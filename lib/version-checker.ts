/**
 * SUGAR LUDO - SERVICIO DE VERIFICACIÓN DE VERSIÓN Y GOBERNANZA DE ACTUALIZACIONES
 * 
 * Consulta remota a $0.00 (Plan Spark) mediante manifiesto estático en Render
 * con fallback resiliente a Firestore 'system_config/app_version'.
 */

import { APP_VERSION } from './version.ts'
import { db } from './firebase.ts'
import { doc, getDoc } from 'firebase/firestore'

/**
 * BANDERA TEMPORAL DE PRUEBA DE DESFASE (DIRECTIVA DE LA DIRECCIÓN TÉCNICA)
 * 
 * Simula que el cliente local ejecuta una versión obsoleta ('9.4.9') para
 * comprobar en vivo el bloqueo infranqueable y el flujo de descarga manual.
 * Para producción definitiva en v9.5.4, este valor debe ser null.
 */
export const MOCK_TEST_CLIENT_VERSION: string | null = null

export interface VersionDownloadUrls {
  android: string
  windows: string
  web: string
}

export interface VersionPolicy {
  latestVersion: string
  minSupportedVersion: string
  forceUpdate: boolean
  releaseDate?: string
  downloadUrls: VersionDownloadUrls
  landingUrl: string
  changelog?: string
}

export interface VersionCheckResult {
  currentVersion: string
  latestVersion: string
  minSupportedVersion: string
  isOutdated: boolean
  isForceUpdate: boolean
  downloadUrls: VersionDownloadUrls
  landingUrl: string
  changelog: string
  source: 'static_manifest' | 'firestore_fallback' | 'memory_cache' | 'offline_fallback'
}

export const DEFAULT_VERSION_POLICY: VersionPolicy = {
  latestVersion: '9.5.4',
  minSupportedVersion: '9.5.4',
  forceUpdate: true,
  releaseDate: '2026-09-21',
  downloadUrls: {
    android: 'https://sugar-ludo-landing.onrender.com/#download',
    windows: 'https://sugar-ludo-landing.onrender.com/#download',
    web: 'https://sugar-ludo-web.onrender.com'
  },
  landingUrl: 'https://sugar-ludo-landing.onrender.com',
  changelog: 'Actualización obligatoria v9.5.4: Centro de soporte inteligente AAA, sistema de incidencias y parches críticos de seguridad.'
}

// Caché en memoria para evitar consultas redundantes en la misma sesión ($0.00 Spark)
let memoryCachedPolicy: VersionPolicy | null = null

/**
 * Retorna la versión activa del cliente (considerando simulación de prueba)
 */
export function getClientAppVersion(): string {
  return MOCK_TEST_CLIENT_VERSION || APP_VERSION || '9.5.4'
}

/**
 * Parsea una versión semver en tupla numérica [major, minor, patch]
 */
export function parseSemver(v: string): [number, number, number] {
  const clean = (v || '').replace(/^[vV]/, '').trim()
  const parts = clean.split('.').map((p) => {
    const num = parseInt(p, 10)
    return isNaN(num) ? 0 : num
  })
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

/**
 * Compara dos versiones semver.
 * Retorna:
 *  1 si v1 > v2
 * -1 si v1 < v2
 *  0 si v1 == v2
 */
export function compareSemver(v1: string, v2: string): number {
  const [maj1, min1, pat1] = parseSemver(v1)
  const [maj2, min2, pat2] = parseSemver(v2)

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1
  if (min1 !== min2) return min1 > min2 ? 1 : -1
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1
  return 0
}

/**
 * Determina si la versión del cliente es estrictamente menor a la versión mínima requerida
 */
export function isVersionOutdated(clientVer: string, minRequiredVer: string): boolean {
  return compareSemver(clientVer, minRequiredVer) < 0
}

/**
 * Consulta la política oficial de versión desde el manifiesto estático en Render
 */
async function fetchStaticVersionManifest(): Promise<VersionPolicy | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  // En navegador/Capacitor se intenta ruta relativa o endpoint absoluto en Render
  const targetUrl = typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file:') && !window.location.origin.startsWith('app:')
    ? '/version.json'
    : 'https://sugar-ludo-web.onrender.com/version.json'

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (data && data.minSupportedVersion) {
        return {
          latestVersion: String(data.latestVersion || data.minSupportedVersion),
          minSupportedVersion: String(data.minSupportedVersion),
          forceUpdate: Boolean(data.forceUpdate ?? true),
          releaseDate: data.releaseDate,
          downloadUrls: {
            android: data.downloadUrls?.android || DEFAULT_VERSION_POLICY.downloadUrls.android,
            windows: data.downloadUrls?.windows || DEFAULT_VERSION_POLICY.downloadUrls.windows,
            web: data.downloadUrls?.web || DEFAULT_VERSION_POLICY.downloadUrls.web
          },
          landingUrl: data.landingUrl || DEFAULT_VERSION_POLICY.landingUrl,
          changelog: data.changelog || DEFAULT_VERSION_POLICY.changelog
        }
      }
    }
  } catch (err) {
    // Falla de red, timeout o CORS -> se activa fallback
  } finally {
    clearTimeout(timeoutId)
  }

  return null
}

/**
 * Consulta la política oficial de versión desde Firestore (system_config/app_version)
 */
async function fetchFirestoreVersionPolicy(): Promise<VersionPolicy | null> {
  try {
    const docRef = doc(db, 'system_config', 'app_version')
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      const data = snap.data() || {}
      if (data.minSupportedVersion) {
        return {
          latestVersion: String(data.latestVersion || data.minSupportedVersion),
          minSupportedVersion: String(data.minSupportedVersion),
          forceUpdate: Boolean(data.forceUpdate ?? true),
          releaseDate: data.releaseDate,
          downloadUrls: {
            android: data.downloadUrls?.android || DEFAULT_VERSION_POLICY.downloadUrls.android,
            windows: data.downloadUrls?.windows || DEFAULT_VERSION_POLICY.downloadUrls.windows,
            web: data.downloadUrls?.web || DEFAULT_VERSION_POLICY.downloadUrls.web
          },
          landingUrl: data.landingUrl || DEFAULT_VERSION_POLICY.landingUrl,
          changelog: data.changelog || DEFAULT_VERSION_POLICY.changelog
        }
      }
    }
  } catch (err) {
    console.warn('[VersionChecker] Fallback a Firestore omitido:', err)
  }
  return null
}

/**
 * Ejecuta el circuito integral de verificación de versión
 */
export async function checkAppVersion(forceBypassCache = false): Promise<VersionCheckResult> {
  const currentVersion = getClientAppVersion()

  // 1. Verificar si ya tenemos la política en caché de sesión
  if (!forceBypassCache && memoryCachedPolicy) {
    const isOutdated = isVersionOutdated(currentVersion, memoryCachedPolicy.minSupportedVersion)
    return {
      currentVersion,
      latestVersion: memoryCachedPolicy.latestVersion,
      minSupportedVersion: memoryCachedPolicy.minSupportedVersion,
      isOutdated,
      isForceUpdate: isOutdated && memoryCachedPolicy.forceUpdate,
      downloadUrls: memoryCachedPolicy.downloadUrls,
      landingUrl: memoryCachedPolicy.landingUrl,
      changelog: memoryCachedPolicy.changelog || '',
      source: 'memory_cache'
    }
  }

  // 2. Intentar manifiesto estático público ($0.00 / 0 lecturas)
  let policy = await fetchStaticVersionManifest()
  let source: VersionCheckResult['source'] = 'static_manifest'

  // 3. Fallback a Firestore si el servidor estático no respondió
  if (!policy) {
    policy = await fetchFirestoreVersionPolicy()
    source = 'firestore_fallback'
  }

  // 4. Fallback por defecto si no hubo conexión
  if (!policy) {
    policy = DEFAULT_VERSION_POLICY
    source = 'offline_fallback'
  }

  // Guardar en memoria
  memoryCachedPolicy = policy

  const isOutdated = isVersionOutdated(currentVersion, policy.minSupportedVersion)

  return {
    currentVersion,
    latestVersion: policy.latestVersion,
    minSupportedVersion: policy.minSupportedVersion,
    isOutdated,
    isForceUpdate: isOutdated && policy.forceUpdate,
    downloadUrls: policy.downloadUrls,
    landingUrl: policy.landingUrl,
    changelog: policy.changelog || '',
    source
  }
}
