/**
 * Validator utilities for Abdi Backend
 */

// Standard UUID format check (8-4-4-4-12 hex digits, accepting any valid UUID version including nil UUID)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a given string is a valid UUID.
 * @param {string} id
 * @returns {boolean}
 */
function isValidUuid(id) {
  if (typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Validates payload for creating a new product.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateProductCreate(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Request body must be a JSON object'] };
  }

  // name_en: required, non-empty string, max 255 chars
  if (!data.name_en || typeof data.name_en !== 'string' || data.name_en.trim() === '') {
    errors.push('name_en is required and cannot be empty');
  } else if (data.name_en.trim().length > 255) {
    errors.push('name_en cannot exceed 255 characters');
  }

  // name_am: required, non-empty string, max 255 chars
  if (!data.name_am || typeof data.name_am !== 'string' || data.name_am.trim() === '') {
    errors.push('name_am is required and cannot be empty');
  } else if (data.name_am.trim().length > 255) {
    errors.push('name_am cannot exceed 255 characters');
  }

  // price: required, valid number >= 0
  if (data.price === undefined || data.price === null || data.price === '') {
    errors.push('price is required');
  } else {
    const numPrice = Number(data.price);
    if (isNaN(numPrice) || !isFinite(numPrice) || numPrice < 0) {
      errors.push('price must be a valid number greater than or equal to 0');
    }
  }

  // is_available: optional, must be boolean if supplied
  if (data.is_available !== undefined && typeof data.is_available !== 'boolean') {
    errors.push('is_available must be a boolean (true or false)');
  }

  // description_en: optional, string or null
  if (data.description_en !== undefined && data.description_en !== null && typeof data.description_en !== 'string') {
    errors.push('description_en must be a string or null');
  }

  // description_am: optional, string or null
  if (data.description_am !== undefined && data.description_am !== null && typeof data.description_am !== 'string') {
    errors.push('description_am must be a string or null');
  }

  // image_url: optional, string or null
  if (data.image_url !== undefined && data.image_url !== null && typeof data.image_url !== 'string') {
    errors.push('image_url must be a string or null');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates payload for updating an existing product.
 * Only supplied fields are validated.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateProductUpdate(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return { isValid: false, errors: ['Request body must contain at least one field to update'] };
  }

  const allowedFields = [
    'name_en',
    'name_am',
    'description_en',
    'description_am',
    'price',
    'image_url',
    'is_available'
  ];

  const providedKeys = Object.keys(data).filter(k => allowedFields.includes(k));
  if (providedKeys.length === 0) {
    return { isValid: false, errors: ['No valid update fields provided'] };
  }

  if (data.name_en !== undefined) {
    if (typeof data.name_en !== 'string' || data.name_en.trim() === '') {
      errors.push('name_en must be a non-empty string');
    } else if (data.name_en.trim().length > 255) {
      errors.push('name_en cannot exceed 255 characters');
    }
  }

  if (data.name_am !== undefined) {
    if (typeof data.name_am !== 'string' || data.name_am.trim() === '') {
      errors.push('name_am must be a non-empty string');
    } else if (data.name_am.trim().length > 255) {
      errors.push('name_am cannot exceed 255 characters');
    }
  }

  if (data.price !== undefined) {
    const numPrice = Number(data.price);
    if (isNaN(numPrice) || !isFinite(numPrice) || numPrice < 0) {
      errors.push('price must be a valid number greater than or equal to 0');
    }
  }

  if (data.is_available !== undefined && typeof data.is_available !== 'boolean') {
    errors.push('is_available must be a boolean (true or false)');
  }

  if (data.description_en !== undefined && data.description_en !== null && typeof data.description_en !== 'string') {
    errors.push('description_en must be a string or null');
  }

  if (data.description_am !== undefined && data.description_am !== null && typeof data.description_am !== 'string') {
    errors.push('description_am must be a string or null');
  }

  if (data.image_url !== undefined && data.image_url !== null && typeof data.image_url !== 'string') {
    errors.push('image_url must be a string or null');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

const ALLOWED_ORDER_STATUSES = [
  'pending',
  'payment_review',
  'confirmed',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rejected'
];

/**
 * Validates payload for creating a new order.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateOrderCreate(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Request body must be a JSON object'] };
  }

  // 1. Customer validation
  if (!data.customer || typeof data.customer !== 'object') {
    errors.push('Customer information is required');
  } else {
    const { name, phone, address } = data.customer;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.push('Customer name is required and cannot be empty');
    } else if (name.trim().length > 150) {
      errors.push('Customer name cannot exceed 150 characters');
    }

    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
      errors.push('Customer phone is required and cannot be empty');
    } else if (phone.trim().length > 30) {
      errors.push('Customer phone cannot exceed 30 characters');
    }

    if (!address || typeof address !== 'string' || address.trim() === '') {
      errors.push('Customer address is required and cannot be empty');
    }
  }

  // 2. Items validation
  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('Order must contain at least one product item');
  } else {
    data.items.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`Item at index ${index} must be an object`);
        return;
      }

      if (!item.product_id || !isValidUuid(item.product_id)) {
        errors.push(`Item at index ${index} must have a valid product_id (UUID)`);
      }

      if (item.quantity === undefined || item.quantity === null) {
        errors.push(`Item at index ${index} must have a quantity`);
      } else if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push(`Item at index ${index} quantity must be a positive integer greater than 0`);
      } else if (item.quantity > 5) {
        errors.push(`Item at index ${index} quantity cannot exceed 5 items per order`);
      }
    });
  }

  // 3. Customer note validation
  if (data.customer_note !== undefined && data.customer_note !== null && typeof data.customer_note !== 'string') {
    errors.push('customer_note must be a string or null');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates order status string.
 * @param {string} status
 * @returns {{ isValid: boolean, message?: string }}
 */
function validateOrderStatus(status) {
  if (!status || typeof status !== 'string') {
    return {
      isValid: false,
      message: `Status is required and must be one of: ${ALLOWED_ORDER_STATUSES.join(', ')}`
    };
  }

  const normalized = status.trim().toLowerCase();
  if (!ALLOWED_ORDER_STATUSES.includes(normalized)) {
    return {
      isValid: false,
      message: `Invalid order status "${status}". Allowed statuses are: ${ALLOWED_ORDER_STATUSES.join(', ')}`
    };
  }

  return {
    isValid: true,
    status: normalized
  };
}

/**
 * Validates pagination query parameters.
 * @param {any} pageQuery
 * @param {any} limitQuery
 * @returns {{ isValid: boolean, page?: number, limit?: number, offset?: number, message?: string }}
 */
function validatePagination(pageQuery, limitQuery) {
  let page = pageQuery !== undefined ? Number(pageQuery) : 1;
  let limit = limitQuery !== undefined ? Number(limitQuery) : 20;

  if (isNaN(page) || !Number.isInteger(page) || page < 1) {
    return {
      isValid: false,
      message: 'Page parameter must be an integer greater than or equal to 1'
    };
  }

  if (isNaN(limit) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return {
      isValid: false,
      message: 'Limit parameter must be an integer between 1 and 100'
    };
  }

  return {
    isValid: true,
    page,
    limit,
    offset: (page - 1) * limit
  };
}

const ALLOWED_PAYMENT_METHODS = ['telebirr', 'cash'];
const ALLOWED_PAYMENT_STATUSES = ['pending', 'verified', 'rejected'];

/**
 * Validates payload for customer payment submission.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validatePaymentSubmission(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Request body must be a JSON object'] };
  }

  // order_id
  if (!data.order_id || typeof data.order_id !== 'string' || !isValidUuid(data.order_id)) {
    errors.push('Valid order_id (UUID) is required');
  }

  // method
  if (!data.method || typeof data.method !== 'string') {
    errors.push('Payment method is required and must be either "telebirr" or "cash"');
  } else {
    const normalizedMethod = data.method.trim().toLowerCase();
    if (!ALLOWED_PAYMENT_METHODS.includes(normalizedMethod)) {
      errors.push(`Invalid payment method "${data.method}". Supported methods are: ${ALLOWED_PAYMENT_METHODS.join(', ')}`);
    }
  }

  // amount
  if (data.amount === undefined || data.amount === null || data.amount === '') {
    errors.push('Amount is required');
  } else {
    const numAmount = Number(data.amount);
    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
      errors.push('Amount must be a positive number greater than 0');
    }
  }

  // payment_proof_url
  const method = data.method ? data.method.trim().toLowerCase() : '';
  if (method === 'telebirr') {
    if (!data.payment_proof_url || typeof data.payment_proof_url !== 'string' || data.payment_proof_url.trim() === '') {
      errors.push('payment_proof_url is required for Telebirr payments');
    }
  } else if (data.payment_proof_url !== undefined && data.payment_proof_url !== null && typeof data.payment_proof_url !== 'string') {
    errors.push('payment_proof_url must be a string or null');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates payment reject payload.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validatePaymentReject(data) {
  const errors = [];

  if (data && typeof data === 'object') {
    if (data.admin_note !== undefined && data.admin_note !== null && typeof data.admin_note !== 'string') {
      errors.push('admin_note must be a string or null');
    }
    if (data.customer_message !== undefined && data.customer_message !== null && typeof data.customer_message !== 'string') {
      errors.push('customer_message must be a string or null');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates image buffer using magic bytes signature verification.
 * Strictly verifies JPG/JPEG, PNG, and WEBP. Rejects executables, PDFs, scripts, etc.
 * @param {Buffer} buffer
 * @param {string} [declaredMimeType]
 * @returns {{ isValid: boolean, detectedType?: string, extension?: string, message?: string }}
 */
function validateImageBuffer(buffer, declaredMimeType) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      isValid: false,
      message: 'No file content provided or file is empty.'
    };
  }

  if (buffer.length > MAX_UPLOAD_FILE_SIZE) {
    return {
      isValid: false,
      message: 'File size exceeds the maximum limit of 5 MB.'
    };
  }

  // 1. Explicitly check for dangerous / disallowed magic bytes
  // PDF check: starts with %PDF
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return {
      isValid: false,
      message: 'PDF files are not allowed. Only JPG, PNG, and WEBP images are accepted.'
    };
  }

  // Windows/DOS Executable: MZ
  if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return {
      isValid: false,
      message: 'Executable files are strictly prohibited.'
    };
  }

  // ELF Linux Executable: 0x7F, E, L, F
  if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return {
      isValid: false,
      message: 'Executable files are strictly prohibited.'
    };
  }

  // 2. Validate legitimate image magic bytes
  // JPEG / JPG: 0xFF, 0xD8, 0xFF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return {
      isValid: true,
      detectedType: 'image/jpeg',
      extension: 'jpg'
    };
  }

  // PNG: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return {
      isValid: true,
      detectedType: 'image/png',
      extension: 'png'
    };
  }

  // WEBP: Starts with 'RIFF' at 0 and 'WEBP' at 8
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return {
      isValid: true,
      detectedType: 'image/webp',
      extension: 'webp'
    };
  }

  return {
    isValid: false,
    message: 'Unsupported or invalid file format. Only valid JPEG, PNG, and WEBP images are allowed.'
  };
}

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
const ALLOWED_MEDIA_TYPES = ['image', 'video'];
const ALLOWED_PRODUCT_MEDIA_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm'
];

/**
 * Validates product media buffer (images and videos) using magic bytes and size rules.
 * @param {Buffer} buffer
 * @param {string} [declaredMimeType]
 * @returns {{ isValid: boolean, mediaType?: 'image'|'video', mimeType?: string, extension?: string, message?: string }}
 */
function validateProductMediaBuffer(buffer, declaredMimeType) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { isValid: false, message: 'No file content provided or file is empty.' };
  }

  // 1. Explicitly check for dangerous / disallowed magic bytes
  // PDF: %PDF
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return { isValid: false, message: 'PDF files are not allowed for product media. Only images (JPG, PNG, WEBP) and videos (MP4, WEBM) are accepted.' };
  }

  // Windows/DOS Executable: MZ
  if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return { isValid: false, message: 'Executable files are strictly prohibited.' };
  }

  // Linux ELF Executable: 0x7F, E, L, F
  if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return { isValid: false, message: 'Executable files are strictly prohibited.' };
  }

  // Shell scripts: #!
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    return { isValid: false, message: 'Script files are strictly prohibited.' };
  }

  // HTML / XML / SVG scripts
  if (buffer.length >= 5) {
    const startStr = buffer.toString('ascii', 0, 10).toLowerCase();
    if (startStr.startsWith('<html') || startStr.startsWith('<!doctype') || startStr.startsWith('<?xml') || startStr.startsWith('<svg') || startStr.startsWith('<script')) {
      return { isValid: false, message: 'HTML, XML, and SVG script uploads are not allowed for product media.' };
    }
  }

  // 2. Check legitimate Image magic bytes
  // JPEG: 0xFF, 0xD8, 0xFF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    if (buffer.length > MAX_IMAGE_FILE_SIZE) {
      return { isValid: false, message: 'Image file size exceeds the maximum limit of 5 MB.' };
    }
    return { isValid: true, mediaType: 'image', mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // PNG: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 && buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    if (buffer.length > MAX_IMAGE_FILE_SIZE) {
      return { isValid: false, message: 'Image file size exceeds the maximum limit of 5 MB.' };
    }
    return { isValid: true, mediaType: 'image', mimeType: 'image/png', extension: 'png' };
  }

  // WEBP: 'RIFF' at 0 and 'WEBP' at 8
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    if (buffer.length > MAX_IMAGE_FILE_SIZE) {
      return { isValid: false, message: 'Image file size exceeds the maximum limit of 5 MB.' };
    }
    return { isValid: true, mediaType: 'image', mimeType: 'image/webp', extension: 'webp' };
  }

  // 3. Check legitimate Video signatures
  // MP4: 'ftyp' box at offset 4
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    if (buffer.length > MAX_VIDEO_FILE_SIZE) {
      return { isValid: false, message: 'Video file size exceeds the maximum limit of 30 MB.' };
    }
    return { isValid: true, mediaType: 'video', mimeType: 'video/mp4', extension: 'mp4' };
  }

  // WEBM: EBML ID 0x1A, 0x45, 0xDF, 0xA3 at offset 0
  if (buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    if (buffer.length > MAX_VIDEO_FILE_SIZE) {
      return { isValid: false, message: 'Video file size exceeds the maximum limit of 30 MB.' };
    }
    return { isValid: true, mediaType: 'video', mimeType: 'video/webm', extension: 'webm' };
  }

  return {
    isValid: false,
    message: 'Unsupported or invalid media format. Allowed formats are JPEG, PNG, WEBP for images and MP4, WEBM for videos.'
  };
}

module.exports = {
  isValidUuid,
  validateProductCreate,
  validateProductUpdate,
  validateOrderCreate,
  validateOrderStatus,
  validatePagination,
  validatePaymentSubmission,
  validatePaymentReject,
  validateImageBuffer,
  validateProductMediaBuffer,
  ALLOWED_ORDER_STATUSES,
  ALLOWED_PAYMENT_METHODS,
  ALLOWED_PAYMENT_STATUSES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE,
  MAX_IMAGE_FILE_SIZE,
  MAX_VIDEO_FILE_SIZE,
  ALLOWED_MEDIA_TYPES,
  ALLOWED_PRODUCT_MEDIA_MIMES
};



