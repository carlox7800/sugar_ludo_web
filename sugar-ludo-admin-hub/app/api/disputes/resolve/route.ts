import { NextResponse } from 'next/server'
import { resolveDisputeCaseAtomics } from '@/lib/atomic-transactions'
import { verifyStaffAuth } from '@/lib/api-auth-guard'
import { admin, adminDb } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase'
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore'

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

export async function POST(request: Request) {
  const authResult = await verifyStaffAuth(request, ['admin'])
  if (!authResult.authorized) {
    return authResult.errorResponse!
  }

  try {
    const body = await request.json()
    const { disputeId, verdict, adminUid, adminName, resolutionNotes, compensationCoins, playerUid } = body

    if (!disputeId || !verdict) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos (disputeId, verdict)' },
        { status: 400 }
      )
    }

    const now = Date.now()
    const adminUserUid = adminUid || 'super_admin_01'
    const adminUserName = adminName || 'Super Admin'

    // 1. Casos no financieros: Aclaratoria oficial o Desestimación con auditoría
    if (verdict === 'clarification' || verdict === 'dismiss') {
      const newStatus = verdict === 'dismiss' ? 'dismissed' : 'resolved_player'
      const updatePayload = {
        status: newStatus,
        resolvedBy: adminUserName,
        resolvedByUid: adminUserUid,
        resolvedAt: now,
        resolutionNotes: resolutionNotes || (verdict === 'dismiss' ? 'Reporte desestimado tras verificación de telemetría.' : 'Aclaratoria oficial de soporte emitida.')
      }

      if (adminDb && adminDb.collection) {
        await adminDb.collection('dispute_cases').doc(disputeId).set(updatePayload, { merge: true })
      } else {
        const dRef = doc(db, 'dispute_cases', disputeId)
        await setDoc(dRef, updatePayload, { merge: true })
      }

      return NextResponse.json({
        success: true,
        message: verdict === 'dismiss' ? 'Caso desestimado formalmente.' : 'Aclaratoria oficial registrada.'
      })
    }

    // 2. Compensación de cortesía Goodwill (Goodwill SC por desconexión o fallo)
    if (verdict === 'compensate_goodwill') {
      const amountCoins = Number(compensationCoins || 50)
      let targetPlayerUid = playerUid

      if (!targetPlayerUid) {
        if (adminDb && adminDb.collection) {
          const snap = await adminDb.collection('dispute_cases').doc(disputeId).get()
          if (snap.exists) {
            targetPlayerUid = snap.data()?.playerUid
          }
        }
      }

      const updatePayload = {
        status: 'compensated',
        amountSugarCoins: amountCoins,
        resolvedBy: adminUserName,
        resolvedByUid: adminUserUid,
        resolvedAt: now,
        resolutionNotes: resolutionNotes || `Compensación de cortesía (${amountCoins} SC) acreditada al jugador.`
      }

      if (adminDb && adminDb.collection) {
        await adminDb.collection('dispute_cases').doc(disputeId).set(updatePayload, { merge: true })
        if (targetPlayerUid) {
          const inc = admin?.firestore?.FieldValue?.increment ? admin.firestore.FieldValue.increment(amountCoins) : amountCoins
          await adminDb.collection('users').doc(targetPlayerUid).set({ coins: inc }, { merge: true }).catch(() => {})
        }
      } else {
        const dRef = doc(db, 'dispute_cases', disputeId)
        await setDoc(dRef, updatePayload, { merge: true })
        if (targetPlayerUid) {
          const uRef = doc(db, 'users', targetPlayerUid)
          await updateDoc(uRef, { coins: increment(amountCoins) }).catch(() => {})
        }
      }

      return NextResponse.json({
        success: true,
        message: `Compensación de cortesía de ${amountCoins} SC acreditada exitosamente.`
      })
    }

    // 3. Casos financieros P2P (Favor del Jugador o Favor del Cajero)
    const result = await resolveDisputeCaseAtomics({
      disputeId,
      verdict,
      adminUid: adminUserUid,
      adminName: adminUserName,
      resolutionNotes
    })

    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
