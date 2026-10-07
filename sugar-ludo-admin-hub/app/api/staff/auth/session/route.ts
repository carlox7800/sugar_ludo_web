import { NextResponse } from 'next/server'
import { admin, adminAuth, adminDb, hasAdminCredentials } from '@/lib/firebase-admin'
import { verifyPassword, hashPassword } from '@/lib/password-hasher'

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
 * Erradica credenciales hardcodeadas y valida contraseñas con hash criptográfico scrypt.
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
    let profileDocRef: any = null

    // 1. Buscar en Firestore (staff_profiles o cashier_profiles, o system_config)
    if (requestedRole === 'cashier') {
      if (adminDb && adminDb.collection) {
        try {
          const snap = await adminDb.collection('cashier_profiles').where('email', '==', cleanId).limit(1).get()
          if (!snap.empty) {
            matchedProfile = snap.docs[0].data()
            profileDocRef = snap.docs[0].ref
          } else {
            // Intentar por UID
            const docSnap = await adminDb.collection('cashier_profiles').doc(cleanId).get()
            if (docSnap.exists) {
              matchedProfile = docSnap.data()
              profileDocRef = docSnap.ref
            }
          }

          // Respaldo en system_config/cashier_accounts
          if (!matchedProfile) {
            const configDoc = await adminDb.collection('system_config').doc('cashier_accounts').get()
            if (configDoc.exists) {
              const accounts = configDoc.data()?.accounts || []
              const match = accounts.find((a: any) =>
                (a.email && a.email.toLowerCase() === cleanId) ||
                (a.uid && a.uid.toLowerCase() === cleanId) ||
                (a.name && a.name.toLowerCase().includes(cleanId))
              )
              if (match) {
                matchedProfile = match
              }
            }
          }
        } catch (e: any) {
          console.warn('[StaffSession] Error consultando perfil de cajero:', e.message)
        }
      }
    } else {
      if (adminDb && adminDb.collection) {
        try {
          const snap = await adminDb.collection('staff_profiles').where('email', '==', cleanId).limit(1).get()
          if (!snap.empty) {
            matchedProfile = snap.docs[0].data()
            profileDocRef = snap.docs[0].ref
          } else {
            // Intentar por UID o username
            const docSnap = await adminDb.collection('staff_profiles').doc(cleanId).get()
            if (docSnap.exists) {
              matchedProfile = docSnap.data()
              profileDocRef = docSnap.ref
            } else {
              const userSnap = await adminDb.collection('staff_profiles').where('username', '==', cleanId).limit(1).get()
              if (!userSnap.empty) {
                matchedProfile = userSnap.docs[0].data()
                profileDocRef = userSnap.docs[0].ref
              }
            }
          }

          // Respaldo en system_config/admin_accounts
          if (!matchedProfile) {
            const configDoc = await adminDb.collection('system_config').doc('admin_accounts').get()
            if (configDoc.exists) {
              const accounts = configDoc.data()?.accounts || []
              const match = accounts.find((a: any) =>
                (a.email && a.email.toLowerCase() === cleanId) ||
                (a.username && a.username.toLowerCase() === cleanId) ||
                (a.uid && a.uid.toLowerCase() === cleanId)
              )
              if (match) {
                matchedProfile = match
              }
            }
          }
        } catch (e: any) {
          console.warn('[StaffSession] Error consultando perfil de admin:', e.message)
        }
      }
    }

    if (!matchedProfile || matchedProfile.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Usuario o correo no autorizado o cuenta inactiva.' },
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // 2. Validación de contraseña estricta con hash scrypt
    const storedHash = matchedProfile.passwordHash
    const legacyPlain = matchedProfile.password

    let isPasswordValid = false

    if (storedHash) {
      isPasswordValid = verifyPassword(cleanPass, storedHash)
    } else if (legacyPlain) {
      // Migración transparente y segura de contraseña legacy a hash scrypt
      isPasswordValid = (cleanPass === legacyPlain)
      if (isPasswordValid && profileDocRef) {
        try {
          const newHash = hashPassword(cleanPass)
          await profileDocRef.update({
            passwordHash: newHash,
            password: null // Erradicar texto plano en Firestore
          })
        } catch {}
      }
    }

    if (!isPasswordValid) {
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
