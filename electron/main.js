const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences } = require('electron');
const path = require('path');
const url = require('url');

// Enable Chromium flags for audio capture (loopback/system sound)
app.commandLine.appendSwitch('enable-features', 'AudioServiceSandbox');
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');

let mainWindow;
let protectionEnabled = true; //Track current content protection state

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#121212',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for desktopCapturer
      preload: path.join(__dirname, 'preload.js'),
      devTools: process.env.NODE_ENV === 'development',
    },
    minWidth: 800,
    minHeight: 600,
  });

  // Protect against screenshots/screen recording
  mainWindow.setContentProtection(protectionEnabled);

  // Block PrintScreen / Ctrl+P / Ctrl+Shift+I
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'PrintScreen' ||
      (input.control && input.key.toLowerCase() === 'p') ||
      (input.control && input.shift && input.key.toLowerCase() === 'i')
    ) {
      event.preventDefault();
    }
  });

  // Prevent new windows (security)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Allow required media permissions
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowed = ['media', 'audioCapture', 'desktopCapture'];
      if (allowed.includes(permission)) {
        console.log('Granting permission for:', permission);
        callback(true);
      } else {
        console.warn('Denying permission for:', permission);
        callback(false);
      }
    }
  );

  // Load Angular app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = url.pathToFileURL(
      path.join(__dirname, '../dist/saas-interview-assistant-tool/browser/index.html')
    ).href;
    mainWindow.loadURL(indexPath);
  }

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Toggle content protection on/off
ipcMain.handle('toggle-protection', (event, enable) => {
  protectionEnabled = enable;
  if (mainWindow) {
    mainWindow.setContentProtection(protectionEnabled);
    console.log(protectionEnabled ? 'Screen protection ENABLED' : 'Screen protection DISABLED');
  }
  return protectionEnabled;
});

// IPC: Request audio recording permission
ipcMain.handle('request-audio-permission', async () => {
  try {
    if (process.platform === 'darwin') {
      // macOS requires screen recording permission
      const status = systemPreferences.getMediaAccessStatus('screen');
      if (status !== 'granted') {
        await systemPreferences.askForMediaAccess('screen');
      }
      console.log('macOS: Screen recording permission granted.');
      return true;
    } else if (process.platform === 'win32') {
      console.log('Windows: Audio capture permission granted.');
      return true;
    } else {
      console.log('Linux: Using Chromium media permission.');
      return true;
    }
  } catch (error) {
    console.error('Error requesting audio permission:', error);
    return false;
  }
});

// IPC: Get system (screen) audio sources from main process
ipcMain.handle('get-audio-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false,
    });
    console.log(
      'Available sources:',
      sources.map((s) => s.name)
    );
    return sources;
  } catch (error) {
    console.error('Error getting audio sources:', error);
    return [];
  }
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Allow insecure localhost during dev
if (process.env.NODE_ENV === 'development') {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });
}
