const paymentService = require('../services/payment.service');
const {
  isValidUuid,
  validatePagination,
  validatePaymentReject,
  ALLOWED_PAYMENT_STATUSES,
  ALLOWED_PAYMENT_METHODS
} = require('../utils/validators');

/**
 * GET /api/admin/payments
 * Admin: List payments with pagination, status, method, and date filters.
 */
async function getAdminPayments(req, res, next) {
  try {
    const pagination = validatePagination(req.query.page, req.query.limit);
    if (!pagination.isValid) {
      return res.status(400).json({
        success: false,
        message: pagination.message
      });
    }

    let status = null;
    if (req.query.status) {
      const normalizedStatus = req.query.status.trim().toLowerCase();
      if (!ALLOWED_PAYMENT_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter "${req.query.status}". Allowed values: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`
        });
      }
      status = normalizedStatus;
    }

    let method = null;
    if (req.query.method) {
      const normalizedMethod = req.query.method.trim().toLowerCase();
      if (!ALLOWED_PAYMENT_METHODS.includes(normalizedMethod)) {
        return res.status(400).json({
          success: false,
          message: `Invalid method filter "${req.query.method}". Allowed values: ${ALLOWED_PAYMENT_METHODS.join(', ')}`
        });
      }
      method = normalizedMethod;
    }

    const date = req.query.date ? req.query.date.trim() : null;

    const result = await paymentService.getAdminPayments({
      status,
      method,
      date,
      limit: pagination.limit,
      offset: pagination.offset
    });

    return res.status(200).json({
      success: true,
      pagination: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
        total_pages: Math.ceil(result.total / pagination.limit)
      },
      data: result.payments
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/payments/:id
 * Admin: View full payment details including order, customer, and items.
 */
async function getAdminPaymentById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID format. Must be a valid UUID.'
      });
    }

    const payment = await paymentService.getAdminPaymentById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: payment
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/payments/:id/verify
 * Admin: Verifies a pending payment and confirms the linked order.
 */
async function verifyPayment(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID format. Must be a valid UUID.'
      });
    }

    const result = await paymentService.verifyPayment(id, {
      adminId: req.admin ? req.admin.id : null
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: result
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
 * PATCH /api/admin/payments/:id/reject
 * Admin: Rejects a pending payment and moves order back to pending if in payment_review.
 */
async function rejectPayment(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID format. Must be a valid UUID.'
      });
    }

    const validation = validatePaymentReject(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reject data',
        errors: validation.errors
      });
    }

    const { admin_note, customer_message } = req.body || {};

    const result = await paymentService.rejectPayment(id, {
      admin_note,
      customer_message,
      adminId: req.admin ? req.admin.id : null
    });

    return res.status(200).json({
      success: true,
      message: 'Payment rejected successfully',
      data: result
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
  getAdminPayments,
  getAdminPaymentById,
  verifyPayment,
  rejectPayment
};
