const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateTelebirrSettings() {
  const client = await pool.connect();
  try {
    console.log('[Update] Updating Telebirr settings in admin_settings...');
    await client.query('BEGIN');

    const updateQuery = `
      INSERT INTO admin_settings (setting_key, setting_value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (setting_key) DO UPDATE
      SET setting_value = EXCLUDED.setting_value,
          updated_at = NOW();
    `;

    await client.query(updateQuery, ['telebirr_account_number', '0931862253']);
    await client.query(updateQuery, ['telebirr_account_name', 'Nuru']);

    await client.query('COMMIT');
    console.log('[Update] Telebirr settings updated successfully in admin_settings.');

    // Verification from DB
    const res = await client.query(`
      SELECT setting_key, setting_value, updated_at
      FROM admin_settings
      WHERE setting_key IN ($1, $2)
      ORDER BY setting_key;
    `, ['telebirr_account_number', 'telebirr_account_name']);

    console.log('\n--- VERIFICATION FROM DATABASE ---');
    res.rows.forEach(r => {
      console.log(`${r.setting_key}: ${r.setting_value} (updated at: ${r.updated_at})`);
    });

  } catch (err) { 
    await client.query('ROLLBACK');
    console.error('[Update Error]', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateTelebirrSettings();
