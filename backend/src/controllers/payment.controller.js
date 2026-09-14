const paymentService = require('../services/payment.service');
const { isValidUuid, validatePaymentSubmission, validateImageBuffer } = require('../utils/validators');

/**
 * GET /api/payment-methods
 * Public: Returns configured payment methods (e.g. Telebirr info from admin_settings, cash).
 */
async function getPaymentMethods(req, res, next) {
  try {
    const data = await paymentService.getPaymentMethods();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/upload-proof (and /api/payments/upload)
 * Public: Customer uploads a Telebirr screenshot for an existing order.
 */
async function uploadPaymentProof(req, res, next) {
  try {
    const orderId = req.body.order_id || req.query.order_id;

    if (!orderId || !isValidUuid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid order_id (UUID) is required.'
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a payment screenshot file (JPEG, PNG, or WEBP).'
      });
    }

    // Deep validation using magic bytes
    const check = validateImageBuffer(req.file.buffer, req.file.mimetype);
    if (!check.isValid) {
      return res.status(400).json({
        success: false,
        message: check.message
      });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const saved = await paymentService.savePaymentProofFile({
      orderId,
      fileBuffer: req.file.buffer,
      mimeType: check.detectedType,
      extension: check.extension,
      originalName: req.file.originalname,
      baseUrl
    });

    return res.status(201).json({
      success: true,
      message: 'Payment screenshot uploaded successfully.',
      data: saved
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
 * GET /api/payments/proof/:fileId
 * Public: Serves the uploaded payment proof screenshot directly from persistent storage.
 */
async function getPaymentProofFile(req, res, next) {
  try {
    const { fileId } = req.params;

    if (!isValidUuid(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file ID format. Must be a valid UUID.'
      });
    }

    const file = await paymentService.getPaymentProofFile(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Payment proof file not found.'
      });
    }

    const etag = `"${file.id}"`;
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }

    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.file_size);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(file.file_data);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments
 * Public: Customer submits a payment attempt for an order. Supports both JSON and multipart form data.
 */
async function submitPayment(req, res, next) {
  try {
    // If an image file was attached via multipart, upload and associate it
    if (req.file && req.file.buffer) {
      const orderId = req.body.order_id;
      if (!orderId || !isValidUuid(orderId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid order_id (UUID) is required when uploading payment screenshot.'
        });
      }

      const check = validateImageBuffer(req.file.buffer, req.file.mimetype);
      if (!check.isValid) {
        return res.status(400).json({
          success: false,
          message: check.message
        });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const saved = await paymentService.savePaymentProofFile({
        orderId,
        fileBuffer: req.file.buffer,
        mimeType: check.detectedType,
        extension: check.extension,
        originalName: req.file.originalname,
        baseUrl
      });

      req.body.payment_proof_url = saved.file_url;
    }

    const validation = validatePaymentSubmission(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment data',
        errors: validation.errors
      });
    }

    const payment = await paymentService.submitPayment(req.body);

    return res.status(201).json({
      success: true,
      message: 'Payment submitted successfully',
      data: payment
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
 * GET /api/payments/order/:orderId
 * Public: Returns customer-safe payment status and history for an order. Excludes admin notes.
 */
async function getPaymentByOrderId(req, res, next) {
  try {
    const { orderId } = req.params;

    if (!isValidUuid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format. Must be a valid UUID.'
      });
    }

    const result = await paymentService.getPaymentByOrderId(orderId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaymentMethods,
  submitPayment,
  getPaymentByOrderId,
  uploadPaymentProof,
  getPaymentProofFile
};
