const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopInfo', {
  platform: process.platform,
  isDesktop: true,
  apiBaseUrl: process.env.DESKTOP_API_BASE_URL || 'http://127.0.0.1:3000',
  publicAppUrl: process.env.DESKTOP_PUBLIC_APP_URL || '',
});
