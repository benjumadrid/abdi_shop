const express = require('express');
const router = express.Router();
const adminPaymentController = require('../controllers/admin.payment.controller');

// =========================================================================
// ADMIN PAYMENT ROUTES
//
// All routes below require admin authentication.
// =========================================================================

const { requireAdminAuth } = require('../middleware/auth');
router.use(requireAdminAuth);

/**
 * @route   GET /api/admin/payments
 * @desc    List payments with pagination and status/method filters
 * @access  Admin (Auth to be attached)
 */
router.get('/', adminPaymentController.getAdminPayments);

/**
 * @route   GET /api/admin/payments/:id
 * @desc    Get detailed payment information including order, items, and customer
 * @access  Admin (Auth to be attached)
 */
router.get('/:id', adminPaymentController.getAdminPaymentById);

/**
 * @route   PATCH /api/admin/payments/:id/verify
 * @desc    Verify pending payment and confirm the order
 * @access  Admin (Auth to be attached)
 */
router.patch('/:id/verify', adminPaymentController.verifyPayment);

/**
 * @route   PATCH /api/admin/payments/:id/reject
 * @desc    Reject pending payment with admin_note and customer_message
 * @access  Admin (Auth to be attached)
 */
router.patch('/:id/reject', adminPaymentController.rejectPayment);

module.exports = router;
