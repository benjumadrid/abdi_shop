/**
 * Migration Script: Add CBE & Bank of Abyssinia Payment Methods
 */
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in environment.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('🚀 Starting payment methods migration...');
    await client.query('BEGIN');

    // 1. Drop existing payments_method_check constraint
    console.log('1. Updating payments table constraint...');
    await client.query(`
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
      ALTER TABLE payments ADD CONSTRAINT payments_method_check 
        CHECK (method IN ('telebirr', 'cbe', 'abyssinia', 'cash'));
    `);

    // 2. Ensure admin_settings has entries for all accounts
    console.log('2. Seeding CBE & Bank of Abyssinia settings...');
    const settings = [
      { key: 'cbe_account_number', value: '1000584744573' },
      { key: 'cbe_account_name', value: 'Behrdin seid' },
      { key: 'abyssinia_account_number', value: '251444412' },
      { key: 'abyssinia_account_name', value: 'Abdulhafiz sani' },
      { key: 'cash_advance_amount', value: '200' }
    ];

    for (const s of settings) {
      await client.query(`
        INSERT INTO admin_settings (setting_key, setting_value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
      `, [s.key, s.value]);
    }

    // 3. Update admin display name to Abdela if it was Abdi
    console.log('3. Updating admin name to Abdela...');
    await client.query(`
      UPDATE admins
      SET name = 'Abdela'
      WHERE name ILIKE '%abdi%' OR email ILIKE '%abdiadmin%';
    `);

    await client.query('COMMIT');
    console.log('✅ Payment methods migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
