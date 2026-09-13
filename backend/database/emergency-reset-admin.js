/**
 * Developer Emergency Admin Password Reset Script
 * 
 * Usage:
 *   node backend/database/emergency-reset-admin.js [email] [newPassword]
 * 
 * Examples:
 *   node backend/database/emergency-reset-admin.js
 *   node backend/database/emergency-reset-admin.js abdi@gmail.com NewSecret123!
 */

const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const SALT_ROUNDS = 12;

async function emergencyReset() {
  console.log('========================================================');
  console.log('🚨 EMERGENCY ADMIN CREDENTIAL RESET');
  console.log('========================================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('[ERROR] DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const args = process.argv.slice(2);
  let targetEmail = args[0];
  let targetPassword = args[1];

  try {
    const client = await pool.connect();

    // If no email specified, find the first active admin in the database
    if (!targetEmail) {
      const adminRes = await client.query('SELECT id, email, name FROM admins WHERE is_active = true ORDER BY created_at ASC LIMIT 1');
      if (adminRes.rows.length === 0) {
        console.error('[ERROR] No active admin found in the database.');
        client.release();
        process.exit(1);
      }
      targetEmail = adminRes.rows[0].email;
      console.log(`[INFO] No email provided. Defaulting to first active admin: "${targetEmail}" (${adminRes.rows[0].name})`);
    }

    if (!targetPassword) {
      targetPassword = 'TempAdminPassword2026!';
      console.log(`[INFO] No password provided. Using temporary password: "${targetPassword}"`);
    }

    if (targetPassword.length < 6) {
      console.error('[ERROR] Password must be at least 6 characters.');
      client.release();
      process.exit(1);
    }

    console.log(`\nHashing password using bcrypt (${SALT_ROUNDS} rounds)...`);
    const passwordHash = await bcrypt.hash(targetPassword, SALT_ROUNDS);

    const updateRes = await client.query(
      `UPDATE admins 
       SET password_hash = $1, is_active = true, updated_at = NOW() 
       WHERE LOWER(email) = LOWER($2) 
       RETURNING id, name, email, role, updated_at`,
      [passwordHash, targetEmail]
    );

    if (updateRes.rows.length === 0) {
      console.error(`[ERROR] No admin found with email "${targetEmail}".`);
      client.release();
      process.exit(1);
    }

    const updated = updateRes.rows[0];
    console.log('\n✅ ADMIN CREDENTIALS RESET SUCCESSFULLY!');
    console.log('--------------------------------------------------------');
    console.log(`Admin Name:     ${updated.name}`);
    console.log(`Admin Email:    ${updated.email}`);
    console.log(`New Password:   ${targetPassword}`);
    console.log(`Updated At:     ${updated.updated_at}`);
    console.log('--------------------------------------------------------');
    console.log('\n💡 Provide these temporary credentials to the client.');
    console.log('Instruct them to log in and immediately update their password in "Account & Security".\n');

    client.release();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Failed to reset admin credentials:', err.message);
    await pool.end();
    process.exit(1);
  }
}

emergencyReset();
