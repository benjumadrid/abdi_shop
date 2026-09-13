const express = require('express');
const router = express.Router();
const adminOrderController = require('../controllers/admin.order.controller');

// =========================================================================
// ADMIN ORDER ROUTES
//
// All routes below require admin authentication.
// =========================================================================

const { requireAdminAuth } = require('../middleware/auth');
router.use(requireAdminAuth);

/**
 * @route   GET /api/admin/orders
 * @desc    Get paginated orders list with status/date filters
 * @access  Admin (Auth to be attached)
 */
router.get('/', adminOrderController.getAdminOrders);

/**
 * @route   GET /api/admin/orders/:id
 * @desc    Get complete order details including admin_note and payment info
 * @access  Admin (Auth to be attached)
 */
router.get('/:id', adminOrderController.getAdminOrderById);

/**
 * @route   PATCH /api/admin/orders/:id/status
 * @desc    Update order status
 * @access  Admin (Auth to be attached)
 */
router.patch('/:id/status', adminOrderController.updateOrderStatus);

/**
 * @route   PATCH /api/admin/orders/:id/note
 * @desc    Update private administrative note
 * @access  Admin (Auth to be attached)
 */
router.patch('/:id/note', adminOrderController.updateAdminNote);

module.exports = router;
