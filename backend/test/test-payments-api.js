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

async function runPaymentTests() {
  console.log('=== STARTING PAYMENTS API VERIFICATION TESTS ===\n');

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
  const createdPaymentIds = [];
  const createdOrderIds = [];
  const createdCustomerIds = [];
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
    console.log('[Setup] Admin token acquired for payment tests.\n');
    // -----------------------------------------------------------------------
    // Test 1: Payment method endpoint returns Telebirr and Cash
    // -----------------------------------------------------------------------
    console.log('\n--- Test 1: Payment method endpoint returns Telebirr and Cash ---');
    const methodsRes = await fetch(`${BASE_URL}/api/payment-methods`);
    const methodsData = await methodsRes.json();
    assert(methodsRes.status === 200, 'GET /api/payment-methods returns HTTP 200');
    assert(methodsData.success === true, 'Response indicates success: true');
    assert(Array.isArray(methodsData.data.methods), 'Methods array returned');

    const telebirrMethod = methodsData.data.methods.find(m => m.method === 'telebirr');
    const cashMethod = methodsData.data.methods.find(m => m.method === 'cash');
    const cbeMethod = methodsData.data.methods.find(m => m.method === 'cbe');
    assert(telebirrMethod !== undefined, 'Telebirr method is present in methods list');
    assert(cashMethod !== undefined, 'Cash method is present in methods list');
    assert(cbeMethod === undefined, 'CBE method is NOT present in methods list');
    assert(telebirrMethod.name === 'Telebirr', 'Telebirr name returned');

    // Get a seeded product to create test orders
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    const productsData = await productsRes.json();
    const p1 = productsData.data[0]; // e.g. 3000 ETB
    const p2 = productsData.data[1]; // e.g. 2600 ETB

    // Helper to create test order
    async function createTestOrder(product, customerPhone = '+251912345678') {
      const orderRes = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: 'Payment Test Customer',
            phone: customerPhone,
            address: 'Dessie, Arada'
          },
          items: [{ product_id: product.id, quantity: 1 }]
        })
      });
      const orderData = await orderRes.json();
      createdOrderIds.push(orderData.data.id);
      createdCustomerIds.push(orderData.data.customer.id);
      return orderData.data;
    }

    const testOrder1 = await createTestOrder(p1, '+251911999888');
    assert(testOrder1.status === 'pending', 'Test order 1 initialized as pending');

    // -----------------------------------------------------------------------
    // Test 2: Telebirr payment submission succeeds
    // -----------------------------------------------------------------------
    console.log('\n--- Test 2: Telebirr payment submission succeeds ---');
    const telebirrPaymentPayload = {
      order_id: testOrder1.id,
      method: 'telebirr',
      amount: testOrder1.total_amount,
      payment_proof_url: 'https://example.com/receipt-telebirr-1234.jpg'
    };
    const res2 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telebirrPaymentPayload)
    });
    const data2 = await res2.json();
    assert(res2.status === 201, 'POST /api/payments returns HTTP 201');
    assert(data2.success === true, 'Response indicates success: true');
    assert(data2.data.method === 'telebirr', 'Payment method is telebirr');
    assert(data2.data.amount === testOrder1.total_amount, 'Payment amount matches order total');
    assert(data2.data.status === 'pending', 'Payment status is initially pending');
    assert(data2.data.payment_proof_url === 'https://example.com/receipt-telebirr-1234.jpg', 'Proof URL stored');

    const payment1 = data2.data;
    createdPaymentIds.push(payment1.id);

    // -----------------------------------------------------------------------
    // Test 3: Telebirr payment submission changes pending order to payment_review
    // -----------------------------------------------------------------------
    console.log('\n--- Test 3: Telebirr payment submission changes pending order to payment_review ---');
    const checkOrder1Res = await fetch(`${BASE_URL}/api/orders/${testOrder1.id}`);
    const checkOrder1Data = await checkOrder1Res.json();
    assert(checkOrder1Data.data.status === 'payment_review', 'Order status moved from pending to payment_review');

    // -----------------------------------------------------------------------
    // Test 4: Duplicate active payment rejected
    // -----------------------------------------------------------------------
    console.log('\n--- Test 4: Duplicate active payment rejected ---');
    const resDup = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telebirrPaymentPayload)
    });
    assert(resDup.status === 409, 'Duplicate active payment rejected with HTTP 409 Conflict');

    // -----------------------------------------------------------------------
    // Test 5: Cash payment submission succeeds & Cash without proof allowed
    // -----------------------------------------------------------------------
    console.log('\n--- Test 5: Cash payment submission succeeds & Cash without proof allowed ---');
    const testOrder2 = await createTestOrder(p2, '+251922888777');
    const cashPaymentPayload = {
      order_id: testOrder2.id,
      method: 'cash',
      amount: testOrder2.total_amount
      // No payment_proof_url
    };
    const resCash = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cashPaymentPayload)
    });
    const dataCash = await resCash.json();
    assert(resCash.status === 201, 'POST /api/payments with cash returns HTTP 201');
    assert(dataCash.data.method === 'cash', 'Payment method is cash');
    assert(dataCash.data.status === 'pending', 'Cash payment status is pending');
    assert(dataCash.data.payment_proof_url === null, 'Cash payment proof is null');

    const payment2 = dataCash.data;
    createdPaymentIds.push(payment2.id);

    // -----------------------------------------------------------------------
    // Test 6: Pending cash payment keeps order pending
    // -----------------------------------------------------------------------
    console.log('\n--- Test 6: Pending cash payment keeps order pending ---');
    const checkOrder2Res = await fetch(`${BASE_URL}/api/orders/${testOrder2.id}`);
    const checkOrder2Data = await checkOrder2Res.json();
    assert(checkOrder2Data.data.status === 'pending', 'Cash order status remains pending (money not yet received)');

    // -----------------------------------------------------------------------
    // Test 7: Invalid UUID rejected
    // -----------------------------------------------------------------------
    console.log('\n--- Test 7: Invalid UUID rejected ---');
    const res7 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'not-a-valid-uuid',
        method: 'cash',
        amount: 1000
      })
    });
    assert(res7.status === 400, 'Invalid order_id UUID returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 8: Invalid payment method rejected
    // -----------------------------------------------------------------------
    console.log('\n--- Test 8: Invalid payment method rejected ---');
    const res8 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: testOrder1.id,
        method: 'cbe', // old CBE method, now rejected
        amount: 3000
      })
    });
    assert(res8.status === 400, 'Old or unsupported payment method (cbe) returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 9: Incorrect amount rejected
    // -----------------------------------------------------------------------
    console.log('\n--- Test 9: Incorrect amount rejected ---');
    const testOrder3 = await createTestOrder(p1, '+251933777666');
    const res9 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: testOrder3.id,
        method: 'cash',
        amount: 99999 // wrong amount
      })
    });
    const data9 = await res9.json();
    assert(res9.status === 400, 'Incorrect payment amount returns HTTP 400');
    assert(data9.message.includes('does not match order total'), 'Clear error explaining amount mismatch');

    // -----------------------------------------------------------------------
    // Test 10: Missing Telebirr payment proof rejected
    // -----------------------------------------------------------------------
    console.log('\n--- Test 10: Missing Telebirr payment proof rejected ---');
    const res10 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: testOrder3.id,
        method: 'telebirr',
        amount: testOrder3.total_amount
        // missing payment_proof_url
      })
    });
    assert(res10.status === 400, 'Telebirr payment without proof returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 11: Nonexistent order rejected
    // -----------------------------------------------------------------------
    console.log('\n--- Test 11: Nonexistent order rejected ---');
    const res11 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: '00000000-0000-0000-0000-000000000000',
        method: 'cash',
        amount: 1000
      })
    });
    assert(res11.status === 404, 'Nonexistent order returns HTTP 404');

    // -----------------------------------------------------------------------
    // Test 12: Cancelled order cannot receive payment
    // -----------------------------------------------------------------------
    console.log('\n--- Test 12: Cancelled order cannot receive payment ---');
    // Cancel testOrder3
    await fetch(`${BASE_URL}/api/admin/orders/${testOrder3.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'cancelled' })
    });

    const res12 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: testOrder3.id,
        method: 'cash',
        amount: testOrder3.total_amount
      })
    });
    assert(res12.status === 400, 'Payment on cancelled order returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 13: Admin can list payments
    // -----------------------------------------------------------------------
    console.log('\n--- Test 13: Admin can list payments ---');
    const res13 = await fetch(`${BASE_URL}/api/admin/payments`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data13 = await res13.json();
    assert(res13.status === 200, 'GET /api/admin/payments returns HTTP 200');
    assert(data13.success === true, 'Response success: true');
    assert(Array.isArray(data13.data), 'Array of payments returned');
    assert(data13.pagination && data13.pagination.total >= 2, 'Pagination reflects created payments');

    // Test method filter
    const res13Telebirr = await fetch(`${BASE_URL}/api/admin/payments?method=telebirr`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data13Telebirr = await res13Telebirr.json();
    assert(data13Telebirr.data.every(p => p.method === 'telebirr'), 'Filter method=telebirr returns only Telebirr payments');

    // -----------------------------------------------------------------------
    // Test 14: Admin can view payment details
    // -----------------------------------------------------------------------
    console.log('\n--- Test 14: Admin can view payment details ---');
    const res14 = await fetch(`${BASE_URL}/api/admin/payments/${payment1.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data14 = await res14.json();
    assert(res14.status === 200, 'GET /api/admin/payments/:id returns HTTP 200');
    assert(data14.data.id === payment1.id, 'Fetched payment matches payment1 ID');
    assert(data14.data.order !== undefined, 'Linked order details included');
    assert(data14.data.order.items.length > 0, 'Linked order items included');

    // -----------------------------------------------------------------------
    // Test 15: Admin can reject payment
    // -----------------------------------------------------------------------
    console.log('\n--- Test 15: Admin can reject payment ---');
    const rejectPayload = {
      admin_note: 'Screenshot does not show transaction ID clearly.',
      customer_message: 'Your Telebirr payment screenshot is unclear. Please upload a clearer screenshot showing the transaction ID.'
    };
    const res15 = await fetch(`${BASE_URL}/api/admin/payments/${payment1.id}/reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(rejectPayload)
    });
    const data15 = await res15.json();
    assert(res15.status === 200, 'PATCH /api/admin/payments/:id/reject returns HTTP 200');
    assert(data15.data.payment.status === 'rejected', 'Payment status updated to rejected');

    // -----------------------------------------------------------------------
    // Test 16: Rejection stores admin_note and customer_message
    // -----------------------------------------------------------------------
    console.log('\n--- Test 16: Rejection stores admin_note and customer_message ---');
    const res16Admin = await fetch(`${BASE_URL}/api/admin/payments/${payment1.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data16Admin = await res16Admin.json();
    assert(data16Admin.data.admin_note === rejectPayload.admin_note, 'admin_note saved in payment');
    assert(data16Admin.data.customer_message === rejectPayload.customer_message, 'customer_message saved in payment');
    assert(data16Admin.data.reviewed_at !== null, 'reviewed_at timestamp recorded');

    // -----------------------------------------------------------------------
    // Test 17: Rejection changes payment_review order back to pending
    // -----------------------------------------------------------------------
    console.log('\n--- Test 17: Rejection changes payment_review order back to pending ---');
    const res17Order = await fetch(`${BASE_URL}/api/orders/${testOrder1.id}`);
    const data17Order = await res17Order.json();
    assert(data17Order.data.status === 'pending', 'Order moved back to pending so customer can re-submit');

    // -----------------------------------------------------------------------
    // Test 18: Customer endpoint never exposes admin_note & can see customer_message
    // -----------------------------------------------------------------------
    console.log('\n--- Test 18: Customer endpoint never exposes admin_note & can see customer_message ---');
    const res18Cust = await fetch(`${BASE_URL}/api/payments/order/${testOrder1.id}`);
    const data18Cust = await res18Cust.json();
    assert(res18Cust.status === 200, 'GET /api/payments/order/:orderId returns HTTP 200');
    assert(data18Cust.data.history[0].customer_message === rejectPayload.customer_message, 'Customer can see customer_message');
    assert(data18Cust.data.history[0].admin_note === undefined, 'Customer endpoint does NOT expose admin_note');

    // -----------------------------------------------------------------------
    // Test 19: Rejected payment can be replaced by a new attempt
    // -----------------------------------------------------------------------
    console.log('\n--- Test 19: Rejected payment can be replaced by a new attempt ---');
    const replacePaymentPayload = {
      order_id: testOrder1.id,
      method: 'telebirr',
      amount: testOrder1.total_amount,
      payment_proof_url: 'https://example.com/receipt-telebirr-clear-new.jpg'
    };
    const res19 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replacePaymentPayload)
    });
    const data19 = await res19.json();
    assert(res19.status === 201, 'New payment attempt accepted after previous rejection');
    assert(data19.data.status === 'pending', 'New payment status is pending');

    const payment1Replaced = data19.data;
    createdPaymentIds.push(payment1Replaced.id);

    // -----------------------------------------------------------------------
    // Test 20: Payment history is preserved after rejection
    // -----------------------------------------------------------------------
    console.log('\n--- Test 20: Payment history is preserved after rejection ---');
    const res20Hist = await fetch(`${BASE_URL}/api/payments/order/${testOrder1.id}`);
    const data20Hist = await res20Hist.json();
    assert(data20Hist.data.history.length === 2, 'Both previous rejected and new pending payments exist in history');
    assert(data20Hist.data.active_payment.id === payment1Replaced.id, 'Active payment points to new pending payment');

    // -----------------------------------------------------------------------
    // Test 21 & 22: Admin can verify payment & changes order to confirmed
    // -----------------------------------------------------------------------
    console.log('\n--- Test 21 & 22: Admin verify payment & order confirmed ---');
    const res21 = await fetch(`${BASE_URL}/api/admin/payments/${payment1Replaced.id}/verify`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data21 = await res21.json();
    assert(res21.status === 200, 'PATCH /api/admin/payments/:id/verify returns HTTP 200');
    assert(data21.data.payment.status === 'verified', 'Payment status is verified');
    assert(data21.data.payment.verified_at !== null, 'verified_at timestamp set');

    const checkOrder1Final = await fetch(`${BASE_URL}/api/orders/${testOrder1.id}`);
    const checkOrder1FinalData = await checkOrder1Final.json();
    assert(checkOrder1FinalData.data.status === 'confirmed', 'Order status moved to confirmed');

    // -----------------------------------------------------------------------
    // Test 23: Already verified payment cannot be verified again
    // -----------------------------------------------------------------------
    console.log('\n--- Test 23: Already verified payment cannot be verified again ---');
    const res23 = await fetch(`${BASE_URL}/api/admin/payments/${payment1Replaced.id}/verify`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res23.status === 400, 'Double verification returns HTTP 400');

    // -----------------------------------------------------------------------
    // Test 24: Cash payment verification flow
    // -----------------------------------------------------------------------
    console.log('\n--- Test 24: Cash payment verification flow ---');
    const res24 = await fetch(`${BASE_URL}/api/admin/payments/${payment2.id}/verify`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data24 = await res24.json();
    assert(res24.status === 200, 'Cash payment verified on delivery');
    assert(data24.data.payment.status === 'verified', 'Cash payment status is verified');

    const checkOrder2Final = await fetch(`${BASE_URL}/api/orders/${testOrder2.id}`);
    const checkOrder2FinalData = await checkOrder2Final.json();
    assert(checkOrder2FinalData.data.status === 'confirmed', 'Cash order status moved from pending to confirmed');

    // =======================================================================
    // SCREENSHOT UPLOAD & TELEBIRR PROOF TESTS
    // =======================================================================
    console.log('\n======================================================');
    console.log('STARTING SCREENSHOT UPLOAD & TELEBIRR PROOF TESTS');
    console.log('======================================================');

    // Create fresh test orders for upload tests
    const uploadTestOrder = await createTestOrder(p1, '+251944111222');

    // Sample buffers for testing image upload & validation
    const validJpegBuffer = Buffer.concat([
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.from('telebirr sample transaction receipt jpeg binary payload')
    ]);

    const validPngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.from('telebirr sample transaction receipt png binary payload')
    ]);

    const validWebpBuffer = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x28, 0x00, 0x00, 0x00]),
      Buffer.from('WEBPVP8 '),
      Buffer.from('telebirr sample transaction receipt webp binary payload')
    ]);

    const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf document not an image');
    const exeDisguisedBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 fake executable disguised as image');
    const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0x41); // 5.5 MB

    // Test 25: Valid JPEG upload via POST /api/payments/upload-proof
    console.log('\n--- Test 25: Valid JPEG upload via POST /api/payments/upload-proof ---');
    const fdJpeg = new FormData();
    fdJpeg.append('order_id', uploadTestOrder.id);
    fdJpeg.append('screenshot', new Blob([validJpegBuffer], { type: 'image/jpeg' }), 'telebirr-receipt.jpg');

    const resUploadJpeg = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: fdJpeg
    });
    const dataUploadJpeg = await resUploadJpeg.json();
    assert(resUploadJpeg.status === 201, 'POST /api/payments/upload-proof returns HTTP 201');
    assert(dataUploadJpeg.success === true, 'Upload response indicates success: true');
    assert(typeof dataUploadJpeg.data.file_url === 'string' && dataUploadJpeg.data.file_url.startsWith('/api/payments/proof/'), 'Valid file_url returned');
    assert(dataUploadJpeg.data.mime_type === 'image/jpeg', 'Detected MIME type is image/jpeg');
    assert(dataUploadJpeg.data.order_id === uploadTestOrder.id, 'Uploaded file associated with correct order_id');

    const uploadedJpegUrl = dataUploadJpeg.data.file_url;

    // Test 26: Stored proof image can be fetched via GET /api/payments/proof/:fileId
    console.log('\n--- Test 26: Stored proof image can be fetched via GET /api/payments/proof/:fileId ---');
    const resGetProof = await fetch(`${BASE_URL}${uploadedJpegUrl}`);
    assert(resGetProof.status === 200, 'GET /api/payments/proof/:fileId returns HTTP 200');
    assert(resGetProof.headers.get('content-type') === 'image/jpeg', 'Served file has Content-Type: image/jpeg');
    const retrievedBuffer = Buffer.from(await resGetProof.arrayBuffer());
    assert(retrievedBuffer.equals(validJpegBuffer), 'Served binary content matches uploaded JPEG exactly');

    // Test 27: Valid PNG upload via POST /api/payments/upload-proof
    console.log('\n--- Test 27: Valid PNG upload via POST /api/payments/upload-proof ---');
    const fdPng = new FormData();
    fdPng.append('order_id', uploadTestOrder.id);
    fdPng.append('screenshot', new Blob([validPngBuffer], { type: 'image/png' }), 'telebirr-receipt.png');

    const resUploadPng = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: fdPng
    });
    const dataUploadPng = await resUploadPng.json();
    assert(resUploadPng.status === 201, 'POST /api/payments/upload-proof with PNG returns HTTP 201');
    assert(dataUploadPng.data.mime_type === 'image/png', 'Detected MIME type is image/png');

    // Test 28: Valid WEBP upload via POST /api/payments/upload-proof
    console.log('\n--- Test 28: Valid WEBP upload via POST /api/payments/upload-proof ---');
    const fdWebp = new FormData();
    fdWebp.append('order_id', uploadTestOrder.id);
    fdWebp.append('screenshot', new Blob([validWebpBuffer], { type: 'image/webp' }), 'telebirr-receipt.webp');

    const resUploadWebp = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: fdWebp
    });
    const dataUploadWebp = await resUploadWebp.json();
    assert(resUploadWebp.status === 201, 'POST /api/payments/upload-proof with WEBP returns HTTP 201');
    assert(dataUploadWebp.data.mime_type === 'image/webp', 'Detected MIME type is image/webp');

    // Test 29: Unsupported file rejection (PDF)
    console.log('\n--- Test 29: Unsupported file rejection (PDF) ---');
    const fdPdf = new FormData();
    fdPdf.append('order_id', uploadTestOrder.id);
    fdPdf.append('screenshot', new Blob([pdfBuffer], { type: 'application/pdf' }), 'invoice.pdf');

    const resUploadPdf = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: fdPdf
    });
    assert(resUploadPdf.status === 400, 'Uploading PDF returns HTTP 400');
    const dataUploadPdf = await resUploadPdf.json();
    assert(dataUploadPdf.success === false, 'PDF upload rejected with success: false');

    // Test 30: Disguised executable rejection (EXE disguised as .jpg)
    console.log('\n--- Test 30: Disguised executable rejection (EXE disguised as .jpg) ---');
    const fdExe = new FormData();
    fdExe.append('order_id', uploadTestOrder.id);
    fdExe.append('screenshot', new Blob([exeDisguisedBuffer], { type: 'image/jpeg' }), 'malicious.jpg');

    const resUploadExe = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: fdExe
    });
    assert(resUploadExe.status === 400, 'Uploading disguised executable returns HTTP 400');
    const dataUploadExe = await resUploadExe.json();
    assert(dataUploadExe.message.toLowerCase().includes('executable') || dataUploadExe.message.toLowerCase().includes('unsupported') || dataUploadExe.message.toLowerCase().includes('invalid'), 'Clear rejection message for executable file');

    // Test 31: Oversized file rejection (> 5 MB)
    console.log('\n--- Test 31: Oversized file rejection (> 5 MB) ---');
    const fdOversized = new FormData();
    fdOversized.append('order_id', uploadTestOrder.id);
    fdOversized.append('screenshot', new Blob([oversizedBuffer], { type: 'image/jpeg' }), 'huge-screenshot.jpg');

    const resUploadOversized = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: fdOversized
    });
    assert(resUploadOversized.status === 400, 'Oversized file returns HTTP 400');
    const dataUploadOversized = await resUploadOversized.json();
    assert(dataUploadOversized.message.toLowerCase().includes('5 mb') || dataUploadOversized.message.toLowerCase().includes('exceed'), 'Rejection message explains size limit');

    // Test 32: Upload for non-existent order rejected
    console.log('\n--- Test 32: Upload for non-existent order rejected ---');
    const fdNonExistent = new FormData();
    fdNonExistent.append('order_id', '00000000-0000-0000-0000-000000000000');
    fdNonExistent.append('screenshot', new Blob([validJpegBuffer], { type: 'image/jpeg' }), 'proof.jpg');

    const resNonExistent = await fetch(`${BASE_URL}/api/payments/upload-proof`, {
      method: 'POST',
      body: fdNonExistent
    });
    assert(resNonExistent.status === 404, 'Upload for non-existent order returns HTTP 404');

    // Test 33: Telebirr payment with uploaded proof succeeds & moves order to payment_review
    console.log('\n--- Test 33: Telebirr payment with uploaded proof succeeds ---');
    const resPayUploaded = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: uploadTestOrder.id,
        method: 'telebirr',
        amount: uploadTestOrder.total_amount,
        payment_proof_url: uploadedJpegUrl
      })
    });
    const dataPayUploaded = await resPayUploaded.json();
    assert(resPayUploaded.status === 201, 'POST /api/payments with uploaded proof returns HTTP 201');
    assert(dataPayUploaded.data.status === 'pending', 'Payment status is pending');
    assert(dataPayUploaded.data.payment_proof_url === uploadedJpegUrl, 'Payment references stored proof URL');
    createdPaymentIds.push(dataPayUploaded.data.id);

    const checkUploadOrderRes = await fetch(`${BASE_URL}/api/orders/${uploadTestOrder.id}`);
    const checkUploadOrderData = await checkUploadOrderRes.json();
    assert(checkUploadOrderData.data.status === 'payment_review', 'Order moved to payment_review with uploaded proof');

    // Test 34: Single-step multipart POST /api/payments with screenshot file
    console.log('\n--- Test 34: Single-step multipart POST /api/payments with screenshot file ---');
    const uploadTestOrder2 = await createTestOrder(p2, '+251944333444');
    const fdSingleStep = new FormData();
    fdSingleStep.append('order_id', uploadTestOrder2.id);
    fdSingleStep.append('method', 'telebirr');
    fdSingleStep.append('amount', String(uploadTestOrder2.total_amount));
    fdSingleStep.append('screenshot', new Blob([validPngBuffer], { type: 'image/png' }), 'telebirr-step-screenshot.png');

    const resSingleStep = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      body: fdSingleStep
    });
    const dataSingleStep = await resSingleStep.json();
    assert(resSingleStep.status === 201, 'Single-step multipart POST /api/payments returns HTTP 201');
    assert(dataSingleStep.data.method === 'telebirr', 'Payment method is telebirr');
    assert(typeof dataSingleStep.data.payment_proof_url === 'string' && dataSingleStep.data.payment_proof_url.startsWith('/api/payments/proof/'), 'Payment proof URL generated and saved');
    createdPaymentIds.push(dataSingleStep.data.id);

    const checkSingleStepOrder = await fetch(`${BASE_URL}/api/orders/${uploadTestOrder2.id}`);
    const checkSingleStepData = await checkSingleStepOrder.json();
    assert(checkSingleStepData.data.status === 'payment_review', 'Order moved to payment_review in single-step submission');

    // Test 35: Admin can verify payment with uploaded proof
    console.log('\n--- Test 35: Admin can verify payment with uploaded proof ---');
    const resVerifyUploaded = await fetch(`${BASE_URL}/api/admin/payments/${dataSingleStep.data.id}/verify`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataVerifyUploaded = await resVerifyUploaded.json();
    assert(resVerifyUploaded.status === 200, 'Admin can verify payment with uploaded screenshot');
    assert(dataVerifyUploaded.data.payment.status === 'verified', 'Payment status is verified');

    const checkOrderFinalVerified = await fetch(`${BASE_URL}/api/orders/${uploadTestOrder2.id}`);
    const checkOrderFinalData = await checkOrderFinalVerified.json();
    assert(checkOrderFinalData.data.status === 'confirmed', 'Order is now confirmed');

    // -----------------------------------------------------------------------
    // Test 36: Verify /api/health
    // -----------------------------------------------------------------------
    console.log('\n--- Test 36: Verify /api/health ---');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthData.database.connected === true, 'Database remains connected and healthy');

    console.log(`\n========================================`);
    console.log(`PAYMENTS API TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);

  } catch (err) {
    console.error('[Test Error]', err);
  } finally {
    // Clean up created test records
    console.log('\n--- Cleaning up test records ---');
    const cleanupClient = await pool.connect();
    try {
      if (createdPaymentIds.length > 0) {
        await cleanupClient.query('DELETE FROM payments WHERE id = ANY($1::uuid[]);', [createdPaymentIds]);
        console.log(`Cleaned up ${createdPaymentIds.length} test payments.`);
      }
      if (createdOrderIds.length > 0) {
        await cleanupClient.query('DELETE FROM payment_proof_files WHERE order_id = ANY($1::uuid[]);', [createdOrderIds]);
        await cleanupClient.query('DELETE FROM orders WHERE id = ANY($1::uuid[]);', [createdOrderIds]);
        console.log(`Cleaned up ${createdOrderIds.length} test orders.`);
      }
      if (createdCustomerIds.length > 0) {
        await cleanupClient.query('DELETE FROM customers WHERE id = ANY($1::uuid[]);', [createdCustomerIds]);
        console.log(`Cleaned up ${createdCustomerIds.length} test customers.`);
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

runPaymentTests();
