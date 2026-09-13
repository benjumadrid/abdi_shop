/**
 * CORS Configuration for Abdi Online Shop Backend
 *
 * Replaces unrestricted wildcard (*) with production-safe origin validation.
 * Reads allowed origins from FRONTEND_URL and ALLOWED_ORIGINS environment variables.
 * Automatically supports local development ports (3000, 5173) in non-production environments.
 */

function getAllowedOrigins() {
  const origins = new Set();

  // 1. Load origins from environment variables
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()) {
    origins.add(process.env.FRONTEND_URL.trim().replace(/\/+$/, ''));
  }

  // Render automatically sets RENDER_EXTERNAL_URL (e.g. https://abdi-shop.onrender.com)
  if (process.env.RENDER_EXTERNAL_URL && process.env.RENDER_EXTERNAL_URL.trim()) {
    origins.add(process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, ''));
  }

  if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim()) {
    process.env.ALLOWED_ORIGINS.split(',')
      .map(o => o.trim().replace(/\/+$/, ''))
      .filter(Boolean)
      .forEach(o => origins.add(o));
  }

  // 2. Default local development origins
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];

  // In non-production or if no origins explicitly configured, allow dev origins
  if (process.env.NODE_ENV !== 'production' || origins.size === 0) {
    devOrigins.forEach(o => origins.add(o));
  }

  return Array.from(origins);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Requests without origin (e.g. server-to-server, mobile native apps, curl, automated test suites)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/+$/, '');
    const allowed = getAllowedOrigins();

    if (allowed.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Always allow Render deployed domains (*.onrender.com)
    if (/^https:\/\/([a-zA-Z0-9_-]+\.)?onrender\.com$/.test(normalizedOrigin)) {
      return callback(null, true);
    }

    // In non-production environments, be flexible for local development ports
    if (process.env.NODE_ENV !== 'production') {
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin);
      if (isLocalhost) {
        return callback(null, true);
      }
    }

    // Origin not allowed
    const corsError = new Error(`CORS policy does not allow access from origin: ${origin}`);
    corsError.status = 403;
    corsError.code = 'CORS_ERROR';
    return callback(corsError);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 204
};

module.exports = {
  corsOptions,
  getAllowedOrigins
};
