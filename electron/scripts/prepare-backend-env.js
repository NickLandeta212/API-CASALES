const fs = require('fs');
const path = require('path');

function parseDotEnv(content) {
  const result = {};

  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    result[key] = value;
  }

  return result;
}

function required(name, fallbackValues = {}) {
  const value = String(process.env[name] || fallbackValues[name] || '').trim();
  if (!value) {
    throw new Error(`Falta variable requerida para desktop build: ${name}`);
  }
  return value;
}

function optional(name, fallback = '', fallbackValues = {}) {
  const value = String(process.env[name] || fallbackValues[name] || '').trim();
  return value || fallback;
}

function run() {
  const target = path.resolve(__dirname, '../../backend/.env.desktop');
  const existingValues = fs.existsSync(target) ? parseDotEnv(fs.readFileSync(target, 'utf8')) : {};
  const fallbackDesktopValues = {
    DESKTOP_PORT: existingValues.PORT,
    DESKTOP_DATABASE_URL: existingValues.DATABASE_URL,
    DESKTOP_JWT_SECRET: existingValues.JWT_SECRET,
    DESKTOP_CORS_ORIGIN: existingValues.CORS_ORIGIN,
    DESKTOP_PUBLIC_APP_URL: existingValues.PUBLIC_APP_URL,
  };

  const databaseUrl = required('DESKTOP_DATABASE_URL', fallbackDesktopValues);
  const jwtSecret = required('DESKTOP_JWT_SECRET', fallbackDesktopValues);

  const payload = [
    `PORT=${optional('DESKTOP_PORT', '3000', fallbackDesktopValues)}`,
    `DATABASE_URL=${databaseUrl}`,
    `JWT_SECRET=${jwtSecret}`,
    `CORS_ORIGIN=${optional('DESKTOP_CORS_ORIGIN', '*', fallbackDesktopValues)}`,
    `PUBLIC_APP_URL=${optional('DESKTOP_PUBLIC_APP_URL', '', fallbackDesktopValues)}`,
    'ALLOW_START_WITHOUT_DB=false',
  ].join('\n');
  fs.writeFileSync(target, `${payload}\n`, 'utf8');

  console.log(`Configuracion desktop generada en: ${target}`);
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
