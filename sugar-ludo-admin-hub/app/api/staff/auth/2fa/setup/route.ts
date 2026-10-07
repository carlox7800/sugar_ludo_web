import { NextResponse } from 'next/server'
import { authenticateApiStaffRequest } from '@/lib/api-auth-guard'
import { generateTOTPSecret, generateTOTPUri, generateRecoveryCodes } from '@/lib/two-factor-auth'
import { adminDb } from '@/lib/firebase-admin'

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie'
    }
  })
}

/**
 * Genera credenciales para enrolamiento de 2FA (RFC 6238 TOTP).
 * Requiere sesión administrativa activa.
 */
export async function POST(request: Request) {
  const authResult = await authenticateApiStaffRequest(request)
  if (!authResult.authenticated || !authResult.account) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'No autorizado.' },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }

  const staff = authResult.account
  const secret = generateTOTPSecret(20)
  const otpauthUrl = generateTOTPUri(staff.email || 'staff@sugarludo.com', secret, 'Sugar Ludo Admin Hub')
  const recoveryCodes = generateRecoveryCodes(8)

  // Guardar secreto provisional si adminDb está listo
  if (adminDb) {
    try {
      const docRef = adminDb.collection('staff_profiles').doc(staff.uid)
      await docRef.set({
        twoFactorPendingSecret: secret,
        twoFactorPendingCodes: recoveryCodes,
        updatedAt: Date.now()
      }, { merge: true })
    } catch (e: any) {
      console.warn('[2FASetup] Error guardando secreto pendiente:', e.message)
    }
  }

  return NextResponse.json({
    success: true,
    secret,
    otpauthUrl,
    recoveryCodes,
    message: 'Escanea el código QR o ingresa la clave secreta en tu aplicación de autenticación (Google Authenticator, Authy).'
  }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
