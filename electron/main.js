const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  systemPreferences,
  protocol,
  shell,
} = require('electron');
const path = require('path');
const url = require('url');

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('krackai', process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient('krackai');
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'krackai', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

app.commandLine.appendSwitch('enable-features', 'AudioServiceSandbox');
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');

let mainWindow;
let protectionEnabled = true;
let pendingDeepLink = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  mainWindow.setContentProtection(protectionEnabled);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'PrintScreen' ||
      (input.control && input.key.toLowerCase() === 'p') ||
      (input.control && input.shift && input.key.toLowerCase() === 'i')
    ) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = ['media', 'audioCapture', 'desktopCapture'];
      callback(allowed.includes(permission));
    }
  );

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = url.pathToFileURL(
      path.join(__dirname, '../dist/saas-interview-assistant-tool/browser/index.html')
    ).href;
    mainWindow.loadURL(indexPath);
  }

  if (pendingDeepLink) {
    mainWindow.loadURL(pendingDeepLink);
    pendingDeepLink = null;
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('open-url', (event, urlStr) => {
  event.preventDefault();

  let targetUrl;

  if (urlStr.startsWith('krackai://success')) {
    targetUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:4200/pricing?success=true'
        : url.pathToFileURL(
            path.join(__dirname, '../dist/saas-interview-assistant-tool/browser/index.html')
          ).href + '#/pricing?success=true';
  }

  if (urlStr.startsWith('krackai://cancel')) {
    targetUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:4200/pricing?canceled=true'
        : url.pathToFileURL(
            path.join(__dirname, '../dist/saas-interview-assistant-tool/browser/index.html')
          ).href + '#/pricing?canceled=true';
  }

  if (!targetUrl) return;

  if (mainWindow) {
    mainWindow.loadURL(targetUrl);
  } else {
    pendingDeepLink = targetUrl;
  }
});

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('toggle-protection', (_event, enable) => {
  protectionEnabled = enable;
  if (mainWindow) mainWindow.setContentProtection(enable);
  return enable;
});

ipcMain.handle('request-audio-permission', async () => {
  try {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen');
      if (status !== 'granted') {
        await systemPreferences.askForMediaAccess('screen');
      }
    }
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('get-audio-sources', async () => {
  try {
    return await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
    });
  } catch {
    return [];
  }
});

ipcMain.handle('open-external', async (_event, targetUrl) => {
  if (typeof targetUrl !== 'string' || !targetUrl.startsWith('https://checkout.stripe.com/')) {
    throw new Error('Blocked external navigation');
  }

  await shell.openExternal(targetUrl);
  return true;
});

if (process.env.NODE_ENV === 'development') {
  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(true);
  });
}
