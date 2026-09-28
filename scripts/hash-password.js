const { hashPassword } = require('../server/lib/security');
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal.');
  process.stdout.write('New admin password (12–256 characters; input hidden): ');
  readline.emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  const password = await new Promise((resolve, reject) => {
    let value = '';
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === 'c') { cleanup(); reject(new Error('Cancelled')); }
      else if (key.name === 'return') { cleanup(); resolve(value); }
      else if (key.name === 'backspace') value = value.slice(0,-1);
      else if (text && !key.ctrl && !key.meta) value += text;
    };
    function cleanup() { process.stdin.off('keypress',onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); }
    process.stdin.on('keypress',onKey);
  });
  if (password.length < 12 || password.length > 256) throw new Error('Use a password of 12–256 characters.');
  const hash = await hashPassword(password);
  if (process.argv.includes('--save')) {
    const envPath = path.resolve(__dirname,'../.env');
    if (!fs.existsSync(envPath)) throw new Error('Copy .env.example to .env first.');
    let contents = fs.readFileSync(envPath,'utf8');
    const line = `ADMIN_PASSWORD_HASH=${hash}`;
    contents = /^ADMIN_PASSWORD_HASH=.*$/m.test(contents) ? contents.replace(/^ADMIN_PASSWORD_HASH=.*$/m, () => line) : `${contents}\n${line}\n`;
    fs.writeFileSync(envPath,contents);
    console.log('Admin password hash saved to .env. Restart the server to use it.');
  } else console.log(`ADMIN_PASSWORD_HASH=${hash}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
