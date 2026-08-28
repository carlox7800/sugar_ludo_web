import { NextResponse } from 'next/server'
import { admin, adminDb } from '@/lib/firebase-admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid, role, accountType } = body

    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID requerido' }, { status: 400 })
    }

    // 1. Eliminar de Firebase Auth
    try {
      if (admin && admin.auth && typeof admin.auth === 'function') {
        await admin.auth().deleteUser(uid)
      }
    } catch (authErr: any) {
      console.warn('[StaffAuth] Firebase Auth delete notice:', authErr.message)
    }

    // 2. Eliminar de Firestore
    try {
      if (adminDb && adminDb.collection) {
        const collectionName = accountType === 'cashier' || role === 'cashier' ? 'cashier_profiles' : 'staff_profiles'
        await adminDb.collection(collectionName).doc(uid).delete()
      }
    } catch (dbErr: any) {
      console.warn('[StaffAuth] Firestore delete notice:', dbErr.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Cuenta eliminada permanentemente del sistema.'
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
