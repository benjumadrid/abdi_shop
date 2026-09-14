const crypto = require('crypto');
const db = require('../db/db');
const { isValidUuid } = require('../utils/validators');

/**
 * Normalizes payment object for customer response (strips admin private fields).
 */
function formatCustomerPayment(p) {
  if (!p) return null;
  return {
    id: p.id,
    order_id: p.order_id,
    method: p.method,
    amount: parseFloat(p.amount),
    payment_proof_url: p.payment_proof_url,
    status: p.status,
    customer_message: p.customer_message,
    reviewed_at: p.reviewed_at,
    created_at: p.created_at,
    updated_at: p.updated_at
  };
}

/**
 * Normalizes payment object for admin response.
 */
function formatAdminPayment(p) {
  if (!p) return null;
  return {
    id: p.id,
    order_id: p.order_id,
    order_number: p.order_number,
    method: p.method,
    amount: parseFloat(p.amount),
    payment_proof_url: p.payment_proof_url,
    status: p.status,
    admin_note: p.admin_note,
    customer_message: p.customer_message,
    verified_by: p.verified_by,
    verified_at: p.verified_at,
    reviewed_by: p.reviewed_by,
    reviewed_at: p.reviewed_at,
    created_at: p.created_at,
    updated_at: p.updated_at,
    customer: p.customer_name ? {
      name: p.customer_name,
      phone: p.customer_phone,
      address: p.customer_address
    } : undefined
  };
}

/**
 * Retrieves configured payment methods by reading admin_settings from database.
 */
async function getPaymentMethods() {
  const result = await db.query(`
    SELECT setting_key, setting_value
    FROM admin_settings
    WHERE setting_key IN (
      'telebirr_account_number', 'telebirr_phone', 'telebirr_account_name',
      'cbe_account_number', 'cbe_account_name',
      'abyssinia_account_number', 'abyssinia_account_name',
      'cash_advance_amount'
    );
  `);

  const settingsMap = new Map(result.rows.map(r => [r.setting_key, r.setting_value]));

  const telebirrAccount = settingsMap.get('telebirr_account_number') || settingsMap.get('telebirr_phone') || '0931862253';
  const telebirrAccountName = settingsMap.get('telebirr_account_name') || 'Nuru';
  const cbeAccount = settingsMap.get('cbe_account_number') || '1000584744573';
  const cbeAccountName = settingsMap.get('cbe_account_name') || 'Behrdin seid';
  const abyssiniaAccount = settingsMap.get('abyssinia_account_number') || '251444412';
  const abyssiniaAccountName = settingsMap.get('abyssinia_account_name') || 'Abdulhafiz sani';
  const cashAdvanceAmount = parseFloat(settingsMap.get('cash_advance_amount') || '200');

  return {
    methods: [
      {
        method: 'telebirr',
        name: 'Telebirr',
        account_number: telebirrAccount,
        account_name: telebirrAccountName
      },
      {
        method: 'cbe',
        name: 'Commercial Bank of Ethiopia (CBE)',
        account_number: cbeAccount,
        account_name: cbeAccountName
      },
      {
        method: 'abyssinia',
        name: 'Bank of Abyssinia',
        account_number: abyssiniaAccount,
        account_name: abyssiniaAccountName
      },
      {
        method: 'cash',
        name: 'Cash on Delivery',
        advance_deposit: cashAdvanceAmount,
        advance_deposit_note: 'Requires 200 ETB advance security deposit screenshot'
      }
    ]
  };
}

/**
 * Customer submits a payment attempt for an existing order.
 * Validates order status, exact amount match, active payment checks, and updates order status.
 */
async function submitPayment(paymentData) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { order_id, method, amount, payment_proof_url } = paymentData;
    const normalizedMethod = method.trim().toLowerCase();
    const cleanProofUrl = typeof payment_proof_url === 'string' && payment_proof_url.trim() ? payment_proof_url.trim() : null;

    // 1. Lock and verify order
    const orderRes = await client.query(`
      SELECT id, total_amount, status
      FROM orders
      WHERE id = $1
      FOR UPDATE;
    `, [order_id]);

    if (orderRes.rows.length === 0) {
      const err = new Error('Order not found.');
      err.status = 404;
      throw err;
    }

    const order = orderRes.rows[0];

    // Cannot pay for cancelled, rejected, or delivered orders
    if (['cancelled', 'rejected', 'delivered'].includes(order.status)) {
      const err = new Error(`Cannot submit payment for an order with status "${order.status}".`);
      err.status = 400;
      throw err;
    }

    // 2. Validate amount matches exact order total
    const orderTotal = parseFloat(order.total_amount);
    const submittedAmount = Number(amount);

    if (Math.abs(orderTotal - submittedAmount) > 0.001) {
      const err = new Error(`Submitted payment amount (${submittedAmount}) does not match order total (${orderTotal}).`);
      err.status = 400;
      throw err;
    }

    // 3. Check for existing active payment (pending or verified)
    const activePaymentRes = await client.query(`
      SELECT id, status
      FROM payments
      WHERE order_id = $1 AND status IN ('pending', 'verified')
      FOR UPDATE;
    `, [order_id]);

    if (activePaymentRes.rows.length > 0) {
      const active = activePaymentRes.rows[0];
      const err = new Error(`An active payment (${active.status}) already exists for this order.`);
      err.status = 409;
      throw err;
    }

    // 4. Insert new payment record
    const insertRes = await client.query(`
      INSERT INTO payments (
        order_id,
        method,
        amount,
        payment_proof_url,
        status
      )
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, order_id, method, amount, status, payment_proof_url, created_at, updated_at;
    `, [order_id, normalizedMethod, orderTotal, cleanProofUrl]);

    const createdPayment = insertRes.rows[0];

    // 5. Update order status if appropriate (all payments with proof require admin review)
    if (order.status === 'pending') {
      await client.query(`
        UPDATE orders
        SET status = 'payment_review', updated_at = NOW()
        WHERE id = $1;
      `, [order_id]);
    }

    await client.query('COMMIT');

    return formatCustomerPayment(createdPayment);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Customer retrieves payment status and history for an order.
 */
async function getPaymentByOrderId(orderId) {
  const orderCheck = await db.query('SELECT id FROM orders WHERE id = $1;', [orderId]);
  if (orderCheck.rows.length === 0) {
    return null;
  }

  const paymentsRes = await db.query(`
    SELECT id, order_id, method, amount, payment_proof_url, status, customer_message, reviewed_at, created_at, updated_at
    FROM payments
    WHERE order_id = $1
    ORDER BY created_at DESC;
  `, [orderId]);

  const history = paymentsRes.rows.map(formatCustomerPayment);
  const activePayment = history.find(p => p.status !== 'rejected') || (history.length > 0 ? history[0] : null);

  return {
    order_id: orderId,
    active_payment: activePayment,
    history
  };
}

/**
 * Admin lists payments with pagination and filters.
 */
async function getAdminPayments({ status, method, date, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`p.status = $${paramIdx++}`);
    params.push(status);
  }

  if (method) {
    conditions.push(`p.method = $${paramIdx++}`);
    params.push(method);
  }

  if (date) {
    conditions.push(`DATE(p.created_at) = $${paramIdx++}::date`);
    params.push(date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(`
    SELECT COUNT(*)::int AS total
    FROM payments p
    ${whereClause};
  `, params);

  const total = countRes.rows[0].total;

  const queryParams = [...params, limit, offset];
  const listQuery = `
    SELECT p.id, p.order_id, p.method, p.amount, p.payment_proof_url,
           p.status, p.admin_note, p.customer_message, p.verified_by, p.verified_at,
           p.reviewed_by, p.reviewed_at, p.created_at, p.updated_at,
           o.order_number, o.status AS order_status,
           c.name AS customer_name, c.phone AS customer_phone
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN customers c ON o.customer_id = c.id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++};
  `;

  const listRes = await db.query(listQuery, queryParams);

  return {
    total,
    payments: listRes.rows.map(formatAdminPayment)
  };
}

/**
 * Admin retrieves full payment details including linked order, customer, and items.
 */
async function getAdminPaymentById(id) {
  const paymentRes = await db.query(`
    SELECT p.id, p.order_id, p.method, p.amount, p.payment_proof_url,
           p.status, p.admin_note, p.customer_message, p.verified_by, p.verified_at,
           p.reviewed_by, p.reviewed_at, p.created_at, p.updated_at,
           o.order_number, o.status AS order_status, o.total_amount AS order_total_amount,
           o.customer_note,
           c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN customers c ON o.customer_id = c.id
    WHERE p.id = $1;
  `, [id]);

  if (paymentRes.rows.length === 0) {
    return null;
  }

  const p = paymentRes.rows[0];

  const itemsRes = await db.query(`
    SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
           pr.name_en AS product_name_en, pr.name_am AS product_name_am
    FROM order_items oi
    JOIN products pr ON oi.product_id = pr.id
    WHERE oi.order_id = $1
    ORDER BY oi.id ASC;
  `, [p.order_id]);

  return {
    ...formatAdminPayment(p),
    order: {
      id: p.order_id,
      order_number: p.order_number,
      status: p.order_status,
      total_amount: parseFloat(p.order_total_amount),
      customer_note: p.customer_note,
      items: itemsRes.rows.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name_en: item.product_name_en,
        product_name_am: item.product_name_am,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price),
        subtotal: parseFloat(item.subtotal)
      }))
    }
  };
}

/**
 * Admin verifies a pending payment.
 * Moves payment to verified and order to confirmed (if pending or payment_review).
 */
async function verifyPayment(paymentId, { adminId = null } = {}) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Lock and check payment
    const paymentRes = await client.query(`
      SELECT id, order_id, method, amount, status
      FROM payments
      WHERE id = $1
      FOR UPDATE;
    `, [paymentId]);

    if (paymentRes.rows.length === 0) {
      const err = new Error('Payment not found.');
      err.status = 404;
      throw err;
    }

    const payment = paymentRes.rows[0];

    if (payment.status !== 'pending') {
      const err = new Error(`Cannot verify payment with status "${payment.status}". Only pending payments can be verified.`);
      err.status = 400;
      throw err;
    }

    // 2. Lock and check order
    const orderRes = await client.query(`
      SELECT id, status
      FROM orders
      WHERE id = $1
      FOR UPDATE;
    `, [payment.order_id]);

    const order = orderRes.rows[0];

    // 3. Update payment to verified
    const updatePaymentRes = await client.query(`
      UPDATE payments
      SET status = 'verified',
          verified_by = $1,
          verified_at = NOW(),
          reviewed_by = $1,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `, [adminId, paymentId]);

    // 4. Update order status to confirmed if currently pending or payment_review
    let updatedOrderStatus = order ? order.status : null;
    if (order && ['pending', 'payment_review'].includes(order.status)) {
      const updateOrderRes = await client.query(`
        UPDATE orders
        SET status = 'confirmed', updated_at = NOW()
        WHERE id = $1
        RETURNING status;
      `, [payment.order_id]);
      updatedOrderStatus = updateOrderRes.rows[0].status;
    }

    await client.query('COMMIT');

    return {
      payment: formatAdminPayment(updatePaymentRes.rows[0]),
      order: {
        id: payment.order_id,
        status: updatedOrderStatus
      }
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin rejects a pending payment with internal admin note and customer message.
 * Moves order back to 'pending' if it was in 'payment_review'.
 */
async function rejectPayment(paymentId, { admin_note, customer_message, adminId = null } = {}) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Lock and check payment
    const paymentRes = await client.query(`
      SELECT id, order_id, method, amount, status
      FROM payments
      WHERE id = $1
      FOR UPDATE;
    `, [paymentId]);

    if (paymentRes.rows.length === 0) {
      const err = new Error('Payment not found.');
      err.status = 404;
      throw err;
    }

    const payment = paymentRes.rows[0];

    if (payment.status !== 'pending') {
      const err = new Error(`Cannot reject payment with status "${payment.status}". Only pending payments can be rejected.`);
      err.status = 400;
      throw err;
    }

    // 2. Lock and check order
    const orderRes = await client.query(`
      SELECT id, status
      FROM orders
      WHERE id = $1
      FOR UPDATE;
    `, [payment.order_id]);

    const order = orderRes.rows[0];

    const cleanAdminNote = typeof admin_note === 'string' && admin_note.trim() ? admin_note.trim() : null;
    const cleanCustomerMsg = typeof customer_message === 'string' && customer_message.trim() ? customer_message.trim() : null;

    // 3. Update payment to rejected
    const updatePaymentRes = await client.query(`
      UPDATE payments
      SET status = 'rejected',
          reviewed_by = $1,
          reviewed_at = NOW(),
          admin_note = $2,
          customer_message = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `, [adminId, cleanAdminNote, cleanCustomerMsg, paymentId]);

    // 4. Move order back to pending if in payment_review
    let updatedOrderStatus = order ? order.status : null;
    if (order && order.status === 'payment_review') {
      const updateOrderRes = await client.query(`
        UPDATE orders
        SET status = 'pending', updated_at = NOW()
        WHERE id = $1
        RETURNING status;
      `, [payment.order_id]);
      updatedOrderStatus = updateOrderRes.rows[0].status;
    }

    await client.query('COMMIT');

    return {
      payment: formatAdminPayment(updatePaymentRes.rows[0]),
      order: {
        id: payment.order_id,
        status: updatedOrderStatus
      }
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Saves an uploaded payment proof file to persistent PostgreSQL object storage.
 * @param {object} params
 * @param {string} params.orderId - Associated order UUID
 * @param {Buffer} params.fileBuffer - Binary file data
 * @param {string} params.mimeType - Verified MIME type
 * @param {string} params.extension - File extension (e.g. 'jpg', 'png', 'webp')
 * @param {string} [params.originalName] - Original client filename
 * @param {string} [params.baseUrl] - Optional host base URL
 * @returns {Promise<object>}
 */
async function savePaymentProofFile({ orderId, fileBuffer, mimeType, extension = 'jpg', originalName = '', baseUrl = '' }) {
  if (!orderId || !isValidUuid(orderId)) {
    const err = new Error('Valid order_id (UUID) is required to upload a payment proof.');
    err.status = 400;
    throw err;
  }

  // 1. Check order existence and status
  const orderRes = await db.query('SELECT id, status, total_amount FROM orders WHERE id = $1;', [orderId]);
  if (orderRes.rows.length === 0) {
    const err = new Error('Order not found.');
    err.status = 404;
    throw err;
  }

  const order = orderRes.rows[0];
  if (['cancelled', 'rejected', 'delivered'].includes(order.status)) {
    const err = new Error(`Cannot upload payment proof for an order with status "${order.status}".`);
    err.status = 400;
    throw err;
  }

  // 2. Generate a secure, sanitized, non-guessable filename
  const cleanExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const safeFilename = `proof-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${cleanExt}`;

  // 3. Insert into persistent PostgreSQL object storage
  const insertRes = await db.query(`
    INSERT INTO payment_proof_files (order_id, filename, mime_type, file_size, file_data)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, order_id, filename, mime_type, file_size, created_at;
  `, [orderId, safeFilename, mimeType, fileBuffer.length, fileBuffer]);

  const record = insertRes.rows[0];
  const relativeUrl = `/api/payments/proof/${record.id}`;
  const fullUrl = baseUrl ? `${baseUrl.replace(/\/+$/, '')}${relativeUrl}` : relativeUrl;

  return {
    file_id: record.id,
    order_id: record.order_id,
    filename: record.filename,
    mime_type: record.mime_type,
    file_size: record.file_size,
    file_url: relativeUrl,
    full_url: fullUrl,
    created_at: record.created_at
  };
}

/**
 * Retrieves a stored payment proof file by ID.
 * @param {string} fileId
 * @returns {Promise<object|null>}
 */
async function getPaymentProofFile(fileId) {
  if (!fileId || !isValidUuid(fileId)) {
    return null;
  }

  const res = await db.query(`
    SELECT id, order_id, filename, mime_type, file_size, file_data, created_at
    FROM payment_proof_files
    WHERE id = $1;
  `, [fileId]);

  if (res.rows.length === 0) {
    return null;
  }

  return res.rows[0];
}

module.exports = {
  getPaymentMethods,
  submitPayment,
  getPaymentByOrderId,
  getAdminPayments,
  getAdminPaymentById,
  verifyPayment,
  rejectPayment,
  savePaymentProofFile,
  getPaymentProofFile
};
