import { NextResponse } from 'next/server'
import {
  parseStaffSessionCookie,
  verifyStaffSessionToken,
  revokeStaffSession,
  revokeAdminSession,
  revokeCashierSession,
  unregisterActiveCashierSession,
  buildClearStaffSessionCookie,
  buildClearAdminSessionCookie,
  buildClearCashierSessionCookie,
  CASHIER_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME
} from '@/lib/session-manager'

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie'
    }
  })
}

/**
 * Cierre de sesión de Staff seguro segregado por rol (Fase 1 & Fase 2).
 * Invalida la sesión activa en el servidor, remueve registro de concurrencia
 * y expira de forma definitiva la cookie HttpOnly en el cliente.
 */
export async function POST(request: Request) {
  try {
    let targetRole: 'admin' | 'cashier' | undefined
    try {
      const body = await request.json().catch(() => null)
      if (body?.role === 'cashier' || body?.role === 'admin') {
        targetRole = body.role
      }
    } catch {}

    if (!targetRole) {
      const url = new URL(request.url, 'http://localhost')
      const rParam = url.searchParams.get('role')
      if (rParam === 'cashier' || rParam === 'admin') {
        targetRole = rParam
      }
    }

    const cookieHeader = request.headers.get('cookie')
    const preferredCookie = targetRole === 'cashier'
      ? CASHIER_SESSION_COOKIE_NAME
      : (targetRole === 'admin' ? ADMIN_SESSION_COOKIE_NAME : undefined)

    const rawToken = parseStaffSessionCookie(cookieHeader, preferredCookie)

    if (rawToken) {
      const decoded = verifyStaffSessionToken(rawToken, targetRole)
      if (decoded.valid && decoded.payload) {
        if (targetRole === 'cashier' || decoded.payload.role === 'cashier' || decoded.payload.accountType === 'cashier') {
          revokeCashierSession(decoded.payload.uid)
        } else if (targetRole === 'admin') {
          revokeAdminSession(decoded.payload.uid)
        } else {
          revokeStaffSession(decoded.payload.uid)
        }
      }
    }

    const response = NextResponse.json(
      { success: true, message: 'Sesión finalizada correctamente.' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )

    // Purgar cookie HttpOnly correspondiente
    if (targetRole === 'cashier') {
      response.headers.set('Set-Cookie', buildClearCashierSessionCookie())
    } else if (targetRole === 'admin') {
      response.headers.set('Set-Cookie', buildClearAdminSessionCookie())
    } else {
      response.headers.set('Set-Cookie', buildClearAdminSessionCookie())
      response.headers.append('Set-Cookie', buildClearCashierSessionCookie())
      response.headers.append('Set-Cookie', buildClearStaffSessionCookie())
    }

    return response
  } catch (err: any) {
    const response = NextResponse.json(
      { success: true, message: 'Sesión finalizada.' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
    response.headers.set('Set-Cookie', buildClearStaffSessionCookie())
    return response
  }
}
