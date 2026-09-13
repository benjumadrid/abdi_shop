const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

const SALT_ROUNDS = 12;

/**
 * Authenticate admin by email and password.
 * Returns the admin record (without password_hash) and a JWT token.
 */
async function loginAdmin(email, password) {
  // Find admin by email
  const result = await db.query(
    'SELECT id, name, email, password_hash, role, is_active FROM admins WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  const admin = result.rows[0];

  // Check if account is active
  if (!admin.is_active) {
    const error = new Error('Admin account is deactivated');
    error.status = 403;
    throw error;
  }

  // Compare password
  const isMatch = await bcrypt.compare(password, admin.password_hash);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  // Generate JWT
  const token = generateToken(admin);

  // Return admin info (without password_hash) and token
  return {
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    },
    token
  };
}

/**
 * Get admin profile by ID.
 * Used by the /me endpoint.
 */
async function getAdminById(adminId) {
  const result = await db.query(
    'SELECT id, name, email, role, is_active, created_at, updated_at FROM admins WHERE id = $1',
    [adminId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Generate a JWT token for the given admin.
 */
function generateToken(admin) {
  const payload = {
    id: admin.id,
    email: admin.email,
    role: admin.role
  };

  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Hash a plain-text password using bcrypt.
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Update admin credentials (email, name, and/or password).
 * Requires verifying current password first for security.
 */
async function updateAdminCredentials(adminId, { currentPassword, newEmail, newPassword, name }) {
  // Find admin by ID
  const result = await db.query(
    'SELECT id, name, email, password_hash, role, is_active FROM admins WHERE id = $1',
    [adminId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Admin not found');
    error.status = 404;
    throw error;
  }

  const admin = result.rows[0];

  // Verify current password
  if (!currentPassword || typeof currentPassword !== 'string') {
    const error = new Error('Current password is required to save changes');
    error.status = 400;
    throw error;
  }

  const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!isMatch) {
    const error = new Error('Current password is incorrect. Please check and try again.');
    error.status = 401;
    throw error;
  }

  // Check email uniqueness if email is changing
  let targetEmail = admin.email;
  if (newEmail && typeof newEmail === 'string' && newEmail.trim().toLowerCase() !== admin.email.toLowerCase()) {
    const cleanEmail = newEmail.trim().toLowerCase();
    const emailCheck = await db.query(
      'SELECT id FROM admins WHERE email = $1 AND id != $2',
      [cleanEmail, adminId]
    );
    if (emailCheck.rows.length > 0) {
      const error = new Error('This email address is already in use by another admin account');
      error.status = 409;
      throw error;
    }
    targetEmail = cleanEmail;
  }

  // Hash new password if provided
  let targetPasswordHash = admin.password_hash;
  if (newPassword && typeof newPassword === 'string' && newPassword.trim() !== '') {
    if (newPassword.length < 6) {
      const error = new Error('New password must be at least 6 characters long');
      error.status = 400;
      throw error;
    }
    targetPasswordHash = await hashPassword(newPassword);
  }

  // Update name if provided
  const targetName = name && typeof name === 'string' && name.trim() !== '' ? name.trim() : admin.name;

  // Persist updates to PostgreSQL
  const updateResult = await db.query(
    `UPDATE admins 
     SET name = $1, email = $2, password_hash = $3, updated_at = NOW() 
     WHERE id = $4 
     RETURNING id, name, email, role, is_active, updated_at`,
    [targetName, targetEmail, targetPasswordHash, adminId]
  );

  const updatedAdmin = updateResult.rows[0];
  const token = generateToken(updatedAdmin);

  return {
    admin: {
      id: updatedAdmin.id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      role: updatedAdmin.role
    },
    token
  };
}

module.exports = {
  loginAdmin,
  getAdminById,
  generateToken,
  hashPassword,
  updateAdminCredentials
};

