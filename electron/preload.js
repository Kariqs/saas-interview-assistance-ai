const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleProtection: async (enable) => {
    try {
      return await ipcRenderer.invoke('toggle-protection', enable);
    } catch {
      return false;
    }
  },

  getAudioSources: async () => {
    try {
      return await ipcRenderer.invoke('get-audio-sources');
    } catch {
      return [];
    }
  },

  requestAudioPermission: async () => {
    try {
      return await ipcRenderer.invoke('request-audio-permission');
    } catch {
      return false;
    }
  },

  openExternal: async (url) => {
    return ipcRenderer.invoke('open-external', url);
  },
});

process.on('uncaughtException', () => {});
