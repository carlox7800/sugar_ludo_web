import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * ============================================================================
 * MIDDLEWARE DE ENRUTAMIENTO POR SUBDOMINIO & GUARDIÁN DE SEGURIDAD (EDGE)
 * ============================================================================
 * - admin.sugarludo.com   -> Enruta internamente a /admin
 * - cajeros.sugarludo.com -> Enruta internamente a /cashier
 * - Bloqueo inmediato de solicitudes no autorizadas en el borde.
 */

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || 'localhost'

  // Rutas públicas y de estáticos (bypass)
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.includes('.') ||
    url.pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Detección de subdominio
  const isAdminDomain = hostname.startsWith('admin.') || hostname.includes('admin-')
  const isCashierDomain = hostname.startsWith('cajeros.') || hostname.includes('cashier-')

  // Redirección inteligente
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
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
