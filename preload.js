const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  onUpdateMessage: (callback) => {
    ipcRenderer.on('update-message', (_event, message) => callback(message));
  }
});
