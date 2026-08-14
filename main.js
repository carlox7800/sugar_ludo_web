const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const url = require('url');

// 1. Registrar esquema 'app' como privilegiado ANTES de que la app esté lista
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // Permitir y configurar popups para inicio de sesión de Google (OAuth / Firebase)
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 600,
        height: 700,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true
        }
      }
    };
  });

  // Next.js static export produce un index.html que cargamos directamente
  mainWindow.loadURL('app://localhost/index.html');
}

app.whenReady().then(() => {
  // Configurar User-Agent limpio para evitar bloqueo de Google ("disallowed_useragent")
  const defaultUA = app.userAgentFallback || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  app.userAgentFallback = defaultUA.replace(/Electron\/\S+ /, '').replace(/Sugar-Ludo\/\S+ /, '');

  // Protocol handler robusto para cargar archivos de /out
  protocol.handle('app', (request) => {
    try {
      const reqUrl = new URL(request.url);
      let pathname = decodeURIComponent(reqUrl.pathname);
      if (!pathname || pathname === '/') {
        pathname = '/index.html';
      }
      
      const filePath = path.join(__dirname, 'out', pathname.replace(/^\//, ''));
      return net.fetch(url.pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('Error serving protocol app:', err);
      return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
