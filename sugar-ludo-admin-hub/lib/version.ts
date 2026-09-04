// Fuente centralizada de verdad para la versión del sistema Sugar Ludo Admin Hub
import packageJson from '../package.json'

export const APP_VERSION: string = (packageJson && packageJson.version) ? packageJson.version : '8.9.4'
export const APP_VERSION_TAG: string = 'v' + APP_VERSION
