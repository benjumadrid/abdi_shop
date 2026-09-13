const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAdminAuth } = require('../middleware/auth');
const { adminLoginLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/admin/auth/login
 * @desc    Authenticate admin and return JWT token
 * @access  Public (Rate limited)
 */
router.post('/login', adminLoginLimiter, authController.login);

/**
 * @route   GET /api/admin/auth/me
 * @desc    Get current admin profile
 * @access  Admin (requires valid JWT)
 */
router.get('/me', requireAdminAuth, authController.getMe);

/**
 * @route   POST /api/admin/auth/logout
 * @desc    Logout (client discards token)
 * @access  Admin (requires valid JWT)
 */
router.post('/logout', requireAdminAuth, authController.logout);

/**
 * @route   PUT /api/admin/auth/credentials
 * @desc    Update admin credentials (email, name, password)
 * @access  Admin (requires valid JWT)
 */
router.put('/credentials', requireAdminAuth, authController.updateCredentials);

module.exports = router;
