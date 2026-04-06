const path = require('path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');

let backendProcess = null;

const DESKTOP_CONFIG_FILE = 'desktop-config.json';

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

function getDesktopConfigPath() {
  return path.join(app.getPath('userData'), DESKTOP_CONFIG_FILE);
}

function readDesktopConfig() {
  const configPath = getDesktopConfigPath();

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

function writeDesktopConfig(config) {
  const configPath = getDesktopConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function sanitizeDesktopConfig(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};

  return {
    DATABASE_URL: String(data.DATABASE_URL || '').trim(),
    JWT_SECRET: String(data.JWT_SECRET || '').trim(),
    CORS_ORIGIN: String(data.CORS_ORIGIN || '*').trim() || '*',
    PUBLIC_APP_URL: String(data.PUBLIC_APP_URL || '').trim(),
    PORT: String(data.PORT || '3000').trim() || '3000',
  };
}

function getPackagedBackendEnv() {
  const backendRoot = path.join(process.resourcesPath, 'backend');
  const desktopEnvPath = path.join(backendRoot, '.env.desktop');

  if (!fs.existsSync(desktopEnvPath)) {
    return {};
  }

  return parseDotEnv(fs.readFileSync(desktopEnvPath, 'utf8'));
}

function buildEffectiveBackendEnv() {
  const packagedEnv = isDev() ? {} : getPackagedBackendEnv();
  const userConfig = sanitizeDesktopConfig(readDesktopConfig());

  return {
    ...packagedEnv,
    ...userConfig,
  };
}

function hasRequiredBackendConfig(env) {
  return Boolean(String(env.DATABASE_URL || '').trim() && String(env.JWT_SECRET || '').trim());
}

function buildConfigWindowHtml(defaultValues) {
  const escaped = {
    DATABASE_URL: String(defaultValues.DATABASE_URL || '').replace(/"/g, '&quot;'),
    JWT_SECRET: String(defaultValues.JWT_SECRET || '').replace(/"/g, '&quot;'),
    CORS_ORIGIN: String(defaultValues.CORS_ORIGIN || '*').replace(/"/g, '&quot;'),
    PUBLIC_APP_URL: String(defaultValues.PUBLIC_APP_URL || '').replace(/"/g, '&quot;'),
    PORT: String(defaultValues.PORT || '3000').replace(/"/g, '&quot;'),
  };

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Configurar App</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; margin: 18px; background: #f7faf9; color: #1a2b23; }
      h2 { margin-top: 0; }
      p { color: #476055; }
      label { display: block; margin: 10px 0 5px; font-weight: 600; }
      input { width: 100%; padding: 10px; border: 1px solid #b7c6bd; border-radius: 8px; box-sizing: border-box; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .actions { margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; }
      button { border: none; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
      .save { background: #1f6b44; color: #fff; }
      .cancel { background: #d7e3dc; color: #1a2b23; }
      .err { margin-top: 8px; color: #912e1a; min-height: 20px; }
    </style>
  </head>
  <body>
    <h2>Configuracion inicial</h2>
    <p>Completa los datos para iniciar el backend interno en esta laptop.</p>

    <label>DATABASE_URL *</label>
    <input id="DATABASE_URL" value="${escaped.DATABASE_URL}" placeholder="postgresql://usuario:clave@host:5432/db" />

    <label>JWT_SECRET *</label>
    <input id="JWT_SECRET" type="password" value="${escaped.JWT_SECRET}" placeholder="secreto fuerte" />

    <div class="row">
      <div>
        <label>PORT</label>
        <input id="PORT" value="${escaped.PORT}" placeholder="3000" />
      </div>
      <div>
        <label>CORS_ORIGIN</label>
        <input id="CORS_ORIGIN" value="${escaped.CORS_ORIGIN}" placeholder="*" />
      </div>
    </div>

    <label>PUBLIC_APP_URL</label>
    <input id="PUBLIC_APP_URL" value="${escaped.PUBLIC_APP_URL}" placeholder="https://tu-dominio.com" />

    <div class="err" id="error"></div>

    <div class="actions">
      <button class="cancel" id="cancel">Cancelar</button>
      <button class="save" id="save">Guardar y continuar</button>
    </div>

    <script>
      const { ipcRenderer } = require('electron');
      const $ = (id) => document.getElementById(id);

      $('cancel').addEventListener('click', () => {
        ipcRenderer.send('desktop-config-cancel');
      });

      $('save').addEventListener('click', () => {
        const payload = {
          DATABASE_URL: $('DATABASE_URL').value.trim(),
          JWT_SECRET: $('JWT_SECRET').value.trim(),
          PORT: $('PORT').value.trim() || '3000',
          CORS_ORIGIN: $('CORS_ORIGIN').value.trim() || '*',
          PUBLIC_APP_URL: $('PUBLIC_APP_URL').value.trim(),
        };

        if (!payload.DATABASE_URL || !payload.JWT_SECRET) {
          $('error').textContent = 'DATABASE_URL y JWT_SECRET son obligatorios.';
          return;
        }

        ipcRenderer.send('desktop-config-save', payload);
      });
    </script>
  </body>
</html>`;
}

function promptDesktopConfig(defaultValues) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 640,
      height: 620,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    const cleanup = () => {
      ipcMain.removeAllListeners('desktop-config-save');
      ipcMain.removeAllListeners('desktop-config-cancel');
    };

    ipcMain.once('desktop-config-save', (_, payload) => {
      cleanup();
      resolve({ action: 'save', payload: sanitizeDesktopConfig(payload) });
      if (!win.isDestroyed()) win.close();
    });

    ipcMain.once('desktop-config-cancel', () => {
      cleanup();
      resolve({ action: 'cancel' });
      if (!win.isDestroyed()) win.close();
    });

    win.on('closed', () => {
      cleanup();
      resolve({ action: 'cancel' });
    });

    win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(buildConfigWindowHtml(defaultValues))}`);
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

async function startBackendForPackagedApp() {
  if (isDev()) {
    return;
  }

  const backendRoot = path.join(process.resourcesPath, 'backend');
  const backendEntry = path.join(backendRoot, 'src', 'server.js');

  let effectiveEnv = buildEffectiveBackendEnv();

  if (!hasRequiredBackendConfig(effectiveEnv)) {
    const response = await promptDesktopConfig(effectiveEnv);

    if (response.action !== 'save') {
      app.quit();
      return;
    }

    writeDesktopConfig(response.payload);
    effectiveEnv = buildEffectiveBackendEnv();
  }

  backendProcess = fork(backendEntry, {
    cwd: backendRoot,
    env: {
      ...process.env,
      ...effectiveEnv,
      NODE_ENV: 'production',
      ALLOW_START_WITHOUT_DB: effectiveEnv.ALLOW_START_WITHOUT_DB || process.env.ALLOW_START_WITHOUT_DB || 'false',
    },
    stdio: 'inherit',
  });

  backendProcess.once('exit', async (code, signal) => {
    if (!app.isQuitting) {
      const buttonIndex = await dialog.showMessageBox({
        type: 'error',
        title: 'Backend detenido',
        message: `El backend se cerró inesperadamente. Code: ${code ?? 'n/a'}, Signal: ${signal ?? 'n/a'}`,
        detail: 'Puedes reconfigurar la conexion y reintentar.',
        buttons: ['Reconfigurar', 'Salir'],
        defaultId: 0,
        cancelId: 1,
      });

      if (buttonIndex.response === 0) {
        const response = await promptDesktopConfig(buildEffectiveBackendEnv());
        if (response.action === 'save') {
          writeDesktopConfig(response.payload);
          await startBackendForPackagedApp();
          return;
        }
      }

      app.quit();
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

app.on('ready', async () => {
  await startBackendForPackagedApp();
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
