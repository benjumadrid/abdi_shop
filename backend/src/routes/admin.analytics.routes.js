const express = require('express');
const router = express.Router();
const adminAnalyticsController = require('../controllers/admin.analytics.controller');
const { requireAdminAuth } = require('../middleware/auth');

// All analytics routes require admin authentication
router.use(requireAdminAuth);

/**
 * @route   GET /api/admin/analytics/overview
 * @desc    Get comprehensive live store metrics and real-time facts for Admin AI Copilot
 * @access  Admin
 */
router.get('/overview', adminAnalyticsController.getOverviewAnalytics);

module.exports = router;
