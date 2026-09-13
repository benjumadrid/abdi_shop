const adminAnalyticsService = require('../services/admin.analytics.service');

/**
 * GET /api/admin/analytics/overview
 * Returns up-to-the-second operational metrics, today's income, inventory status,
 * pending Telebirr payments, and recent orders for Admin AI and dashboard.
 */
async function getOverviewAnalytics(req, res, next) {
  try {
    const data = await adminAnalyticsService.getAdminOverviewAnalytics();
    return res.status(200).json({
      success: true,
      message: 'Admin overview analytics retrieved successfully',
      data
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverviewAnalytics
};
