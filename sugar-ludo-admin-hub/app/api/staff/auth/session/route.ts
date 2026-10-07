import { NextResponse } from 'next/server'
import { admin, adminAuth, adminDb, hasAdminCredentials } from '@/lib/firebase-admin'
import { verifyPassword, hashPassword } from '@/lib/password-hasher'
import {
  createStaffSessionToken,
  buildStaffSessionCookie,
  registerActiveCashierSession,
  generateSessionId,
  SESSION_CONFIG
} from '@/lib/session-manager'
import { verifyTOTPCode } from '@/lib/two-factor-auth'

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
 * Emite un Custom Token firmado criptográficamente para iniciar sesión en Firebase Auth,
 * además de una Cookie HttpOnly de sesión segura con control de concurrencia e inactividad.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { identifier, password, role, totpCode } = body || {}

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

    // 2.1 Verificación de 2FA (TOTP) si la cuenta lo tiene habilitado
    if (matchedProfile.twoFactorEnabled) {
      if (!totpCode) {
        return NextResponse.json(
          {
            success: true,
            requires2FA: true,
            message: 'Se requiere código de autenticación en dos pasos (2FA).',
            uid: matchedProfile.uid
          },
          { headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }

      const isValidTOTP = verifyTOTPCode(String(totpCode).trim(), matchedProfile.twoFactorSecret || '')
      if (!isValidTOTP) {
        return NextResponse.json(
          { success: false, error: 'Código 2FA incorrecto o expirado.' },
          { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
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
    const resolvedAccountType = matchedProfile.accountType || requestedRole
    await adminAuth.setCustomUserClaims(authUserRecord.uid, {
      role: matchedProfile.role,
      accountType: resolvedAccountType,
      staffUid: matchedProfile.uid,
      isActive: true
    })

    // Generar Custom Token firmado por Firebase Admin
    const customToken = await adminAuth.createCustomToken(authUserRecord.uid, {
      role: matchedProfile.role,
      accountType: resolvedAccountType,
      email: targetEmail
    })

    // 4. Creación de Sesión Segura HttpOnly y Control de Dispositivos (Fase 1)
    const sessionId = generateSessionId()
    const isCashier = matchedProfile.role === 'cashier' || requestedRole === 'cashier'

    // Control de sesión única activa para cajeros
    if (isCashier) {
      registerActiveCashierSession(matchedProfile.uid, sessionId)
    }

    const sessionResult = createStaffSessionToken({
      sessionId,
      uid: matchedProfile.uid,
      name: matchedProfile.displayName || matchedProfile.name || 'Staff',
      email: targetEmail,
      role: matchedProfile.role,
      accountType: resolvedAccountType
    })

    const cookieHeader = buildStaffSessionCookie(sessionResult.token)
    const maxAgeSeconds = isCashier ? SESSION_CONFIG.cashierMaxLifeSeconds : SESSION_CONFIG.adminMaxLifeSeconds

    const response = NextResponse.json(
      {
        success: true,
        customToken,
        sessionId,
        expiresIn: maxAgeSeconds,
        idleTimeoutMinutes: isCashier ? 15 : 30,
        profile: {
          uid: matchedProfile.uid,
          email: targetEmail,
          displayName: matchedProfile.displayName || matchedProfile.name || 'Staff',
          role: matchedProfile.role,
          accountType: resolvedAccountType
        }
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )

    // Inyectar Set-Cookie para transporte seguro HttpOnly
    response.headers.set('Set-Cookie', cookieHeader)

    return response
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error procesando autenticación' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}
