import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  getClientIp,
  resolveRateLimitTier,
  checkRateLimit,
  createRateLimitResponse,
  applyRateLimitHeaders,
} from './lib/rate-limiter'

/**
 * ============================================================================
 * MIDDLEWARE DE ENRUTAMIENTO POR SUBDOMINIO & RATE LIMITING MULTI-TIER
 * ============================================================================
 * 1. Rate Limiting en memoria para todas las rutas /api/** con mitigación anti-DDoS.
 * 2. Enrutamiento por subdominio (*.sugarludo.com):
 *    - admin.sugarludo.com   -> Enruta internamente a /admin
 *    - cajeros.sugarludo.com -> Enruta internamente a /cashier
 *
 * NOTA: Los dominios de Render (*.onrender.com) y localhost NO reciben
 * rewrite de subdominio — el usuario verá el formulario de login en `/`.
 */

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || 'localhost'

  // 1. MANEJO DE RUTAS DE API (Rate Limiting Multi-Tier)
  if (url.pathname.startsWith('/api')) {
    const tier = resolveRateLimitTier(url.pathname, request.method)
    if (tier) {
      const clientIp = getClientIp(request.headers)
      const limitResult = checkRateLimit(clientIp, tier)

      if (!limitResult.allowed) {
        return createRateLimitResponse(limitResult)
      }

      const response = NextResponse.next()
      return applyRateLimitHeaders(response, limitResult)
    }

    // Ruta de API exenta (telemetría, salud, OPTIONS preflight)
    return NextResponse.next()
  }

  // 2. Rutas públicas y de estáticos (bypass)
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.includes('.') ||
    url.pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // 3. Rewrite de subdominio solo si es un subdominio REAL de producción (sugarludo.com)
  const isProductionDomain = hostname.endsWith('.sugarludo.com')

  if (!isProductionDomain) {
    return NextResponse.next()
  }

  // Detección de subdominio solo para dominios de producción reales
  const isAdminDomain = hostname.startsWith('admin.')
  const isCashierDomain = hostname.startsWith('cajeros.')

  // Redirección inteligente solo para subdominios conocidos
  if (isAdminDomain && !url.pathname.startsWith('/admin')) {
    url.pathname = `/admin${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (isCashierDomain && !url.pathname.startsWith('/cashier')) {
    url.pathname = `/cashier${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
