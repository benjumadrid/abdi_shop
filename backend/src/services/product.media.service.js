const crypto = require('crypto');
const db = require('../db/db');
const { isValidUuid } = require('../utils/validators');

/**
 * Normalizes a product_media row for JSON response (strips raw binary data).
 * @param {object} m
 * @returns {object|null}
 */
function formatMedia(m) {
  if (!m) return null;
  return {
    id: m.id,
    product_id: m.product_id,
    media_type: m.media_type,
    mime_type: m.mime_type,
    filename: m.filename,
    file_size: m.file_size,
    sort_order: m.sort_order,
    is_primary: m.is_primary,
    url: `/api/products/media/${m.id}`,
    created_at: m.created_at
  };
}

/**
 * Uploads and stores a new product media file in Neon PostgreSQL.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function uploadProductMedia({
  productId,
  fileBuffer,
  mediaType,
  mimeType,
  extension = 'jpg',
  sortOrder = null,
  isPrimary = null
}) {
  if (!productId || !isValidUuid(productId)) {
    const err = new Error('Valid product_id (UUID) is required.');
    err.status = 400;
    throw err;
  }

  // 1. Verify product exists
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1;', [productId]);
  if (productCheck.rows.length === 0) {
    const err = new Error('Product not found.');
    err.status = 404;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 2. Determine sort order if not specified
    let finalSortOrder = sortOrder;
    if (finalSortOrder === null || finalSortOrder === undefined || isNaN(finalSortOrder)) {
      const orderRes = await client.query(`
        SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
        FROM product_media
        WHERE product_id = $1;
      `, [productId]);
      finalSortOrder = parseInt(orderRes.rows[0].next_order, 10);
    } else {
      finalSortOrder = parseInt(finalSortOrder, 10);
    }

    // 3. Determine is_primary behavior
    const countRes = await client.query('SELECT COUNT(*) AS total FROM product_media WHERE product_id = $1;', [productId]);
    const existingCount = parseInt(countRes.rows[0].total, 10);

    let finalIsPrimary = isPrimary;
    if (finalIsPrimary === null || finalIsPrimary === undefined) {
      // First media item automatically becomes primary
      finalIsPrimary = existingCount === 0;
    } else {
      finalIsPrimary = Boolean(finalIsPrimary);
    }

    // If this item is marked primary, unset primary on all other items for this product
    if (finalIsPrimary) {
      await client.query('UPDATE product_media SET is_primary = FALSE WHERE product_id = $1;', [productId]);
    }

    // 4. Generate safe, non-guessable, sanitized filename
    const cleanExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
    const safeFilename = `media-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${cleanExt}`;

    // 5. Insert media record
    const insertRes = await client.query(`
      INSERT INTO product_media (
        product_id,
        media_type,
        mime_type,
        filename,
        file_size,
        file_data,
        sort_order,
        is_primary
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, product_id, media_type, mime_type, filename, file_size, sort_order, is_primary, created_at;
    `, [productId, mediaType, mimeType, safeFilename, fileBuffer.length, fileBuffer, finalSortOrder, finalIsPrimary]);

    await client.query('COMMIT');
    return formatMedia(insertRes.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieves all media items for a given product ordered by sort_order.
 * @param {string} productId
 * @returns {Promise<Array>}
 */
async function getProductMediaByProductId(productId) {
  if (!productId || !isValidUuid(productId)) {
    const err = new Error('Invalid product ID format. Must be a valid UUID.');
    err.status = 400;
    throw err;
  }

  // Check product exists
  const prod = await db.query('SELECT id FROM products WHERE id = $1;', [productId]);
  if (prod.rows.length === 0) {
    const err = new Error('Product not found.');
    err.status = 404;
    throw err;
  }

  const res = await db.query(`
    SELECT id, product_id, media_type, mime_type, filename, file_size, sort_order, is_primary, created_at
    FROM product_media
    WHERE product_id = $1
    ORDER BY sort_order ASC, created_at ASC;
  `, [productId]);

  return res.rows.map(formatMedia);
}

/**
 * Retrieves a single media item by ID including file_data for serving.
 * @param {string} mediaId
 * @returns {Promise<object|null>}
 */
async function getProductMediaById(mediaId) {
  if (!mediaId || !isValidUuid(mediaId)) {
    return null;
  }

  const res = await db.query(`
    SELECT id, product_id, media_type, mime_type, filename, file_size, file_data, sort_order, is_primary, created_at
    FROM product_media
    WHERE id = $1;
  `, [mediaId]);

  return res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * Updates sort_order or is_primary flag of a media item.
 * @param {string} mediaId
 * @param {object} updates
 * @returns {Promise<object>}
 */
async function updateProductMedia(mediaId, { sort_order, is_primary }) {
  if (!mediaId || !isValidUuid(mediaId)) {
    const err = new Error('Invalid media ID format. Must be a valid UUID.');
    err.status = 400;
    throw err;
  }

  const existingRes = await db.query('SELECT id, product_id FROM product_media WHERE id = $1;', [mediaId]);
  if (existingRes.rows.length === 0) {
    const err = new Error('Product media not found.');
    err.status = 404;
    throw err;
  }

  const productId = existingRes.rows[0].product_id;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    if (is_primary === true) {
      await client.query('UPDATE product_media SET is_primary = FALSE WHERE product_id = $1;', [productId]);
      await client.query('UPDATE product_media SET is_primary = TRUE WHERE id = $1;', [mediaId]);
    } else if (is_primary === false) {
      await client.query('UPDATE product_media SET is_primary = FALSE WHERE id = $1;', [mediaId]);
    }

    if (sort_order !== undefined && sort_order !== null && !isNaN(sort_order)) {
      await client.query('UPDATE product_media SET sort_order = $1 WHERE id = $2;', [parseInt(sort_order, 10), mediaId]);
    }

    const updatedRes = await client.query(`
      SELECT id, product_id, media_type, mime_type, filename, file_size, sort_order, is_primary, created_at
      FROM product_media
      WHERE id = $1;
    `, [mediaId]);

    await client.query('COMMIT');
    return formatMedia(updatedRes.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Bulk reorders media items for a product.
 * @param {string} productId
 * @param {Array<{ id: string, sort_order: number, is_primary?: boolean }>} items
 * @returns {Promise<Array>}
 */
async function reorderProductMedia(productId, items) {
  if (!productId || !isValidUuid(productId)) {
    const err = new Error('Valid product_id (UUID) is required.');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Items array is required.');
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    let hasPrimary = false;
    for (const item of items) {
      if (item.is_primary === true) {
        hasPrimary = true;
      }
    }

    if (hasPrimary) {
      await client.query('UPDATE product_media SET is_primary = FALSE WHERE product_id = $1;', [productId]);
    }

    for (const item of items) {
      if (!item.id || !isValidUuid(item.id)) continue;
      const sortOrder = item.sort_order !== undefined ? parseInt(item.sort_order, 10) : 0;
      const isPrim = item.is_primary === true;

      await client.query(`
        UPDATE product_media
        SET sort_order = $1,
            is_primary = CASE WHEN $2 = TRUE THEN TRUE ELSE is_primary END
        WHERE id = $3 AND product_id = $4;
      `, [sortOrder, isPrim, item.id, productId]);
    }

    const res = await client.query(`
      SELECT id, product_id, media_type, mime_type, filename, file_size, sort_order, is_primary, created_at
      FROM product_media
      WHERE product_id = $1
      ORDER BY sort_order ASC, created_at ASC;
    `, [productId]);

    await client.query('COMMIT');
    return res.rows.map(formatMedia);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Deletes a media item by ID.
 * If the deleted item was primary, promotes the next item (by lowest sort_order) to primary.
 * @param {string} mediaId
 * @returns {Promise<{ deleted: boolean, new_primary_id?: string|null }>}
 */
async function deleteProductMedia(mediaId) {
  if (!mediaId || !isValidUuid(mediaId)) {
    const err = new Error('Invalid media ID format. Must be a valid UUID.');
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const checkRes = await client.query('SELECT id, product_id, is_primary FROM product_media WHERE id = $1;', [mediaId]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Product media not found.');
      err.status = 404;
      throw err;
    }

    const { product_id: productId, is_primary: wasPrimary } = checkRes.rows[0];

    // Delete item
    await client.query('DELETE FROM product_media WHERE id = $1;', [mediaId]);

    let newPrimaryId = null;
    if (wasPrimary) {
      // Find and promote the next media item
      const nextRes = await client.query(`
        SELECT id FROM product_media
        WHERE product_id = $1
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1;
      `, [productId]);

      if (nextRes.rows.length > 0) {
        newPrimaryId = nextRes.rows[0].id;
        await client.query('UPDATE product_media SET is_primary = TRUE WHERE id = $1;', [newPrimaryId]);
      }
    }

    await client.query('COMMIT');
    return { deleted: true, new_primary_id: newPrimaryId };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  formatMedia,
  uploadProductMedia,
  getProductMediaByProductId,
  getProductMediaById,
  updateProductMedia,
  reorderProductMedia,
  deleteProductMedia
};
