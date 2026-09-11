// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
import { APP_VERSION_TAG } from './version'

export const APP_VERSION = APP_VERSION_TAG
export const IS_PRODUCTION = true // Change to false for localhost testing;
export const LANDING_PORTAL_URL = process.env.NEXT_PUBLIC_LANDING_PORTAL_URL || 'https://sugarludo.com';
