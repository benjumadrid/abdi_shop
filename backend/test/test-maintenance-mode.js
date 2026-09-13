const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

process.env.NODE_ENV = 'test';
const { app } = require('../src/server');

async function runMaintenanceTests() {
  console.log('====================================================');
  console.log('🧪 TESTING CUSTOMER MAINTENANCE MODE IMPLEMENTATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Start in-process server on dynamic/unused port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Normal Mode (MAINTENANCE_MODE = false or unset)
    // -----------------------------------------------------------------
    process.env.MAINTENANCE_MODE = 'false';

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert(healthRes.status === 200, 'Health check is 200 OK when maintenance mode is false');

    const maintResFalse = await fetch(`${baseUrl}/api/maintenance`);
    const maintDataFalse = await maintResFalse.json();
    assert(maintResFalse.status === 200, 'GET /api/maintenance status is 200');
    assert(maintDataFalse.maintenance === false, 'GET /api/maintenance reports maintenance: false');

    // Customer order route is not blocked by maintenance
    const orderFalseRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // Empty body will fail validation, NOT maintenance 503
    });
    assert(orderFalseRes.status !== 503, 'Customer order route is NOT blocked with 503 when maintenance is false');

    // -----------------------------------------------------------------
    // TEST 2: Active Maintenance Mode (MAINTENANCE_MODE = true)
    // -----------------------------------------------------------------
    console.log('\n--- Switching process.env.MAINTENANCE_MODE = true ---');
    process.env.MAINTENANCE_MODE = 'true';

    // A. Maintenance status endpoint
    const maintResTrue = await fetch(`${baseUrl}/api/maintenance`);
    const maintDataTrue = await maintResTrue.json();
    assert(maintResTrue.status === 200, 'GET /api/maintenance status is 200 when active');
    assert(maintDataTrue.maintenance === true, 'GET /api/maintenance reports maintenance: true');

    // B. Health check must still be accessible
    const healthTrueRes = await fetch(`${baseUrl}/api/health`);
    assert(healthTrueRes.status === 200, 'Health check (/api/health) remains 200 OK during maintenance mode');

    // C. Customer order submission must be blocked with 503
    const orderBlockedRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Test Customer', items: [] })
    });
    const orderBlockedData = await orderBlockedRes.json();
    assert(orderBlockedRes.status === 503, 'Customer order submission returns HTTP 503 Service Unavailable');
    assert(orderBlockedData.maintenance === true, 'Customer order rejection contains maintenance: true flag');
    assert(typeof orderBlockedData.message === 'string' && orderBlockedData.message.length > 0, 'Customer order rejection includes polite English message');
    assert(typeof orderBlockedData.message_am === 'string' && orderBlockedData.message_am.length > 0, 'Customer order rejection includes polite Amharic message');

    // D. Customer payment submission must be blocked with 503
    const paymentBlockedRes = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const paymentBlockedData = await paymentBlockedRes.json();
    assert(paymentBlockedRes.status === 503, 'Customer payment submission returns HTTP 503 Service Unavailable');
    assert(paymentBlockedData.maintenance === true, 'Customer payment rejection contains maintenance: true flag');

    // E. ADMIN PORTAL ACCESSIBILITY: Admin auth endpoint MUST remain reachable (not blocked with 503)
    const adminLoginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@admin.com', password: 'wrong' })
    });
    assert(adminLoginRes.status !== 503, `Admin auth route (/api/admin/auth/login) is NOT blocked by maintenance (Status: ${adminLoginRes.status})`);

    // Generate valid admin token to test authenticated admin routes
    const jwt = require('jsonwebtoken');
    const adminToken = jwt.sign(
      { id: '47f3e4ef-fbf1-4c01-a378-e3111a27cc5c', email: 'abdiadminretry234@gmail.com', role: 'super_admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // F. Admin authenticated API routes (/api/admin/orders) must work during maintenance
    const adminOrdersRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminOrdersRes.status === 200, 'Admin orders route (/api/admin/orders) is 200 OK during maintenance mode');

    // G. Admin payments route (/api/admin/payments) must work during maintenance
    const adminPaymentsRes = await fetch(`${baseUrl}/api/admin/payments`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminPaymentsRes.status === 200, 'Admin payments route (/api/admin/payments) is 200 OK during maintenance mode');

    // -----------------------------------------------------------------
    // TEST 3: Return to Normal Mode
    // -----------------------------------------------------------------
    console.log('\n--- Switching back process.env.MAINTENANCE_MODE = false ---');
    process.env.MAINTENANCE_MODE = 'false';

    const maintResetRes = await fetch(`${baseUrl}/api/maintenance`);
    const maintResetData = await maintResetRes.json();
    assert(maintResetData.maintenance === false, 'System cleanly restores to operational mode (maintenance: false)');

    console.log('\n====================================================');
    console.log(`🏁 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runMaintenanceTests();
