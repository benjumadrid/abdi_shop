const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runPaymentsMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting payments schema migration...');
    await client.query('BEGIN');

    // 1. Safely update payment method check constraint from ('telebirr', 'cash') to ('cbe', 'cash')
    console.log('Updating payment method constraint...');
    await client.query(`
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
      ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('cbe', 'cash'));
    `);

    // 2. Add reviewed_by, reviewed_at, and customer_message columns
    console.log('Adding reviewed_by, reviewed_at, and customer_message columns...');
    await client.query(`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES admins(id);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_message TEXT;
    `);

    // 3. Seed CBE account settings into admin_settings
    console.log('Seeding CBE payment configuration in admin_settings...');
    await client.query(`
      INSERT INTO admin_settings (setting_key, setting_value)
      VALUES 
        ('cbe_account_number', '1000255667897'),
        ('cbe_account_name', 'Abdi Commercial Account'),
        ('cbe_bank_name', 'Commercial Bank of Ethiopia')
      ON CONFLICT (setting_key) DO UPDATE
      SET setting_value = EXCLUDED.setting_value,
          updated_at = NOW();
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully executed payments migration.');

    // Verification
    console.log('\n--- VERIFICATION: PAYMENTS TABLE ---');
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'payments'
      ORDER BY ordinal_position;
    `);
    console.log('Payments columns:', cols.rows.map(r => r.column_name).join(', '));

    const checkConstraints = await client.query(`
      SELECT tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'payments';
    `);
    checkConstraints.rows.forEach(c => {
      console.log(`Constraint ${c.constraint_name}: ${c.check_clause}`);
    });

    console.log('\n--- VERIFICATION: ADMIN SETTINGS ---');
    const settings = await client.query(`
      SELECT setting_key, setting_value
      FROM admin_settings
      WHERE setting_key LIKE 'cbe_%';
    `);
    settings.rows.forEach(s => {
      console.log(`Setting [${s.setting_key}]: ${s.setting_value}`);
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

runPaymentsMigration();
