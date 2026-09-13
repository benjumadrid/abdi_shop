const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runProductMediaMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Creating product_media table in Neon PostgreSQL...');
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
        mime_type VARCHAR(100) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_size INTEGER NOT NULL,
        file_data BYTEA NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON product_media(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_media_sort_order ON product_media(product_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_product_media_is_primary ON product_media(product_id, is_primary);
    `);

    await client.query('COMMIT');
    console.log('[Migration] Successfully created product_media table.');

    // Verification
    const checkTable = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_media'
      ORDER BY ordinal_position;
    `);

    console.log('\n--- VERIFICATION: PRODUCT_MEDIA COLUMNS ---');
    checkTable.rows.forEach(col => {
      console.log(`Column: ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
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

runProductMediaMigration();
