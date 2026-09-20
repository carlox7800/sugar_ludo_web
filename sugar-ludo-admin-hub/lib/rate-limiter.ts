import { NextResponse } from 'next/server.js'

/**
 * ============================================================================
 * MOTOR DE RATE LIMITING DISTRIBUIDO EN MEMORIA (SLIDING WINDOW COUNTER)
 * ============================================================================
 * Proporciona mitigación anti-DDoS, anti-fuerza bruta y anti-spam sin costo
 * de infraestructura ($0.00 / mes en cuota Spark / Render).
 *
 * Características:
 * - Algoritmo: Sliding Window Counter con ponderación temporal precisa.
 * - Auto-GC: Purga automática periódica para respetar el límite de 512 MB RAM.
 * - Resolución de IP segura: cf-connecting-ip -> x-forwarded-for -> x-real-ip.
 * - Cabeceras estándar IETF / RFC 6585: Retry-After, X-RateLimit-*.
 */

export type RateLimitTier =
  | 'tier1_financial'
  | 'tier2_orders_chat'
  | 'tier3_staff_auth'
  | 'tier4_reads_polling'

export interface TierConfig {
  windowMs: number
  maxRequests: number
  retryAfterSeconds: number
  description: string
}

export interface RateLimitCheckResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter: number
}

interface WindowEntry {
  previousCount: number
  currentCount: number
  windowStart: number
  lastUpdated: number
}

export const RATE_LIMIT_TIERS: Record<RateLimitTier, TierConfig> = {
  tier1_financial: {
    windowMs: 60_000,
    maxRequests: 20,
    retryAfterSeconds: 30,
    description: 'Mutaciones financieras y atómicas (acciones de órdenes, tesorería, disputas)'
  },
  tier2_orders_chat: {
    windowMs: 60_000,
    maxRequests: 40,
    retryAfterSeconds: 15,
    description: 'Creación de órdenes y mensajería en tiempo real'
  },
  tier3_staff_auth: {
    windowMs: 60_000,
    maxRequests: 15,
    retryAfterSeconds: 60,
    description: 'Autenticación y administración de operadores'
  },
  tier4_reads_polling: {
    windowMs: 60_000,
    maxRequests: 120,
    retryAfterSeconds: 10,
    description: 'Lecturas de apoyo, consultas y polling'
  }
}

// Almacén en memoria volátil de proceso Node.js / Edge Runtime
const memoryStore = new Map<string, WindowEntry>()

let lastGcTime = Date.now()
const GC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Purga de entradas expiradas para prevenir fugas de memoria en contenedores de 512 MB.
 */
function runGarbageCollection(now: number): void {
  if (now - lastGcTime < GC_INTERVAL_MS) return
  lastGcTime = now

  const expirationThreshold = now - 120_000 // Inactivas por más de 2 ventanas
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.lastUpdated < expirationThreshold) {
      memoryStore.delete(key)
    }
  }
}

// Activación de timer en segundo plano si el runtime lo soporta
if (typeof setInterval !== 'undefined') {
  try {
    const timer = setInterval(() => {
      runGarbageCollection(Date.now())
    }, GC_INTERVAL_MS)
    if (timer && typeof timer.unref === 'function') {
      timer.unref()
    }
  } catch {
    // Si el entorno no soporta unref, la recolección perezosa garantiza la limpieza
  }
}

/**
 * Resuelve la IP real del cliente detrás de Cloudflare y los reverse proxies de Render.
 */
export function getClientIp(headers: Headers): string {
  // 1. Cloudflare Connecting IP
  const cfIp = headers.get('cf-connecting-ip')
  if (cfIp && cfIp.trim().length > 0) {
    return cfIp.trim()
  }

  // 2. X-Forwarded-For (el primer elemento antes de la coma es el cliente original)
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    const clientIp = forwardedFor.split(',')[0].trim()
    if (clientIp.length > 0) {
      return clientIp
    }
  }

  // 3. X-Real-IP
  const realIp = headers.get('x-real-ip')
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim()
  }

  // 4. Fallback seguro
  return '127.0.0.1'
}

/**
 * Clasifica la petición en el Tier correspondiente de acuerdo a su ruta y método HTTP.
 * Retorna null si la ruta está exenta de rate limiting.
 */
export function resolveRateLimitTier(pathname: string, method: string): RateLimitTier | null {
  // Peticiones preflight OPTIONS nunca se limitan
  if (method === 'OPTIONS') return null

  // Endpoints de salud y telemetría (Bypass absoluto para disponibilidad en Render)
  if (
    pathname === '/api/telemetry' ||
    pathname === '/health' ||
    pathname === '/healthz' ||
    pathname === '/ping' ||
    pathname.startsWith('/api/health')
  ) {
    return null
  }

  // Tier 1: Financiero / Mutaciones atómicas críticas
  if (
    pathname.includes('/action') ||
    pathname.startsWith('/api/admin/treasury/') ||
    pathname.startsWith('/api/disputes/resolve')
  ) {
    return 'tier1_financial'
  }

  // Tier 3: Autenticación de Staff / Prevención de fuerza bruta
  if (
    pathname.startsWith('/api/staff/auth') ||
    pathname.startsWith('/api/auth')
  ) {
    return 'tier3_staff_auth'
  }

  // Tier 2: Creación de órdenes y mensajes de chat
  if (
    method === 'POST' &&
    (
      pathname === '/api/cashier/orders' ||
      pathname.includes('/message') ||
      pathname === '/api/chat/messages'
    )
  ) {
    return 'tier2_orders_chat'
  }

  // Tier 4: Lecturas, consultas y polling de respaldo en /api/*
  if (pathname.startsWith('/api/')) {
    return 'tier4_reads_polling'
  }

  return null
}

/**
 * Verifica y actualiza la cuota de la ventana deslizante para un identificador e IP dados.
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier
): RateLimitCheckResult {
  const config = RATE_LIMIT_TIERS[tier]
  const now = Date.now()
  runGarbageCollection(now)

  const key = `${tier}:${identifier}`
  let entry = memoryStore.get(key)

  if (!entry) {
    entry = {
      previousCount: 0,
      currentCount: 1,
      windowStart: now,
      lastUpdated: now,
    }
    memoryStore.set(key, entry)
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: Math.ceil((now + config.windowMs) / 1000),
      retryAfter: 0,
    }
  }

  const elapsed = now - entry.windowStart

  // Más de 2 ventanas de tiempo transcurridas -> reinicio completo
  if (elapsed >= 2 * config.windowMs) {
    entry.previousCount = 0
    entry.currentCount = 1
    entry.windowStart = now
    entry.lastUpdated = now
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: Math.ceil((now + config.windowMs) / 1000),
      retryAfter: 0,
    }
  }

  // 1 ventana transcurrida -> deslizar ventana
  if (elapsed >= config.windowMs) {
    entry.previousCount = entry.currentCount
    entry.currentCount = 1
    entry.windowStart = entry.windowStart + config.windowMs
    entry.lastUpdated = now

    const newElapsed = now - entry.windowStart
    const weight = Math.max(0, 1 - (newElapsed / config.windowMs))
    const estimatedCount = entry.currentCount + (entry.previousCount * weight)

    const remaining = Math.max(0, Math.floor(config.maxRequests - estimatedCount))
    const isAllowed = estimatedCount <= config.maxRequests

    return {
      allowed: isAllowed,
      limit: config.maxRequests,
      remaining,
      resetTime: Math.ceil((entry.windowStart + config.windowMs) / 1000),
      retryAfter: isAllowed ? 0 : config.retryAfterSeconds,
    }
  }

  // Misma ventana de tiempo: interpolar recuento previo con el actual
  const weight = Math.max(0, 1 - (elapsed / config.windowMs))
  const estimatedCount = entry.currentCount + (entry.previousCount * weight)

  if (estimatedCount >= config.maxRequests) {
    entry.lastUpdated = now
    const resetTime = Math.ceil((entry.windowStart + config.windowMs) / 1000)
    const retryAfter = Math.max(
      1,
      Math.min(config.retryAfterSeconds, Math.ceil((entry.windowStart + config.windowMs - now) / 1000))
    )
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime,
      retryAfter,
    }
  }

  entry.currentCount += 1
  entry.lastUpdated = now
  const newEstimated = entry.currentCount + (entry.previousCount * weight)
  const remaining = Math.max(0, Math.floor(config.maxRequests - newEstimated))

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining,
    resetTime: Math.ceil((entry.windowStart + config.windowMs) / 1000),
    retryAfter: 0,
  }
}

/**
 * Genera una respuesta estándar HTTP 429 Too Many Requests con cabeceras completas.
 */
export function createRateLimitResponse(result: RateLimitCheckResult): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Demasiadas solicitudes. Límite de tasa excedido para esta operación.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetTime),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  )
}

/**
 * Inyecta las cabeceras X-RateLimit-* en una respuesta existente.
 */
export function applyRateLimitHeaders(response: NextResponse, result: RateLimitCheckResult): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset', String(result.resetTime))
  return response
}
