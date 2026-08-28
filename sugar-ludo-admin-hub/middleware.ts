import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * ============================================================================
 * MIDDLEWARE DE ENRUTAMIENTO POR SUBDOMINIO & GUARDIÁN DE SEGURIDAD (EDGE)
 * ============================================================================
 * - admin.sugarludo.com   -> Enruta internamente a /admin
 * - cajeros.sugarludo.com -> Enruta internamente a /cashier
 * - Bloqueo inmediato de solicitudes no autorizadas en el borde.
 *
 * NOTA: Los dominios de Render (*.onrender.com) y localhost NO reciben
 * rewrite de subdominio — el usuario verá el formulario de login en `/`.
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

  // Solo hacer rewrite si es un subdominio REAL del dominio de producción (sugarludo.com)
  // Excluir Render, localhost y cualquier otro dominio genérico
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
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
