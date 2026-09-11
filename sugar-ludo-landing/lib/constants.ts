export const APP_VERSION = '9.2.8';

// Rutas de descarga oficiales
export const PC_DOWNLOAD_URL = process.env.NEXT_PUBLIC_PC_DOWNLOAD_URL || '/downloads/SugarLudo-Setup.exe';
export const ANDROID_DOWNLOAD_URL = process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL || '/downloads/SugarLudo.apk';

// Enlace directo al juego web desplegado
export const WEB_GAME_URL = process.env.NEXT_PUBLIC_WEB_GAME_URL || 'https://sugar-ludo-web.onrender.com';

// Especificaciones de empaquetado verificadas
export const PC_FILE_SIZE = '~248 MB';
export const ANDROID_FILE_SIZE = '~47 MB';
