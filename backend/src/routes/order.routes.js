const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { orderSubmissionLimiter } = require('../middleware/rateLimiter');

// =========================================================================
// PUBLIC / CUSTOMER ORDER ROUTES
// Accessible to customers placing orders or tracking their order status.
// =========================================================================

/**
 * @route   POST /api/orders
 * @desc    Create a new customer order
 * @access  Public (Rate limited)
 */
router.post('/', orderSubmissionLimiter, orderController.createOrder);

/**
 * @route   GET /api/orders/number/:orderNumber
 * @desc    Get order details by human-friendly order number (e.g. ORD-20260906-0001)
 * @access  Public
 */
router.get('/number/:orderNumber', orderController.getOrderByNumber);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order details by UUID
 * @access  Public
 */
router.get('/:id', orderController.getOrderById);

/**
 * @route   POST /api/orders/lookup
 * @desc    Secure customer order lookup by order_number AND customer phone
 * @access  Public (Rate limited)
 */
router.post('/lookup', orderSubmissionLimiter, orderController.lookupOrder);

module.exports = router;
