const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Toggle screen protection
  toggleProtection: async (enable) => {
    try {
      const result = await ipcRenderer.invoke('toggle-protection', enable);
      return result;
    } catch (err) {
      console.error('Error toggling protection:', err);
      return false;
    }
  },

  // Ask main process for audio/screen sources
  getAudioSources: async () => {
    try {
      const sources = await ipcRenderer.invoke('get-audio-sources');
      console.log('Sources from main process:', sources);
      return sources;
    } catch (err) {
      console.error('Error getting audio sources:', err);
      return [];
    }
  },
  // Request microphone/system audio permission
  requestAudioPermission: async () => {
    try {
      const result = await ipcRenderer.invoke('request-audio-permission');
      console.log('Audio permission result:', result);
      return result;
    } catch (err) {
      console.error('Error requesting audio permission:', err);
      return false;
    }
  },
});

// Catch any preload-level runtime errors
process.on('uncaughtException', (err) => {
  console.error('Unhandled error in preload:', err);
});
