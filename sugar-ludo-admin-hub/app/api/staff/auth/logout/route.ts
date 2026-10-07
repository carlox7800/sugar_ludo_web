import { NextResponse } from 'next/server'
import {
  parseStaffSessionCookie,
  verifyStaffSessionToken,
  revokeStaffSession,
  unregisterActiveCashierSession,
  buildClearStaffSessionCookie
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
 * Cierre de sesión de Staff seguro (Fase 1).
 * Invalida la sesión activa en el servidor, remueve registro de concurrencia
 * y expira de forma definitiva la cookie HttpOnly en el cliente.
 */
export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const rawToken = parseStaffSessionCookie(cookieHeader)

    if (rawToken) {
      const decoded = verifyStaffSessionToken(rawToken)
      if (decoded.valid && decoded.payload) {
        revokeStaffSession(decoded.payload.uid)
        if (decoded.payload.role === 'cashier' || decoded.payload.accountType === 'cashier') {
          unregisterActiveCashierSession(decoded.payload.uid)
        }
      }
    }

    const response = NextResponse.json(
      { success: true, message: 'Sesión finalizada correctamente.' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )

    // Purgar cookie HttpOnly
    response.headers.set('Set-Cookie', buildClearStaffSessionCookie())

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
