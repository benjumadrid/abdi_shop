const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

process.env.NODE_ENV = 'test';
const { app } = require('../src/server');

const BASE_URL = 'http://localhost:5000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runOrderTests() {
  console.log('=== STARTING ORDERS API VERIFICATION TESTS ===\n');

  let serverInstance = null;

  // Ensure server is reachable, start if necessary
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/health`);
    if (!healthCheck.ok) throw new Error('Not running');
  } catch (err) {
    console.log('[Setup] Local server not running on port 5000. Starting in-process server...');
    serverInstance = app.listen(5000);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Tracking IDs for cleanup
  const createdOrderIds = [];
  const createdCustomerIds = [];
  const createdProductIds = [];
  let adminToken = null;

  // Auth helper: login as admin and return JWT token
  async function getAdminToken() {
    const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL || 'admin@abdi.com',
        password: process.env.ADMIN_PASSWORD || 'admin1234'
      })
    });
    const data = await res.json();
    if (!data.data || !data.data.token) {
      throw new Error('Failed to get admin token for tests');
    }
    return data.data.token;
  }

  try {
    // Login as admin for protected endpoints
    adminToken = await getAdminToken();
    console.log('[Setup] Admin token acquired for order tests.\n');

    // Fetch seeded products to use for test orders
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    const productsData = await productsRes.json();
    const seededProducts = productsData.data;

    assert(seededProducts && seededProducts.length >= 3, 'Found initial seeded products for tests');
    const p1 = seededProducts[0]; // e.g. Yemeni Honey (3000)
    const p2 = seededProducts[1]; // e.g. Cramp Relief (2500)
    const p3 = seededProducts[2]; // e.g. iPhone Cable (1000)

    // -----------------------------------------------------------------------
    // Test 1: Create an order with one product
    // -----------------------------------------------------------------------
    console.log('\n--- Test 1: Create an order with one product ---');
    const order1Payload = {
      customer: {
        name: 'Abebe Bikila',
        phone: '+251911111111',
        address: 'Dessie, Kebele 03'
      },
      items: [
        { product_id: p1.id, quantity: 1 }
      ],
      customer_note: 'Deliver in morning'
    };
    const res1 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order1Payload)
    });
    const data1 = await res1.json();

    assert(res1.status === 201, 'POST /api/orders returns HTTP 201');
    assert(data1.success === true, 'Response indicates success: true');
    assert(data1.data.items.length === 1, 'Order has 1 item');
    assert(data1.data.total_amount === p1.price, `Total amount matches product 1 price (${p1.price})`);
    assert(data1.data.order_number.startsWith('ORD-'), `Order number starts with ORD- (${data1.data.order_number})`);
    assert(typeof data1.data.items[0].image_url === 'string' && data1.data.items[0].image_url.startsWith('/api/products/media/'), 'Order item has primary media image_url');

    const order1 = data1.data;
    createdOrderIds.push(order1.id);
    createdCustomerIds.push(order1.customer.id);

    // -----------------------------------------------------------------------
    // Test 2: Create an order with multiple products
    // -----------------------------------------------------------------------
    console.log('\n--- Test 2: Create an order with multiple products ---');
    const order2Payload = {
      customer: {
        name: 'Fatima Ahmed',
        phone: '+251922222222',
        address: 'Dessie, Piazza'
      },
      items: [
        { product_id: p1.id, quantity: 1 },
        { product_id: p2.id, quantity: 1 }
      ]
    };
    const res2 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order2Payload)
    });
    const data2 = await res2.json();
    assert(res2.status === 201, 'POST with multiple products returns HTTP 201');
    assert(data2.data.items.length === 2, 'Order has 2 items');

    const expectedTotal2 = p1.price + p2.price;
    assert(data2.data.total_amount === expectedTotal2, `Total amount (${data2.data.total_amount}) matches sum of products (${expectedTotal2})`);

    const order2 = data2.data;
    createdOrderIds.push(order2.id);
    createdCustomerIds.push(order2.customer.id);

    // -----------------------------------------------------------------------
    // Test 3: Create an order with multiple quantities
    // -----------------------------------------------------------------------
    console.log('\n--- Test 3: Create an order with multiple quantities ---');
    const order3Payload = {
      customer: {
        name: 'Chala Tadesse',
        phone: '+251933333333',
        address: 'Dessie, Robit'
      },
      items: [
        { product_id: p3.id, quantity: 3 }
      ]
    };
    const res3 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order3Payload)
    });
    const data3 = await res3.json();
    assert(res3.status === 201, 'POST with multiple quantity returns HTTP 201');
    assert(data3.data.items[0].quantity === 3, 'Item quantity is 3');

    const order3 = data3.data;
    createdOrderIds.push(order3.id);
    createdCustomerIds.push(order3.customer.id);

    // -----------------------------------------------------------------------
    // Test 4: Verify total calculation
    // -----------------------------------------------------------------------
    console.log('\n--- Test 4: Verify total calculation ---');
    const expectedTotal3 = p3.price * 3;
    assert(order3.total_amount === expectedTotal3, `Total ${order3.total_amount} == 3 * ${p3.price} (${expectedTotal3})`);

    // -----------------------------------------------------------------------
    // Test 5: Verify unit_price snapshot
    // -----------------------------------------------------------------------
    console.log('\n--- Test 5: Verify unit_price snapshot ---');
    assert(order3.items[0].unit_price === p3.price, `Stored unit_price (${order3.items[0].unit_price}) matches DB price (${p3.price})`);

    // -----------------------------------------------------------------------
    // Test 6: Verify subtotal
    // -----------------------------------------------------------------------
    console.log('\n--- Test 6: Verify subtotal ---');
    assert(order3.items[0].subtotal === expectedTotal3, `Item subtotal (${order3.items[0].subtotal}) == quantity * unit_price`);

    // -----------------------------------------------------------------------
    // Test 7: Verify customer creation
    // -----------------------------------------------------------------------
    console.log('\n--- Test 7: Verify customer creation ---');
    assert(order1.customer.name === 'Abebe Bikila', 'Customer 1 name is Abebe Bikila');
    assert(order1.customer.phone === '+251911111111', 'Customer 1 phone is +251911111111');
    assert(order1.customer.address === 'Dessie, Kebele 03', 'Customer 1 address is Dessie, Kebele 03');

    // -----------------------------------------------------------------------
    // Test 8: Create another order using same phone and verify customer reuse
    // -----------------------------------------------------------------------
    console.log('\n--- Test 8: Create another order using same phone and verify customer reuse ---');
    const orderReusePayload = {
      customer: {
        name: 'Abebe Bikila Updated',
        phone: '+251911111111', // same phone as customer 1
        address: 'Dessie, Kebele 04 New Address'
      },
      items: [
        { product_id: p2.id, quantity: 1 }
      ]
    };
    const resReuse = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderReusePayload)
    });
    const dataReuse = await resReuse.json();
    assert(resReuse.status === 201, 'Order with existing customer phone returns HTTP 201');
    assert(dataReuse.data.customer.id === order1.customer.id, 'Reused existing customer ID');
    assert(dataReuse.data.customer.name === 'Abebe Bikila Updated', 'Customer name was updated');
    assert(dataReuse.data.customer.address === 'Dessie, Kebele 04 New Address', 'Customer address was updated');

    createdOrderIds.push(dataReuse.data.id);

    // -----------------------------------------------------------------------
    // Test 9: Test missing customer name
    // -----------------------------------------------------------------------
    console.log('\n--- Test 9: Test missing customer name ---');
    const res9 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { phone: '+251944444444', address: 'Dessie' },
        items: [{ product_id: p1.id, quantity: 1 }]
      })
    });
    assert(res9.status === 400, 'Missing customer name returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 10: Test missing phone
    // -----------------------------------------------------------------------
    console.log('\n--- Test 10: Test missing phone ---');
    const res10 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', address: 'Dessie' },
        items: [{ product_id: p1.id, quantity: 1 }]
      })
    });
    assert(res10.status === 400, 'Missing phone returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 11: Test missing address
    // -----------------------------------------------------------------------
    console.log('\n--- Test 11: Test missing address ---');
    const res11 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', phone: '+251944444444' },
        items: [{ product_id: p1.id, quantity: 1 }]
      })
    });
    assert(res11.status === 400, 'Missing address returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 12: Test empty items
    // -----------------------------------------------------------------------
    console.log('\n--- Test 12: Test empty items ---');
    const res12 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', phone: '+251944444444', address: 'Dessie' },
        items: []
      })
    });
    assert(res12.status === 400, 'Empty items array returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 13: Test invalid product UUID
    // -----------------------------------------------------------------------
    console.log('\n--- Test 13: Test invalid product UUID ---');
    const res13 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', phone: '+251944444444', address: 'Dessie' },
        items: [{ product_id: 'not-a-uuid', quantity: 1 }]
      })
    });
    assert(res13.status === 400, 'Invalid product UUID returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 14: Test nonexistent product
    // -----------------------------------------------------------------------
    console.log('\n--- Test 14: Test nonexistent product ---');
    const res14 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', phone: '+251944444444', address: 'Dessie' },
        items: [{ product_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }]
      })
    });
    assert(res14.status === 404, 'Nonexistent product returns HTTP 404');

    // -----------------------------------------------------------------------
    // Test 15: Test unavailable product
    // -----------------------------------------------------------------------
    console.log('\n--- Test 15: Test unavailable product ---');
    // Create a temporary unavailable product
    const unavailProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        name_en: 'Out of Stock Item',
        name_am: 'ያለቀ እቃ',
        price: 999,
        is_available: false
      })
    });
    const unavailData = await unavailProdRes.json();
    const unavailId = unavailData.data.id;
    createdProductIds.push(unavailId);

    const res15 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', phone: '+251944444444', address: 'Dessie' },
        items: [{ product_id: unavailId, quantity: 1 }]
      })
    });
    const data15 = await res15.json();
    assert(res15.status === 400, 'Unavailable product returns HTTP 400');
    assert(data15.message.includes('unavailable'), 'Helpful message indicating unavailable product');

    // -----------------------------------------------------------------------
    // Test 16: Test quantity 0
    // -----------------------------------------------------------------------
    console.log('\n--- Test 16: Test quantity 0 ---');
    const res16 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', phone: '+251944444444', address: 'Dessie' },
        items: [{ product_id: p1.id, quantity: 0 }]
      })
    });
    assert(res16.status === 400, 'Quantity 0 returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 17: Test negative quantity
    // -----------------------------------------------------------------------
    console.log('\n--- Test 17: Test negative quantity ---');
    const res17 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', phone: '+251944444444', address: 'Dessie' },
        items: [{ product_id: p1.id, quantity: -2 }]
      })
    });
    assert(res17.status === 400, 'Negative quantity returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 18: Test decimal quantity
    // -----------------------------------------------------------------------
    console.log('\n--- Test 18: Test decimal quantity ---');
    const res18 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Name', phone: '+251944444444', address: 'Dessie' },
        items: [{ product_id: p1.id, quantity: 1.5 }]
      })
    });
    assert(res18.status === 400, 'Decimal quantity returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 19: Test client manipulating price/total (backend ignores/rejects client price)
    // -----------------------------------------------------------------------
    console.log('\n--- Test 19: Test client manipulating price/total ---');
    const res19 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Hacker Attempt', phone: '+251955555555', address: 'Dessie' },
        items: [{
          product_id: p1.id, // Yemeni honey is 3000 ETB
          quantity: 2,
          unit_price: 1, // Client tries to pay 1 ETB
          subtotal: 2
        }],
        total_amount: 2 // Client claims total is 2 ETB
      })
    });
    const data19 = await res19.json();
    assert(res19.status === 201, 'Order created successfully');
    assert(data19.data.items[0].unit_price === p1.price, `Stored unit price (${data19.data.items[0].unit_price}) is DB price (${p1.price}), not manipulated 1`);
    assert(data19.data.total_amount === p1.price * 2, `Stored total (${data19.data.total_amount}) is computed correctly (6000), not manipulated 2`);

    createdOrderIds.push(data19.data.id);
    createdCustomerIds.push(data19.data.customer.id);

    // -----------------------------------------------------------------------
    // Test 20 & 37: Verify failed orders do not leave partial database records / rollback
    // -----------------------------------------------------------------------
    console.log('\n--- Test 20 & 37: Transaction rollback verification ---');
    const client = await pool.connect();
    let preOrderCount = 0;
    let preItemCount = 0;
    try {
      const oCount = await client.query('SELECT count(*)::int AS cnt FROM orders;');
      const iCount = await client.query('SELECT count(*)::int AS cnt FROM order_items;');
      preOrderCount = oCount.rows[0].cnt;
      preItemCount = iCount.rows[0].cnt;

      // Attempt order with 1 valid product and 1 invalid nonexistent product
      const resRollback = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: 'Fail Customer', phone: '+251966666666', address: 'Dessie' },
          items: [
            { product_id: p1.id, quantity: 1 },
            { product_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }
          ]
        })
      });
      assert(resRollback.status === 404, 'Failed creation returns HTTP 404');

      const postOCount = await client.query('SELECT count(*)::int AS cnt FROM orders;');
      const postICount = await client.query('SELECT count(*)::int AS cnt FROM order_items;');
      assert(postOCount.rows[0].cnt === preOrderCount, 'Orders count unchanged after failed transaction');
      assert(postICount.rows[0].cnt === preItemCount, 'Order_items count unchanged after failed transaction');

    } finally {
      client.release();
    }

    // -----------------------------------------------------------------------
    // Test 21: GET order by UUID
    // -----------------------------------------------------------------------
    console.log('\n--- Test 21: GET order by UUID ---');
    const res21 = await fetch(`${BASE_URL}/api/orders/${order1.id}`);
    const data21 = await res21.json();
    assert(res21.status === 200, 'GET /api/orders/:id returns HTTP 200');
    assert(data21.data.id === order1.id, 'Fetched correct order ID');
    assert(data21.data.customer.phone === order1.customer.phone, 'Customer phone matches');
    assert(data21.data.items.length === 1, 'Items array returned');
    assert(typeof data21.data.items[0].image_url === 'string' && data21.data.items[0].image_url.startsWith('/api/products/media/'), 'Fetched order item has primary media image_url');

    // -----------------------------------------------------------------------
    // Test 22: GET order by order number
    // -----------------------------------------------------------------------
    console.log('\n--- Test 22: GET order by order number ---');
    const res22 = await fetch(`${BASE_URL}/api/orders/number/${order1.order_number}`);
    const data22 = await res22.json();
    assert(res22.status === 200, 'GET /api/orders/number/:orderNumber returns HTTP 200');
    assert(data22.data.order_number === order1.order_number, 'Returned matching order number');
    assert(data22.data.id === order1.id, 'Matching order ID');
    assert(typeof data22.data.items[0].image_url === 'string' && data22.data.items[0].image_url.startsWith('/api/products/media/'), 'Fetched order by number item has primary media image_url');

    // -----------------------------------------------------------------------
    // Test 23: Test nonexistent order
    // -----------------------------------------------------------------------
    console.log('\n--- Test 23: Test nonexistent order ---');
    const res23 = await fetch(`${BASE_URL}/api/orders/00000000-0000-0000-0000-000000000000`);
    assert(res23.status === 404, 'Nonexistent order returns HTTP 404');

    // -----------------------------------------------------------------------
    // Test 24: Test invalid UUID
    // -----------------------------------------------------------------------
    console.log('\n--- Test 24: Test invalid UUID ---');
    const res24 = await fetch(`${BASE_URL}/api/orders/invalid-uuid-abc`);
    assert(res24.status === 400, 'Invalid UUID returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 25: GET admin orders
    // -----------------------------------------------------------------------
    console.log('\n--- Test 25: GET admin orders ---');
    const res25 = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data25 = await res25.json();
    assert(res25.status === 200, 'GET /api/admin/orders returns HTTP 200');
    assert(data25.success === true, 'Response indicates success: true');
    assert(Array.isArray(data25.data), 'Returns data array of orders');
    assert(data25.pagination && data25.pagination.total >= 3, 'Pagination total reflects created orders');

    // -----------------------------------------------------------------------
    // Test 26: Test pagination
    // -----------------------------------------------------------------------
    console.log('\n--- Test 26: Test pagination ---');
    const res26 = await fetch(`${BASE_URL}/api/admin/orders?page=1&limit=2`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data26 = await res26.json();
    assert(res26.status === 200, 'Paginated query returns HTTP 200');
    assert(data26.data.length <= 2, `Data length (${data26.data.length}) is <= limit (2)`);
    assert(data26.pagination.page === 1, 'Page is 1');
    assert(data26.pagination.limit === 2, 'Limit is 2');

    // -----------------------------------------------------------------------
    // Test 27: Test status filtering
    // -----------------------------------------------------------------------
    console.log('\n--- Test 27: Test status filtering ---');
    const res27 = await fetch(`${BASE_URL}/api/admin/orders?status=pending`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data27 = await res27.json();
    assert(res27.status === 200, 'Status filter query returns HTTP 200');
    assert(data27.data.every(o => o.status === 'pending'), 'All returned orders have status "pending"');

    // -----------------------------------------------------------------------
    // Test 28: GET admin order details
    // -----------------------------------------------------------------------
    console.log('\n--- Test 28: GET admin order details ---');
    const res28 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data28 = await res28.json();
    assert(res28.status === 200, 'GET /api/admin/orders/:id returns HTTP 200');
    assert(data28.data.id === order1.id, 'Fetched correct order ID');
    assert('admin_note' in data28.data, 'Admin details include admin_note field');
    assert(Array.isArray(data28.data.payments), 'Admin details include payments array');

    // -----------------------------------------------------------------------
    // Test 29: Update order status
    // -----------------------------------------------------------------------
    console.log('\n--- Test 29: Update order status ---');
    const res29 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'confirmed' })
    });
    const data29 = await res29.json();
    assert(res29.status === 200, 'PATCH status returns HTTP 200');
    assert(data29.data.status === 'confirmed', 'Order status updated to confirmed');

    // -----------------------------------------------------------------------
    // Test 30: Reject invalid status
    // -----------------------------------------------------------------------
    console.log('\n--- Test 30: Reject invalid status ---');
    const res30 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'shipped_invalid_status' })
    });
    assert(res30.status === 400, 'Invalid status returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 31: Update admin note
    // -----------------------------------------------------------------------
    console.log('\n--- Test 31: Update admin note ---');
    const res31 = await fetch(`${BASE_URL}/api/admin/orders/${order1.id}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ admin_note: 'Verified payment on telebirr.' })
    });
    const data31 = await res31.json();
    assert(res31.status === 200, 'PATCH admin note returns HTTP 200');
    assert(data31.data.admin_note === 'Verified payment on telebirr.', 'Admin note saved properly');

    // -----------------------------------------------------------------------
    // Test 32: Verify public endpoints do NOT expose admin_note
    // -----------------------------------------------------------------------
    console.log('\n--- Test 32: Verify public endpoints do NOT expose admin_note ---');
    const pubRes1 = await fetch(`${BASE_URL}/api/orders/${order1.id}`);
    const pubData1 = await pubRes1.json();
    assert(pubData1.data.admin_note === undefined, 'Public GET /api/orders/:id does NOT include admin_note');

    const pubRes2 = await fetch(`${BASE_URL}/api/orders/number/${order1.order_number}`);
    const pubData2 = await pubRes2.json();
    assert(pubData2.data.admin_note === undefined, 'Public GET /api/orders/number/:orderNumber does NOT include admin_note');

    // -----------------------------------------------------------------------
    // Test 33: Verify /api/health
    // -----------------------------------------------------------------------
    console.log('\n--- Test 33: Verify /api/health ---');
    const res33 = await fetch(`${BASE_URL}/api/health`);
    const data33 = await res33.json();
    assert(res33.status === 200, 'Health endpoint returns HTTP 200');
    assert(data33.database.connected === true, 'Database remains healthy');

    // -----------------------------------------------------------------------
    // Test 34: Verify all original products remain intact
    // -----------------------------------------------------------------------
    console.log('\n--- Test 34: Verify all original products remain intact ---');
    const res34 = await fetch(`${BASE_URL}/api/products`);
    const data34 = await res34.json();
    const currentProducts = data34.data;
    const names = currentProducts.map(p => p.name_en);
    assert(names.includes('Original Yemeni Honey'), 'Product 1 intact');
    assert(names.includes('Original Women\'s Period Cramp Relief'), 'Product 2 intact');
    assert(names.includes('Original iPhone Cable Charger') || names.includes('WiFi Router Power Boost Cable'), 'Product 3 intact');

    // -----------------------------------------------------------------------
    // Test 35: Verify historical order prices remain unchanged after changing product price
    // -----------------------------------------------------------------------
    console.log('\n--- Test 35: Historical order prices remain unchanged after product price update ---');
    // Change p1's price to 3500
    const originalPrice = p1.price;
    await fetch(`${BASE_URL}/api/products/${p1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ price: 3500 })
    });

    // Check historical order 1 (which was bought at 3000)
    const checkOrder1 = await fetch(`${BASE_URL}/api/orders/${order1.id}`);
    const checkOrder1Data = await checkOrder1.json();
    assert(checkOrder1Data.data.items[0].unit_price === originalPrice, `Historical order unit price preserved at ${originalPrice}`);
    assert(checkOrder1Data.data.total_amount === originalPrice, `Historical order total preserved at ${originalPrice}`);

    // Revert product price back to original
    await fetch(`${BASE_URL}/api/products/${p1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ price: originalPrice })
    });
    console.log('Restored original product price to', originalPrice);

    // -----------------------------------------------------------------------
    // Test 36: Verify order_items correctly reference their products
    // -----------------------------------------------------------------------
    console.log('\n--- Test 36: Verify order_items correctly reference their products ---');
    const clientRef = await pool.connect();
    try {
      const refCheck = await clientRef.query(`
        SELECT oi.id, oi.product_id, p.name_en
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1;
      `, [order1.id]);
      assert(refCheck.rows.length === 1, 'order_items successfully joins with products');
      assert(refCheck.rows[0].product_id === p1.id, 'order_items product_id matches p1');
    } finally {
      clientRef.release();
    }

    console.log(`\n========================================`);
    console.log(`ORDERS API TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);

  } catch (err) {
    console.error('[Test Error]', err);
  } finally {
    // Clean up created test records in reverse order
    console.log('\n--- Cleaning up test records ---');
    const cleanupClient = await pool.connect();
    try {
      if (createdOrderIds.length > 0) {
        await cleanupClient.query('DELETE FROM orders WHERE id = ANY($1::uuid[]);', [createdOrderIds]);
        console.log(`Cleaned up ${createdOrderIds.length} test orders.`);
      }
      if (createdCustomerIds.length > 0) {
        await cleanupClient.query('DELETE FROM customers WHERE id = ANY($1::uuid[]);', [createdCustomerIds]);
        console.log(`Cleaned up ${createdCustomerIds.length} test customers.`);
      }
      if (createdProductIds.length > 0) {
        await cleanupClient.query('DELETE FROM products WHERE id = ANY($1::uuid[]);', [createdProductIds]);
        console.log(`Cleaned up ${createdProductIds.length} test products.`);
      }
    } catch (e) {
      console.error('Cleanup warning:', e.message);
    } finally {
      cleanupClient.release();
      await pool.end();
      if (serverInstance) {
        await new Promise(resolve => serverInstance.close(resolve));
      }
      process.exit(failed > 0 ? 1 : 0);
    }
  }
}

runOrderTests();
