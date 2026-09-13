/**
 * Rate Limiting Middleware for Abdi Online Shop
 *
 * Provides targeted protection:
 * 1. Strict limiting on admin login attempts to prevent brute-force attacks.
 * 2. Reasonable limiting on public APIs to prevent scraping and abuse.
 * 3. Submission rate limiting on order creation and payment proof uploads.
 *
 * Automatically disabled during automated unit/integration tests (NODE_ENV === 'test')
 * unless explicitly requested via 'x-test-rate-limit' header.
 */

const { rateLimit } = require('express-rate-limit');

/**
 * Helper to skip rate limiting during test executions unless explicitly testing rate limits.
 */
function shouldSkip(req) {
  if (process.env.NODE_ENV === 'test') {
    return !req.headers['x-test-rate-limit'];
  }
  return false;
}

/**
 * Resolves client key: uses x-test-client-id if provided (for isolated security tests),
 * otherwise falls back to standard client IP.
 */
function resolveClientKey(req) {
  return req.headers['x-test-client-id'] || req.ip;
}

/**
 * 1. Strict limit on Admin Login attempts (10 failed requests per 15 minutes).
 * Skips successful logins so legitimate administrators are not locked out.
 */
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // max 10 attempts per client key
  skipSuccessfulRequests: true, // Only failed attempts count toward brute-force threshold
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: shouldSkip,
  keyGenerator: resolveClientKey,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
    });
  }
});

/**
 * 2. Reasonable limit on general public APIs (300 requests per 15 minutes).
 * Generous enough for normal customer browsing without degrading user experience.
 */
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: shouldSkip,
  keyGenerator: resolveClientKey,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.'
    });
  }
});

/**
 * 3. Checkout and Payment Submission Limiter (30 requests per 15 minutes).
 * Prevents automated order creation / upload spam.
 */
const orderSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: shouldSkip,
  keyGenerator: resolveClientKey,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many submissions. Please wait a few minutes before trying again.'
    });
  }
});

module.exports = {
  adminLoginLimiter,
  publicApiLimiter,
  orderSubmissionLimiter
};
