// Fuente centralizada de verdad para la versión del sistema Sugar Ludo Web
import packageJson from '../package.json'

export const APP_VERSION: string = (packageJson && packageJson.version) ? packageJson.version : '8.10.0'
export const APP_VERSION_TAG: string = 'v' + APP_VERSION
