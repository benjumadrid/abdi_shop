const orderService = require('../services/order.service');
const { isValidUuid, validateOrderCreate } = require('../utils/validators');

/**
 * POST /api/orders
 * Public / Customer: Places a new customer order.
 */
async function createOrder(req, res, next) {
  try {
    const validation = validateOrderCreate(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data',
        errors: validation.errors
      });
    }

    const order = await orderService.createOrder(req.body);

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
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
 * GET /api/orders/:id
 * Public / Customer: Retrieves order details by UUID. Excludes private admin fields.
 */
async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format. Must be a valid UUID.'
      });
    }

    const order = await orderService.getOrderById(id, { isAdmin: false });

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
 * GET /api/orders/number/:orderNumber
 * Public / Customer: Retrieves order details by order number. Excludes private admin fields.
 */
async function getOrderByNumber(req, res, next) {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber || typeof orderNumber !== 'string' || orderNumber.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Order number is required.'
      });
    }

    const order = await orderService.getOrderByNumber(orderNumber.trim(), { isAdmin: false });

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
 * POST /api/orders/lookup
 * Public / Customer: Secure lookup requiring BOTH order_number and phone.
 */
async function lookupOrder(req, res, next) {
  try {
    const { order_number, phone } = req.body || {};

    if (!order_number || typeof order_number !== 'string' || order_number.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Order number is required.'
      });
    }

    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Customer phone number is required.'
      });
    }

    const order = await orderService.lookupCustomerOrder({
      order_number: order_number.trim(),
      phone: phone.trim()
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'No matching order found with the provided order number and phone number.'
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

module.exports = {
  lookupOrder,
  createOrder,
  getOrderById,
  getOrderByNumber
};
