const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');
const { app, BrowserWindow, dialog } = require('electron');

const DESKTOP_CONFIG_FILE = 'desktop-config.json';
const DEFAULT_DEV_API_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_DEV_PUBLIC_APP_URL = 'http://localhost:5173';
const MAX_BACKEND_RESTARTS = 3;
const BACKEND_STABLE_MS = 5000;
const BACKEND_READY_TIMEOUT_MS = 15000;

let backendProcess = null;
let backendOutputTail = '';
let backendRestartAttempts = 0;
let backendStableTimer = null;
let backendBaseUrl = DEFAULT_DEV_API_BASE_URL;
let runtimeConfig = {
  API_BASE_URL: DEFAULT_DEV_API_BASE_URL,
  PUBLIC_APP_URL: '',
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
    : {
        API_BASE_URL: DEFAULT_DEV_API_BASE_URL,
        PUBLIC_APP_URL: '',
      };

  return removeEmptyConfigValues({
    ...defaultConfig,
    ...parseDesktopConfigPayload(embeddedConfig),
    ...parseDesktopConfigPayload(userConfig),
    ...envConfig,
  });
}

function hasRequiredDesktopConfig(config) {
  return Boolean(String(config.API_BASE_URL || '').trim());
}

function resolveBackendBaseUrl(portValue) {
  const port = Number(portValue) || 3000;
  return `http://127.0.0.1:${port}`;
}

function appendBackendOutput(chunk) {
  if (!chunk) {
    return;
  }

  backendOutputTail = `${backendOutputTail}${String(chunk)}`;
  if (backendOutputTail.length > 3000) {
    backendOutputTail = backendOutputTail.slice(-3000);
  }
}

function getPackagedBackendEnv() {
  const backendRoot = path.join(process.resourcesPath, 'backend');
  const desktopEnvPath = path.join(backendRoot, '.env.desktop');

  if (!fs.existsSync(desktopEnvPath)) {
    return {};
  }

  const env = {};
  for (const rawLine of fs.readFileSync(desktopEnvPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function buildEffectiveBackendEnv() {
  const packagedEnv = isDev() ? {} : getPackagedBackendEnv();
  const userConfig = removeEmptyConfigValues(parseDesktopConfigPayload(readDesktopConfigFile(path.join(app.getPath('userData'), DESKTOP_CONFIG_FILE))));

  return {
    ...packagedEnv,
    ...userConfig,
  };
}

function hasRequiredBackendConfig(env) {
  return Boolean(String(env.DATABASE_URL || '').trim() && String(env.JWT_SECRET || '').trim());
}

function waitForBackendReady(port, timeoutMs = BACKEND_READY_TIMEOUT_MS) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const attempt = () => {
      const request = http.get({
        hostname: '127.0.0.1',
        port: Number(port) || 3000,
        path: '/',
        timeout: 1500,
      }, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve(true);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          resolve(false);
          return;
        }

        setTimeout(attempt, 300);
      });

      request.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          resolve(false);
          return;
        }

        setTimeout(attempt, 300);
      });

      request.on('timeout', () => {
        request.destroy();
      });
    };

    attempt();
  });
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
    message: 'La aplicacion no tiene configurada la base de datos.',
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

async function startBackendForPackagedApp() {
  if (isDev()) {
    return true;
  }

  const backendRoot = path.join(process.resourcesPath, 'backend');
  const backendEntry = path.join(backendRoot, 'src', 'server.js');

  const effectiveEnv = buildEffectiveBackendEnv();
  backendBaseUrl = resolveBackendBaseUrl(effectiveEnv.PORT);

  if (!hasRequiredBackendConfig(effectiveEnv)) {
    await showConfigurationError(
      'Falta definir DATABASE_URL o JWT_SECRET en la configuracion embebida del instalador.'
    );
    app.quit();
    return false;
  }

  backendProcess = fork(backendEntry, {
    cwd: backendRoot,
    env: {
      ...process.env,
      ...effectiveEnv,
      NODE_ENV: 'production',
      ALLOW_START_WITHOUT_DB: effectiveEnv.ALLOW_START_WITHOUT_DB || process.env.ALLOW_START_WITHOUT_DB || 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  backendOutputTail = '';
  backendProcess.stdout?.on('data', (chunk) => appendBackendOutput(chunk));
  backendProcess.stderr?.on('data', (chunk) => appendBackendOutput(chunk));

  if (backendStableTimer) {
    clearTimeout(backendStableTimer);
    backendStableTimer = null;
  }

  backendStableTimer = setTimeout(() => {
    backendRestartAttempts = 0;
  }, BACKEND_STABLE_MS);

  backendProcess.once('exit', async (code, signal) => {
    if (backendStableTimer) {
      clearTimeout(backendStableTimer);
      backendStableTimer = null;
    }

    if (!app.isQuitting) {
      if (backendRestartAttempts < MAX_BACKEND_RESTARTS) {
        backendRestartAttempts += 1;
        await startBackendForPackagedApp();
        return;
      }

      await dialog.showMessageBox({
        type: 'error',
        title: 'Backend detenido',
        message: `El backend se cerró inesperadamente. Code: ${code ?? 'n/a'}, Signal: ${signal ?? 'n/a'}`,
        detail: [
          'Cierra y vuelve a abrir la aplicacion. Si el problema persiste, revisa la configuracion de base de datos embebida del instalador.',
          backendOutputTail ? `\n\nUltimos logs del backend:\n${backendOutputTail.trim()}` : '',
        ].join(''),
        buttons: ['Salir'],
        defaultId: 0,
        cancelId: 0,
      });

      app.quit();
    }
  });

  const backendReady = await waitForBackendReady(effectiveEnv.PORT);
  if (!backendReady) {
    await showFrontendLoadError(
      backendOutputTail ? `Ultimos logs del backend:\n${backendOutputTail.trim()}` : 'El backend interno no respondio a tiempo.'
    );
    app.quit();
    return false;
  }

  return true;
}

function stopBackend() {
  if (backendStableTimer) {
    clearTimeout(backendStableTimer);
    backendStableTimer = null;
  }

  if (!backendProcess || backendProcess.killed) {
    return;
  }

  backendProcess.kill('SIGTERM');
  backendProcess = null;
}

async function createWindow() {
  process.env.DESKTOP_API_BASE_URL = backendBaseUrl;

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

  const backendStarted = await startBackendForPackagedApp();
  if (!backendStarted) {
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
  stopBackend();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});