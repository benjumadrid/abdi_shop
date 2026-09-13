const orderService = require('../services/order.service');
const {
  isValidUuid,
  validateOrderStatus,
  validatePagination
} = require('../utils/validators');

/**
 * GET /api/admin/orders
 * Admin: Retrieves paginated orders list with optional status and date filters.
 */
async function getAdminOrders(req, res, next) {
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
      const statusValidation = validateOrderStatus(req.query.status);
      if (!statusValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: statusValidation.message
        });
      }
      status = statusValidation.status;
    }

    const date = req.query.date ? req.query.date.trim() : null;

    const result = await orderService.getAdminOrders({
      status,
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
      data: result.orders
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/orders/:id
 * Admin: Retrieves complete order details including admin note and payments.
 */
async function getAdminOrderById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format. Must be a valid UUID.'
      });
    }

    const order = await orderService.getOrderById(id, { isAdmin: true });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/orders/:id/status
 * Admin: Updates the status of an order.
 */
async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format. Must be a valid UUID.'
      });
    }

    const statusValidation = validateOrderStatus(req.body.status);
    if (!statusValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: statusValidation.message
      });
    }

    const updated = await orderService.updateOrderStatus(id, statusValidation.status);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/orders/:id/note
 * Admin: Updates private administrative note for an order.
 */
async function updateAdminNote(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format. Must be a valid UUID.'
      });
    }

    if (req.body.admin_note !== undefined && req.body.admin_note !== null && typeof req.body.admin_note !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'admin_note must be a string or null'
      });
    }

    const updated = await orderService.updateAdminNote(id, req.body.admin_note);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin note updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateAdminNote
};
