const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { db } = require('../server/config/env');
(async () => {
  if (db.database !== 'creative_carnival') throw new Error('schema.sql creates creative_carnival. Use DB_NAME=creative_carnival for setup.');
  const connection = await mysql.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, multipleStatements: true, ...(db.sslCa ? { ssl: { ca: fs.readFileSync(db.sslCa), rejectUnauthorized: true } } : {}) });
  try {
    // Only trusted, bundled schema SQL is executed in this one-time setup script.
    await connection.query(fs.readFileSync(path.resolve(__dirname,'../database/schema.sql'),'utf8'));
    console.log('creative_carnival database and tables are ready.');
  } finally { await connection.end(); }
})().catch(error => { console.error(`Database setup failed (${error.code || 'CONFIGURATION'}). Check .env and MySQL permissions.`); process.exitCode = 1; });
