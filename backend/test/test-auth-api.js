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

async function runAuthTests() {
  console.log('=== STARTING AUTH API VERIFICATION TESTS ===\n');

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

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@abdi.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
  let adminToken = null;

  try {
    // -----------------------------------------------------------------------
    // Test 1: Login with missing email
    // -----------------------------------------------------------------------
    console.log('--- Test 1: Login with missing email ---');
    const res1 = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    const data1 = await res1.json();
    assert(res1.status === 400, 'Missing email returns HTTP 400');
    assert(data1.success === false, 'Response success: false');
    assert(data1.errors.some(e => e.includes('Email')), 'Error mentions email');

    // -----------------------------------------------------------------------
    // Test 2: Login with missing password
    // -----------------------------------------------------------------------
    console.log('\n--- Test 2: Login with missing password ---');
    const res2 = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL })
    });
    const data2 = await res2.json();
    assert(res2.status === 400, 'Missing password returns HTTP 400');
    assert(data2.success === false, 'Response success: false');

    // -----------------------------------------------------------------------
    // Test 3: Login with empty body
    // -----------------------------------------------------------------------
    console.log('\n--- Test 3: Login with empty body ---');
    const res3 = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(res3.status === 400, 'Empty body returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 4: Login with wrong email
    // -----------------------------------------------------------------------
    console.log('\n--- Test 4: Login with wrong email ---');
    const res4 = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrong@wrong.com', password: ADMIN_PASSWORD })
    });
    const data4 = await res4.json();
    assert(res4.status === 401, 'Wrong email returns HTTP 401');
    assert(data4.message.includes('Invalid email or password'), 'Generic error message (no email enumeration)');

    // -----------------------------------------------------------------------
    // Test 5: Login with wrong password
    // -----------------------------------------------------------------------
    console.log('\n--- Test 5: Login with wrong password ---');
    const res5 = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: 'wrongpassword' })
    });
    const data5 = await res5.json();
    assert(res5.status === 401, 'Wrong password returns HTTP 401');
    assert(data5.message.includes('Invalid email or password'), 'Same generic error for wrong password');

    // -----------------------------------------------------------------------
    // Test 6: Successful login with valid credentials
    // -----------------------------------------------------------------------
    console.log('\n--- Test 6: Successful login ---');
    const res6 = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const data6 = await res6.json();
    assert(res6.status === 200, 'Valid login returns HTTP 200');
    assert(data6.success === true, 'Response success: true');
    assert(data6.data.token && typeof data6.data.token === 'string', 'JWT token returned');
    assert(data6.data.admin.email === ADMIN_EMAIL.toLowerCase(), 'Admin email in response');
    assert(data6.data.admin.id !== undefined, 'Admin ID in response');
    assert(data6.data.admin.password_hash === undefined, 'password_hash NOT in response');

    adminToken = data6.data.token;

    // -----------------------------------------------------------------------
    // Test 7: GET /me without token
    // -----------------------------------------------------------------------
    console.log('\n--- Test 7: GET /me without token ---');
    const res7 = await fetch(`${BASE_URL}/api/admin/auth/me`);
    assert(res7.status === 401, 'GET /me without token returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 8: GET /me with invalid token
    // -----------------------------------------------------------------------
    console.log('\n--- Test 8: GET /me with invalid token ---');
    const res8 = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { 'Authorization': 'Bearer invalid.token.here' }
    });
    assert(res8.status === 401, 'GET /me with invalid token returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 9: GET /me with valid token
    // -----------------------------------------------------------------------
    console.log('\n--- Test 9: GET /me with valid token ---');
    const res9 = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data9 = await res9.json();
    assert(res9.status === 200, 'GET /me with valid token returns HTTP 200');
    assert(data9.success === true, 'Response success: true');
    assert(data9.data.email === ADMIN_EMAIL.toLowerCase(), 'Returned admin email matches');
    assert(data9.data.role === 'admin', 'Returned admin role is admin');
    assert(data9.data.password_hash === undefined, 'password_hash NOT exposed');

    // -----------------------------------------------------------------------
    // Test 10: GET /me with malformed Authorization header
    // -----------------------------------------------------------------------
    console.log('\n--- Test 10: GET /me with malformed Authorization header ---');
    const res10 = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { 'Authorization': 'NotBearer sometoken' }
    });
    assert(res10.status === 401, 'Malformed Authorization header returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 11: POST /logout with valid token
    // -----------------------------------------------------------------------
    console.log('\n--- Test 11: POST /logout with valid token ---');
    const res11 = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data11 = await res11.json();
    assert(res11.status === 200, 'Logout returns HTTP 200');
    assert(data11.success === true, 'Logout success: true');

    // -----------------------------------------------------------------------
    // Test 12: POST /logout without token
    // -----------------------------------------------------------------------
    console.log('\n--- Test 12: POST /logout without token ---');
    const res12 = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
      method: 'POST'
    });
    assert(res12.status === 401, 'Logout without token returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 13: Admin product endpoints require auth (POST /api/products)
    // -----------------------------------------------------------------------
    console.log('\n--- Test 13: POST /api/products without auth ---');
    const res13 = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name_en: 'Test', name_am: 'ትስት', price: 100 })
    });
    assert(res13.status === 401, 'POST /api/products without auth returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 14: Admin product endpoints work with auth (POST /api/products)
    // -----------------------------------------------------------------------
    console.log('\n--- Test 14: POST /api/products with auth ---');
    const res14 = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name_en: 'Auth Test Product',
        name_am: 'የማረጋገጫ ምርት',
        price: 100
      })
    });
    const data14 = await res14.json();
    assert(res14.status === 201, 'POST /api/products with auth returns HTTP 201');
    assert(data14.success === true, 'Product created successfully');
    const authTestProductId = data14.data.id;

    // -----------------------------------------------------------------------
    // Test 15: PATCH /api/products/:id without auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 15: PATCH /api/products/:id without auth ---');
    const res15 = await fetch(`${BASE_URL}/api/products/${authTestProductId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 200 })
    });
    assert(res15.status === 401, 'PATCH /api/products/:id without auth returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 16: DELETE /api/products/:id without auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 16: DELETE /api/products/:id without auth ---');
    const res16 = await fetch(`${BASE_URL}/api/products/${authTestProductId}`, {
      method: 'DELETE'
    });
    assert(res16.status === 401, 'DELETE /api/products/:id without auth returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 17: Public GET /api/products still works without auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 17: Public GET /api/products still works without auth ---');
    const res17 = await fetch(`${BASE_URL}/api/products`);
    assert(res17.status === 200, 'GET /api/products without auth returns HTTP 200 (public)');

    // -----------------------------------------------------------------------
    // Test 18: Public GET /api/products/:id still works without auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 18: Public GET /api/products/:id still works without auth ---');
    const res18 = await fetch(`${BASE_URL}/api/products/${authTestProductId}`);
    assert(res18.status === 200, 'GET /api/products/:id without auth returns HTTP 200 (public)');

    // -----------------------------------------------------------------------
    // Test 19: Admin order endpoints require auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 19: Admin order endpoints require auth ---');
    const res19 = await fetch(`${BASE_URL}/api/admin/orders`);
    assert(res19.status === 401, 'GET /api/admin/orders without auth returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 20: Admin order endpoints work with auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 20: Admin order endpoints work with auth ---');
    const res20 = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res20.status === 200, 'GET /api/admin/orders with auth returns HTTP 200');

    // -----------------------------------------------------------------------
    // Test 21: Admin payment endpoints require auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 21: Admin payment endpoints require auth ---');
    const res21 = await fetch(`${BASE_URL}/api/admin/payments`);
    assert(res21.status === 401, 'GET /api/admin/payments without auth returns HTTP 401');

    // -----------------------------------------------------------------------
    // Test 22: Admin payment endpoints work with auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 22: Admin payment endpoints work with auth ---');
    const res22 = await fetch(`${BASE_URL}/api/admin/payments`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res22.status === 200, 'GET /api/admin/payments with auth returns HTTP 200');

    // -----------------------------------------------------------------------
    // Test 23: Public order endpoints still work without auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 23: Public order endpoints still work without auth ---');
    const res23 = await fetch(`${BASE_URL}/api/orders/00000000-0000-0000-0000-000000000000`);
    // Should return 404 (not found), not 401 — proving it's unprotected
    assert(res23.status === 404, 'GET /api/orders/:id without auth returns 404 (not 401 — public)');

    // -----------------------------------------------------------------------
    // Test 24: Public payment endpoints still work without auth
    // -----------------------------------------------------------------------
    console.log('\n--- Test 24: Public payment endpoints still work without auth ---');
    const res24 = await fetch(`${BASE_URL}/api/payment-methods`);
    assert(res24.status === 200, 'GET /api/payment-methods without auth returns HTTP 200 (public)');

    // -----------------------------------------------------------------------
    // Test 25: Login is case-insensitive for email
    // -----------------------------------------------------------------------
    console.log('\n--- Test 25: Login is case-insensitive for email ---');
    const res25 = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD })
    });
    const data25 = await res25.json();
    assert(res25.status === 200, 'Login with uppercase email returns HTTP 200');
    assert(data25.data.token && typeof data25.data.token === 'string', 'Token returned for case-insensitive login');

    // -----------------------------------------------------------------------
    // Test 26: Deactivated admin cannot login
    // -----------------------------------------------------------------------
    console.log('\n--- Test 26: Deactivated admin cannot login ---');
    const client = await pool.connect();
    try {
      // Deactivate admin
      await client.query('UPDATE admins SET is_active = FALSE WHERE email = $1', [ADMIN_EMAIL.toLowerCase()]);

      const res26 = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      });
      assert(res26.status === 403, 'Deactivated admin login returns HTTP 403');

      // Reactivate admin
      await client.query('UPDATE admins SET is_active = TRUE WHERE email = $1', [ADMIN_EMAIL.toLowerCase()]);
    } finally {
      client.release();
    }

    // -----------------------------------------------------------------------
    // Test 27: Deactivated admin's existing token is rejected
    // -----------------------------------------------------------------------
    console.log('\n--- Test 27: Deactivated admin token is rejected ---');
    // Get a fresh token first
    const freshLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const freshLoginData = await freshLoginRes.json();
    const freshToken = freshLoginData.data.token;

    const client2 = await pool.connect();
    try {
      // Deactivate admin
      await client2.query('UPDATE admins SET is_active = FALSE WHERE email = $1', [ADMIN_EMAIL.toLowerCase()]);

      const res27 = await fetch(`${BASE_URL}/api/admin/auth/me`, {
        headers: { 'Authorization': `Bearer ${freshToken}` }
      });
      assert(res27.status === 403, 'Deactivated admin token returns HTTP 403');

      // Reactivate admin
      await client2.query('UPDATE admins SET is_active = TRUE WHERE email = $1', [ADMIN_EMAIL.toLowerCase()]);
    } finally {
      client2.release();
    }

    // -----------------------------------------------------------------------
    // Test 28: Health endpoint still works
    // -----------------------------------------------------------------------
    console.log('\n--- Test 28: Health endpoint still works ---');
    const res28 = await fetch(`${BASE_URL}/api/health`);
    const data28 = await res28.json();
    assert(res28.status === 200, 'Health endpoint returns HTTP 200');
    assert(data28.database.connected === true, 'Database remains healthy');

    // -----------------------------------------------------------------------
    // Cleanup: Delete test product
    // -----------------------------------------------------------------------
    console.log('\n--- Cleaning up test records ---');
    if (authTestProductId) {
      await fetch(`${BASE_URL}/api/products/${authTestProductId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      console.log('Cleaned up auth test product.');
    }

    console.log(`\n========================================`);
    console.log(`AUTH API TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);

  } catch (err) {
    console.error('[Test Error]', err);
  } finally {
    await pool.end();
    if (serverInstance) {
      await new Promise(resolve => serverInstance.close(resolve));
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAuthTests();
