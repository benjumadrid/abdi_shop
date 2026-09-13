/**
 * One-Time Test Data Cleanup Script for Production Database
 *
 * PURPOSE:
 * Safely removes ONLY intentionally created development and test records
 * (test orders, items, payments, proof files, and test-only customers)
 * from the PostgreSQL database before final production launch.
 *
 * SAFETY GUARANTEES:
 * 1. Does NOT run automatically. Requires explicit execution with `--confirm`.
 * 2. By default runs in SAFE DRY-RUN mode (shows what would be deleted without making changes).
 * 3. Uses a PostgreSQL TRANSACTION: BEGIN -> cleanup -> verify -> COMMIT (or ROLLBACK on error).
 * 4. Strictly protects:
 *    - products & product_media (aborts and rolls back if any product is affected)
 *    - admins & admin_settings (aborts and rolls back if touched)
 *    - real customer records (customers with any non-test orders are NEVER deleted)
 * 5. Respects database foreign key order:
 *    payment_proof_files -> payments -> order_items -> orders -> test-only customers
 *
 * USAGE:
 *   Dry-Run (Inspect what will be deleted, no database changes):
 *     node backend/database/cleanup-test-data.js
 *
 *   Execute Cleanup (Explicit confirmation required):
 *     node backend/database/cleanup-test-data.js --confirm
 *
 *   Target specific order numbers (optional override):
 *     node backend/database/cleanup-test-data.js --confirm ORD-20260912-0152 ORD-20260911-0151
 */

const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// Explicit list of known test order numbers created during development/testing
const DEFAULT_TEST_ORDER_NUMBERS = [
  'ORD-20260912-0152',
  'ORD-20260911-0151',
  'ORD-20260911-0150',
  'ORD-20260908-0148'
];

async function runCleanup() {
  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirm');
  
  // Collect custom order numbers if passed, otherwise use DEFAULT_TEST_ORDER_NUMBERS
  const customOrderArgs = args.filter(a => a.startsWith('ORD-'));
  const targetOrderNumbers = customOrderArgs.length > 0 ? customOrderArgs : DEFAULT_TEST_ORDER_NUMBERS;

  console.log('===============================================================');
  console.log('🧹 ABDI ONLINE SHOPPING - TEST DATA CLEANUP SCRIPT');
  console.log('===============================================================');
  console.log(`Execution Mode: ${isConfirmed ? '🔴 LIVE EXECUTION (--confirm)' : '🟡 DRY RUN (No changes will be saved)'}`);
  console.log(`Target Test Orders: ${targetOrderNumbers.join(', ')}\n`);

  if (!process.env.DATABASE_URL) {
    console.error('❌ [FATAL] DATABASE_URL environment variable is not defined.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // 1. Check critical tables before starting (Baseline Counts)
    const productCountBefore = parseInt((await client.query('SELECT COUNT(*) FROM products;')).rows[0].count, 10);
    const mediaCountBefore = parseInt((await client.query('SELECT COUNT(*) FROM product_media;')).rows[0].count, 10);
    const adminCountBefore = parseInt((await client.query('SELECT COUNT(*) FROM admins;')).rows[0].count, 10);
    const settingsCountBefore = parseInt((await client.query('SELECT COUNT(*) FROM admin_settings;')).rows[0].count, 10);

    console.log('🔒 [Safety Baseline Verified]');
    console.log(`   Products: ${productCountBefore}, Media: ${mediaCountBefore}, Admins: ${adminCountBefore}, Settings: ${settingsCountBefore}\n`);

    // 2. Identify candidate orders
    const findOrdersRes = await client.query(
      `SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_id, c.name as customer_name, c.phone as customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.order_number = ANY($1::text[]);`,
      [targetOrderNumbers]
    );

    const ordersToDelete = findOrdersRes.rows;
    if (ordersToDelete.length === 0) {
      console.log('ℹ️  No matching test orders found in the database. Nothing to clean up.');
      client.release();
      await pool.end();
      return;
    }

    console.log(`📋 Found ${ordersToDelete.length} matching test order(s) for cleanup:`);
    ordersToDelete.forEach((o, i) => {
      console.log(`   ${i + 1}. [${o.order_number}] Status: ${o.status} | Total: ${o.total_amount} ETB | Customer: ${o.customer_name} (${o.customer_phone})`);
    });
    console.log('');

    const orderIds = ordersToDelete.map(o => o.id);
    const candidateCustomerIds = Array.from(new Set(ordersToDelete.map(o => o.customer_id).filter(Boolean)));

    // Begin PostgreSQL Transaction
    await client.query('BEGIN');

    // 3. Count/Delete payment_proof_files
    const proofFilesRes = await client.query(
      `SELECT id, order_id, filename, file_size FROM payment_proof_files WHERE order_id = ANY($1::uuid[]);`,
      [orderIds]
    );
    console.log(`🔎 Found ${proofFilesRes.rows.length} payment proof file(s) attached to test orders.`);

    // 4. Count/Delete payments
    const paymentsRes = await client.query(
      `SELECT id, order_id, method, amount, status FROM payments WHERE order_id = ANY($1::uuid[]);`,
      [orderIds]
    );
    console.log(`🔎 Found ${paymentsRes.rows.length} payment record(s) attached to test orders.`);

    // 5. Count/Delete order_items
    const itemsRes = await client.query(
      `SELECT id, order_id, product_id, quantity, subtotal FROM order_items WHERE order_id = ANY($1::uuid[]);`,
      [orderIds]
    );
    console.log(`🔎 Found ${itemsRes.rows.length} order item(s) attached to test orders.`);

    // 6. Identify test-only customers (customers that have NO OTHER legitimate orders)
    const testOnlyCustomersRes = await client.query(
      `SELECT c.id, c.name, c.phone
       FROM customers c
       WHERE c.id = ANY($1::uuid[])
         AND NOT EXISTS (
           SELECT 1 FROM orders o
           WHERE o.customer_id = c.id
             AND NOT (o.id = ANY($2::uuid[]))
         );`,
      [candidateCustomerIds, orderIds]
    );
    console.log(`🔎 Found ${testOnlyCustomersRes.rows.length} test-only customer(s) with no other orders.`);

    // Execute deletions in order inside transaction
    // Step A: Payment proof files
    const deletedProof = await client.query(
      `DELETE FROM payment_proof_files WHERE order_id = ANY($1::uuid[]) RETURNING id;`,
      [orderIds]
    );

    // Step B: Payments
    const deletedPayments = await client.query(
      `DELETE FROM payments WHERE order_id = ANY($1::uuid[]) RETURNING id;`,
      [orderIds]
    );

    // Step C: Order Items
    const deletedItems = await client.query(
      `DELETE FROM order_items WHERE order_id = ANY($1::uuid[]) RETURNING id;`,
      [orderIds]
    );

    // Step D: Orders
    const deletedOrders = await client.query(
      `DELETE FROM orders WHERE id = ANY($1::uuid[]) RETURNING id, order_number;`,
      [orderIds]
    );

    // Step E: Test-only customers (if safe)
    let deletedCustomersCount = 0;
    if (testOnlyCustomersRes.rows.length > 0) {
      const testCustomerIds = testOnlyCustomersRes.rows.map(c => c.id);
      const deletedCustomers = await client.query(
        `DELETE FROM customers WHERE id = ANY($1::uuid[]) RETURNING id;`,
        [testCustomerIds]
      );
      deletedCustomersCount = deletedCustomers.rows.length;
    }

    // 7. Safety Verification Checks (Ensure zero collateral damage)
    const productCountAfter = parseInt((await client.query('SELECT COUNT(*) FROM products;')).rows[0].count, 10);
    const mediaCountAfter = parseInt((await client.query('SELECT COUNT(*) FROM product_media;')).rows[0].count, 10);
    const adminCountAfter = parseInt((await client.query('SELECT COUNT(*) FROM admins;')).rows[0].count, 10);
    const settingsCountAfter = parseInt((await client.query('SELECT COUNT(*) FROM admin_settings;')).rows[0].count, 10);

    if (productCountBefore !== productCountAfter) {
      throw new Error(`CRITICAL SAFETY CHECK FAILED: Product count changed (${productCountBefore} -> ${productCountAfter}). Aborting!`);
    }
    if (mediaCountBefore !== mediaCountAfter) {
      throw new Error(`CRITICAL SAFETY CHECK FAILED: Media count changed (${mediaCountBefore} -> ${mediaCountAfter}). Aborting!`);
    }
    if (adminCountBefore !== adminCountAfter) {
      throw new Error(`CRITICAL SAFETY CHECK FAILED: Admin count changed (${adminCountBefore} -> ${adminCountAfter}). Aborting!`);
    }
    if (settingsCountBefore !== settingsCountAfter) {
      throw new Error(`CRITICAL SAFETY CHECK FAILED: Settings count changed (${settingsCountBefore} -> ${settingsCountAfter}). Aborting!`);
    }

    console.log('\n✅ [Integrity Checks Passed]');
    console.log(`   - Payment proofs removed: ${deletedProof.rows.length}`);
    console.log(`   - Payments removed: ${deletedPayments.rows.length}`);
    console.log(`   - Order items removed: ${deletedItems.rows.length}`);
    console.log(`   - Orders removed: ${deletedOrders.rows.length}`);
    console.log(`   - Test-only customers removed: ${deletedCustomersCount}`);
    console.log(`   - Products protected: 100% (${productCountAfter}/${productCountBefore} intact)`);
    console.log(`   - Admins protected: 100% (${adminCountAfter}/${adminCountBefore} intact)`);

    if (isConfirmed) {
      await client.query('COMMIT');
      console.log('\n🎉 [SUCCESS] Transaction committed. Test data has been safely and permanently cleaned.');
    } else {
      await client.query('ROLLBACK');
      console.log('\n🛡️  [DRY RUN COMPLETE] Transaction rolled back. NO database changes were committed.');
      console.log('   To permanently delete these test records, run explicitly with:');
      console.log('   node backend/database/cleanup-test-data.js --confirm\n');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ [ERROR] An error occurred during cleanup. Transaction rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Only run if called directly from CLI (never automatically on require or module load)
if (require.main === module) {
  runCleanup();
}

module.exports = { runCleanup, DEFAULT_TEST_ORDER_NUMBERS };
