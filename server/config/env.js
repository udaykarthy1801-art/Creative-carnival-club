const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function integer(name, fallback, min, max) {
  const text = process.env[name] ?? String(fallback);
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name} configuration`);
  return value;
}
const production = process.env.NODE_ENV === 'production';
const port = integer('PORT', 5000, 1, 65535);
const cookieSecure = process.env.COOKIE_SECURE === 'true';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || `http://localhost:${port},http://127.0.0.1:${port}`).split(',').map(x => x.trim()).filter(Boolean);
for (const origin of allowedOrigins) {
  const url = new URL(origin);
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('ALLOWED_ORIGINS must contain exact HTTP(S) origins');
}
if (production && (!cookieSecure || allowedOrigins.some(x => !x.startsWith('https://')))) throw new Error('Production requires COOKIE_SECURE=true and HTTPS ALLOWED_ORIGINS');
const adminHash = process.env.ADMIN_PASSWORD_HASH || '';
if (adminHash && !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(adminHash)) throw new Error('Invalid ADMIN_PASSWORD_HASH; run npm run admin:password');
if (production && (!adminHash || !process.env.DB_PASSWORD || process.env.DB_USER === 'root')) throw new Error('Production requires an admin password hash and a non-root, password-protected database account');
module.exports = {
  production, port, cookieSecure, allowedOrigins,
  host: process.env.HOST || '127.0.0.1',
  trustProxy: process.env.TRUST_PROXY || false,
  adminUsername: process.env.ADMIN_USERNAME || 'admin', adminHash,
  sessionHours: integer('SESSION_HOURS', 8, 1, 24),
  registrationLimit: integer('REGISTRATION_RATE_LIMIT', 60, 1, 10000),
  registrationWindow: integer('REGISTRATION_RATE_WINDOW_MINUTES', 15, 1, 1440) * 60000,
  db: {
    host: process.env.DB_HOST || 'localhost', port: integer('DB_PORT', 3306, 1, 65535),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'creative_carnival',
    connectionLimit: integer('DB_CONNECTION_LIMIT', 10, 1, 100),
    sslCa: process.env.DB_SSL_CA || ''
  }
};
