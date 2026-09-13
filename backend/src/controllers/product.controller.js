const productService = require('../services/product.service');
const {
  isValidUuid,
  validateProductCreate,
  validateProductUpdate
} = require('../utils/validators');

/**
 * GET /api/products
 * Customer/Public: Retrieves all available products.
 * Admin (optional query ?include_unavailable=true): Can view all products.
 */
async function getProducts(req, res, next) {
  try {
    // Default to including all catalog items so out-of-stock products remain visible with status notices
    const includeUnavailable = req.query.include_unavailable !== 'false';
    const products = await productService.getProducts({ includeUnavailable });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/products/:id
 * Customer/Public: Retrieves one available product by UUID.
 */
async function getProductById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.'
      });
    }

    // Allow customer to view product details even if out of stock
    const includeUnavailable = req.query.include_unavailable !== 'false';
    const product = await productService.getProductById(id, { includeUnavailable });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/products
 * Admin: Creates a new product.
 */
async function createProduct(req, res, next) {
  try {
    const validation = validateProductCreate(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product data',
        errors: validation.errors
      });
    }

    const newProduct = await productService.createProduct(req.body);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/products/:id
 * Admin: Updates specified fields of an existing product.
 */
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.'
      });
    }

    const validation = validateProductUpdate(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product data',
        errors: validation.errors
      });
    }

    const updatedProduct = await productService.updateProduct(id, req.body);

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/products/:id
 * Admin: Deletes product if unreferenced; blocks if historical order references exist.
 */
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.'
      });
    }

    const result = await productService.deleteProduct(id);

    if (result.status === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (result.status === 'referenced') {
      return res.status(409).json({
        success: false,
        message: `Cannot permanently delete product "${result.productName}" because it is referenced in ${result.orderCount} historical order item(s). We recommend setting is_available to false to archive it instead.`,
        is_referenced: true,
        order_count: result.orderCount
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product permanently deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
