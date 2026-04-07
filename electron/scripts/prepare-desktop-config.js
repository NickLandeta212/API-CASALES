const fs = require('fs');
const path = require('path');

function stripTrailingSlash(value) {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function required(name, fallbackValues = {}) {
  const value = stripTrailingSlash(process.env[name] || fallbackValues[name] || '');

  if (!value) {
    throw new Error(`Falta variable requerida para desktop build: ${name}`);
  }

  return value;
}

function run() {
  const target = path.resolve(__dirname, '../assets/desktop-config.json');
  const existingValues = readJsonFile(target);
  const fallbackValues = {
    DESKTOP_API_BASE_URL: existingValues.API_BASE_URL,
    DESKTOP_PUBLIC_APP_URL: existingValues.PUBLIC_APP_URL,
  };

  const payload = {
    API_BASE_URL: required('DESKTOP_API_BASE_URL', fallbackValues),
    PUBLIC_APP_URL: required('DESKTOP_PUBLIC_APP_URL', fallbackValues),
  };

  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Configuracion desktop generada en: ${target}`);
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}