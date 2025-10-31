const { contextBridge, ipcRenderer } = require('electron');

// Expose API to Angular safely
contextBridge.exposeInMainWorld('electronAPI', {
  toggleProtection: async (enable) => {
    try {
      const result = await ipcRenderer.invoke('toggle-protection', enable);
      return result;
    } catch (err) {
      console.error('Error toggling protection:', err);
      return false;
    }
  },
});
