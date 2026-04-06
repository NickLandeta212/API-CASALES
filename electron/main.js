const path = require('path');
const { app, BrowserWindow, dialog } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');

let backendProcess = null;

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

function isDev() {
  return !app.isPackaged;
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

function startBackendForPackagedApp() {
  if (isDev()) {
    return;
  }

  const backendRoot = path.join(process.resourcesPath, 'backend');
  const backendEntry = path.join(backendRoot, 'src', 'server.js');
  const desktopEnvPath = path.join(backendRoot, '.env.desktop');
  const packagedEnv = fs.existsSync(desktopEnvPath)
    ? parseDotEnv(fs.readFileSync(desktopEnvPath, 'utf8'))
    : {};

  if (!packagedEnv.DATABASE_URL || !packagedEnv.JWT_SECRET) {
    dialog.showErrorBox(
      'Configuracion faltante',
      'La app desktop no tiene DATABASE_URL o JWT_SECRET embebidos. Rebuild con DESKTOP_DATABASE_URL y DESKTOP_JWT_SECRET.'
    );
  }

  backendProcess = fork(backendEntry, {
    cwd: backendRoot,
    env: {
      ...process.env,
      ...packagedEnv,
      NODE_ENV: 'production',
      ALLOW_START_WITHOUT_DB: packagedEnv.ALLOW_START_WITHOUT_DB || process.env.ALLOW_START_WITHOUT_DB || 'false',
    },
    stdio: 'inherit',
  });

  backendProcess.on('exit', (code, signal) => {
    if (!app.isQuitting) {
      dialog.showErrorBox(
        'Backend detenido',
        `El servicio backend se cerró inesperadamente. Code: ${code ?? 'n/a'}, Signal: ${signal ?? 'n/a'}`
      );
    }
  });
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) {
    return;
  }

  backendProcess.kill('SIGTERM');
  backendProcess = null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const entry = getFrontendEntry();

  if (entry.type === 'url') {
    win.loadURL(entry.value);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(entry.value);
  }
}

app.on('ready', () => {
  startBackendForPackagedApp();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopBackend();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
