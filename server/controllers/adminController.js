const pool = require('../config/db');
const config = require('../config/env');
const { verifyPassword, hashToken, createToken } = require('../lib/security');
const { cookieName, cookieOptions, sessionToken } = require('../middleware/adminAuth');
const { filters, positiveInteger, csvCell } = require('../lib/adminQuery');
const { registrationView } = require('../lib/validation');

exports.login = async (req, res) => {
  if (!config.adminHash) return res.status(503).json({ success: false, message: 'Administrator access has not been configured.' });
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 256) return res.status(400).json({ success: false, message: 'Enter a valid username and password.' });
  const valid = await verifyPassword(password, config.adminHash);
  if (!valid || username !== config.adminUsername) return res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
  const token = createToken(), csrfToken = hashToken(`csrf:${token}`);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM admin_sessions WHERE expires_at <= UTC_TIMESTAMP(3)');
    const previous = sessionToken(req);
    if (previous) await connection.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [hashToken(previous)]);
    await connection.execute('INSERT INTO admin_sessions (token_hash,csrf_hash,expires_at) VALUES (?,?,?)', [hashToken(token), hashToken(csrfToken), new Date(Date.now() + config.sessionHours * 3600000)]);
    await connection.commit();
  } catch (error) { try { await connection.rollback(); } catch {} throw error; }
  finally { connection.release(); }
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: config.sessionHours * 3600000 });
  console.info(JSON.stringify({ event: 'admin_signed_in' }));
  res.json({ success: true, csrfToken });
};
exports.session = (req, res) => res.json({ success: true, csrfToken: req.csrfToken });
exports.logout = async (req, res) => {
  await pool.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [req.adminSession.token_hash]);
  res.clearCookie(cookieName, cookieOptions);
  res.json({ success: true });
};
exports.list = async (req, res) => {
  const { where, values, order } = filters(req.query);
  const page = positiveInteger(req.query.page, 1, 100000), limit = positiveInteger(req.query.limit, 25, 100);
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM registrations${where}`, values);
  const [rows] = await pool.query(`SELECT * FROM registrations${where} ORDER BY created_at ${order}, id ${order} LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
  res.json({ success: true, registrations: rows.map(row => ({ id: row.id, ...registrationView(row) })), page, limit, total });
};
exports.detail = async (req, res) => {
  const id = positiveInteger(req.params.id, 1, 4294967295);
  const [rows] = await pool.execute('SELECT * FROM registrations WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Registration not found' });
  res.json({ success: true, registration: { id: rows[0].id, ...registrationView(rows[0]) } });
};
exports.remove = async (req, res) => {
  const id = positiveInteger(req.params.id, 1, 4294967295);
  const [result] = await pool.execute('DELETE FROM registrations WHERE id = ?', [id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Registration not found' });
  console.info(JSON.stringify({ event: 'registration_deleted', internalId: id }));
  res.json({ success: true, message: 'Registration deleted.' });
};
exports.csv = async (req, res) => {
  const { where, values, order } = filters(req.query);
  const [rows] = await pool.execute(`SELECT * FROM registrations${where} ORDER BY created_at ${order}, id ${order} LIMIT 10001`, values);
  if (rows.length > 10000) return res.status(413).json({ success: false, message: 'Export is limited to 10,000 registrations. Narrow your search or filters.' });
  const fields = ['registrationId','name','mobile','email','visitorType','college','purpose','reference','message','createdAt'];
  const lines = [fields.map(csvCell).join(',')];
  for (const row of rows) {
    const view = registrationView(row);
    lines.push(fields.map(field => csvCell(view[field] instanceof Date ? view[field].toISOString() : view[field])).join(','));
  }
  res.set('Content-Type','text/csv; charset=utf-8');
  res.set('Content-Disposition','attachment; filename="creative-carnival-registrations.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
};
