export const APP_VERSION = '9.5.4';

// Rutas de descarga oficiales fijas (GitHub Releases v9.5.4)
// CANDADO TÉCNICO INFRANQUEABLE: Asignación determinista que rechaza variables obsoletas (ej. v9.2.8) de Render
export const OFFICIAL_PC_DOWNLOAD_URL = 'https://github.com/carlox7800/sugar_ludo_web/releases/download/v9.5.4/SugarLudo-v9.5.4-Setup.exe';
export const OFFICIAL_ANDROID_DOWNLOAD_URL = 'https://github.com/carlox7800/sugar_ludo_web/releases/download/v9.5.4/SugarLudo-v9.5.4.apk';

export const PC_DOWNLOAD_URL = (process.env.NEXT_PUBLIC_PC_DOWNLOAD_URL && process.env.NEXT_PUBLIC_PC_DOWNLOAD_URL.includes(`v${APP_VERSION}`))
  ? process.env.NEXT_PUBLIC_PC_DOWNLOAD_URL
  : OFFICIAL_PC_DOWNLOAD_URL;

export const ANDROID_DOWNLOAD_URL = (process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL && process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL.includes(`v${APP_VERSION}`))
  ? process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL
  : OFFICIAL_ANDROID_DOWNLOAD_URL;

// Enlace directo al juego web desplegado
export const WEB_GAME_URL = process.env.NEXT_PUBLIC_WEB_GAME_URL || 'https://sugar-ludo-web.onrender.com';

// Especificaciones de empaquetado verificadas
export const PC_FILE_SIZE = '~248 MB';
export const ANDROID_FILE_SIZE = '~47 MB';
