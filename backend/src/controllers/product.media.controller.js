const productMediaService = require('../services/product.media.service');
const { isValidUuid, validateProductMediaBuffer } = require('../utils/validators');

/**
 * POST /api/products/:productId/media
 * Admin: Upload an image or video for a product.
 */
async function uploadProductMedia(req, res, next) {
  try {
    const { productId } = req.params;

    if (!productId || !isValidUuid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.'
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an image (JPEG, PNG, WEBP) or video (MP4, WEBM) file.'
      });
    }

    // Verify magic bytes and media type limits
    const check = validateProductMediaBuffer(req.file.buffer, req.file.mimetype);
    if (!check.isValid) {
      return res.status(400).json({
        success: false,
        message: check.message
      });
    }

    const sortOrder = req.body.sort_order !== undefined ? parseInt(req.body.sort_order, 10) : null;
    const isPrimary = req.body.is_primary !== undefined ? (req.body.is_primary === 'true' || req.body.is_primary === true) : null;

    const media = await productMediaService.uploadProductMedia({
      productId,
      fileBuffer: req.file.buffer,
      mediaType: check.mediaType,
      mimeType: check.mimeType,
      extension: check.extension,
      originalName: req.file.originalname,
      sortOrder,
      isPrimary
    });

    return res.status(201).json({
      success: true,
      message: 'Product media uploaded successfully',
      data: media
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
 * GET /api/products/:productId/media
 * Public: List all media items for a product ordered by sort_order.
 */
async function getProductMedia(req, res, next) {
  try {
    const { productId } = req.params;

    if (!productId || !isValidUuid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.'
      });
    }

    const media = await productMediaService.getProductMediaByProductId(productId);

    return res.status(200).json({
      success: true,
      count: media.length,
      data: media
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
 * GET /api/products/media/:mediaId
 * Public: Stream the binary image or video file.
 */
async function serveProductMedia(req, res, next) {
  try {
    const { mediaId } = req.params;

    if (!mediaId || !isValidUuid(mediaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media ID format. Must be a valid UUID.'
      });
    }

    const media = await productMediaService.getProductMediaById(mediaId);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Product media not found.'
      });
    }

    res.setHeader('Content-Type', media.mime_type);
    res.setHeader('Content-Length', media.file_size);
    res.setHeader('Content-Disposition', `inline; filename="${media.filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(media.file_data);

  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/products/media/:mediaId
 * Admin: Update sort_order or is_primary of a media item.
 */
async function updateProductMedia(req, res, next) {
  try {
    const { mediaId } = req.params;

    if (!mediaId || !isValidUuid(mediaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media ID format. Must be a valid UUID.'
      });
    }

    const { sort_order, is_primary } = req.body;
    const updated = await productMediaService.updateProductMedia(mediaId, { sort_order, is_primary });

    return res.status(200).json({
      success: true,
      message: 'Product media updated successfully',
      data: updated
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
 * PUT /api/products/:productId/media/reorder
 * Admin: Bulk reorder media items for a product.
 */
async function reorderProductMedia(req, res, next) {
  try {
    const { productId } = req.params;

    if (!productId || !isValidUuid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.'
      });
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items must be an array of media ordering objects.'
      });
    }

    const reordered = await productMediaService.reorderProductMedia(productId, items);

    return res.status(200).json({
      success: true,
      message: 'Product media reordered successfully',
      data: reordered
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
 * DELETE /api/products/media/:mediaId
 * Admin: Delete a product media item.
 */
async function deleteProductMedia(req, res, next) {
  try {
    const { mediaId } = req.params;

    if (!mediaId || !isValidUuid(mediaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media ID format. Must be a valid UUID.'
      });
    }

    const result = await productMediaService.deleteProductMedia(mediaId);

    return res.status(200).json({
      success: true,
      message: 'Product media deleted successfully',
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
  uploadProductMedia,
  getProductMedia,
  serveProductMedia,
  updateProductMedia,
  reorderProductMedia,
  deleteProductMedia
};
