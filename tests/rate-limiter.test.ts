import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkRateLimit,
  resolveRateLimitTier,
  getClientIp,
  createRateLimitResponse,
  RATE_LIMIT_TIERS
} from '../sugar-ludo-admin-hub/lib/rate-limiter.ts'

describe('Suite: Rate Limiter - Sliding Window Counter', () => {
  it('debe tener configurados los 4 tiers con sus cuotas y ventanas exactas', () => {
    assert.equal(RATE_LIMIT_TIERS.tier1_financial.maxRequests, 20)
    assert.equal(RATE_LIMIT_TIERS.tier1_financial.retryAfterSeconds, 30)

    assert.equal(RATE_LIMIT_TIERS.tier2_orders_chat.maxRequests, 40)
    assert.equal(RATE_LIMIT_TIERS.tier2_orders_chat.retryAfterSeconds, 15)

    assert.equal(RATE_LIMIT_TIERS.tier3_staff_auth.maxRequests, 15)
    assert.equal(RATE_LIMIT_TIERS.tier3_staff_auth.retryAfterSeconds, 60)

    assert.equal(RATE_LIMIT_TIERS.tier4_reads_polling.maxRequests, 120)
    assert.equal(RATE_LIMIT_TIERS.tier4_reads_polling.retryAfterSeconds, 10)
  })

  it('debe decrementar remaining y permitir peticiones dentro del límite', () => {
    const testId = `client_allow_${Date.now()}`
    const firstCheck = checkRateLimit(testId, 'tier1_financial')

    assert.equal(firstCheck.allowed, true)
    assert.equal(firstCheck.limit, 20)
    assert.equal(firstCheck.remaining, 19)
    assert.equal(firstCheck.retryAfter, 0)

    const secondCheck = checkRateLimit(testId, 'tier1_financial')
    assert.equal(secondCheck.allowed, true)
    assert.equal(secondCheck.remaining, 18)
  })

  it('debe bloquear con allowed=false y remaining=0 al superar la cuota máxima (Burst)', () => {
    const testId = `client_burst_${Date.now()}`
    const max = RATE_LIMIT_TIERS.tier3_staff_auth.maxRequests // 15

    for (let i = 0; i < max; i++) {
      const res = checkRateLimit(testId, 'tier3_staff_auth')
      assert.equal(res.allowed, true, `Petición ${i + 1} debería ser permitida`)
    }

    // La petición 16 debe ser bloqueada
    const blockedRes = checkRateLimit(testId, 'tier3_staff_auth')
    assert.equal(blockedRes.allowed, false)
    assert.equal(blockedRes.remaining, 0)
    assert.ok(blockedRes.retryAfter > 0)
    assert.ok(blockedRes.resetTime > 0)
  })

  it('debe aislar estrictamente las cuotas entre diferentes clientes e IPs', () => {
    const clientA = `ip_A_${Date.now()}`
    const clientB = `ip_B_${Date.now()}`

    // Saturar cliente A
    for (let i = 0; i < 20; i++) {
      checkRateLimit(clientA, 'tier1_financial')
    }
    const blockedA = checkRateLimit(clientA, 'tier1_financial')
    assert.equal(blockedA.allowed, false)

    // Cliente B debe estar completamente limpio e independiente
    const cleanB = checkRateLimit(clientB, 'tier1_financial')
    assert.equal(cleanB.allowed, true)
    assert.equal(cleanB.remaining, 19)
  })
})

describe('Suite: Clasificación de Tiers y Exenciones (resolveRateLimitTier)', () => {
  it('debe clasificar mutaciones financieras y atómicas en tier1_financial', () => {
    assert.equal(resolveRateLimitTier('/api/cashier/orders/ord_123/action', 'POST'), 'tier1_financial')
    assert.equal(resolveRateLimitTier('/api/cashier/orders/recharge/action', 'POST'), 'tier1_financial')
    assert.equal(resolveRateLimitTier('/api/admin/treasury/reconcile', 'POST'), 'tier1_financial')
    assert.equal(resolveRateLimitTier('/api/admin/treasury/reset', 'POST'), 'tier1_financial')
    assert.equal(resolveRateLimitTier('/api/disputes/resolve', 'POST'), 'tier1_financial')
  })

  it('debe clasificar creación de órdenes y chat en tier2_orders_chat', () => {
    assert.equal(resolveRateLimitTier('/api/cashier/orders', 'POST'), 'tier2_orders_chat')
    assert.equal(resolveRateLimitTier('/api/cashier/orders/ord_123/message', 'POST'), 'tier2_orders_chat')
    assert.equal(resolveRateLimitTier('/api/chat/messages', 'POST'), 'tier2_orders_chat')
  })

  it('debe clasificar endpoints de autenticación de staff en tier3_staff_auth', () => {
    assert.equal(resolveRateLimitTier('/api/staff/auth/create', 'POST'), 'tier3_staff_auth')
    assert.equal(resolveRateLimitTier('/api/staff/auth/delete', 'POST'), 'tier3_staff_auth')
    assert.equal(resolveRateLimitTier('/api/auth/session', 'GET'), 'tier3_staff_auth')
  })

  it('debe clasificar consultas GET y polling de lectura en tier4_reads_polling', () => {
    assert.equal(resolveRateLimitTier('/api/cashier/orders', 'GET'), 'tier4_reads_polling')
    assert.equal(resolveRateLimitTier('/api/cashier/orders/ord_123', 'GET'), 'tier4_reads_polling')
    assert.equal(resolveRateLimitTier('/api/chat/messages', 'GET'), 'tier4_reads_polling')
    assert.equal(resolveRateLimitTier('/api/economy/config', 'GET'), 'tier4_reads_polling')
  })

  it('debe otorgar bypass absoluto (null) a telemetría, health checks y preflights OPTIONS', () => {
    assert.equal(resolveRateLimitTier('/api/telemetry', 'GET'), null)
    assert.equal(resolveRateLimitTier('/health', 'GET'), null)
    assert.equal(resolveRateLimitTier('/healthz', 'GET'), null)
    assert.equal(resolveRateLimitTier('/ping', 'GET'), null)
    assert.equal(resolveRateLimitTier('/api/health', 'GET'), null)
    assert.equal(resolveRateLimitTier('/api/cashier/orders', 'OPTIONS'), null)
    assert.equal(resolveRateLimitTier('/api/admin/treasury/reconcile', 'OPTIONS'), null)
  })
})

describe('Suite: Resolución de IP Cliente y Respuestas HTTP 429', () => {
  it('debe priorizar cf-connecting-ip cuando esté presente', () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.195',
      'x-forwarded-for': '198.51.100.1',
      'x-real-ip': '192.0.2.1'
    })
    assert.equal(getClientIp(headers), '203.0.113.195')
  })

  it('debe extraer el primer salto de x-forwarded-for si cf-connecting-ip no está', () => {
    const headers = new Headers({
      'x-forwarded-for': ' 198.51.100.42 , 10.0.0.1, 172.16.0.1 ',
      'x-real-ip': '192.0.2.1'
    })
    assert.equal(getClientIp(headers), '198.51.100.42')
  })

  it('debe usar x-real-ip como tercer nivel en la cascada', () => {
    const headers = new Headers({
      'x-real-ip': '192.0.2.88'
    })
    assert.equal(getClientIp(headers), '192.0.2.88')
  })

  it('debe hacer fallback seguro a 127.0.0.1 si no hay cabeceras de proxy', () => {
    const headers = new Headers()
    assert.equal(getClientIp(headers), '127.0.0.1')
  })

  it('debe construir una respuesta HTTP 429 estandarizada con cabeceras completas', async () => {
    const mockCheckResult = {
      allowed: false,
      limit: 20,
      remaining: 0,
      resetTime: Math.floor(Date.now() / 1000) + 30,
      retryAfter: 30
    }

    const response = createRateLimitResponse(mockCheckResult)
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Retry-After'), '30')
    assert.equal(response.headers.get('X-RateLimit-Limit'), '20')
    assert.equal(response.headers.get('X-RateLimit-Remaining'), '0')
    assert.equal(response.headers.get('X-RateLimit-Reset'), String(mockCheckResult.resetTime))

    const body = await response.json()
    assert.equal(body.success, false)
    assert.equal(body.code, 'RATE_LIMIT_EXCEEDED')
    assert.equal(body.retryAfter, 30)
  })
})
