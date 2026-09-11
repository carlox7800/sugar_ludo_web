const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAuth', {
  onDeepLinkToken: (callback) => {
    ipcRenderer.on('auth-deep-link', (event, data) => callback(data));
  },
  getPendingAuthToken: () => {
    return ipcRenderer.invoke('get-pending-auth-token');
  },
  openExternalUrl: (url) => {
    ipcRenderer.send('open-external-url', url);
  },
  isElectron: true
});
