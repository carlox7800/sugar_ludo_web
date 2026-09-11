const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAuth', {
  onDeepLinkToken: (callback) => {
    ipcRenderer.on('auth-deep-link', (event, data) => callback(data));
  },
  openExternalUrl: (url) => {
    ipcRenderer.send('open-external-url', url);
  },
  isElectron: true
});
