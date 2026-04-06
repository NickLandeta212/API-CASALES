const fs = require('fs');
const path = require('path');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Falta variable requerida para desktop build: ${name}`);
  }
  return value;
}

function optional(name, fallback = '') {
  const value = String(process.env[name] || '').trim();
  return value || fallback;
}

function run() {
  const databaseUrl = required('DESKTOP_DATABASE_URL');
  const jwtSecret = required('DESKTOP_JWT_SECRET');

  const payload = [
    `PORT=${optional('DESKTOP_PORT', '3000')}`,
    `DATABASE_URL=${databaseUrl}`,
    `JWT_SECRET=${jwtSecret}`,
    `CORS_ORIGIN=${optional('DESKTOP_CORS_ORIGIN', '*')}`,
    `PUBLIC_APP_URL=${optional('DESKTOP_PUBLIC_APP_URL')}`,
    'ALLOW_START_WITHOUT_DB=false',
  ].join('\n');

  const target = path.resolve(__dirname, '../../backend/.env.desktop');
  fs.writeFileSync(target, `${payload}\n`, 'utf8');

  console.log(`Configuracion desktop generada en: ${target}`);
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
