const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db/db');
const { corsOptions } = require('./config/cors');
const { publicApiLimiter } = require('./middleware/rateLimiter');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const adminOrderRoutes = require('./routes/admin.order.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminPaymentRoutes = require('./routes/admin.payment.routes');
const adminAnalyticsRoutes = require('./routes/admin.analytics.routes');
const authRoutes = require('./routes/auth.routes');
const paymentController = require('./controllers/payment.controller');
const { checkCustomerMaintenance } = require('./middleware/maintenance');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy if running behind reverse proxy (e.g., Nginx, Vercel, Railway)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 1. Security Headers (Helmet)
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows cross-origin rendering of product media & proof images
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// 2. Production-safe CORS
app.use(cors(corsOptions));

// 3. Request Body Size Limits (Prevents payload exhaustion DOS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Rate Limiting for Public APIs
app.use('/api', publicApiLimiter);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Abdi Online Order System API',
    maintenance: process.env.MAINTENANCE_MODE === 'true',
    endpoints: {
      health: '/api/health',
      maintenance: '/api/maintenance',
      products: '/api/products',
      orders: '/api/orders',
      admin_orders: '/api/admin/orders',
      payment_methods: '/api/payment-methods',
      payments: '/api/payments',
      payment_proof_upload: '/api/payments/upload-proof',
      admin_payments: '/api/admin/payments',
      admin_auth: '/api/admin/auth'
    }
  });
});

// Health check endpoint (shields internal database errors in production)
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.checkDatabaseConnection();
  const isProd = process.env.NODE_ENV === 'production';

  res.status(dbStatus.connected ? 200 : 503).json({
    status: dbStatus.connected ? 'ok' : 'degraded',
    server: 'running',
    service: 'Abdi Backend',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus.connected,
      message: dbStatus.message,
      ...(dbStatus.timestamp && { db_timestamp: dbStatus.timestamp }),
      ...(!isProd && dbStatus.error && { error: dbStatus.error })
    }
  });
});

// Maintenance status endpoint
app.get('/api/maintenance', (req, res) => {
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true';
  res.status(200).json({
    success: true,
    maintenance: isMaintenance,
    message: isMaintenance
      ? 'Scheduled maintenance is currently in progress.'
      : 'Store is operational.'
  });
});

// API Routes
app.get('/api/payment-methods', paymentController.getPaymentMethods);
app.use('/api/products', productRoutes);
app.use('/api/orders', checkCustomerMaintenance, orderRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/payments', checkCustomerMaintenance, paymentRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/auth', authRoutes);

// Production Static File Serving (Full-stack single service deployment)
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Start server
let server = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, async () => {
    console.log(`[Server] Abdi backend running on port ${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[Server] Products API: http://localhost:${PORT}/api/products`);

    const dbStatus = await db.checkDatabaseConnection();
    if (dbStatus.connected) {
      console.log('[Database] Connected to Neon PostgreSQL successfully.');
    } else {
      console.warn(`[Database] Notice: ${dbStatus.message}`);
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_jwt_secret_key_change_in_production_min_32_chars') {
      console.warn('[Security Warning] JWT_SECRET is using a default or empty value. Set a strong secret in production.');
    }
  });
}

// Graceful shutdown handling
const shutdown = async () => {
  console.log('[Server] Shutting down gracefully...');
  if (server) {
    server.close(async () => {
      if (db.pool) {
        await db.pool.end();
        console.log('[Database] Pool closed.');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { app, server };
