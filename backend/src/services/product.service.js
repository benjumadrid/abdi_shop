const db = require('../db/db');

/**
 * Normalizes product row from PostgreSQL (e.g. parse numeric price).
 * If image_url is NULL and media items exist, falls back to the primary media URL.
 * @param {object} p
 * @returns {object|null}
 */
function formatProduct(p) {
  if (!p) return null;
  let imageUrl = p.image_url;
  if (!imageUrl && Array.isArray(p.media) && p.media.length > 0) {
    const primary = p.media.find(m => m.is_primary) || p.media[0];
    if (primary) {
      imageUrl = primary.url || `/api/products/media/${primary.id}`;
    }
  }
  return {
    ...p,
    price: parseFloat(p.price),
    image_url: imageUrl
  };
}

/**
 * Retrieves products list.
 * By default, returns only available products (is_available = true) ordered newest first.
 * @param {object} options
 * @param {boolean} [options.includeUnavailable=false]
 * @returns {Promise<Array>}
 */
async function getProducts(options = {}) {
  const { includeUnavailable = false } = options;

  let queryText = `
    SELECT id, name_en, name_am, description_en, description_am,
           price, image_url, is_available, created_at, updated_at
    FROM products
  `;

  if (!includeUnavailable) {
    queryText += ' WHERE is_available = true';
  }

  queryText += ' ORDER BY created_at DESC;';

  const result = await db.query(queryText);
  const products = result.rows.map(formatProduct);

  if (products.length > 0) {
    const productIds = products.map(p => p.id);
    const mediaRes = await db.query(`
      SELECT id, product_id, media_type, mime_type, filename, file_size, sort_order, is_primary, created_at
      FROM product_media
      WHERE product_id = ANY($1::uuid[])
      ORDER BY sort_order ASC, created_at ASC;
    `, [productIds]);

    const mediaMap = new Map();
    for (const m of mediaRes.rows) {
      if (!mediaMap.has(m.product_id)) {
        mediaMap.set(m.product_id, []);
      }
      mediaMap.get(m.product_id).push({
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
      });
    }

    for (const p of products) {
      p.media = mediaMap.get(p.id) || [];
      if (!p.image_url) {
        const primary = p.media.find(m => m.is_primary) || p.media[0];
        if (primary) {
          p.image_url = primary.url;
        }
      }
    }
  }

  return products;
}

/**
 * Retrieves a single product by UUID.
 * @param {string} id
 * @param {object} options
 * @param {boolean} [options.includeUnavailable=false]
 * @returns {Promise<object|null>}
 */
async function getProductById(id, options = {}) {
  const { includeUnavailable = false } = options;

  let queryText = `
    SELECT id, name_en, name_am, description_en, description_am,
           price, image_url, is_available, created_at, updated_at
    FROM products
    WHERE id = $1
  `;

  if (!includeUnavailable) {
    queryText += ' AND is_available = true';
  }

  queryText += ';';

  const result = await db.query(queryText, [id]);
  if (result.rows.length === 0) {
    return null;
  }

  const product = formatProduct(result.rows[0]);

  // Fetch associated media items ordered by sort_order
  const mediaRes = await db.query(`
    SELECT id, product_id, media_type, mime_type, filename, file_size, sort_order, is_primary, created_at
    FROM product_media
    WHERE product_id = $1
    ORDER BY sort_order ASC, created_at ASC;
  `, [id]);

  product.media = mediaRes.rows.map(m => ({
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
  }));

  if (!product.image_url) {
    const primary = product.media.find(m => m.is_primary) || product.media[0];
    if (primary) {
      product.image_url = primary.url;
    }
  }

  return product;
}

/**
 * Creates a new product in the database.
 * @param {object} productData
 * @returns {Promise<object>}
 */
async function createProduct(productData) {
  const {
    name_en,
    name_am,
    description_en = null,
    description_am = null,
    price,
    image_url = null,
    is_available = true
  } = productData;

  const queryText = `
    INSERT INTO products (
      name_en,
      name_am,
      description_en,
      description_am,
      price,
      image_url,
      is_available
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, name_en, name_am, description_en, description_am,
              price, image_url, is_available, created_at, updated_at;
  `;

  const values = [
    name_en.trim(),
    name_am.trim(),
    typeof description_en === 'string' && description_en.trim() ? description_en.trim() : null,
    typeof description_am === 'string' && description_am.trim() ? description_am.trim() : null,
    Number(price),
    typeof image_url === 'string' && image_url.trim() ? image_url.trim() : null,
    typeof is_available === 'boolean' ? is_available : true
  ];

  const result = await db.query(queryText, values);
  return formatProduct(result.rows[0]);
}

/**
 * Updates specified fields on an existing product.
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object|null>}
 */
async function updateProduct(id, updateData) {
  // Check if product exists first
  const existingCheck = await db.query('SELECT id FROM products WHERE id = $1;', [id]);
  if (existingCheck.rows.length === 0) {
    return null;
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updateData.name_en !== undefined) {
    fields.push(`name_en = $${paramIndex++}`);
    values.push(updateData.name_en.trim());
  }
  if (updateData.name_am !== undefined) {
    fields.push(`name_am = $${paramIndex++}`);
    values.push(updateData.name_am.trim());
  }
  if (updateData.description_en !== undefined) {
    fields.push(`description_en = $${paramIndex++}`);
    values.push(typeof updateData.description_en === 'string' && updateData.description_en.trim() ? updateData.description_en.trim() : null);
  }
  if (updateData.description_am !== undefined) {
    fields.push(`description_am = $${paramIndex++}`);
    values.push(typeof updateData.description_am === 'string' && updateData.description_am.trim() ? updateData.description_am.trim() : null);
  }
  if (updateData.price !== undefined) {
    fields.push(`price = $${paramIndex++}`);
    values.push(Number(updateData.price));
  }
  if (updateData.image_url !== undefined) {
    fields.push(`image_url = $${paramIndex++}`);
    values.push(typeof updateData.image_url === 'string' && updateData.image_url.trim() ? updateData.image_url.trim() : null);
  }
  if (updateData.is_available !== undefined) {
    fields.push(`is_available = $${paramIndex++}`);
    values.push(Boolean(updateData.is_available));
  }

  values.push(id);

  const queryText = `
    UPDATE products
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name_en, name_am, description_en, description_am,
              price, image_url, is_available, created_at, updated_at;
  `;

  const result = await db.query(queryText, values);
  return formatProduct(result.rows[0]);
}

/**
 * Safely handles product deletion.
 * Checks whether the product has order_items references before attempting delete.
 * @param {string} id
 * @returns {Promise<{ status: 'not_found'|'referenced'|'deleted', id?: string, orderCount?: number }>}
 */
async function deleteProduct(id) {
  // 1. Check if product exists
  const existingCheck = await db.query('SELECT id, name_en FROM products WHERE id = $1;', [id]);
  if (existingCheck.rows.length === 0) {
    return { status: 'not_found' };
  }

  // 2. Check if referenced by order_items
  const orderItemsCheck = await db.query(
    'SELECT COUNT(*)::int AS count FROM order_items WHERE product_id = $1;',
    [id]
  );
  const orderCount = orderItemsCheck.rows[0].count;

  if (orderCount > 0) {
    return {
      status: 'referenced',
      orderCount,
      productName: existingCheck.rows[0].name_en
    };
  }

  // 3. Safe to permanently delete
  await db.query('DELETE FROM products WHERE id = $1;', [id]);
  return { status: 'deleted', id };
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
