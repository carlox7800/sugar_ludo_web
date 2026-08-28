import { NextResponse } from 'next/server'
import { admin, adminDb } from '@/lib/firebase-admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, displayName, role, accountType, initialFloatCoins, phone, idDocument, username } = body

    if (!email || !password || !displayName || !role) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios (email, password, displayName, role)' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanRole = role.trim()

    // 1. Intentar crear usuario en Firebase Auth usando Firebase Admin SDK si está configurado
    let authUid = `staff_${Date.now()}`
    let isCreatedInFirebaseAuth = false

    try {
      if (admin && admin.auth && typeof admin.auth === 'function') {
        const userRecord = await admin.auth().createUser({
          email: cleanEmail,
          password: password,
          displayName: displayName.trim()
        })
        authUid = userRecord.uid
        isCreatedInFirebaseAuth = true

        // Asignar Custom Claim de Rol de forma inmutable en Firebase Auth
        await admin.auth().setCustomUserClaims(authUid, {
          role: cleanRole,
          accountType: accountType || 'admin',
          isActive: true
        })
      }
    } catch (authErr: any) {
      console.warn('[StaffAuth] Firebase Auth Admin SDK notice:', authErr.message)
      // Si el usuario ya existe en Auth, generar UID seguro o continuar
      if (authErr.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { success: false, error: 'Ya existe una cuenta registrada con este correo electrónico.' },
          { status: 400 }
        )
      }
    }

    // 2. Guardar perfil formal en Firestore (colección 'staff_profiles' o 'cashier_profiles')
    const profileData = {
      uid: authUid,
      email: cleanEmail,
      username: username || cleanEmail.split('@')[0],
      displayName: displayName.trim(),
      role: cleanRole,
      accountType: accountType || (cleanRole === 'cashier' ? 'cashier' : 'admin'),
      createdAt: Date.now(),
      lastLoginAt: 0,
      isActive: true,
      ...(accountType === 'cashier' || cleanRole === 'cashier'
        ? {
            name: displayName.trim(),
            floatBalanceCoins: initialFloatCoins || 0,
            shiftStatus: 'off_shift',
            assignedShiftAt: 0,
            lastRechargeAt: Date.now(),
            ordersCompletedToday: 0,
            commissionEarnedTodayCoins: 0,
            paymentMethodsCount: 0,
            phone: phone || '',
            idDocument: idDocument || ''
          }
        : {})
    }

    try {
      if (adminDb && adminDb.collection) {
        const collectionName = cleanRole === 'cashier' ? 'cashier_profiles' : 'staff_profiles'
        await adminDb.collection(collectionName).doc(authUid).set(profileData, { merge: true })
      }
    } catch (dbErr: any) {
      console.warn('[StaffAuth] Firestore write notice:', dbErr.message)
    }

    return NextResponse.json({
      success: true,
      message: `Cuenta de ${cleanRole === 'cashier' ? 'Cajero' : 'Administrador'} creada y autorizada con éxito.`,
      profile: profileData,
      isFirebaseAuth: isCreatedInFirebaseAuth
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
