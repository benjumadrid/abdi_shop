/**
 * Admin Setup Script
 * 
 * Creates or updates the initial admin account using environment variables.
 * Run with: npm run admin:setup
 * 
 * Required environment variables:
 *   ADMIN_EMAIL    - Admin email address
 *   ADMIN_PASSWORD - Admin password (minimum 8 characters)
 * 
 * Optional environment variables:
 *   ADMIN_NAME     - Admin display name (default: 'Abdi Admin')
 */

const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Load environment from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const SALT_ROUNDS = 12;

async function setupAdmin() {
  console.log('=== ADMIN SETUP ===\n');

  // Validate environment variables
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Abdi Admin';

  if (!email || email.trim() === '') {
    console.error('[ERROR] ADMIN_EMAIL environment variable is required.');
    console.error('Add ADMIN_EMAIL=your@email.com to backend/.env');
    process.exit(1);
  }

  if (!password || password.trim() === '') {
    console.error('[ERROR] ADMIN_PASSWORD environment variable is required.');
    console.error('Add ADMIN_PASSWORD=yourpassword to backend/.env');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('[ERROR] ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('[ERROR] DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Hash password
    console.log('[Setup] Hashing password...');
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Upsert admin: insert if email doesn't exist, update password if it does
    const result = await pool.query(`
      INSERT INTO admins (name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, 'admin', TRUE)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING id, name, email, role, is_active, created_at, updated_at;
    `, [name.trim(), email.trim().toLowerCase(), passwordHash]);

    const admin = result.rows[0];

    console.log('[Setup] Admin account ready:\n');
    console.log(`  ID:       ${admin.id}`);
    console.log(`  Name:     ${admin.name}`);
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Role:     ${admin.role}`);
    console.log(`  Active:   ${admin.is_active}`);
    console.log(`  Created:  ${admin.created_at}`);
    console.log(`  Updated:  ${admin.updated_at}`);
    console.log('\n=== ADMIN SETUP COMPLETE ===');

  } catch (err) {
    console.error('[ERROR] Admin setup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupAdmin();
