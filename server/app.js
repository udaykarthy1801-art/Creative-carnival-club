const config = require('./config/env');
const pool = require('./config/db');
const createApp = require('./createApp');

async function start() {
  await pool.query('SELECT 1');
  await pool.query('SELECT id, lookup_token_hash FROM registrations LIMIT 0');
  await pool.query('SELECT token_hash FROM admin_sessions LIMIT 0');
  console.info('MySQL connected; registration schema verified.');
  if (!config.adminHash) console.warn('Admin login disabled until ADMIN_PASSWORD_HASH is configured.');
  const server = createApp().listen(config.port, config.host, () => console.info(`Creative Carnival running at http://${config.host}:${config.port}`));
  server.requestTimeout = 20000;
  server.headersTimeout = 25000;
  server.on('error', async error => {
    console.error(`Server could not start (${error.code || 'UNKNOWN'}). Check HOST and PORT.`);
    await pool.end(); process.exitCode = 1;
  });
  let shuttingDown = false;
  async function stop() {
    if (shuttingDown) return; shuttingDown = true;
    console.info('Shutting down registration server.');
    const timer = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => { await pool.end(); clearTimeout(timer); process.exitCode = 0; });
  }
  process.on('SIGTERM',stop); process.on('SIGINT',stop);
  return server;
}
if (require.main === module) start().catch(async error => {
  console.error(`Database startup failed (${error.code || 'UNKNOWN'}). Check MySQL, .env, and run npm run db:setup. No registration server was started.`);
  await pool.end(); process.exitCode = 1;
});
module.exports = { start };
