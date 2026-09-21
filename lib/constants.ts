// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
import { APP_VERSION_TAG } from './version'

export const APP_VERSION = APP_VERSION_TAG
export const IS_PRODUCTION = true // Change to false for localhost testing;
export const LANDING_PORTAL_URL = process.env.NEXT_PUBLIC_LANDING_PORTAL_URL || 'https://sugar-ludo-landing.onrender.com';
export const GITHUB_RELEASE_PC_URL = 'https://github.com/carlox7800/sugar_ludo_web/releases/download/v9.5.4/SugarLudo-v9.5.4-Setup.exe';
export const GITHUB_RELEASE_ANDROID_URL = 'https://github.com/carlox7800/sugar_ludo_web/releases/download/v9.5.4/SugarLudo-v9.5.4.apk';
