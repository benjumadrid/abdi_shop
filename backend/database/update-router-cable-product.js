const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const { query } = require('../src/db/db');

async function updateRouterCableProduct() {
  console.log('=== UPDATING ROUTER CABLE PRODUCT RECORD ===\n');

  const TARGET_PRODUCT_ID = 'c16dfe9a-8a74-42b4-8ac3-b42546e50d1a';

  // 1. Fetch current product record
  const currentRes = await query(
    'SELECT id, name_en, name_am, description_en, description_am, price, image_url, is_available, created_at, updated_at FROM products WHERE id = $1',
    [TARGET_PRODUCT_ID]
  );

  if (currentRes.rows.length === 0) {
    throw new Error(`Target product with ID ${TARGET_PRODUCT_ID} not found in database!`);
  }

  const oldProduct = currentRes.rows[0];
  console.log('--- OLD PRODUCT RECORD ---');
  console.log('ID:', oldProduct.id);
  console.log('Name (EN):', oldProduct.name_en);
  console.log('Name (AM):', oldProduct.name_am);
  console.log('Description (EN):', oldProduct.description_en);
  console.log('Price:', oldProduct.price, 'ETB');
  console.log('Available:', oldProduct.is_available);

  // Check current media
  const currentMediaRes = await query(
    'SELECT id, product_id, media_type, mime_type, filename, file_size, sort_order, is_primary FROM product_media WHERE product_id = $1 ORDER BY sort_order ASC',
    [TARGET_PRODUCT_ID]
  );
  console.log(`Attached Media Items (${currentMediaRes.rows.length}):`);
  currentMediaRes.rows.forEach(m => {
    console.log(` - ID: ${m.id} | Primary: ${m.is_primary} | Order: ${m.sort_order} | File: ${m.filename}`);
  });

  // 2. Perform update using parameterized SQL
  const newNameEn = 'WiFi Router Power Boost Cable';
  const newNameAm = 'የዋይፋይ ራውተር ፓወር ቡስት ኬብል';
  const newDescEn = 'Keep your WiFi connected even when the electricity goes out. This WiFi Router Power Boost Cable allows you to power a compatible WiFi router or modem directly from a power bank, providing a convenient backup power solution during power outages. It converts power from a USB power bank to the required DC output for compatible routers, helping you stay connected without needing electricity from the wall. Compact, practical, and easy to use — simply connect the USB end to your power bank and the DC connector to your compatible router. Perfect for homes, offices, and businesses that need reliable internet during power cuts.';

  const updateRes = await query(
    `UPDATE products
     SET name_en = $1,
         name_am = $2,
         description_en = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, name_en, name_am, description_en, description_am, price, image_url, is_available, created_at, updated_at`,
    [newNameEn, newNameAm, newDescEn, TARGET_PRODUCT_ID]
  );

  const updatedProduct = updateRes.rows[0];
  console.log('\n--- NEW PRODUCT RECORD ---');
  console.log('ID:', updatedProduct.id);
  console.log('Name (EN):', updatedProduct.name_en);
  console.log('Name (AM):', updatedProduct.name_am);
  console.log('Description (EN):', updatedProduct.description_en);
  console.log('Price:', updatedProduct.price, 'ETB');
  console.log('Available:', updatedProduct.is_available);
  console.log('Updated At:', updatedProduct.updated_at);

  // 3. Verify media records remain intact
  const verifyMediaRes = await query(
    'SELECT id, product_id, media_type, mime_type, filename, file_size, sort_order, is_primary FROM product_media WHERE product_id = $1 ORDER BY sort_order ASC',
    [TARGET_PRODUCT_ID]
  );

  console.log(`\n--- VERIFIED MEDIA ITEMS AFTER UPDATE (${verifyMediaRes.rows.length}) ---`);
  verifyMediaRes.rows.forEach(m => {
    console.log(` - ID: ${m.id} | Primary: ${m.is_primary} | Order: ${m.sort_order} | File: ${m.filename}`);
  });

  if (verifyMediaRes.rows.length !== currentMediaRes.rows.length) {
    throw new Error('Media count mismatch after update!');
  }

  console.log('\n=== UPDATE COMPLETED SUCCESSFULLY ===');
}

updateRouterCableProduct()
  .catch(err => {
    console.error('[Error]', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
