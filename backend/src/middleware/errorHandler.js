/**
 * Centralized error handling and 404 middleware for Abdi backend
 */

/**
 * 404 Not Found handler for undefined routes.
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
}

/**
 * Global error handler.
 * Logs internal error details on the server while returning clean, safe JSON to clients.
 */
function globalErrorHandler(err, req, res, next) {
  console.error('[Server Error]', {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Handle request body exceeding size limit
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      message: 'Payload too large. Request body exceeds allowed size limit.'
    });
  }

  // Handle CORS rejection
  if (err.code === 'CORS_ERROR' || (err.message && err.message.includes('CORS policy'))) {
    return res.status(403).json({
      success: false,
      message: 'Cross-Origin Request Blocked: Origin not permitted by CORS policy.'
    });
  }

  // Handle malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload in request body'
    });
  }

  // Handle PostgreSQL foreign key or unique violations gracefully if any bubble up
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Conflict: A record with this unique value already exists'
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced resource does not exist or cannot be modified.'
    });
  }

  if (err.code === '23502') {
    return res.status(400).json({
      success: false,
      message: 'A required field is missing.'
    });
  }

  if (err.code === '22P02') {
    return res.status(400).json({
      success: false,
      message: 'Invalid input syntax for data type'
    });
  }

  // Respect explicitly set client-facing 4xx errors
  if (err.status && typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({
      success: false,
      message: err.message || 'Request failed'
    });
  }

  // Default internal server error (never leak raw secrets, SQL queries, or stack traces to client)
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
