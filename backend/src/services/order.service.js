const db = require('../db/db');

/**
 * Normalizes numbers from PostgreSQL (NUMERIC columns).
 */
function formatOrderItem(item) {
  return {
    id: item.id,
    product_id: item.product_id,
    product_name_en: item.product_name_en,
    product_name_am: item.product_name_am,
    image_url: item.image_url,
    quantity: item.quantity,
    unit_price: parseFloat(item.unit_price),
    subtotal: parseFloat(item.subtotal)
  };
}

function formatOrder(orderRow, items = [], payments = [], isAdmin = false) {
  const formatted = {
    id: orderRow.id,
    order_number: orderRow.order_number,
    status: orderRow.status,
    total_amount: parseFloat(orderRow.total_amount),
    customer_note: orderRow.customer_note,
    created_at: orderRow.created_at,
    updated_at: orderRow.updated_at,
    customer: {
      id: orderRow.customer_id,
      name: orderRow.customer_name,
      phone: orderRow.customer_phone,
      address: orderRow.customer_address
    },
    items: items.map(formatOrderItem)
  };

  // Only expose private admin fields if admin request
  if (isAdmin) {
    formatted.admin_note = orderRow.admin_note;
    formatted.payments = payments.map(p => ({
      id: p.id,
      method: p.method,
      amount: parseFloat(p.amount),
      status: p.status,
      payment_proof_url: p.payment_proof_url,
      admin_note: p.admin_note,
      customer_message: p.customer_message,
      verified_by: p.verified_by,
      verified_at: p.verified_at,
      reviewed_at: p.reviewed_at,
      created_at: p.created_at,
      updated_at: p.updated_at
    }));
  } else {
    // Customer-safe payments projection: strictly excludes admin_note and verified_by
    formatted.payments = payments.map(p => ({
      id: p.id,
      method: p.method,
      amount: parseFloat(p.amount),
      status: p.status,
      payment_proof_url: p.payment_proof_url,
      customer_message: p.customer_message,
      reviewed_at: p.reviewed_at,
      created_at: p.created_at,
      updated_at: p.updated_at
    }));
  }

  // Active payment shortcut (for customer and admin convenience)
  formatted.active_payment = formatted.payments.find(p => p.status !== 'rejected') || (formatted.payments.length > 0 ? formatted.payments[0] : null);

  return formatted;
}

/**
 * Creates a new customer order within a database transaction.
 * Calculates prices from current database records.
 * Reuses or creates customer record based on phone.
 * Generates human-friendly concurrency-safe order number.
 */
async function createOrder(orderData) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { customer, items, customer_note } = orderData;

    // 1. Group quantities by product_id in case duplicate IDs are sent
    const itemQuantityMap = new Map();
    for (const item of items) {
      const currentQty = itemQuantityMap.get(item.product_id) || 0;
      itemQuantityMap.set(item.product_id, currentQty + item.quantity);
    }

    for (const [prodId, qty] of itemQuantityMap.entries()) {
      if (qty > 5) {
        const error = new Error('Maximum allowed quantity is 5 items per product in a single order.');
        error.status = 400;
        throw error;
      }
    }

    const uniqueProductIds = Array.from(itemQuantityMap.keys());

    // 2. Query products from database using lock/snapshot
    const productsResult = await client.query(
      `SELECT p.id, p.name_en, p.name_am, p.price, p.is_available,
              COALESCE(p.image_url, pm.url) AS image_url
       FROM products p
       LEFT JOIN (
         SELECT DISTINCT ON (product_id)
                product_id,
                '/api/products/media/' || id AS url
         FROM product_media
         ORDER BY product_id, is_primary DESC, sort_order ASC, created_at ASC
       ) pm ON pm.product_id = p.id
       WHERE p.id = ANY($1::uuid[]);`,
      [uniqueProductIds]
    );

    const foundProducts = productsResult.rows;
    const foundProductMap = new Map(foundProducts.map(p => [p.id, p]));

    // Check all products exist
    for (const prodId of uniqueProductIds) {
      if (!foundProductMap.has(prodId)) {
        const error = new Error(`Product with ID "${prodId}" does not exist.`);
        error.status = 404;
        throw error;
      }
    }

    // Check all products are available
    for (const [prodId, product] of foundProductMap.entries()) {
      if (!product.is_available) {
        const error = new Error(`Product "${product.name_en}" is currently unavailable.`);
        error.status = 400;
        throw error;
      }
    }

    // 3. Calculate subtotals and complete order total based ONLY on database prices
    let totalAmount = 0;
    const calculatedItems = [];

    for (const [prodId, quantity] of itemQuantityMap.entries()) {
      const product = foundProductMap.get(prodId);
      const unitPrice = parseFloat(product.price);
      const subtotal = Math.round(unitPrice * quantity * 100) / 100;
      totalAmount = Math.round((totalAmount + subtotal) * 100) / 100;

      calculatedItems.push({
        product_id: prodId,
        product_name_en: product.name_en,
        product_name_am: product.name_am,
        image_url: product.image_url,
        quantity,
        unit_price: unitPrice,
        subtotal
      });
    }

    // 4. Create or reuse customer by phone (atomic upsert)
    const normalizedPhone = customer.phone.trim();
    const normalizedName = customer.name.trim();
    const normalizedAddress = customer.address.trim();

    const customerResult = await client.query(
      `INSERT INTO customers (name, phone, address)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone)
       DO UPDATE SET
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         updated_at = NOW()
       RETURNING id, name, phone, address, created_at, updated_at;`,
      [normalizedName, normalizedPhone, normalizedAddress]
    );

    const savedCustomer = customerResult.rows[0];

    // 5. Generate concurrency-safe human-friendly order number (ORD-YYYYMMDD-XXXX)
    const orderNumberResult = await client.query(
      `SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::text, 4, '0') AS order_number;`
    );
    const orderNumber = orderNumberResult.rows[0].order_number;

    // 6. Insert Order
    const cleanCustomerNote = typeof customer_note === 'string' && customer_note.trim() ? customer_note.trim() : null;

    const orderResult = await client.query(
      `INSERT INTO orders (
         order_number,
         customer_id,
         total_amount,
         status,
         customer_note
       )
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id, order_number, customer_id, total_amount, status, customer_note, admin_note, created_at, updated_at;`,
      [orderNumber, savedCustomer.id, totalAmount, cleanCustomerNote]
    );

    const savedOrder = orderResult.rows[0];

    // 7. Insert Order Items
    const savedItems = [];
    for (const item of calculatedItems) {
      const itemResult = await client.query(
        `INSERT INTO order_items (
           order_id,
           product_id,
           quantity,
           unit_price,
           subtotal
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, order_id, product_id, quantity, unit_price, subtotal;`,
        [savedOrder.id, item.product_id, item.quantity, item.unit_price, item.subtotal]
      );

      savedItems.push({
        ...itemResult.rows[0],
        product_name_en: item.product_name_en,
        product_name_am: item.product_name_am,
        image_url: item.image_url
      });
    }

    await client.query('COMMIT');

    // Return public representation
    return formatOrder(
      {
        ...savedOrder,
        customer_name: savedCustomer.name,
        customer_phone: savedCustomer.phone,
        customer_address: savedCustomer.address
      },
      savedItems,
      [],
      false // public
    );

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieves an order by UUID.
 */
async function getOrderById(id, { isAdmin = false } = {}) {
  const orderResult = await db.query(
    `SELECT o.id, o.order_number, o.total_amount, o.status, o.customer_note,
            o.admin_note, o.created_at, o.updated_at,
            c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE o.id = $1;`,
    [id]
  );

  if (orderResult.rows.length === 0) {
    return null;
  }

  const orderRow = orderResult.rows[0];

  const itemsResult = await db.query(
    `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
            p.name_en AS product_name_en, p.name_am AS product_name_am,
            COALESCE(p.image_url, pm.url) AS image_url
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     LEFT JOIN (
       SELECT DISTINCT ON (product_id)
              product_id,
              '/api/products/media/' || id AS url
       FROM product_media
       ORDER BY product_id, is_primary DESC, sort_order ASC, created_at ASC
     ) pm ON pm.product_id = p.id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC;`,
    [id]
  );

  const paymentsResult = await db.query(
    `SELECT id, method, amount, payment_proof_url, status, admin_note, customer_message, verified_by, verified_at, reviewed_at, created_at, updated_at
     FROM payments
     WHERE order_id = $1
     ORDER BY created_at DESC;`,
    [id]
  );
  const payments = paymentsResult.rows;

  return formatOrder(orderRow, itemsResult.rows, payments, isAdmin);
}

/**
 * Retrieves an order by its human-friendly order number (e.g. ORD-20260906-0001).
 */
async function getOrderByNumber(orderNumber, { isAdmin = false } = {}) {
  const orderResult = await db.query(
    `SELECT o.id, o.order_number, o.total_amount, o.status, o.customer_note,
            o.admin_note, o.created_at, o.updated_at,
            c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE o.order_number = $1;`,
    [orderNumber]
  );

  if (orderResult.rows.length === 0) {
    return null;
  }

  const orderRow = orderResult.rows[0];

  const itemsResult = await db.query(
    `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
            p.name_en AS product_name_en, p.name_am AS product_name_am,
            COALESCE(p.image_url, pm.url) AS image_url
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     LEFT JOIN (
       SELECT DISTINCT ON (product_id)
              product_id,
              '/api/products/media/' || id AS url
       FROM product_media
       ORDER BY product_id, is_primary DESC, sort_order ASC, created_at ASC
     ) pm ON pm.product_id = p.id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC;`,
    [orderRow.id]
  );

  const paymentsResult = await db.query(
    `SELECT id, method, amount, payment_proof_url, status, admin_note, customer_message, verified_by, verified_at, reviewed_at, created_at, updated_at
     FROM payments
     WHERE order_id = $1
     ORDER BY created_at DESC;`,
    [orderRow.id]
  );
  const payments = paymentsResult.rows;

  return formatOrder(orderRow, itemsResult.rows, payments, isAdmin);
}

/**
 * Retrieves paginated list of orders for the admin dashboard.
 */
async function getAdminOrders({ status, date, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`o.status = $${paramIdx++}`);
    params.push(status);
  }

  if (date) {
    conditions.push(`DATE(o.created_at) = $${paramIdx++}::date`);
    params.push(date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Total count matching filters
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM orders o ${whereClause};`,
    params
  );
  const total = countResult.rows[0].total;

  // 2. Paginated rows
  const queryParams = [...params, limit, offset];
  const listQuery = `
    SELECT o.id, o.order_number, o.total_amount, o.status, o.customer_note,
           o.admin_note, o.created_at, o.updated_at,
           c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
           COUNT(DISTINCT oi.id)::int AS items_count,
           py.id AS payment_id, py.method AS payment_method, py.amount AS payment_amount,
           py.payment_proof_url, py.status AS payment_status
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN LATERAL (
      SELECT id, method, amount, payment_proof_url, status
      FROM payments
      WHERE order_id = o.id
      ORDER BY created_at DESC
      LIMIT 1
    ) py ON true
    ${whereClause}
    GROUP BY o.id, c.id, py.id, py.method, py.amount, py.payment_proof_url, py.status
    ORDER BY o.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++};
  `;

  const listResult = await db.query(listQuery, queryParams);

  const formattedOrders = listResult.rows.map(row => {
    const activePayment = row.payment_id ? {
      id: row.payment_id,
      method: row.payment_method,
      amount: parseFloat(row.payment_amount || 0),
      payment_proof_url: row.payment_proof_url,
      status: row.payment_status
    } : null;

    return {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      total_amount: parseFloat(row.total_amount),
      items_count: row.items_count,
      customer_note: row.customer_note,
      admin_note: row.admin_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        phone: row.customer_phone,
        address: row.customer_address
      },
      active_payment: activePayment,
      payments: activePayment ? [activePayment] : []
    };
  });

  return {
    total,
    orders: formattedOrders
  };
}

/**
 * Updates an order's status.
 */
async function updateOrderStatus(id, status) {
  const check = await db.query('SELECT id FROM orders WHERE id = $1;', [id]);
  if (check.rows.length === 0) {
    return null;
  }

  const result = await db.query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, order_number, status, total_amount, updated_at;`,
    [status, id]
  );

  return {
    ...result.rows[0],
    total_amount: parseFloat(result.rows[0].total_amount)
  };
}

/**
 * Updates an order's administrative note.
 */
async function updateAdminNote(id, adminNote) {
  const check = await db.query('SELECT id FROM orders WHERE id = $1;', [id]);
  if (check.rows.length === 0) {
    return null;
  }

  const cleanNote = typeof adminNote === 'string' && adminNote.trim() ? adminNote.trim() : null;

  const result = await db.query(
    `UPDATE orders
     SET admin_note = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, order_number, admin_note, updated_at;`,
    [cleanNote, id]
  );

  return result.rows[0];
}


/**
 * Customer looks up their previous order securely by matching BOTH order_number and phone.
 * Never allows lookup by phone alone or order_number alone.
 */
async function lookupCustomerOrder({ order_number, phone }) {
  if (!order_number || typeof order_number !== 'string' || !phone || typeof phone !== 'string') {
    return null;
  }

  const cleanOrderNumber = order_number.trim().toUpperCase();
  const cleanPhone = phone.trim();

  const orderResult = await db.query(
    `SELECT o.id, o.order_number, o.total_amount, o.status, o.customer_note,
            o.created_at, o.updated_at,
            c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE UPPER(o.order_number) = $1 AND c.phone = $2;`,
    [cleanOrderNumber, cleanPhone]
  );

  if (orderResult.rows.length === 0) {
    return null;
  }

  const orderRow = orderResult.rows[0];
  return getOrderById(orderRow.id, { isAdmin: false });
}

module.exports = {
  lookupCustomerOrder,
  createOrder,
  getOrderById,
  getOrderByNumber,
  getAdminOrders,
  updateOrderStatus,
  updateAdminNote
};
