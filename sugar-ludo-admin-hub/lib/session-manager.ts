import crypto from 'crypto'

export type StaffRole = 'cashier' | 'admin' | 'super_admin' | 'financial_admin' | 'support_admin'

/**
 * ============================================================================
 * SUGAR LUDO - GESTOR DE SESIONES SEGURAS DE STAFF (FASE 1)
 * ============================================================================
 * Características:
 * 1. Cookies HttpOnly, Secure, SameSite=Lax con tokens firmados con HMAC SHA-256.
 * 2. Expiración estricta por inactividad: 15 min para cajeros, 30 min para administradores.
 * 3. Expiración absoluta: 8 horas para cajeros, 12 horas para administradores.
 * 4. Control de sesión única por dispositivo (Single Active Session) para cajeros.
 * 5. Costo $0.00 en cuota Spark de Firebase Firestore.
 */

export const STAFF_SESSION_COOKIE_NAME = 'sugar_staff_session'

// Tiempos de inactividad (Idle Timeouts)
export const CASHIER_IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutos
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000   // 30 minutos

// Tiempos máximos absolutos de sesión (Max Session Life)
export const CASHIER_MAX_SESSION_MS = 8 * 60 * 60 * 1000  // 8 horas
export const ADMIN_MAX_SESSION_MS = 12 * 60 * 60 * 1000   // 12 horas

export const SESSION_CONFIG = {
  cashierIdleTimeoutMs: CASHIER_IDLE_TIMEOUT_MS,
  adminIdleTimeoutMs: ADMIN_IDLE_TIMEOUT_MS,
  cashierMaxLifeSeconds: Math.floor(CASHIER_MAX_SESSION_MS / 1000),
  adminMaxLifeSeconds: Math.floor(ADMIN_MAX_SESSION_MS / 1000)
}

export interface StaffSessionPayload {
  sessionId: string
  uid: string
  role: StaffRole
  email: string
  name: string
  accountType: 'admin' | 'cashier'
  createdAt: number
  lastActiveAt: number
  expiresAt: number
  maxExpiresAt: number
  twoFactorVerified?: boolean
  deviceId?: string
}

export interface SessionVerificationResult {
  valid: boolean
  payload?: StaffSessionPayload
  error?: 'expired_idle' | 'expired_absolute' | 'invalid_signature' | 'malformed' | 'superseded'
  message?: string
}

// Almacén en memoria de sesiones activas concurrentes (Single Session Control)
// Mapea uid -> activeSessionId
const activeCashierSessions = new Map<string, { sessionId: string; updatedAt: number }>()

/**
 * Obtiene la clave secreta para la firma HMAC de sesiones
 */
function getSessionSecretKey(): string {
  return (
    process.env.STAFF_SESSION_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    'sugar_ludo_staff_hmac_secret_production_v984_fixed_seed'
  )
}

/**
 * Genera un identificador único de sesión
 */
export function generateSessionId(): string {
  const random = crypto.randomBytes(16).toString('hex')
  return `sess_${Date.now()}_${random}`
}

/**
 * Crea y firma criptográficamente un token de sesión de Staff con HMAC SHA-256
 */
export function createStaffSessionToken(
  params: {
    uid: string
    role: StaffRole
    email: string
    name?: string
    sessionId?: string
    accountType?: 'admin' | 'cashier'
    deviceId?: string
    twoFactorVerified?: boolean
  }
): { token: string; payload: StaffSessionPayload } {
  const now = Date.now()
  const accountType = params.accountType || (params.role === 'cashier' ? 'cashier' : 'admin')
  const idleTimeout = accountType === 'cashier' ? CASHIER_IDLE_TIMEOUT_MS : ADMIN_IDLE_TIMEOUT_MS
  const maxSession = accountType === 'cashier' ? CASHIER_MAX_SESSION_MS : ADMIN_MAX_SESSION_MS

  const payload: StaffSessionPayload = {
    sessionId: params.sessionId || generateSessionId(),
    uid: params.uid,
    role: params.role,
    email: params.email,
    name: params.name || params.email.split('@')[0],
    accountType,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: now + idleTimeout,
    maxExpiresAt: now + maxSession,
    twoFactorVerified: params.twoFactorVerified ?? false,
    deviceId: params.deviceId
  }

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const hmac = crypto.createHmac('sha256', getSessionSecretKey())
  hmac.update(payloadBase64)
  const signature = hmac.digest('base64url')

  const token = `${payloadBase64}.${signature}`
  return { token, payload }
}

/**
 * Verifica la firma criptográfica, inactividad y vigencia de un token de sesión
 */
export function verifyStaffSessionToken(token: string): SessionVerificationResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'malformed', message: 'Token de sesión ausente o vacío.' }
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'malformed', message: 'Estructura de token de sesión inválida.' }
  }

  const [payloadBase64, providedSignature] = parts

  // 1. Verificación en tiempo constante de la firma HMAC
  const hmac = crypto.createHmac('sha256', getSessionSecretKey())
  hmac.update(payloadBase64)
  const expectedSignature = hmac.digest('base64url')

  const providedBuf = Buffer.from(providedSignature)
  const expectedBuf = Buffer.from(expectedSignature)

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, error: 'invalid_signature', message: 'Firma de sesión inválida o adulterada.' }
  }

  // 2. Decodificación de payload
  let payload: StaffSessionPayload
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'))
  } catch {
    return { valid: false, error: 'malformed', message: 'Payload de sesión ilegible.' }
  }

  const now = Date.now()

  // 3. Expiración absoluta
  if (now > payload.maxExpiresAt) {
    return {
      valid: false,
      payload,
      error: 'expired_absolute',
      message: 'La sesión ha expirado (límite máximo alcanzado). Inicie sesión nuevamente.'
    }
  }

  // 4. Expiración por inactividad
  const idleTimeout = payload.accountType === 'cashier' ? CASHIER_IDLE_TIMEOUT_MS : ADMIN_IDLE_TIMEOUT_MS
  if (now - payload.lastActiveAt > idleTimeout) {
    return {
      valid: false,
      payload,
      error: 'expired_idle',
      message: `La sesión ha expirado por inactividad (${payload.accountType === 'cashier' ? '15' : '30'} minutos).`
    }
  }

  // 5. Control de sesión única activa para cajeros
  if (payload.accountType === 'cashier') {
    const active = activeCashierSessions.get(payload.uid)
    if (active && active.sessionId !== payload.sessionId) {
      return {
        valid: false,
        payload,
        error: 'superseded',
        message: 'Sesión invalidada: Se ha iniciado sesión desde otro dispositivo o navegador.'
      }
    }
  }

  return { valid: true, payload }
}

/**
 * Registra una sesión de cajero como la única activa concurrente
 */
export function registerActiveCashierSession(uid: string, sessionId: string): void {
  activeCashierSessions.set(uid, { sessionId, updatedAt: Date.now() })
}

/**
 * Invalida cualquier sesión previa de un operador
 */
export function revokeStaffSession(uid: string): void {
  activeCashierSessions.delete(uid)
}

/**
 * Desregistra una sesión de cajero (alias explícito)
 */
export function unregisterActiveCashierSession(uid: string): void {
  activeCashierSessions.delete(uid)
}

/**
 * Parsea una cabecera Cookie cruda y extrae el token de staff
 */
export function parseStaffSessionCookie(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${STAFF_SESSION_COOKIE_NAME}=([^;]+)`))
  return match ? decodeURIComponent(match[1].trim()) : null
}

/**
 * Construye la cabecera Set-Cookie para la sesión HttpOnly
 */
export function buildStaffSessionCookie(
  token: string,
  options?: { maxAgeSeconds?: number; isProduction?: boolean }
): string {
  const isProd = options?.isProduction ?? (process.env.NODE_ENV === 'production')
  const maxAge = options?.maxAgeSeconds ?? Math.floor(ADMIN_MAX_SESSION_MS / 1000)

  const flags = [
    `${STAFF_SESSION_COOKIE_NAME}=${token}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `HttpOnly`,
    `SameSite=Lax`
  ]

  if (isProd) {
    flags.push('Secure')
  }

  return flags.join('; ')
}

/**
 * Construye la cabecera Set-Cookie para purgar/limpiar la sesión
 */
export function buildClearStaffSessionCookie(isProduction?: boolean): string {
  const isProd = isProduction ?? (process.env.NODE_ENV === 'production')
  const flags = [
    `${STAFF_SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `Max-Age=0`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `HttpOnly`,
    `SameSite=Lax`
  ]
  if (isProd) {
    flags.push('Secure')
  }
  return flags.join('; ')
}

/**
 * Extrae el token de la cookie de sesión de una petición Request
 */
export function extractStaffSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || ''
  return parseStaffSessionCookie(cookieHeader)
}
