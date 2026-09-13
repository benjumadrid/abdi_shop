const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// Run in test environment
process.env.NODE_ENV = 'test';

const { app } = require('../src/server');

const BASE_URL = 'http://127.0.0.1:5000';

async function runSecurityTests() {
  console.log('=== STARTING PRODUCTION SECURITY VERIFICATION TESTS ===\n');
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

  let serverInstance = null;
  // Ensure server is running
  try {
    const check = await fetch(`${BASE_URL}/api/health`);
    if (!check.ok) throw new Error('Not running');
  } catch (err) {
    console.log('[Setup] Local server not running on port 5000. Starting test server instance...');
    serverInstance = app.listen(5000);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Helmet Security Headers
    // -------------------------------------------------------------
    console.log('--- Test 1: Helmet Security Headers ---');
    const res1 = await fetch(`${BASE_URL}/`);
    assert(res1.status === 200, 'Root endpoint returns HTTP 200');

    // X-Powered-By must be suppressed
    const poweredBy = res1.headers.get('x-powered-by');
    assert(!poweredBy, 'X-Powered-By header is safely suppressed');

    // Standard security headers
    const nosniff = res1.headers.get('x-content-type-options');
    assert(nosniff === 'nosniff', 'X-Content-Type-Options is set to "nosniff"');

    const frameOptions = res1.headers.get('x-frame-options');
    assert(frameOptions === 'SAMEORIGIN', 'X-Frame-Options is set to "SAMEORIGIN"');

    const corp = res1.headers.get('cross-origin-resource-policy');
    assert(corp === 'cross-origin', 'Cross-Origin-Resource-Policy allows cross-origin media rendering');

    const csp = res1.headers.get('content-security-policy');
    assert(typeof csp === 'string' && csp.length > 0, 'Content-Security-Policy header is present');

    // -------------------------------------------------------------
    // Test 2: CORS Configuration & Preflight
    // -------------------------------------------------------------
    console.log('\n--- Test 2: CORS Configuration ---');
    // Allowed origin
    const resCorsAllowed = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Origin': 'http://localhost:3000' }
    });
    assert(resCorsAllowed.status === 200, 'Request with allowed origin succeeds');
    const acao = resCorsAllowed.headers.get('access-control-allow-origin');
    assert(acao === 'http://localhost:3000', 'Access-Control-Allow-Origin reflects allowed origin');
    const acac = resCorsAllowed.headers.get('access-control-allow-credentials');
    assert(acac === 'true', 'Access-Control-Allow-Credentials is true');

    // Disallowed origin
    const resCorsDenied = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Origin': 'https://malicious-attacker-site.com' }
    });
    assert(resCorsDenied.status === 403, 'Request with unauthorized origin returns HTTP 403');
    const corsDenyData = await resCorsDenied.json();
    assert(corsDenyData.success === false, 'CORS rejection response has success: false');

    // CORS Preflight OPTIONS
    const resPreflight = await fetch(`${BASE_URL}/api/products`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    assert(resPreflight.status === 204, 'Preflight OPTIONS returns HTTP 204 No Content');
    const allowMethods = resPreflight.headers.get('access-control-allow-methods');
    assert(allowMethods && allowMethods.includes('POST'), 'Preflight permits POST method');

    // -------------------------------------------------------------
    // Test 3: Request Body Size Limit (Payload DOS Protection)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Request Body Size Limit (Payload DOS Protection) ---');
    // Create a string slightly larger than 1MB
    const largePayload = JSON.stringify({
      data: 'x'.repeat(1.2 * 1024 * 1024)
    });

    const resLarge = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largePayload
    });
    assert(resLarge.status === 413, 'Oversized JSON payload (> 1 MB) is rejected with HTTP 413');
    const largeData = await resLarge.json();
    assert(largeData.success === false, 'Payload too large response has success: false');
    assert(largeData.message.includes('Payload too large'), 'Message clearly states payload too large');

    // -------------------------------------------------------------
    // Test 4: Malformed JSON Protection
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Malformed JSON Protection ---');
    const resMalformed = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken_json": true,'
    });
    assert(resMalformed.status === 400, 'Malformed JSON returns HTTP 400 Bad Request');
    const malformedData = await resMalformed.json();
    assert(malformedData.success === false, 'Malformed JSON response has success: false');
    assert(malformedData.message === 'Invalid JSON payload in request body', 'Clean, safe error message without stack trace');

    // -------------------------------------------------------------
    // Test 5: Rate Limiting Enforcement (Admin Login Protection)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Rate Limiting Enforcement (Admin Login Protection) ---');
    let rateLimitTriggered = false;
    let rateLimitResponse = null;

    // Send 11 attempts with x-test-rate-limit header to test rate limiter in test mode
    for (let i = 1; i <= 12; i++) {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-rate-limit': 'true',
          'x-test-client-id': 'security-test-client-1'
        },
        body: JSON.stringify({
          email: 'rate-limit-test@abdi.com',
          password: 'wrongpassword'
        })
      });

      if (res.status === 429) {
        rateLimitTriggered = true;
        rateLimitResponse = await res.json();
        break;
      }
    }

    assert(rateLimitTriggered, 'Admin login rate limiter triggers HTTP 429 after threshold');
    assert(rateLimitResponse && rateLimitResponse.success === false, 'Rate limit response has success: false');
    assert(rateLimitResponse && rateLimitResponse.message.includes('Too many login attempts'), 'Rate limit response has user-friendly message');

    // -------------------------------------------------------------
    // Test 6: Authentication Security Audit
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Authentication Security Audit ---');
    // Verify protected admin endpoints reject unauthenticated requests
    const protectedEndpoints = [
      { method: 'GET', url: '/api/admin/orders' },
      { method: 'GET', url: '/api/admin/payments' },
      { method: 'GET', url: '/api/admin/auth/me' },
      { method: 'POST', url: '/api/admin/auth/logout' },
      { method: 'POST', url: '/api/products' },
      { method: 'PATCH', url: '/api/products/00000000-0000-0000-0000-000000000000' },
      { method: 'DELETE', url: '/api/products/00000000-0000-0000-0000-000000000000' }
    ];

    for (const ep of protectedEndpoints) {
      const res = await fetch(`${BASE_URL}${ep.url}`, { method: ep.method });
      assert(res.status === 401, `Unauthenticated ${ep.method} ${ep.url} returns HTTP 401`);
    }

    // Verify invalid token format
    const resBadToken = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { 'Authorization': 'Bearer invalid.token.value' }
    });
    assert(resBadToken.status === 401, 'Invalid JWT token returns HTTP 401');

    // -------------------------------------------------------------
    // Test 7: File Upload Security Audit
    // -------------------------------------------------------------
    console.log('\n--- Test 7: File Upload Security Audit ---');
    // Disguised executable (MZ header)
    const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00FakeWindowsExecutablePayload');
    const exeForm = new FormData();
    exeForm.append('file', new Blob([exeBuffer], { type: 'image/jpeg' }), 'malicious.jpg');
    exeForm.append('order_id', '00000000-0000-0000-0000-000000000000');

    const resExe = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: exeForm
    });
    assert(resExe.status === 400, 'Disguised executable rejected with HTTP 400');
    const exeData = await resExe.json();
    assert(exeData.message.includes('Executable files are strictly prohibited'), 'Clear security rejection message for executable');

    // Disguised PDF
    const pdfBuffer = Buffer.from('%PDF-1.4 Fake PDF Content');
    const pdfForm = new FormData();
    pdfForm.append('file', new Blob([pdfBuffer], { type: 'image/jpeg' }), 'disguised.jpg');
    pdfForm.append('order_id', '00000000-0000-0000-0000-000000000000');

    const resPdf = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: pdfForm
    });
    assert(resPdf.status === 400, 'Disguised PDF rejected with HTTP 400');
    const pdfData = await resPdf.json();
    assert(pdfData.message.includes('PDF files are not allowed'), 'Clear security rejection message for PDF');

    // -------------------------------------------------------------
    // Test 8: Health Check & Secrets Shielding
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Health Check & Secrets Shielding ---');
    const resHealth = await fetch(`${BASE_URL}/api/health`);
    assert(resHealth.status === 200, 'Health check returns HTTP 200');
    const healthData = await resHealth.json();
    assert(healthData.status === 'ok', 'Health status is ok');
    assert(healthData.database.connected === true, 'Database is connected');
    // Ensure no raw secrets/connection strings are exposed in health response
    const rawHealthStr = JSON.stringify(healthData);
    assert(!rawHealthStr.includes('postgres://') && !rawHealthStr.includes('postgresql://'), 'Health endpoint does not expose DATABASE_URL connection string');
    assert(!rawHealthStr.includes('jwt') && !rawHealthStr.includes('secret'), 'Health endpoint does not expose JWT secrets');

    console.log('\n========================================');
    console.log(`SECURITY TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

runSecurityTests().catch(err => {
  console.error('[Error in security tests]', err);
  process.exit(1);
});
