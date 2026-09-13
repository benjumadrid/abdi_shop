const db = require('../db/db');

/**
 * Service providing real-time operational metrics, financial stats,
 * inventory alerts, and order breakdowns for the Admin AI Copilot.
 */
async function getAdminOverviewAnalytics() {
  // 1. Today's metrics (since midnight local / UTC)
  const todayResult = await db.query(`
    SELECT
      COUNT(*)::int AS today_orders_count,
      COALESCE(SUM(total_amount), 0)::numeric AS today_revenue,
      COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS today_pending,
      COUNT(CASE WHEN status = 'payment_review' THEN 1 END)::int AS today_payment_review,
      COUNT(CASE WHEN status = 'confirmed' THEN 1 END)::int AS today_confirmed,
      COUNT(CASE WHEN status = 'out_for_delivery' THEN 1 END)::int AS today_out_for_delivery,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END)::int AS today_delivered,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int AS today_cancelled
    FROM orders
    WHERE created_at >= CURRENT_DATE;
  `);

  // 2. All-time metrics & pipeline
  const allTimeResult = await db.query(`
    SELECT
      COUNT(*)::int AS total_orders_count,
      COALESCE(SUM(CASE WHEN status IN ('confirmed', 'out_for_delivery', 'delivered') THEN total_amount ELSE 0 END), 0)::numeric AS total_confirmed_revenue,
      COALESCE(SUM(total_amount), 0)::numeric AS total_gross_revenue,
      COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS all_pending,
      COUNT(CASE WHEN status = 'payment_review' THEN 1 END)::int AS all_payment_review,
      COUNT(CASE WHEN status = 'confirmed' THEN 1 END)::int AS all_confirmed,
      COUNT(CASE WHEN status = 'out_for_delivery' THEN 1 END)::int AS all_out_for_delivery,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END)::int AS all_delivered,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int AS all_cancelled
    FROM orders;
  `);

  // 3. Pending Telebirr screenshots needing review
  const pendingPaymentsResult = await db.query(`
    SELECT
      p.id AS payment_id,
      p.order_id,
      o.order_number,
      p.amount,
      p.method,
      p.status,
      p.payment_proof_url,
      p.created_at,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN customers c ON o.customer_id = c.id
    WHERE p.status = 'submitted'
    ORDER BY p.created_at ASC;
  `);

  // 4. Products catalog & stock status
  const productsResult = await db.query(`
    SELECT
      id,
      name_en,
      name_am,
      price,
      is_available,
      image_url
    FROM products
    ORDER BY is_available ASC, name_en ASC;
  `);

  // 5. Top-selling products
  const topProductsResult = await db.query(`
    SELECT
      pr.id,
      pr.name_en,
      pr.name_am,
      pr.price,
      pr.is_available,
      COALESCE(SUM(oi.quantity), 0)::int AS total_sold_qty,
      COUNT(DISTINCT oi.order_id)::int AS order_count,
      COALESCE(SUM(oi.subtotal), 0)::numeric AS total_revenue
    FROM products pr
    LEFT JOIN order_items oi ON pr.id = oi.product_id
    GROUP BY pr.id, pr.name_en, pr.name_am, pr.price, pr.is_available
    ORDER BY total_sold_qty DESC, total_revenue DESC;
  `);

  // 6. Recent orders with customer and item breakdown (last 20)
  const recentOrdersResult = await db.query(`
    SELECT
      o.id,
      o.order_number,
      o.total_amount,
      o.status,
      o.customer_note,
      o.created_at,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address,
      COALESCE(
        (
          SELECT json_agg(json_build_object(
            'product_name_en', pr.name_en,
            'product_name_am', pr.name_am,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'subtotal', oi.subtotal
          ))
          FROM order_items oi
          JOIN products pr ON oi.product_id = pr.id
          WHERE oi.order_id = o.id
        ),
        '[]'::json
      ) AS items,
      COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id', py.id,
            'method', py.method,
            'amount', py.amount,
            'status', py.status,
            'payment_proof_url', py.payment_proof_url
          ))
          FROM payments py
          WHERE py.order_id = o.id
        ),
        '[]'::json
      ) AS payments
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    ORDER BY o.created_at DESC
    LIMIT 100;
  `);

  const todayStats = todayResult.rows[0] || {};
  const allTimeStats = allTimeResult.rows[0] || {};
  const products = productsResult.rows || [];
  const inStockProducts = products.filter(p => p.is_available !== false);
  const outOfStockProducts = products.filter(p => p.is_available === false);

  return {
    today: {
      orders_count: todayStats.today_orders_count || 0,
      revenue: parseFloat(todayStats.today_revenue || 0),
      pending: todayStats.today_pending || 0,
      payment_review: todayStats.today_payment_review || 0,
      confirmed: todayStats.today_confirmed || 0,
      out_for_delivery: todayStats.today_out_for_delivery || 0,
      delivered: todayStats.today_delivered || 0,
      cancelled: todayStats.today_cancelled || 0
    },
    all_time: {
      total_orders: allTimeStats.total_orders_count || 0,
      confirmed_revenue: parseFloat(allTimeStats.total_confirmed_revenue || 0),
      gross_revenue: parseFloat(allTimeStats.total_gross_revenue || 0),
      pending: allTimeStats.all_pending || 0,
      payment_review: allTimeStats.all_payment_review || 0,
      confirmed: allTimeStats.all_confirmed || 0,
      out_for_delivery: allTimeStats.all_out_for_delivery || 0,
      delivered: allTimeStats.all_delivered || 0,
      cancelled: allTimeStats.all_cancelled || 0
    },
    pending_payments: {
      count: pendingPaymentsResult.rows.length,
      items: pendingPaymentsResult.rows
    },
    inventory: {
      total_catalog: products.length,
      in_stock_count: inStockProducts.length,
      out_of_stock_count: outOfStockProducts.length,
      out_of_stock_products: outOfStockProducts.map(p => ({
        id: p.id,
        name_en: p.name_en,
        name_am: p.name_am,
        price: parseFloat(p.price)
      })),
      all_products: products.map(p => ({
        id: p.id,
        name_en: p.name_en,
        name_am: p.name_am,
        price: parseFloat(p.price),
        is_available: p.is_available !== false
      }))
    },
    top_products: topProductsResult.rows.map(p => ({
      id: p.id,
      name_en: p.name_en,
      name_am: p.name_am,
      price: parseFloat(p.price),
      total_sold_qty: p.total_sold_qty,
      order_count: p.order_count,
      total_revenue: parseFloat(p.total_revenue || 0)
    })),
    recent_orders: recentOrdersResult.rows.map(o => ({
      id: o.id,
      order_number: o.order_number,
      total_amount: parseFloat(o.total_amount),
      status: o.status,
      customer_note: o.customer_note,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      customer_address: o.customer_address,
      items: o.items || [],
      payments: o.payments || [],
      created_at: o.created_at
    })),
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  getAdminOverviewAnalytics
};
