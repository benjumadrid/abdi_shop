const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('[Error] DATABASE_URL is not defined in backend/.env');
  process.exit(1);
}

const cleanConnectionString = process.env.DATABASE_URL
  .replace(/([?&])sslmode=require(&|$)/, (match, p1, p2) => (p2 === '&' ? p1 : ''))
  .replace(/\?$/, '');

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting schema execution...');

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('[Migration] Schema execution completed successfully.');

    // 1. Verify tables
    const expectedTables = ['admins', 'products', 'customers', 'orders', 'order_items', 'payments', 'admin_settings'];
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
      ORDER BY table_name;
    `, [expectedTables]);

    const createdTables = tablesResult.rows.map(r => r.table_name);
    console.log('\n--- VERIFICATION: TABLES ---');
    expectedTables.forEach(table => {
      const exists = createdTables.includes(table);
      console.log(`Table "${table}": ${exists ? 'EXISTS' : 'MISSING'}`);
    });

    // 2. Verify foreign keys
    console.log('\n--- VERIFICATION: FOREIGN KEYS ---');
    const fkResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);

    fkResult.rows.forEach(fk => {
      console.log(`${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (ON DELETE ${fk.delete_rule})`);
    });

    // 3. Verify CHECK constraints
    console.log('\n--- VERIFICATION: CHECK CONSTRAINTS ---');
    const checkResult = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'CHECK'
        AND tc.table_name = ANY($1::text[])
      ORDER BY tc.table_name;
    `, [expectedTables]);

    checkResult.rows.forEach(c => {
      console.log(`[${c.table_name}] ${c.constraint_name}: ${c.check_clause}`);
    });

    // 4. Verify Indexes
    console.log('\n--- VERIFICATION: INDEXES ---');
    const expectedIndexes = [
      'idx_orders_customer_id',
      'idx_orders_status',
      'idx_orders_created_at',
      'idx_order_items_order_id',
      'idx_order_items_product_id',
      'idx_payments_order_id',
      'idx_payments_status',
      'idx_products_is_available'
    ];
    const indexResult = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
      ORDER BY tablename, indexname;
    `, [expectedIndexes]);

    const foundIndexes = indexResult.rows.map(r => r.indexname);
    expectedIndexes.forEach(idx => {
      const exists = foundIndexes.includes(idx);
      console.log(`Index "${idx}": ${exists ? 'EXISTS' : 'MISSING'}`);
    });

    // 5. Verify Triggers
    console.log('\n--- VERIFICATION: TRIGGERS ---');
    const triggersResult = await client.query(`
      SELECT event_object_table, trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table;
    `);
    triggersResult.rows.forEach(tr => {
      console.log(`Trigger on ${tr.event_object_table}: ${tr.trigger_name}`);
    });

    // 6. Verify Seeded Products
    console.log('\n--- VERIFICATION: SEEDED PRODUCTS ---');
    const productsResult = await client.query(`
      SELECT id, name_en, name_am, price, is_available, created_at
      FROM products
      ORDER BY price DESC;
    `);

    console.log(`Total products found: ${productsResult.rowCount}`);
    productsResult.rows.forEach(p => {
      console.log(`- ${p.name_en} (${p.name_am}) | Price: ${p.price} ETB | Available: ${p.is_available} | ID: ${p.id}`);
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
