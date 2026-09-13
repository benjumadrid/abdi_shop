const multer = require('multer');
const { MAX_UPLOAD_FILE_SIZE } = require('../utils/validators');

// Store file in memory to avoid writing unverified files to disk
const storage = multer.memoryStorage();

const uploadInstance = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE // 5 MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      const err = new Error('Unsupported file type. Only JPEG, PNG, and WEBP image files are allowed.');
      err.code = 'INVALID_FILE_TYPE';
      cb(err);
    }
  }
});

/**
 * Flexible middleware that accepts a single image file under any common field name
 * ('screenshot', 'file', 'proof', 'payment_proof_file', etc.) and formats errors cleanly.
 */
function handleScreenshotUpload(req, res, next) {
  uploadInstance.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the maximum limit of 5 MB.'
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed.'
      });
    }

    // Normalize: point req.file to the first uploaded file if any
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }

    next();
  });
}

const { MAX_VIDEO_FILE_SIZE, ALLOWED_PRODUCT_MEDIA_MIMES } = require('../utils/validators');

const productMediaUploadInstance = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_FILE_SIZE // 30 MB max
  },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    const allowed = [...ALLOWED_PRODUCT_MEDIA_MIMES, 'image/jpg'];
    if (allowed.includes(mime)) {
      cb(null, true);
    } else {
      const err = new Error('Unsupported file type. Allowed formats are JPEG, PNG, WEBP for images and MP4, WEBM for videos.');
      err.code = 'INVALID_MEDIA_TYPE';
      cb(err);
    }
  }
});

/**
 * Middleware that accepts product media file (image or video) and formats errors cleanly.
 */
function handleProductMediaUpload(req, res, next) {
  productMediaUploadInstance.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the maximum allowed limit (5 MB for images, 30 MB for videos).'
        });
      }
      if (err.code === 'INVALID_MEDIA_TYPE') {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Product media upload failed.'
      });
    }

    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }

    next();
  });
}

module.exports = {
  handleScreenshotUpload,
  handleProductMediaUpload
};
