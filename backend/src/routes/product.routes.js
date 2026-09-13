const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const productMediaController = require('../controllers/product.media.controller');
const { handleProductMediaUpload } = require('../middleware/upload');
const { requireAdminAuth } = require('../middleware/auth');

// =========================================================================
// 1. PUBLIC / CUSTOMER PRODUCT & MEDIA ROUTES
// Accessible by anyone viewing the shop.
// =========================================================================

/**
 * @route   GET /api/products/media/:mediaId
 * @desc    Serve the binary image or video file
 * @access  Public
 */
router.get('/media/:mediaId', productMediaController.serveProductMedia);

/**
 * @route   GET /api/products/:productId/media
 * @desc    Get all media items for a product ordered by sort_order
 * @access  Public
 */
router.get('/:productId/media', productMediaController.getProductMedia);

/**
 * @route   GET /api/products
 * @desc    Get all available products (default: is_available = true)
 * @access  Public
 */
router.get('/', productController.getProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by UUID (default: only if is_available = true)
 * @access  Public
 */
router.get('/:id', productController.getProductById);

// =========================================================================
// 2. ADMIN PRODUCT & MEDIA ROUTES
// All routes below this point require admin authentication.
// =========================================================================

router.use(requireAdminAuth);

/**
 * @route   POST /api/products/:productId/media
 * @desc    Upload an image or video for a product
 * @access  Admin
 */
router.post('/:productId/media', handleProductMediaUpload, productMediaController.uploadProductMedia);

/**
 * @route   PATCH /api/products/media/:mediaId
 * @desc    Update sort_order or is_primary of a media item
 * @access  Admin
 */
router.patch('/media/:mediaId', productMediaController.updateProductMedia);

/**
 * @route   PUT /api/products/:productId/media/reorder
 * @desc    Bulk reorder media items for a product
 * @access  Admin
 */
router.put('/:productId/media/reorder', productMediaController.reorderProductMedia);

/**
 * @route   DELETE /api/products/media/:mediaId
 * @desc    Delete a product media item
 * @access  Admin
 */
router.delete('/media/:mediaId', productMediaController.deleteProductMedia);

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Admin
 */
router.post('/', productController.createProduct);

/**
 * @route   PATCH /api/products/:id
 * @desc    Update an existing product by UUID
 * @access  Admin
 */
router.patch('/:id', productController.updateProduct);

/**
 * @route   DELETE /api/products/:id
 * @desc    Safely delete a product (prevents deleting products with historical orders)
 * @access  Admin
 */
router.delete('/:id', productController.deleteProduct);

module.exports = router;
