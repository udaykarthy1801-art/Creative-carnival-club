const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const pool = require('./config/db');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"], styleSrc: ["'self'"], imgSrc: ["'self'",'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'none'"], formAction: ["'self'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } },
    strictTransportSecurity: config.production ? undefined : false,
    referrerPolicy: { policy: 'no-referrer' }
  }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control','no-store');
    if (req.headers.origin && !config.allowedOrigins.includes(req.headers.origin)) return res.status(403).json({ success: false, message: 'This request origin is not allowed.' });
    if (req.headers['sec-fetch-site'] === 'cross-site' && !config.allowedOrigins.includes(req.headers.origin)) return res.status(403).json({ success: false, message: 'Cross-site requests are not allowed.' });
    next();
  });
  app.use('/api', cors({ origin: config.allowedOrigins, credentials: true, methods: ['GET','POST','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token'] }));
  app.use('/api', (req, res, next) => {
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ success: false, message: 'Content-Type must be application/json.' });
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ success: true, message: 'Creative Carnival API is running', database: 'connected' });
    } catch {
      res.status(503).json({ success: false, message: 'Registration service is temporarily unavailable.' });
    }
  });
  app.use('/api/registrations', require('./routes/registrationRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));
  app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API endpoint not found.' }));
  app.use(express.static(path.resolve(__dirname,'../public'), { dotfiles: 'deny', index: 'index.html', etag: true, maxAge: 0 }));
  app.use((req, res) => res.status(404).type('text').send('Page not found.'));
  app.use((error, req, res, next) => {
    // Never log request bodies, SQL text, passwords, tokens, or error messages containing visitor data.
    console.error(JSON.stringify({ event: 'request_failed', code: error.code || error.type || 'INTERNAL_ERROR', method: req.method }));
    if (res.headersSent) return next(error);
    const status = error.status === 400 ? 400 : error.status === 413 ? 413 : 503;
    const message = error.type === 'entity.parse.failed' ? 'Invalid JSON request.' : status === 413 ? 'Request is too large.' : status === 400 && !error.type ? error.message : 'Unable to complete registration right now. Please try again.';
    res.status(status).json({ success: false, message });
  });
  return app;
}
module.exports = createApp;
