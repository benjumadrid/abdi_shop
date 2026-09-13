const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

process.env.NODE_ENV = 'test';
const { app } = require('../src/server');

const BASE_URL = 'http://localhost:5000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

async function runTests() {
  console.log('=== STARTING PRODUCTS API VERIFICATION TESTS ===\n');
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

  let testProductId = null;
  let initialProducts = [];
  let adminToken = null;
  let serverInstance = null;

  // Ensure server is reachable, start in-process if necessary
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/health`);
    if (!healthCheck.ok) throw new Error('Not running');
  } catch (err) {
    console.log('[Setup] Local server not running on port 5000. Starting in-process server...');
    serverInstance = app.listen(5000);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  try {
    // Login as admin for protected endpoints
    adminToken = await getAdminToken();
    console.log('[Setup] Admin token acquired for product tests.\n');
    // -------------------------------------------------------------
    // Test 1: GET all available products
    // -------------------------------------------------------------
    console.log('--- Test 1: GET all available products ---');
    const res1 = await fetch(`${BASE_URL}/api/products`);
    const data1 = await res1.json();
    assert(res1.status === 200, 'GET /api/products returns HTTP 200');
    assert(data1.success === true, 'Response has success: true');
    assert(Array.isArray(data1.data), 'data is an array');
    assert(data1.data.length >= 3, `Expected at least 3 seeded products, got ${data1.data.length}`);
    const allAvailable = data1.data.every(p => p.is_available === true);
    assert(allAvailable, 'All returned products have is_available = true');
    const productsWithMedia = data1.data.filter(p => p.media && p.media.length > 0);
    const mediaHaveImageFallback = productsWithMedia.length > 0 && productsWithMedia.every(p => typeof p.image_url === 'string' && p.image_url.startsWith('/api/products/media/'));
    assert(mediaHaveImageFallback, 'Products with media have primary media image_url fallback');
    initialProducts = data1.data;

    // -------------------------------------------------------------
    // Test 2: GET one existing product
    // -------------------------------------------------------------
    console.log('\n--- Test 2: GET one existing product ---');
    const targetProduct = initialProducts[0];
    const res2 = await fetch(`${BASE_URL}/api/products/${targetProduct.id}`);
    const data2 = await res2.json();
    assert(res2.status === 200, `GET /api/products/:id returns HTTP 200`);
    assert(data2.success === true, 'Response has success: true');
    assert(data2.data.id === targetProduct.id, 'Fetched product matches target ID');
    assert(data2.data.name_en === targetProduct.name_en, 'Fetched product name matches');
    if (data2.data.media && data2.data.media.length > 0) {
      assert(typeof data2.data.image_url === 'string' && data2.data.image_url.startsWith('/api/products/media/'), 'Single product image_url matches primary media URL');
    }

    // -------------------------------------------------------------
    // Test 3: GET a nonexistent UUID
    // -------------------------------------------------------------
    console.log('\n--- Test 3: GET a nonexistent UUID ---');
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
    const res3 = await fetch(`${BASE_URL}/api/products/${nonExistentUuid}`);
    const data3 = await res3.json();
    assert(res3.status === 404, 'GET nonexistent UUID returns HTTP 404');
    assert(data3.success === false, 'Response has success: false');
    assert(data3.message === 'Product not found', 'Proper 404 message returned');

    // -------------------------------------------------------------
    // Test 4: GET with an invalid UUID
    // -------------------------------------------------------------
    console.log('\n--- Test 4: GET with an invalid UUID ---');
    const res4 = await fetch(`${BASE_URL}/api/products/invalid-uuid-12345`);
    const data4 = await res4.json();
    assert(res4.status === 400, 'GET invalid UUID returns HTTP 400');
    assert(data4.success === false, 'Response has success: false');
    assert(data4.message.includes('Invalid product ID format'), 'Proper validation message returned');

    // -------------------------------------------------------------
    // Test 5: Create a valid product
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Create a valid product ---');
    const newProductPayload = {
      name_en: 'Test Organic Honey Candy',
      name_am: 'የተፈተነ የኦርጋኒክ ማር ከረሜላ',
      description_en: 'Delicious natural candy made with pure honey.',
      description_am: null,
      price: 450.00,
      image_url: null,
      is_available: true
    };
    const res5 = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(newProductPayload)
    });
    const data5 = await res5.json();
    assert(res5.status === 201, 'POST /api/products returns HTTP 201');
    assert(data5.success === true, 'Response has success: true');
    assert(data5.data && data5.data.id, 'Created product has an id');
    assert(data5.data.price === 450, 'Created product price is 450');
    testProductId = data5.data.id;

    // -------------------------------------------------------------
    // Test 6: Create a product with missing required fields
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Create a product with missing required fields ---');
    const res6 = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ price: 100 }) // missing name_en and name_am
    });
    const data6 = await res6.json();
    assert(res6.status === 400, 'POST with missing required fields returns HTTP 400');
    assert(data6.success === false, 'Response has success: false');
    assert(Array.isArray(data6.errors) && data6.errors.length >= 2, 'Detailed errors array returned');

    // -------------------------------------------------------------
    // Test 7: Create a product with negative price
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Create a product with negative price ---');
    const res7 = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        name_en: 'Negative Price Item',
        name_am: 'አሉታዊ ዋጋ',
        price: -50.00
      })
    });
    const data7 = await res7.json();
    assert(res7.status === 400, 'POST with negative price returns HTTP 400');
    assert(data7.success === false, 'Response has success: false');

    // -------------------------------------------------------------
    // Test 8: Update a product price
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Update a product price ---');
    const res8 = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ price: 550.00 })
    });
    const data8 = await res8.json();
    assert(res8.status === 200, 'PATCH /api/products/:id returns HTTP 200');
    assert(data8.success === true, 'Response has success: true');
    assert(data8.data.price === 550, 'Price updated to 550');

    // -------------------------------------------------------------
    // Test 9: Update only one field and verify other fields remain unchanged
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Update only one field and verify other fields remain unchanged ---');
    const res9 = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ description_en: 'Special updated description text only.' })
    });
    const data9 = await res9.json();
    assert(res9.status === 200, 'PATCH single field returns HTTP 200');
    assert(data9.data.description_en === 'Special updated description text only.', 'description_en was updated');
    assert(data9.data.name_en === 'Test Organic Honey Candy', 'name_en remained unchanged');
    assert(data9.data.name_am === 'የተፈተነ የኦርጋኒክ ማር ከረሜላ', 'name_am remained unchanged');
    assert(data9.data.price === 550, 'price remained unchanged at 550');
    assert(data9.data.is_available === true, 'is_available remained true');

    // -------------------------------------------------------------
    // Test 10: Change is_available to false
    // -------------------------------------------------------------
    console.log('\n--- Test 10: Change is_available to false ---');
    const res10 = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ is_available: false })
    });
    const data10 = await res10.json();
    assert(res10.status === 200, 'PATCH is_available returns HTTP 200');
    assert(data10.data.is_available === false, 'Product is_available is now false');

    // -------------------------------------------------------------
    // Test 11: Verify unavailable products do not appear in public GET /api/products
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Verify unavailable products do not appear in public GET /api/products ---');
    const res11a = await fetch(`${BASE_URL}/api/products`);
    const data11a = await res11a.json();
    const foundInList = data11a.data.some(p => p.id === testProductId);
    assert(!foundInList, 'Unavailable product is omitted from public GET /api/products');

    const res11b = await fetch(`${BASE_URL}/api/products/${testProductId}`);
    assert(res11b.status === 404, 'Public GET /api/products/:id returns HTTP 404 for unavailable product');

    // Also verify that passing include_unavailable=true lets admin view it
    const res11c = await fetch(`${BASE_URL}/api/products/${testProductId}?include_unavailable=true`);
    const data11c = await res11c.json();
    assert(res11c.status === 200, 'Admin query include_unavailable=true can view unavailable product');
    assert(data11c.data.id === testProductId, 'Returned correct product');

    // -------------------------------------------------------------
    // Test 12: Test DELETE behavior
    // -------------------------------------------------------------
    console.log('\n--- Test 12: Test DELETE behavior ---');
    // 12a: Unreferenced product should be permanently deleted
    const res12a = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data12a = await res12a.json();
    assert(res12a.status === 200, 'DELETE unreferenced product returns HTTP 200');
    assert(data12a.success === true, 'DELETE success is true');

    const res12aCheck = await fetch(`${BASE_URL}/api/products/${testProductId}?include_unavailable=true`);
    assert(res12aCheck.status === 404, 'Deleted product is completely gone from DB (404)');

    // 12b: Test DELETE protection on product referenced by order_items
    console.log('Testing DELETE protection when product is referenced in orders...');
    const client = await pool.connect();
    let tempProdId = null;
    let tempCustId = null;
    let tempOrderId = null;

    try {
      // Create a temporary product
      const pRes = await client.query(`
        INSERT INTO products (name_en, name_am, price)
        VALUES ('Referenced Product', 'የተያያዘ ምርት', 1200)
        RETURNING id;
      `);
      tempProdId = pRes.rows[0].id;

      // Create a temporary customer
      const cRes = await client.query(`
        INSERT INTO customers (name, phone, address)
        VALUES ('Test Customer', '0911000000', 'Dessie, Kebele 02')
        RETURNING id;
      `);
      tempCustId = cRes.rows[0].id;

      // Create a temporary order
      const oRes = await client.query(`
        INSERT INTO orders (order_number, customer_id, total_amount, status)
        VALUES ('TEST-ORDER-DELETE-1', $1, 1200, 'pending')
        RETURNING id;
      `, [tempCustId]);
      tempOrderId = oRes.rows[0].id;

      // Create an order_item linking to tempProdId
      await client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES ($1, $2, 1, 1200, 1200);
      `, [tempOrderId, tempProdId]);

      // Attempt DELETE via API on referenced product
      const res12b = await fetch(`${BASE_URL}/api/products/${tempProdId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data12b = await res12b.json();
      assert(res12b.status === 409, 'DELETE on referenced product is blocked with HTTP 409 Conflict');
      assert(data12b.is_referenced === true, 'Response indicates is_referenced: true');
      assert(data12b.message.includes('historical order'), 'Helpful message explaining historical order integrity');

      // Verify product still exists in DB
      const checkStillThere = await client.query('SELECT id FROM products WHERE id = $1', [tempProdId]);
      assert(checkStillThere.rows.length === 1, 'Product was preserved in the database');

    } finally {
      // Clean up test order, customer, product
      if (tempOrderId) await client.query('DELETE FROM orders WHERE id = $1', [tempOrderId]);
      if (tempCustId) await client.query('DELETE FROM customers WHERE id = $1', [tempCustId]);
      if (tempProdId) await client.query('DELETE FROM products WHERE id = $1', [tempProdId]);
      client.release();
    }

    // -------------------------------------------------------------
    // Test 13: Verify existing database records are not damaged
    // -------------------------------------------------------------
    console.log('\n--- Test 13: Verify existing database records are not damaged ---');
    const res13 = await fetch(`${BASE_URL}/api/products`);
    const data13 = await res13.json();
    assert(res13.status === 200, 'GET /api/products returns HTTP 200');

    const currentNames = data13.data.map(p => p.name_en);
    const hasHoney = currentNames.includes('Original Yemeni Honey');
    const hasCrampRelief = currentNames.includes("Original Women's Period Cramp Relief");
    const hasCable = currentNames.includes('WiFi Router Power Boost Cable') || currentNames.includes('Original iPhone Cable Charger');
    const allOriginalsExist = hasHoney && hasCrampRelief && hasCable;
    assert(allOriginalsExist, 'All 3 original seeded products exist and are unharmed');

    // -------------------------------------------------------------
    // Test 14: Verify /api/health still works
    // -------------------------------------------------------------
    console.log('\n--- Test 14: Verify /api/health still works ---');
    const res14 = await fetch(`${BASE_URL}/api/health`);
    const data14 = await res14.json();
    assert(res14.status === 200, 'GET /api/health returns HTTP 200');
    assert(data14.status === 'ok', 'Health status is "ok"');
    assert(data14.database.connected === true, 'Database connection is healthy and verified');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);

  } catch (err) {
    console.error('[Test Suite Error]', err);
  } finally {
    await pool.end();
    if (serverInstance) {
      await new Promise(resolve => serverInstance.close(resolve));
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
