const jwt = require('jsonwebtoken');

/**
 * Customer Maintenance Mode Middleware
 *
 * PURPOSE:
 * When MAINTENANCE_MODE is active ('true'):
 * 1. The Admin Portal and all Admin APIs (/api/admin/*) remain 100% operational.
 * 2. Authenticated requests with a valid Admin token are never blocked.
 * 3. Health check and maintenance status endpoints remain accessible.
 * 4. Customer-facing endpoints (orders, payments, uploads) return HTTP 503
 *    with a polite bilingual notification.
 *
 * When MAINTENANCE_MODE is disabled (default 'false' or omitted):
 * - Passes through immediately with zero overhead.
 */
function checkCustomerMaintenance(req, res, next) {
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true';
  if (!isMaintenance) {
    return next();
  }

  // 1. Always allow Admin Portal API routes (/api/admin/*)
  const originalUrl = (req.originalUrl || req.url || '').split('?')[0];
  const baseUrl = req.baseUrl || '';

  if (
    originalUrl.startsWith('/api/admin') ||
    baseUrl.startsWith('/api/admin')
  ) {
    return next();
  }

  // 2. Always allow system/health/maintenance status endpoints
  if (
    originalUrl === '/api/maintenance' ||
    originalUrl === '/api/health' ||
    originalUrl === '/'
  ) {
    return next();
  }

  // 3. Allow requests with a valid admin Bearer token across any endpoint
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          return next();
        }
      } catch {
        // Invalid or expired token: fall through to maintenance restriction
      }
    }
  }

  // 4. Safely reject customer actions with a polite bilingual 503 response
  return res.status(503).json({
    success: false,
    maintenance: true,
    message: 'The store is currently undergoing scheduled maintenance. Please try again shortly.',
    message_am: 'የመደብር ስርዓቱ በአሁኑ ጊዜ በጊዜያዊ ማሻሻያ ላይ ይገኛል። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።',
    support: {
      phone: '+251 931 862 253',
      location: 'Dessie, Ethiopia'
    }
  });
}

module.exports = { checkCustomerMaintenance };
