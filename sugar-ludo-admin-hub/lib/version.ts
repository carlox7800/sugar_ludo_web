import packageJson from '../package.json' with { type: 'json' }

export const APP_VERSION: string = (packageJson && packageJson.version) ? packageJson.version : '9.9.4'
export const APP_VERSION_TAG: string = 'v' + APP_VERSION
