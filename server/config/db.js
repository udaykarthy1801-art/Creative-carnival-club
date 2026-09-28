const mysql = require('mysql2/promise');
const fs = require('node:fs');
const { db } = require('./env');
const options = {
  host: db.host, port: db.port, user: db.user, password: db.password, database: db.database,
  waitForConnections: true, connectionLimit: db.connectionLimit, queueLimit: 100,
  charset: 'utf8mb4', timezone: 'Z', connectTimeout: 10000,
  enableKeepAlive: true, multipleStatements: false,
  ...(db.sslCa ? { ssl: { ca: fs.readFileSync(db.sslCa), rejectUnauthorized: true } } : {})
};
const pool = mysql.createPool(options);
// DATETIME values and session expiry comparisons are stored in UTC.
pool.on('connection', connection => {
  connection.query("SET time_zone = '+00:00'", error => {
    if (error) connection.destroy();
  });
});
module.exports = pool;
