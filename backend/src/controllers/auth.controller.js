const authService = require('../services/auth.service');

/**
 * POST /api/admin/auth/login
 * Authenticate admin with email and password, return JWT token.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    // Validate input
    const errors = [];
    if (!email || typeof email !== 'string' || email.trim() === '') {
      errors.push('Email is required');
    } else if (email.trim().length > 255) {
      errors.push('Email cannot exceed 255 characters');
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      errors.push('Password is required');
    } else if (password.length > 255) {
      errors.push('Password cannot exceed 255 characters');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Login validation failed',
        errors
      });
    }

    const result = await authService.loginAdmin(email.trim().toLowerCase(), password);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        admin: result.admin,
        token: result.token
      }
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message
      });
    }
    next(err);
  }
}

/**
 * GET /api/admin/auth/me
 * Return authenticated admin's profile.
 * Requires requireAdminAuth middleware to have run first.
 */
async function getMe(req, res, next) {
  try {
    const admin = await authService.getAdminById(req.admin.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        is_active: admin.is_active,
        created_at: admin.created_at,
        updated_at: admin.updated_at
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/auth/logout
 * Logout endpoint. Since JWT is stateless, the client simply discards the token.
 * This endpoint exists for API completeness and to allow future token blocklisting.
 */
async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please discard your token.'
  });
}

/**
 * PUT /api/admin/auth/credentials
 * Update admin credentials (email, name, and/or password).
 * Requires requireAdminAuth middleware to have run first.
 */
async function updateCredentials(req, res, next) {
  try {
    const { currentPassword, newEmail, newPassword, name } = req.body || {};

    if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Current password is required to verify identity'
      });
    }

    if (newEmail && (typeof newEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim()))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (newPassword && (typeof newPassword !== 'string' || newPassword.length < 6)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const result = await authService.updateAdminCredentials(req.admin.id, {
      currentPassword,
      newEmail,
      newPassword,
      name
    });

    return res.status(200).json({
      success: true,
      message: 'Admin credentials updated successfully',
      data: {
        admin: result.admin,
        token: result.token
      }
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message
      });
    }
    next(err);
  }
}

module.exports = {
  login,
  getMe,
  logout,
  updateCredentials
};

