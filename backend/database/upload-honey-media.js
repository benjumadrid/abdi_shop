const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';

const imagePaths = [
  {
    path: 'C:/Users/acer/.gemini/antigravity/brain/aed2b88d-8f79-4dad-9936-d9125b6cf884/.user_uploaded/media_1788770122795.jpg',
    name: 'yemeni-honey-hero-outdoor-display.jpg',
    role: 'Primary Hero Shot (Staged pyramid arrangement on table with natural lighting)',
    sort_order: 0,
    is_primary: true
  },
  {
    path: 'C:/Users/acer/.gemini/antigravity/brain/aed2b88d-8f79-4dad-9936-d9125b6cf884/.user_uploaded/media_1788770122776.jpg',
    name: 'yemeni-honey-shop-counter-display.jpg',
    role: 'Secondary Display Shot (Hexagonal tins displayed on shop glass counter)',
    sort_order: 1,
    is_primary: false
  }
];

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
    throw new Error('Failed to get admin token: ' + JSON.stringify(data));
  }
  return data.data.token;
}

async function uploadHoneyMedia() {
  console.log('=== UPLOADING YEMENI HONEY PRODUCT MEDIA ===\n');

  // 1. Get Admin Token
  const token = await getAdminToken();
  console.log('[Auth] Admin token acquired.');

  // 2. Locate the "Original Yemeni Honey" product
  const productsRes = await fetch(`${BASE_URL}/api/products?all=true`);
  const productsData = await productsRes.json();
  const product = productsData.data.find(p => p.name_en === "Original Yemeni Honey");

  if (!product) {
    throw new Error('Could not find product: "Original Yemeni Honey"');
  }

  console.log(`[Product] Found product: "${product.name_en}" (ID: ${product.id})`);
  console.log(`[Product] Amharic Name: "${product.name_am}"`);
  console.log(`[Product] Current Price: ${product.price} ETB | Available: ${product.is_available}`);

  // 3. Check if media already exists for this product
  const existingMediaRes = await fetch(`${BASE_URL}/api/products/${product.id}/media`);
  const existingMediaData = await existingMediaRes.json();

  if (existingMediaData.data && existingMediaData.data.length > 0) {
    console.log(`[Check] Product already has ${existingMediaData.data.length} media items attached. Skipping upload to avoid duplicates.`);
    console.log('\n--- EXISTING MEDIA ITEMS ---');
    console.log(JSON.stringify(existingMediaData.data, null, 2));
    return;
  }

  // 4. Upload each image in specified order
  const uploadedResults = [];

  for (const img of imagePaths) {
    console.log(`\n[Upload] Uploading: ${img.name} (${img.role})...`);
    if (!fs.existsSync(img.path)) {
      throw new Error(`File not found: ${img.path}`);
    }

    const fileBuffer = fs.readFileSync(img.path);
    const fd = new FormData();
    fd.append('file', new Blob([fileBuffer], { type: 'image/jpeg' }), img.name);
    fd.append('sort_order', String(img.sort_order));
    fd.append('is_primary', String(img.is_primary));

    const uploadRes = await fetch(`${BASE_URL}/api/products/${product.id}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd
    });

    const uploadData = await uploadRes.json();
    if (uploadRes.status !== 201) {
      throw new Error(`Upload failed (${uploadRes.status}): ${JSON.stringify(uploadData)}`);
    }

    console.log(`[Upload Success] ID: ${uploadData.data.id} | URL: ${uploadData.data.url} | Primary: ${uploadData.data.is_primary} | Order: ${uploadData.data.sort_order}`);
    uploadedResults.push({
      ...uploadData.data,
      role: img.role
    });
  }

  // 5. Verify through GET endpoints
  console.log('\n--- VERIFICATION: GET /api/products/:productId/media ---');
  const verifyListRes = await fetch(`${BASE_URL}/api/products/${product.id}/media`);
  const verifyListData = await verifyListRes.json();
  console.log(`Retrieved ${verifyListData.data.length} media items for product.`);
  verifyListData.data.forEach(m => {
    console.log(` - ID: ${m.id} | Primary: ${m.is_primary} | Order: ${m.sort_order} | Size: ${m.file_size} bytes | URL: ${m.url}`);
  });

  // Verify binary download for each
  console.log('\n--- VERIFICATION: GET /api/products/media/:mediaId (Binary Serving) ---');
  for (const m of verifyListData.data) {
    const serveRes = await fetch(`${BASE_URL}${m.url}`);
    const buf = Buffer.from(await serveRes.arrayBuffer());
    console.log(` - GET ${m.url} -> Status: ${serveRes.status}, Content-Type: ${serveRes.headers.get('content-type')}, Bytes: ${buf.length}`);
  }

  // 6. Verify Product Detail API
  console.log('\n--- VERIFICATION: GET /api/products/:id ---');
  const verifyProdRes = await fetch(`${BASE_URL}/api/products/${product.id}`);
  const verifyProdData = await verifyProdRes.json();
  console.log(`Product: "${verifyProdData.data.name_en}"`);
  console.log(`Amharic: "${verifyProdData.data.name_am}"`);
  console.log(`Price: ${verifyProdData.data.price} ETB (unmodified)`);
  console.log(`Available: ${verifyProdData.data.is_available} (unmodified)`);
  console.log(`Media items count: ${verifyProdData.data.media.length}`);
  console.log(`Primary media: ${verifyProdData.data.media.find(m => m.is_primary)?.url}`);

  console.log('\n=== UPLOAD AND VERIFICATION COMPLETE ===');
}

uploadHoneyMedia().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
