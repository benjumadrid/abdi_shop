const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runOrdersMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting orders schema migration...');
    await client.query('BEGIN');

    // 1. Add unique constraint on customers.phone for safe customer reuse
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'customers_phone_unique'
        ) THEN
          ALTER TABLE customers ADD CONSTRAINT customers_phone_unique UNIQUE (phone);
        END IF;
      END $$;
    `);

    // 2. Add sequence for concurrency-safe order numbers
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully added customers_phone_unique constraint and order_number_seq.');

    // Verification
    const constraintCheck = await client.query(`
      SELECT conname FROM pg_constraint WHERE conname = 'customers_phone_unique';
    `);
    console.log('Constraint customers_phone_unique exists:', constraintCheck.rowCount > 0);

    const seqCheck = await client.query(`
      SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::text, 4, '0') AS sample_order_number;
    `);
    console.log('Sample order number generated:', seqCheck.rows[0].sample_order_number);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runOrdersMigration();
