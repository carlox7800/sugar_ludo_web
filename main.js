const { app, BrowserWindow, protocol, net, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');

// Registro de protocolo personalizado para Deep Linking OAuth (sugarludo://)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('sugarludo', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('sugarludo');
}

// Bloqueo de instancia única para evitar múltiples ventanas concurrentes y capturar deep links en Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let pendingDeepLinkData = null;

function handleDeepLinkUrl(rawIncomingUrl) {
  if (!rawIncomingUrl || typeof rawIncomingUrl !== 'string') return;
  
  // Limpieza de comillas y caracteres añadidos por Windows/Chromium shell
  let cleanUrl = rawIncomingUrl.trim().replace(/^["']|["']$/g, '');
  if (!cleanUrl.startsWith('sugarludo://')) return;

  try {
    let idToken = null;
    let accessToken = null;

    if (cleanUrl.includes('?')) {
      const queryString = cleanUrl.split('?')[1];
      const params = new URLSearchParams(queryString);
      idToken = params.get('idToken');
      accessToken = params.get('accessToken');
    }
    
    if (!idToken && !accessToken) {
      const parsed = new URL(cleanUrl);
      idToken = parsed.searchParams.get('idToken');
      accessToken = parsed.searchParams.get('accessToken');
    }

    // Sanitización de posibles barras diagonales finales o caracteres pegados por Windows
    if (idToken) idToken = idToken.replace(/\/+$/, '').trim();
    if (accessToken) accessToken = accessToken.replace(/\/+$/, '').trim();

    if (idToken || accessToken) {
      console.log('[Main Process] Credenciales de Deep Link capturadas correctamente');
      pendingDeepLinkData = { idToken, accessToken };
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('auth-deep-link', { idToken, accessToken });
      }
    }
  } catch (e) {
    console.error('Error parseando deep link:', e, 'URL cruda:', rawIncomingUrl);
    // Fallback de extracción regex directa
    const idMatch = cleanUrl.match(/[?&]idToken=([^&]+)/);
    const accessMatch = cleanUrl.match(/[?&]accessToken=([^&]+)/);
    const idToken = idMatch && idMatch[1] ? decodeURIComponent(idMatch[1]).replace(/\/+$/, '').trim() : null;
    const accessToken = accessMatch && accessMatch[1] ? decodeURIComponent(accessMatch[1]).replace(/\/+$/, '').trim() : null;

    if (idToken || accessToken) {
      pendingDeepLinkData = { idToken, accessToken };
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('auth-deep-link', { idToken, accessToken });
      }
    }
  }
}

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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // Atajo de teclado F11 para alternar pantalla completa y Escape para confirmar salida
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancelar', 'Salir del Juego'],
        defaultId: 0,
        cancelId: 0,
        title: 'Sugar Ludo',
        message: '¿Estás seguro de que deseas salir de Sugar Ludo?',
        detail: 'Cualquier partida o acción no guardada podría interrumpirse.'
      }).then(({ response }) => {
        if (response === 1) {
          app.quit();
        }
      }).catch(err => {
        console.error('Error en cuadro de diálogo de salida:', err);
      });
    }
  });

  // Permitir y configurar popups o redirigir enlaces externos al navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      shell.openExternal(targetUrl);
      return { action: 'deny' };
    }
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Next.js static export produce un index.html que cargamos directamente
  mainWindow.loadURL('app://localhost/index.html');

  // Si la aplicación se inició directamente con un argumento sugarludo:// (arranque en frío)
  const coldUrl = process.argv.find(arg => arg.startsWith('sugarludo://'));
  if (coldUrl) {
    mainWindow.webContents.once('did-finish-load', () => {
      handleDeepLinkUrl(coldUrl);
    });
  }
}

// Captura de Deep Link en Windows cuando ya hay una instancia abierta
app.on('second-instance', (event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();

    const deepUrl = commandLine.find(arg => typeof arg === 'string' && (arg.includes('sugarludo://') || arg.startsWith('sugarludo://')));
    if (deepUrl) {
      handleDeepLinkUrl(deepUrl);
    }
  }
});

// Captura de Deep Link en macOS
app.on('open-url', (event, targetUrl) => {
  event.preventDefault();
  handleDeepLinkUrl(targetUrl);
});

// IPC Handler para que el cliente consulte si hay un token de autenticación pendiente
ipcMain.handle('get-pending-auth-token', () => {
  const data = pendingDeepLinkData;
  pendingDeepLinkData = null; // Consumir una sola vez
  return data;
});

// IPC Handler para abrir URLs en el navegador predeterminado del sistema operativo
ipcMain.on('open-external-url', (event, targetUrl) => {
  if (targetUrl && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
    shell.openExternal(targetUrl);
  }
});

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
