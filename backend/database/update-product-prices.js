const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== UPDATING PRODUCT PRICES IN POSTGRESQL ===\n');

  const client = await pool.connect();

  try {
    // 1. Verify that both products already exist by their English names
    console.log('[Step 1] Verifying target products exist before update...');
    const product1Name = "Original Women's Period Cramp Relief";
    const product2Name = "Original iPhone Cable Charger";

    const p1Query = `SELECT * FROM products WHERE name_en = $1;`;
    const p1Res = await client.query(p1Query, [product1Name]);

    const p2Query = `SELECT * FROM products WHERE name_en = $1;`;
    const p2Res = await client.query(p2Query, [product2Name]);

    if (p1Res.rows.length === 0) {
      throw new Error(`Product not found: "${product1Name}"`);
    }
    if (p2Res.rows.length === 0) {
      throw new Error(`Product not found: "${product2Name}"`);
    }

    const p1Before = p1Res.rows[0];
    const p2Before = p2Res.rows[0];

    console.log(`Found "${product1Name}":`);
    console.log(` - ID: ${p1Before.id}`);
    console.log(` - Current Price: ${p1Before.price} ETB`);
    console.log(` - Available: ${p1Before.is_available}`);

    console.log(`\nFound "${product2Name}":`);
    console.log(` - ID: ${p2Before.id}`);
    console.log(` - Current Price: ${p2Before.price} ETB`);
    console.log(` - Available: ${p2Before.is_available}`);

    // Also get the other two products to ensure they exist and record their before prices
    const honeyRes = await client.query(`SELECT * FROM products WHERE name_en = $1;`, ['Original Yemeni Honey']);
    const powerbankRes = await client.query(`SELECT * FROM products WHERE name_en = $1;`, ['F-max TD-301 30,000mAh Power Bank']);

    const honeyBefore = honeyRes.rows[0];
    const powerbankBefore = powerbankRes.rows[0];

    console.log('\nOther existing products before update:');
    console.log(` - Original Yemeni Honey: ${honeyBefore ? honeyBefore.price : 'N/A'} ETB`);
    console.log(` - F-max TD-301 30,000mAh Power Bank: ${powerbankBefore ? powerbankBefore.price : 'N/A'} ETB`);

    // 2. Update ONLY the price fields using parameterized SQL queries
    console.log('\n[Step 2] Updating prices using parameterized SQL...');
    const updateQuery = `
      UPDATE products
      SET price = $1, updated_at = NOW()
      WHERE id = $2 AND name_en = $3
      RETURNING *;
    `;

    const newP1Price = 2600.00;
    const newP2Price = 1300.00;

    const p1UpdateRes = await client.query(updateQuery, [newP1Price, p1Before.id, product1Name]);
    const p2UpdateRes = await client.query(updateQuery, [newP2Price, p2Before.id, product2Name]);

    const p1After = p1UpdateRes.rows[0];
    const p2After = p2UpdateRes.rows[0];

    console.log('[Success] Prices updated successfully in database.');

    // 3. Query both records and verify
    console.log('\n[Step 3] Verifying updated records in PostgreSQL:');
    console.log(`\n1. "${product1Name}":`);
    console.log(` - Before Price:        ${p1Before.price} ETB`);
    console.log(` - After Price:         ${p1After.price} ETB`);
    console.log(` - Name (EN):           ${p1After.name_en}`);
    console.log(` - Name (AM):           ${p1After.name_am}`);
    console.log(` - Availability:        ${p1After.is_available}`);
    console.log(` - Image URL:           ${p1After.image_url}`);
    console.log(` - Amharic Description: ${p1After.description_am}`);

    console.log(`\n2. "${product2Name}":`);
    console.log(` - Before Price:        ${p2Before.price} ETB`);
    console.log(` - After Price:         ${p2After.price} ETB`);
    console.log(` - Name (EN):           ${p2After.name_en}`);
    console.log(` - Name (AM):           ${p2After.name_am}`);
    console.log(` - Availability:        ${p2After.is_available}`);
    console.log(` - Image URL:           ${p2After.image_url}`);
    console.log(` - Amharic Description: ${p2After.description_am}`);

    // Verification assertions
    const asserts = [
      { cond: parseFloat(p1After.price) === 2600, msg: "Original Women's Period Cramp Relief price is 2600.00 ETB" },
      { cond: parseFloat(p2After.price) === 1300, msg: "Original iPhone Cable Charger price is 1300.00 ETB" },
      { cond: p1After.name_en === p1Before.name_en, msg: "Product 1 name_en unchanged" },
      { cond: p1After.name_am === p1Before.name_am, msg: "Product 1 name_am unchanged" },
      { cond: p1After.description_en === p1Before.description_en, msg: "Product 1 description_en unchanged" },
      { cond: p1After.description_am === p1Before.description_am, msg: "Product 1 description_am unchanged" },
      { cond: p1After.image_url === p1Before.image_url, msg: "Product 1 image_url unchanged" },
      { cond: p1After.is_available === p1Before.is_available, msg: "Product 1 is_available unchanged" },
      { cond: p2After.name_en === p2Before.name_en, msg: "Product 2 name_en unchanged" },
      { cond: p2After.name_am === p2Before.name_am, msg: "Product 2 name_am unchanged" },
      { cond: p2After.description_en === p2Before.description_en, msg: "Product 2 description_en unchanged" },
      { cond: p2After.description_am === p2Before.description_am, msg: "Product 2 description_am unchanged" },
      { cond: p2After.image_url === p2Before.image_url, msg: "Product 2 image_url unchanged" },
      { cond: p2After.is_available === p2Before.is_available, msg: "Product 2 is_available unchanged" }
    ];

    console.log('\nDatabase integrity assertions:');
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

    // 4. Test public API: GET /api/products
    console.log('\n[Step 4] Verifying public endpoint GET /api/products...');
    const BASE_URL = 'http://localhost:5000';
    let apiRes;
    try {
      apiRes = await fetch(`${BASE_URL}/api/products`);
    } catch (err) {
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

    const apiProducts = apiData.data;
    console.log(`Total available products returned: ${apiProducts.length}`);

    const p1InApi = apiProducts.find(p => p.name_en === product1Name);
    const p2InApi = apiProducts.find(p => p.name_en === product2Name);
    const honeyInApi = apiProducts.find(p => p.name_en === 'Original Yemeni Honey');
    const powerbankInApi = apiProducts.find(p => p.name_en === 'F-max TD-301 30,000mAh Power Bank');

    console.log('\nAPI Product list verification:');
    console.log(` - ${product1Name}: ${p1InApi ? p1InApi.price : 'NOT FOUND'} ETB`);
    console.log(` - ${product2Name}: ${p2InApi ? p2InApi.price : 'NOT FOUND'} ETB`);
    console.log(` - Original Yemeni Honey: ${honeyInApi ? honeyInApi.price : 'NOT FOUND'} ETB`);
    console.log(` - F-max TD-301 30,000mAh Power Bank: ${powerbankInApi ? powerbankInApi.price : 'NOT FOUND'} ETB`);

    const apiAsserts = [
      { cond: p1InApi && p1InApi.price === 2600, msg: "API returns Cramp Relief at 2600 ETB" },
      { cond: p2InApi && p2InApi.price === 1300, msg: "API returns iPhone Cable at 1300 ETB" },
      { cond: honeyInApi && honeyInApi.price === 3000, msg: "API returns Yemeni Honey at 3000 ETB (unchanged)" },
      { cond: powerbankInApi && powerbankInApi.price === 4500, msg: "API returns Power Bank at 4500 ETB (unchanged)" },
      { cond: apiProducts.length === 4, msg: "Total active product count remains exactly 4" }
    ];

    apiAsserts.forEach(a => {
      if (a.cond) {
        console.log(` [PASS] ${a.msg}`);
      } else {
        console.error(` [FAIL] ${a.msg}`);
        allPassed = false;
      }
    });

    if (!allPassed) {
      throw new Error('API verification failed');
    }

    console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');

  } catch (err) {
    console.error('[Error during price update]', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
