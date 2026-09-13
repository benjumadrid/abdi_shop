const jwt = require('jsonwebtoken');
const db = require('../db/db');

/**
 * Admin authentication middleware.
 * Verifies JWT token from Authorization header and attaches admin info to req.admin.
 *
 * Expected header: Authorization: Bearer <token>
 */
async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.'
      });
    }

    // Validate Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format. Use: Bearer <token>'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Token is empty.'
      });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid or malformed token.'
      });
    }

    // Verify admin still exists and is active in the database
    const result = await db.query(
      'SELECT id, name, email, role, is_active FROM admins WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not found.'
      });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is deactivated.'
      });
    }

    // Attach admin info to request for use by downstream handlers
    req.admin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdminAuth };
