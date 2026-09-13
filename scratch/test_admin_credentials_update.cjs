const assert = require('assert');
const path = require('path');
const rootDir = 'c:/Users/acer/Desktop/abdi';
const dotenv = require(`${rootDir}/node_modules/dotenv`);
dotenv.config({ path: `${rootDir}/backend/.env` });
dotenv.config();

const bcrypt = require(`${rootDir}/node_modules/bcryptjs`);
const jwt = require(`${rootDir}/node_modules/jsonwebtoken`);
const db = require(`${rootDir}/backend/src/db/db`);

const authService = require(`${rootDir}/backend/src/services/auth.service`);

(async () => {
  console.log('========================================================');
  console.log('🔒 TESTING ADMIN CREDENTIAL UPDATE & BCRYPT ENCRYPTION');
  console.log('========================================================\n');

  // 1. Get current active admin
  const adminRes = await db.query('SELECT id, name, email, password_hash FROM admins WHERE is_active = true LIMIT 1');
  assert(adminRes.rows.length > 0, 'Must have at least one active admin in DB');
  const originalAdmin = adminRes.rows[0];
  console.log(`Original Admin: ${originalAdmin.name} (${originalAdmin.email})`);

  // We need a known working password for testing. Let's set a temporary known password for originalAdmin
  const testCurrentPassword = 'CurrentKnownPass123!';
  const initialHash = await bcrypt.hash(testCurrentPassword, 12);
  await db.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [initialHash, originalAdmin.id]);
  console.log('Set initial test password for verification: "CurrentKnownPass123!"');

  // ── TEST 1: Rejection on Wrong Current Password ────────────────────────────
  console.log('\n--- TEST 1: Rejection on Wrong Current Password ---');
  try {
    await authService.updateAdminCredentials(originalAdmin.id, {
      currentPassword: 'WrongPassword999!',
      newPassword: 'ShouldNotWork123!'
    });
    assert.fail('Should have thrown error on wrong current password');
  } catch (err) {
    console.log('Caught expected error:', err.message, `(Status: ${err.status})`);
    assert.strictEqual(err.status, 401, 'Must return status 401');
    assert(err.message.includes('Current password is incorrect'), 'Error message must specify incorrect current password');
    console.log('✅ TEST 1 PASSED: Unauthorized update was strictly blocked!');
  }

  // ── TEST 2: Successful Credential Update with Correct Current Password ─────
  console.log('\n--- TEST 2: Successful Credential Update ---');
  const newEmail = 'abdi.storeowner@test.com';
  const newPassword = 'AbdiPrivateSecret2026!';
  const newName = 'Abdi Store Owner';

  const updateResult = await authService.updateAdminCredentials(originalAdmin.id, {
    currentPassword: testCurrentPassword,
    newEmail,
    newPassword,
    name: newName
  });

  assert(updateResult.admin, 'Must return updated admin object');
  assert.strictEqual(updateResult.admin.email, newEmail, 'Email must be updated');
  assert.strictEqual(updateResult.admin.name, newName, 'Name must be updated');
  assert(updateResult.token, 'Must issue a fresh JWT token');

  // Verify in PostgreSQL database
  const verifyDb = await db.query('SELECT name, email, password_hash FROM admins WHERE id = $1', [originalAdmin.id]);
  const dbRecord = verifyDb.rows[0];
  assert.strictEqual(dbRecord.email, newEmail, 'PostgreSQL email must match');
  assert.strictEqual(dbRecord.name, newName, 'PostgreSQL name must match');
  assert.notStrictEqual(dbRecord.password_hash, initialHash, 'Password hash in DB must be changed');

  // Verify bcrypt hash matches new password
  const bcryptMatchesNew = await bcrypt.compare(newPassword, dbRecord.password_hash);
  assert(bcryptMatchesNew, 'bcrypt.compare with new password must return true');

  // Verify bcrypt hash DOES NOT match old password
  const bcryptMatchesOld = await bcrypt.compare(testCurrentPassword, dbRecord.password_hash);
  assert(!bcryptMatchesOld, 'bcrypt.compare with old password must return false');

  console.log('Updated DB Record:');
  console.log(`- Email: ${dbRecord.email}`);
  console.log(`- Password Hash: ${dbRecord.password_hash.substring(0, 25)}... (Encrypted)`);
  console.log('✅ TEST 2 PASSED: Password securely hashed with bcrypt and email updated!');

  // ── TEST 3: Login with Old Password Must Fail ─────────────────────────────
  console.log('\n--- TEST 3: Login with Old Password Must Fail ---');
  try {
    await authService.loginAdmin(newEmail, testCurrentPassword);
    assert.fail('Should not be able to log in with old password');
  } catch (err) {
    console.log('Caught expected error:', err.message, `(Status: ${err.status})`);
    assert.strictEqual(err.status, 401);
    console.log('✅ TEST 3 PASSED: Old password successfully invalidated!');
  }

  // ── TEST 4: Login with New Credentials Must Succeed ───────────────────────
  console.log('\n--- TEST 4: Login with New Credentials ---');
  const loginResult = await authService.loginAdmin(newEmail, newPassword);
  assert(loginResult.token, 'Login must return valid JWT token');
  assert.strictEqual(loginResult.admin.email, newEmail);
  console.log('Login successful for:', loginResult.admin.email);
  console.log('✅ TEST 4 PASSED: Client can log in with their new private credentials!');

  // ── TEST 5: Restore Original Admin State ─────────────────────────────────
  console.log('\n--- TEST 5: Clean Up / Restoring Original Admin State ---');
  await db.query(
    'UPDATE admins SET name = $1, email = $2, password_hash = $3 WHERE id = $4',
    [originalAdmin.name, originalAdmin.email, originalAdmin.password_hash, originalAdmin.id]
  );
  console.log(`Restored original admin: ${originalAdmin.name} (${originalAdmin.email})`);
  console.log('✅ TEST 5 PASSED: Database cleanly restored.');

  console.log('\n========================================================');
  console.log('🎉 ALL ADMIN CREDENTIALS & SECURITY TESTS PASSED 100%!');
  console.log('========================================================');
  process.exit(0);
})();
