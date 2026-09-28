const { timingSafeEqual } = require('node:crypto');
const pool = require('../config/db');
const { hashToken } = require('../lib/security');
const config = require('../config/env');
const cookieName = config.cookieSecure ? '__Host-cc_admin' : 'cc_admin';
const cookieOptions = { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' };
function sessionToken(req) {
  const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`));
  const token = raw?.slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token || '') ? token : null;
}
async function requireAdmin(req, res, next) {
  const token = sessionToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Administrator sign-in required.' });
  const [sessions] = await pool.execute('SELECT token_hash, csrf_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP(3)', [hashToken(token)]);
  if (!sessions.length) return res.status(401).json({ success: false, message: 'Your administrator session has expired. Sign in again.' });
  req.adminSession = sessions[0];
  req.csrfToken = hashToken(`csrf:${token}`);
  next();
}
function requireCsrf(req, res, next) {
  const supplied = req.get('X-CSRF-Token') || '';
  if (!timingSafeEqual(Buffer.from(hashToken(supplied),'hex'), Buffer.from(req.adminSession.csrf_hash,'hex'))) return res.status(403).json({ success: false, message: 'Invalid security token. Refresh and sign in again.' });
  next();
}
module.exports = { requireAdmin, requireCsrf, sessionToken, cookieName, cookieOptions };
