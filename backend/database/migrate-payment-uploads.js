const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runPaymentUploadsMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Creating payment_proof_files table in Neon PostgreSQL...');
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_proof_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payment_proof_files_order_id ON payment_proof_files(order_id);
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully created payment_proof_files table.');

    // Verification
    const checkTable = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_proof_files'
      ORDER BY ordinal_position;
    `);

    console.log('\n--- VERIFICATION: PAYMENT_PROOF_FILES COLUMNS ---');
    checkTable.rows.forEach(col => {
      console.log(`Column: ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runPaymentUploadsMigration();
