import { NextResponse } from 'next/server'
import { authenticateApiStaffRequest } from '@/lib/api-auth-guard'
import { verifyTOTPCode } from '@/lib/two-factor-auth'
import { adminDb } from '@/lib/firebase-admin'

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
 * Confirma y activa la autenticación en dos pasos (2FA) con el primer código válido.
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

  try {
    const body = await request.json()
    const { code, secret } = body || {}

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Código de 6 dígitos requerido.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    let totpSecret = secret
    let recoveryCodes: string[] = []

    if (!totpSecret && adminDb) {
      const snap = await adminDb.collection('staff_profiles').doc(staff.uid).get()
      if (snap.exists) {
        const data = snap.data()
        totpSecret = data?.twoFactorPendingSecret || data?.twoFactorSecret
        recoveryCodes = data?.twoFactorPendingCodes || []
      }
    }

    if (!totpSecret) {
      return NextResponse.json(
        { success: false, error: 'No hay configuración 2FA pendiente. Inicia el proceso de configuración.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const isValid = verifyTOTPCode(String(code).trim(), totpSecret)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Código de autenticación inválido. Revisa tu reloj o aplicación.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // Activar formalmente en Firestore
    if (adminDb) {
      await adminDb.collection('staff_profiles').doc(staff.uid).set({
        twoFactorEnabled: true,
        twoFactorSecret: totpSecret,
        twoFactorRecoveryCodes: recoveryCodes,
        twoFactorPendingSecret: null,
        twoFactorPendingCodes: null,
        twoFactorEnrolledAt: Date.now()
      }, { merge: true })
    }

    return NextResponse.json(
      {
        success: true,
        message: '¡Autenticación en dos pasos (2FA) activada exitosamente!',
        twoFactorEnabled: true
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error validando código 2FA' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}
