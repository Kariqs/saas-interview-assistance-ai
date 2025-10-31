const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;
let protectionEnabled = true; // 🛡️ Track current state globally

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#121212',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.env.NODE_ENV === 'development',
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'), // ✅ preload linked
    },
    minWidth: 800,
    minHeight: 600,
  });

  // Enable content protection by default
  mainWindow.setContentProtection(protectionEnabled);

  // Prevent Print Screen / Ctrl+P / Ctrl+Shift+I
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'PrintScreen' ||
      (input.control && input.key.toLowerCase() === 'p') ||
      (input.control && input.shift && input.key.toLowerCase() === 'i')
    ) {
      event.preventDefault();
    }
  });

  // Prevent opening new windows (security)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

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

// ✅ IPC: Toggle screen protection when Angular sends request
ipcMain.handle('toggle-protection', (event, enable) => {
  protectionEnabled = enable;
  if (mainWindow) {
    mainWindow.setContentProtection(protectionEnabled);
    console.log(
      protectionEnabled ? '🛡️ Screen protection ENABLED' : '🟢 Screen protection DISABLED'
    );
  }
  return protectionEnabled;
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

if (process.env.NODE_ENV === 'development') {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });
}
