const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Ensure environment variables are loaded from backend/.env (or root .env as fallback)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

let pool = null;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
  const isNeon = process.env.DATABASE_URL.includes('neon.tech');
  const hasSslParam = process.env.DATABASE_URL.includes('sslmode=require');

  // Strip sslmode=require from connection string to eliminate pg-connection-string
  // libpq alias deprecation warning while configuring explicit, secure SSL for Neon & production
  const cleanConnectionString = process.env.DATABASE_URL
    .replace(/([?&])sslmode=require(&|$)/, (match, p1, p2) => (p2 === '&' ? p1 : ''))
    .replace(/\?$/, '');

  process.env.DATABASE_URL = cleanConnectionString;

  pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: isNeon || hasSslParam || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined
  });
}

/**
 * Health check helper to test database connectivity.
 */
const checkDatabaseConnection = async () => {
  if (!pool) {
    return {
      connected: false,
      message: 'DATABASE_URL is not configured in backend/.env'
    };
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW() AS current_time');
      return {
        connected: true,
        message: 'Neon PostgreSQL connection successful',
        timestamp: result.rows[0].current_time
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      connected: false,
      message: 'Database connection failed',
      error: error.message
    };
  }
};

/**
 * Executes a parameterized SQL query on the pool.
 */
const query = (text, params) => {
  if (!pool) {
    throw new Error('Database pool is not initialized. Check DATABASE_URL in backend/.env');
  }
  return pool.query(text, params);
};

/**
 * Acquires a client from the pool for transactions.
 */
const getClient = () => {
  if (!pool) {
    throw new Error('Database pool is not initialized. Check DATABASE_URL in backend/.env');
  }
  return pool.connect();
};

module.exports = {
  pool,
  query,
  getClient,
  checkDatabaseConnection
};
