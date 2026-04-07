const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, dialog } = require('electron');

const DESKTOP_CONFIG_FILE = 'desktop-config.json';
const DEFAULT_DEV_API_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_DEV_PUBLIC_APP_URL = 'http://localhost:5173';

let runtimeConfig = {
  API_BASE_URL: DEFAULT_DEV_API_BASE_URL,
  PUBLIC_APP_URL: DEFAULT_DEV_PUBLIC_APP_URL,
};

function isDev() {
  return !app.isPackaged;
}

function stripTrailingSlash(value) {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

function parseDesktopConfigPayload(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};

  return {
    API_BASE_URL: stripTrailingSlash(data.API_BASE_URL || data.apiBaseUrl || ''),
    PUBLIC_APP_URL: stripTrailingSlash(data.PUBLIC_APP_URL || data.publicAppUrl || ''),
  };
}

function removeEmptyConfigValues(config) {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => String(value || '').trim())
  );
}

function readDesktopConfigFile(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function getEmbeddedDesktopConfig() {
  if (isDev()) {
    return {};
  }

  return readDesktopConfigFile(path.join(__dirname, 'assets', DESKTOP_CONFIG_FILE));
}

function getUserDesktopConfig() {
  return readDesktopConfigFile(path.join(app.getPath('userData'), DESKTOP_CONFIG_FILE));
}

function buildRuntimeDesktopConfig() {
  const envConfig = parseDesktopConfigPayload({
    API_BASE_URL: process.env.DESKTOP_API_BASE_URL,
    PUBLIC_APP_URL: process.env.DESKTOP_PUBLIC_APP_URL,
  });

  const embeddedConfig = getEmbeddedDesktopConfig();
  const userConfig = getUserDesktopConfig();

  const defaultConfig = isDev()
    ? {
        API_BASE_URL: DEFAULT_DEV_API_BASE_URL,
        PUBLIC_APP_URL: DEFAULT_DEV_PUBLIC_APP_URL,
      }
    : {};

  return removeEmptyConfigValues({
    ...defaultConfig,
    ...parseDesktopConfigPayload(embeddedConfig),
    ...parseDesktopConfigPayload(userConfig),
    ...envConfig,
  });
}

function hasRequiredDesktopConfig(config) {
  return Boolean(String(config.API_BASE_URL || '').trim() && String(config.PUBLIC_APP_URL || '').trim());
}

function getFrontendEntry() {
  if (isDev()) {
    return {
      type: 'url',
      value: process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173',
    };
  }

  return {
    type: 'file',
    value: path.join(__dirname, '..', 'frontend', 'dist', 'index.html'),
  };
}

async function showConfigurationError(detail) {
  await dialog.showMessageBox({
    type: 'error',
    title: 'Configuracion incompleta',
    message: 'La aplicacion no tiene configurada la API central.',
    detail,
    buttons: ['Cerrar'],
    defaultId: 0,
    cancelId: 0,
  });
}

async function showFrontendLoadError(detail) {
  await dialog.showMessageBox({
    type: 'error',
    title: 'No se pudo abrir la interfaz',
    message: 'La aplicacion no pudo cargar el frontend.',
    detail,
    buttons: ['Cerrar'],
    defaultId: 0,
    cancelId: 0,
  });
}

async function createWindow() {
  process.env.DESKTOP_API_BASE_URL = runtimeConfig.API_BASE_URL;
  process.env.DESKTOP_PUBLIC_APP_URL = runtimeConfig.PUBLIC_APP_URL;

  const win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const entry = getFrontendEntry();

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('did-fail-load', async (_, errorCode, errorDescription, validatedURL) => {
    if (app.isQuitting) {
      return;
    }

    await showFrontendLoadError(
      `Error de carga (${errorCode}): ${errorDescription}\nURL: ${validatedURL || 'n/a'}`
    );
    app.quit();
  });

  if (entry.type === 'url') {
    try {
      await win.loadURL(entry.value);
    } catch (error) {
      await showFrontendLoadError(`No se pudo abrir ${entry.value}\n\n${error.message}`);
      app.quit();
      return;
    }

    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  if (!fs.existsSync(entry.value)) {
    await showFrontendLoadError(
      `No existe el archivo esperado del frontend:\n${entry.value}\n\nGenera nuevamente el instalador.`
    );
    app.quit();
    return;
  }

  try {
    await win.loadFile(entry.value);
  } catch (error) {
    await showFrontendLoadError(`No se pudo abrir ${entry.value}\n\n${error.message}`);
    app.quit();
  }
}

app.on('ready', async () => {
  runtimeConfig = buildRuntimeDesktopConfig();

  if (!hasRequiredDesktopConfig(runtimeConfig)) {
    await showConfigurationError(
      'Falta definir DESKTOP_API_BASE_URL y DESKTOP_PUBLIC_APP_URL para el instalador.\n\nGenera nuevamente el build con electron/scripts/prepare-desktop-config.js o edita %APPDATA%/Conjunto App/desktop-config.json.'
    );
    app.quit();
    return;
  }

  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});