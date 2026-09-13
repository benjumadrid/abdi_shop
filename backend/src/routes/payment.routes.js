const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { handleScreenshotUpload } = require('../middleware/upload');
const { orderSubmissionLimiter } = require('../middleware/rateLimiter');

// =========================================================================
// PUBLIC / CUSTOMER PAYMENT ROUTES
// =========================================================================

/**
 * @route   POST /api/payments/upload-proof
 * @desc    Upload Telebirr payment screenshot (multipart/form-data)
 * @access  Public (Rate limited)
 */
router.post('/upload-proof', orderSubmissionLimiter, handleScreenshotUpload, paymentController.uploadPaymentProof);
router.post('/upload', orderSubmissionLimiter, handleScreenshotUpload, paymentController.uploadPaymentProof);

/**
 * @route   GET /api/payments/proof/:fileId
 * @desc    Retrieve uploaded payment proof image
 * @access  Public
 */
router.get('/proof/:fileId', paymentController.getPaymentProofFile);

/**
 * @route   POST /api/payments
 * @desc    Submit payment proof for an order (Telebirr transfer or Cash on delivery). Supports JSON and multipart form-data.
 * @access  Public (Rate limited)
 */
router.post('/', orderSubmissionLimiter, handleScreenshotUpload, paymentController.submitPayment);

/**
 * @route   GET /api/payments/order/:orderId
 * @desc    Get payment status and history for an order (customer safe)
 * @access  Public
 */
router.get('/order/:orderId', paymentController.getPaymentByOrderId);

module.exports = router;

