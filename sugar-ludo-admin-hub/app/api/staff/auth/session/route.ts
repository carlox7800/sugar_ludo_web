import { NextResponse } from 'next/server'
import { admin, adminAuth, adminDb, hasAdminCredentials } from '@/lib/firebase-admin'

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

/**
 * Autenticación oficial de Staff (Admin & Cajeros) mediante Firebase Admin SDK.
 * Emite un Custom Token firmado criptográficamente para iniciar sesión en Firebase Auth.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { identifier, password, role } = body || {}

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Credenciales incompletas (identifier y password requeridos).' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const cleanId = String(identifier).trim().toLowerCase()
    const cleanPass = String(password).trim()
    const requestedRole = (role === 'cashier' ? 'cashier' : 'admin')

    let matchedProfile: any = null

    // 1. Buscar en Firestore (staff_profiles o cashier_profiles)
    if (requestedRole === 'cashier') {
      if (adminDb && adminDb.collection) {
        try {
          const snap = await adminDb.collection('cashier_profiles').where('email', '==', cleanId).limit(1).get()
          if (!snap.empty) {
            matchedProfile = snap.docs[0].data()
          }
        } catch {}
      }
      // Cuenta de respaldo autorizada para cajeros iniciales
      if (!matchedProfile && cleanId === 'carlos.cajero@sugarludo.com') {
        matchedProfile = {
          uid: 'csh_carlosandroid_001',
          email: 'carlos.cajero@sugarludo.com',
          name: 'carlosandroid (Cajero)',
          displayName: 'carlosandroid (Cajero)',
          role: 'cashier',
          accountType: 'cashier',
          isActive: true
        }
      }
    } else {
      if (adminDb && adminDb.collection) {
        try {
          const snap = await adminDb.collection('staff_profiles').where('email', '==', cleanId).limit(1).get()
          if (!snap.empty) {
            matchedProfile = snap.docs[0].data()
          }
        } catch {}
      }
      // Cuenta de respaldo autorizada para Super Admin inicial
      if (!matchedProfile && (cleanId === 'admin@sugarludo.com' || cleanId === 'superadmin')) {
        matchedProfile = {
          uid: 'adm_super_carlos_001',
          email: 'admin@sugarludo.com',
          displayName: 'Carlos (Super Admin)',
          role: 'super_admin',
          accountType: 'admin',
          isActive: true
        }
      }
    }

    if (!matchedProfile || matchedProfile.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Usuario o correo no autorizado o cuenta inactiva.' },
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // 2. Validación de contraseña
    const expectedPass = matchedProfile.password || (requestedRole === 'cashier' ? 'CajeroSugar2026!' : 'SugarAdmin2026!')
    if (cleanPass !== expectedPass) {
      return NextResponse.json(
        { success: false, error: 'Contraseña incorrecta. Verifique sus credenciales.' },
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // 3. Generación de Custom Token con Firebase Admin SDK
    if (!adminAuth) {
      return NextResponse.json(
        { success: false, error: 'Servicio de autenticación administrativa no disponible en el servidor.' },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const targetEmail = matchedProfile.email || `${matchedProfile.uid}@sugarludo.com`
    let authUserRecord: any = null

    try {
      authUserRecord = await adminAuth.getUserByEmail(targetEmail)
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.message?.includes('no user record')) {
        authUserRecord = await adminAuth.createUser({
          uid: matchedProfile.uid,
          email: targetEmail,
          displayName: matchedProfile.displayName || matchedProfile.name || 'Staff',
          emailVerified: true
        })
      } else {
        throw e
      }
    }

    // Inyectar Custom Claims autoritativos
    await adminAuth.setCustomUserClaims(authUserRecord.uid, {
      role: matchedProfile.role,
      accountType: matchedProfile.accountType || requestedRole,
      staffUid: matchedProfile.uid,
      isActive: true
    })

    // Generar Custom Token firmado por Firebase Admin
    const customToken = await adminAuth.createCustomToken(authUserRecord.uid, {
      role: matchedProfile.role,
      accountType: matchedProfile.accountType || requestedRole,
      email: targetEmail
    })

    return NextResponse.json(
      {
        success: true,
        customToken,
        profile: {
          uid: matchedProfile.uid,
          email: targetEmail,
          displayName: matchedProfile.displayName || matchedProfile.name || 'Staff',
          role: matchedProfile.role,
          accountType: matchedProfile.accountType || requestedRole
        }
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error procesando autenticación' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}
