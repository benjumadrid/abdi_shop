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

async function runMediaTests() {
  console.log('=== STARTING PRODUCT MEDIA API VERIFICATION TESTS ===\n');
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

  let adminToken = null;
  let serverInstance = null;
  let testProductId = null;
  const createdMediaIds = [];

  // Ensure server is running
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/health`);
    if (!healthCheck.ok) throw new Error('Not running');
  } catch (err) {
    console.log('[Setup] Local server not running on port 5000. Starting in-process server...');
    serverInstance = app.listen(5000);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  try {
    adminToken = await getAdminToken();
    console.log('[Setup] Admin token acquired for media tests.\n');

    // Create a dedicated test product for media testing
    console.log('--- Setup: Create dedicated test product ---');
    const prodRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        name_en: 'Media Test Gadget',
        name_am: 'የሚዲያ ሙከራ መሣሪያ',
        description_en: 'Temporary product used for media upload tests.',
        price: 999.00,
        is_available: true
      })
    });
    const prodData = await prodRes.json();
    assert(prodRes.status === 201, 'Dedicated test product created');
    testProductId = prodData.data.id;

    // Sample buffers
    const validJpeg = Buffer.concat([
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.from('sample jpeg image binary test data')
    ]);

    const validPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.from('sample png image binary test data')
    ]);

    const validWebp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WEBPVP8 '),
      Buffer.from('sample webp image binary test data')
    ]);

    const validMp4 = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x20]),
      Buffer.from('ftypisom'),
      Buffer.from([0x00, 0x00, 0x02, 0x00]),
      Buffer.from('isomiso2mp41'),
      Buffer.from('sample mp4 video binary test data')
    ]);

    const validWebm = Buffer.concat([
      Buffer.from([0x1A, 0x45, 0xDF, 0xA3]),
      Buffer.from('sample webm ebml container binary test data')
    ]);

    const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf document not an image or video');
    const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 executable disguised as media');

    const oversizedImage = Buffer.alloc(5.5 * 1024 * 1024, 0x20);
    oversizedImage[0] = 0xFF; oversizedImage[1] = 0xD8; oversizedImage[2] = 0xFF;

    const oversizedVideo = Buffer.alloc(31 * 1024 * 1024, 0x00);
    Buffer.from('ftyp').copy(oversizedVideo, 4);

    // -------------------------------------------------------------
    // Test 1: Upload valid JPEG (first upload should be is_primary=true)
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Upload valid JPEG ---');
    const fd1 = new FormData();
    fd1.append('file', new Blob([validJpeg], { type: 'image/jpeg' }), 'gadget-front.jpg');

    const res1 = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fd1
    });
    const data1 = await res1.json();
    assert(res1.status === 201, 'POST /api/products/:productId/media returns HTTP 201');
    assert(data1.success === true, 'Upload response indicates success: true');
    assert(data1.data.media_type === 'image', 'Media type is image');
    assert(data1.data.mime_type === 'image/jpeg', 'MIME type is image/jpeg');
    assert(data1.data.is_primary === true, 'First media item automatically becomes is_primary = true');
    assert(data1.data.sort_order === 0, 'First media item defaults to sort_order = 0');
    assert(data1.data.url === `/api/products/media/${data1.data.id}`, 'Valid url returned');
    const mediaId1 = data1.data.id;
    createdMediaIds.push(mediaId1);

    // -------------------------------------------------------------
    // Test 2: Upload valid PNG
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Upload valid PNG ---');
    const fd2 = new FormData();
    fd2.append('file', new Blob([validPng], { type: 'image/png' }), 'gadget-side.png');

    const res2 = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fd2
    });
    const data2 = await res2.json();
    assert(res2.status === 201, 'POST PNG returns HTTP 201');
    assert(data2.data.media_type === 'image', 'Media type is image');
    assert(data2.data.mime_type === 'image/png', 'MIME type is image/png');
    assert(data2.data.is_primary === false, 'Subsequent media defaults to is_primary = false');
    assert(data2.data.sort_order === 1, 'Second media item increments sort_order to 1');
    const mediaId2 = data2.data.id;
    createdMediaIds.push(mediaId2);

    // -------------------------------------------------------------
    // Test 3: Upload valid WEBP
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Upload valid WEBP ---');
    const fd3 = new FormData();
    fd3.append('file', new Blob([validWebp], { type: 'image/webp' }), 'gadget-box.webp');

    const res3 = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fd3
    });
    const data3 = await res3.json();
    assert(res3.status === 201, 'POST WEBP returns HTTP 201');
    assert(data3.data.media_type === 'image', 'Media type is image');
    assert(data3.data.mime_type === 'image/webp', 'MIME type is image/webp');
    const mediaId3 = data3.data.id;
    createdMediaIds.push(mediaId3);

    // -------------------------------------------------------------
    // Test 4: Upload valid MP4 video
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Upload valid MP4 video ---');
    const fd4 = new FormData();
    fd4.append('file', new Blob([validMp4], { type: 'video/mp4' }), 'gadget-demo.mp4');

    const res4 = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fd4
    });
    const data4 = await res4.json();
    assert(res4.status === 201, 'POST MP4 video returns HTTP 201');
    assert(data4.data.media_type === 'video', 'Media type is video');
    assert(data4.data.mime_type === 'video/mp4', 'MIME type is video/mp4');
    const mediaId4 = data4.data.id;
    createdMediaIds.push(mediaId4);

    // -------------------------------------------------------------
    // Test 5: Upload valid WEBM video
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Upload valid WEBM video ---');
    const fd5 = new FormData();
    fd5.append('file', new Blob([validWebm], { type: 'video/webm' }), 'gadget-preview.webm');

    const res5 = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fd5
    });
    const data5 = await res5.json();
    assert(res5.status === 201, 'POST WEBM video returns HTTP 201');
    assert(data5.data.media_type === 'video', 'Media type is video');
    assert(data5.data.mime_type === 'video/webm', 'MIME type is video/webm');
    const mediaId5 = data5.data.id;
    createdMediaIds.push(mediaId5);

    // -------------------------------------------------------------
    // Test 6: Reject unsupported file (PDF)
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Reject unsupported file (PDF) ---');
    const fdPdf = new FormData();
    fdPdf.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'manual.pdf');

    const resPdf = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fdPdf
    });
    assert(resPdf.status === 400, 'Uploading PDF rejected with HTTP 400');
    const dataPdf = await resPdf.json();
    assert(dataPdf.success === false, 'PDF upload response success: false');

    // -------------------------------------------------------------
    // Test 7: Reject disguised executable (.exe disguised as .jpg)
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Reject disguised executable ---');
    const fdExe = new FormData();
    fdExe.append('file', new Blob([exeBuffer], { type: 'image/jpeg' }), 'malicious.jpg');

    const resExe = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fdExe
    });
    assert(resExe.status === 400, 'Disguised executable rejected with HTTP 400');
    const dataExe = await resExe.json();
    assert(dataExe.message.toLowerCase().includes('executable') || dataExe.message.toLowerCase().includes('unsupported') || dataExe.message.toLowerCase().includes('invalid'), 'Clear error rejecting executable file');

    // -------------------------------------------------------------
    // Test 8: Reject oversized image (> 5 MB)
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Reject oversized image (> 5 MB) ---');
    const fdOversizedImg = new FormData();
    fdOversizedImg.append('file', new Blob([oversizedImage], { type: 'image/jpeg' }), 'huge.jpg');

    const resOversizedImg = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fdOversizedImg
    });
    assert(resOversizedImg.status === 400, 'Oversized image rejected with HTTP 400');
    const dataOversizedImg = await resOversizedImg.json();
    assert(dataOversizedImg.message.toLowerCase().includes('5 mb') || dataOversizedImg.message.toLowerCase().includes('exceed'), 'Rejection message explains 5 MB image limit');

    // -------------------------------------------------------------
    // Test 9: Reject oversized video (> 30 MB)
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Reject oversized video (> 30 MB) ---');
    const fdOversizedVid = new FormData();
    fdOversizedVid.append('file', new Blob([oversizedVideo], { type: 'video/mp4' }), 'huge.mp4');

    const resOversizedVid = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fdOversizedVid
    });
    assert(resOversizedVid.status === 400, 'Oversized video rejected with HTTP 400');
    const dataOversizedVid = await resOversizedVid.json();
    assert(dataOversizedVid.message.toLowerCase().includes('30 mb') || dataOversizedVid.message.toLowerCase().includes('exceed'), 'Rejection message explains 30 MB video limit');

    // -------------------------------------------------------------
    // Test 10: Public media listing (ordered by sort_order)
    // -------------------------------------------------------------
    console.log('\n--- Test 10: Public media listing ---');
    const resList = await fetch(`${BASE_URL}/api/products/${testProductId}/media`);
    const dataList = await resList.json();
    assert(resList.status === 200, 'GET /api/products/:productId/media returns HTTP 200 without auth');
    assert(dataList.success === true, 'Response success: true');
    assert(Array.isArray(dataList.data), 'Array of media returned');
    assert(dataList.data.length === 5, 'All 5 uploaded media items returned');
    // Verify ascending sort order
    let isSorted = true;
    for (let i = 1; i < dataList.data.length; i++) {
      if (dataList.data[i].sort_order < dataList.data[i - 1].sort_order) isSorted = false;
    }
    assert(isSorted, 'Media items sorted by sort_order ascending');
    const primaryItems = dataList.data.filter(m => m.is_primary === true);
    assert(primaryItems.length === 1, 'Exactly one primary media item exists');
    assert(primaryItems[0].id === mediaId1, 'Original first upload is primary');

    // -------------------------------------------------------------
    // Test 11: Serve binary media via GET /api/products/media/:mediaId
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Serve binary media ---');
    const resServe = await fetch(`${BASE_URL}/api/products/media/${mediaId1}`);
    assert(resServe.status === 200, 'GET /api/products/media/:mediaId returns HTTP 200');
    assert(resServe.headers.get('content-type') === 'image/jpeg', 'Served file has Content-Type: image/jpeg');
    const servedBuf = Buffer.from(await resServe.arrayBuffer());
    assert(servedBuf.equals(validJpeg), 'Served binary content matches uploaded JPEG exactly');

    // Serve MP4 video
    const resServeVideo = await fetch(`${BASE_URL}/api/products/media/${mediaId4}`);
    assert(resServeVideo.status === 200, 'GET /api/products/media/:mediaId for video returns HTTP 200');
    assert(resServeVideo.headers.get('content-type') === 'video/mp4', 'Served video has Content-Type: video/mp4');

    // -------------------------------------------------------------
    // Test 12: Admin update media (set mediaId2 as primary)
    // -------------------------------------------------------------
    console.log('\n--- Test 12: Admin update media (change primary) ---');
    const resPatch = await fetch(`${BASE_URL}/api/products/media/${mediaId2}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ is_primary: true })
    });
    const dataPatch = await resPatch.json();
    assert(resPatch.status === 200, 'PATCH /api/products/media/:mediaId returns HTTP 200');
    assert(dataPatch.data.is_primary === true, 'Media item 2 updated to is_primary = true');

    // Verify media item 1 was automatically unset
    const resListAfterPrimary = await fetch(`${BASE_URL}/api/products/${testProductId}/media`);
    const dataListAfterPrimary = await resListAfterPrimary.json();
    const primaryAfter = dataListAfterPrimary.data.filter(m => m.is_primary === true);
    assert(primaryAfter.length === 1 && primaryAfter[0].id === mediaId2, 'Only media item 2 is primary now');

    // -------------------------------------------------------------
    // Test 13: Admin bulk reorder media
    // -------------------------------------------------------------
    console.log('\n--- Test 13: Admin bulk reorder media ---');
    const reorderPayload = {
      items: [
        { id: mediaId5, sort_order: 0 },
        { id: mediaId4, sort_order: 1 },
        { id: mediaId3, sort_order: 2 },
        { id: mediaId2, sort_order: 3 },
        { id: mediaId1, sort_order: 4 }
      ]
    };
    const resReorder = await fetch(`${BASE_URL}/api/products/${testProductId}/media/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(reorderPayload)
    });
    const dataReorder = await resReorder.json();
    assert(resReorder.status === 200, 'PUT /api/products/:productId/media/reorder returns HTTP 200');
    assert(dataReorder.data[0].id === mediaId5 && dataReorder.data[0].sort_order === 0, 'mediaId5 is now first with sort_order 0');
    assert(dataReorder.data[4].id === mediaId1 && dataReorder.data[4].sort_order === 4, 'mediaId1 is now last with sort_order 4');

    // -------------------------------------------------------------
    // Test 14: Product detail response includes media collection
    // -------------------------------------------------------------
    console.log('\n--- Test 14: Product detail response includes media collection ---');
    const resProdDetail = await fetch(`${BASE_URL}/api/products/${testProductId}`);
    const dataProdDetail = await resProdDetail.json();
    assert(resProdDetail.status === 200, 'GET /api/products/:id returns HTTP 200');
    assert(Array.isArray(dataProdDetail.data.media), 'Product detail response has media array');
    assert(dataProdDetail.data.media.length === 5, 'Media array contains all 5 items');
    assert(dataProdDetail.data.name_en === 'Media Test Gadget', 'Existing product fields preserved');

    // -------------------------------------------------------------
    // Test 15: Unauthorized modifications rejected with HTTP 401
    // -------------------------------------------------------------
    console.log('\n--- Test 15: Unauthorized modifications rejected ---');
    const resUnauthPost = await fetch(`${BASE_URL}/api/products/${testProductId}/media`, {
      method: 'POST',
      body: fd1
    });
    assert(resUnauthPost.status === 401, 'POST media without token returns HTTP 401');

    const resUnauthPatch = await fetch(`${BASE_URL}/api/products/media/${mediaId1}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true })
    });
    assert(resUnauthPatch.status === 401, 'PATCH media without token returns HTTP 401');

    const resUnauthDelete = await fetch(`${BASE_URL}/api/products/media/${mediaId1}`, {
      method: 'DELETE'
    });
    assert(resUnauthDelete.status === 401, 'DELETE media without token returns HTTP 401');

    // -------------------------------------------------------------
    // Test 16: Delete primary media promotes next media item to primary
    // -------------------------------------------------------------
    console.log('\n--- Test 16: Delete primary media promotes next item ---');
    // mediaId2 is currently primary. Delete it.
    const resDelete = await fetch(`${BASE_URL}/api/products/media/${mediaId2}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataDelete = await resDelete.json();
    assert(resDelete.status === 200, 'DELETE /api/products/media/:mediaId returns HTTP 200');
    assert(dataDelete.success === true, 'Delete response indicates success: true');

    // Verify remaining media has a new primary promoted
    const resListAfterDelete = await fetch(`${BASE_URL}/api/products/${testProductId}/media`);
    const dataListAfterDelete = await resListAfterDelete.json();
    assert(dataListAfterDelete.data.length === 4, '4 media items remain after deletion');
    const newPrimaries = dataListAfterDelete.data.filter(m => m.is_primary === true);
    assert(newPrimaries.length === 1, 'Next media item was promoted to primary');

    // -------------------------------------------------------------
    // Test 17: Verify /api/health
    // -------------------------------------------------------------
    console.log('\n--- Test 17: Verify /api/health ---');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthData.database.connected === true, 'Database remains healthy');

    console.log(`\n========================================`);
    console.log(`PRODUCT MEDIA API TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);

  } catch (err) {
    console.error('[Test Error]', err);
  } finally {
    console.log('\n--- Cleaning up test records ---');
    const cleanupClient = await pool.connect();
    try {
      if (testProductId) {
        // Deleting test product cascade-deletes its media
        await cleanupClient.query('DELETE FROM product_media WHERE product_id = $1;', [testProductId]);
        await cleanupClient.query('DELETE FROM products WHERE id = $1;', [testProductId]);
        console.log(`Cleaned up test product: ${testProductId}`);
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

runMediaTests();
