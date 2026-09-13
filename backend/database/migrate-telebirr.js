const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runTelebirrMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting Telebirr payment migration...');
    await client.query('BEGIN');

    // 1. Update payment method check constraint from ('cbe', 'cash') to ('telebirr', 'cash')
    console.log('Updating payment method constraint on payments table...');
    await client.query(`
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
      ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('telebirr', 'cash'));
    `);

    // 2. Remove obsolete CBE settings and insert Telebirr settings in admin_settings
    console.log('Updating payment settings in admin_settings...');
    await client.query(`
      DELETE FROM admin_settings WHERE setting_key LIKE 'cbe_%';
    `);

    // Insert Telebirr configuration with NULL values (to be provided by Abdi)
    await client.query(`
      INSERT INTO admin_settings (setting_key, setting_value)
      VALUES 
        ('telebirr_account_number', NULL),
        ('telebirr_account_name', NULL)
      ON CONFLICT (setting_key) DO UPDATE
      SET setting_value = EXCLUDED.setting_value,
          updated_at = NOW();
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully executed Telebirr payment migration.');

    // 3. Verification
    console.log('\n--- VERIFICATION: CHECK CONSTRAINTS ON PAYMENTS ---');
    const checkConstraints = await client.query(`
      SELECT tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'payments';
    `);
    checkConstraints.rows.forEach(c => {
      console.log(`Constraint [${c.constraint_name}]: ${c.check_clause}`);
    });

    console.log('\n--- VERIFICATION: ADMIN SETTINGS ---');
    const settings = await client.query(`
      SELECT setting_key, setting_value
      FROM admin_settings
      ORDER BY setting_key;
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

runTelebirrMigration();
