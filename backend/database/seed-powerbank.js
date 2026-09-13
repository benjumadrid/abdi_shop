const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== ADDING NEW PRODUCT: F-max TD-301 30,000mAh Power Bank ===\n');

  const client = await pool.connect();

  try {
    // 1. Inspect live schema of the products table
    console.log('[Step 1] Inspecting existing products table schema...');
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position;
    `;
    const schemaRes = await client.query(schemaQuery);
    console.log('Products table columns:');
    schemaRes.rows.forEach(col => {
      console.log(` - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });

    // 2. Check whether product with same English name already exists
    const productNameEn = 'F-max TD-301 30,000mAh Power Bank';
    console.log(`\n[Step 2] Checking if product already exists: "${productNameEn}"...`);
    const checkQuery = `SELECT * FROM products WHERE name_en = $1;`;
    const existingRes = await client.query(checkQuery, [productNameEn]);

    let productRecord = null;
    let wasInserted = false;

    if (existingRes.rows.length > 0) {
      console.log('[Notice] Product already exists in database. Skipping insertion to avoid duplicates.');
      productRecord = existingRes.rows[0];
      wasInserted = false;
    } else {
      console.log('[Step 3] Product does not exist. Inserting new product using parameterized SQL...');
      const insertQuery = `
        INSERT INTO products (
          name_en,
          name_am,
          description_en,
          description_am,
          price,
          image_url,
          is_available
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;

      const insertValues = [
        productNameEn,
        'F-max TD-301 30,000mAh ፓወር ባንክ',
        "F-max TD-301 30,000mAh Power Bank — A high-capacity portable power bank designed to keep your devices charged while you're away from a wall outlet. It features a 30,000mAh rated capacity and up to 22.5W output, with built-in iOS, Type-C, and Micro-USB cables for convenient charging of compatible devices. Its compact design makes it suitable for everyday use, travel, work, and emergencies.",
        null,
        4500.00,
        null,
        true
      ];

      const insertRes = await client.query(insertQuery, insertValues);
      productRecord = insertRes.rows[0];
      wasInserted = true;
      console.log('[Success] Product successfully inserted into database.');
    }

    // 4. Verification of database record
    console.log('\n[Step 4] Verifying database record values:');
    console.log(` - Was inserted:        ${wasInserted ? 'YES (New product added)' : 'NO (Already existed)'}`);
    console.log(` - ID:                  ${productRecord.id}`);
    console.log(` - English Name:        ${productRecord.name_en}`);
    console.log(` - Amharic Name:        ${productRecord.name_am}`);
    console.log(` - Price:               ${productRecord.price} ETB`);
    console.log(` - Availability:        ${productRecord.is_available}`);
    console.log(` - Image URL:           ${productRecord.image_url === null ? 'NULL (not invented)' : productRecord.image_url}`);
    console.log(` - English Description: ${productRecord.description_en.substring(0, 70)}...`);
    console.log(` - Amharic Description: ${productRecord.description_am === null ? 'NULL (as required)' : productRecord.description_am}`);
    console.log(` - Created At:          ${productRecord.created_at}`);
    console.log(` - Updated At:          ${productRecord.updated_at}`);

    // Check all assertions
    const asserts = [
      { cond: productRecord.name_en === productNameEn, msg: 'English name matches' },
      { cond: productRecord.name_am === 'F-max TD-301 30,000mAh ፓወር ባንክ', msg: 'Amharic name matches' },
      { cond: parseFloat(productRecord.price) === 4500, msg: 'Price is 4500 ETB' },
      { cond: productRecord.is_available === true, msg: 'Availability is true' },
      { cond: productRecord.image_url === null, msg: 'Image URL is NULL' },
      { cond: productRecord.description_am === null, msg: 'Amharic description is NULL' },
      { cond: productRecord.description_en && productRecord.description_en.includes('30,000mAh rated capacity'), msg: 'English description matches' }
    ];

    console.log('\nField validation checks:');
    let allPassed = true;
    asserts.forEach(a => {
      if (a.cond) {
        console.log(` [PASS] ${a.msg}`);
      } else {
        console.error(` [FAIL] ${a.msg}`);
        allPassed = false;
      }
    });

    if (!allPassed) {
      throw new Error('Database field verification failed');
    }

    // 5. Test public API: GET /api/products
    console.log('\n[Step 5] Verifying public endpoint GET /api/products...');
    const BASE_URL = 'http://localhost:5000';
    let apiRes;
    try {
      apiRes = await fetch(`${BASE_URL}/api/products`);
    } catch (err) {
      // If server is not listening on 5000, start in-process app to verify
      console.log('Local server not running on 5000, testing directly with Express app instance...');
      process.env.NODE_ENV = 'test';
      const { app } = require('../src/server');
      const server = app.listen(5001);
      try {
        apiRes = await fetch('http://localhost:5001/api/products');
      } finally {
        await new Promise(r => server.close(r));
      }
    }

    const apiData = await apiRes.json();
    console.log(`API response status: ${apiRes.status}`);
    console.log(`Total available products returned by API: ${apiData.data.length}`);

    const foundInApi = apiData.data.find(p => p.id === productRecord.id);
    if (foundInApi) {
      console.log(`[PASS] Newly inserted product appears in public GET /api/products list:`);
      console.log(`       ID: ${foundInApi.id}`);
      console.log(`       Name (EN): ${foundInApi.name_en}`);
      console.log(`       Name (AM): ${foundInApi.name_am}`);
      console.log(`       Price: ${foundInApi.price} ETB`);
      console.log(`       Available: ${foundInApi.is_available}`);
      console.log(`       Image: ${foundInApi.image_url}`);
    } else {
      console.error(`[FAIL] Product not found in public GET /api/products list!`);
      allPassed = false;
    }

    // Verify existing products and their prices are unaffected
    console.log('\nExisting products verification:');
    apiData.data.forEach(p => {
      console.log(` - [${p.id}] ${p.name_en}: ${p.price} ETB (available: ${p.is_available})`);
    });

  } catch (err) {
    console.error('[Error during execution]', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
