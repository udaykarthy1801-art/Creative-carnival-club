const { randomBytes } = require('node:crypto');
const pool = require('../config/db');
const { validateRegistration, registrationView, registrationIdValid } = require('../lib/validation');
const { createToken, hashToken } = require('../lib/security');

exports.create = async (req, res, next) => {
  const { data, errors } = validateRegistration(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const lookupToken = createToken();
    const [result] = await connection.execute(
      'INSERT INTO registrations (registration_id,full_name,mobile,email,visitor_type,college_organization,purpose,reference,message,lookup_token_hash) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [`PENDING-${randomBytes(8).toString('hex')}`, data.fullName, data.mobile, data.email, data.visitorType, data.college, data.purpose, data.reference, data.message, hashToken(lookupToken)]
    );
    const registrationId = `CCMD-2026-${String(result.insertId).padStart(6,'0')}`;
    await connection.execute('UPDATE registrations SET registration_id = ? WHERE id = ?', [registrationId, result.insertId]);
    const [rows] = await connection.execute('SELECT * FROM registrations WHERE id = ?', [result.insertId]);
    await connection.commit(); // Never acknowledge success before the database commits.
    console.info(JSON.stringify({ event: 'registration_created', registrationId }));
    res.status(201).json({ success: true, message: 'Registration successful', registrationId, lookupToken, visitor: registrationView(rows[0]) });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch { /* Original error is handled below. */ } }
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A registration already exists for this visitor.' });
    next(error);
  } finally { connection?.release(); }
};

exports.lookup = async (req, res) => {
  if (!registrationIdValid(req.params.registrationId)) return res.status(400).json({ success: false, message: 'Invalid registration ID.' });
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ success: false, message: 'A private lookup token is required.' });
  const [rows] = await pool.execute('SELECT * FROM registrations WHERE registration_id = ? AND lookup_token_hash = ?', [req.params.registrationId, hashToken(token)]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Registration not found' });
  res.json({ success: true, registration: registrationView(rows[0]) });
};
