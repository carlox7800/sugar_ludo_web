import { NextResponse } from 'next/server'
import {
  approveDepositOrder,
  completeWithdrawalOrder,
  rechargeCashierFloatAtomics,
  cancelWithdrawOrderAtomics,
  cleanFirestorePayload
} from '@/lib/atomic-transactions'
import { verifyStaffAuth } from '@/lib/api-auth-guard'
import { adminDb } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { CashierOrder } from '@/types/cashier'
import {
  canCashierTakeOrder,
  applyOrderLock,
  releaseOrderLock,
  isOrderLockActive,
  checkIdempotency
} from '@/lib/order-state-machine'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key'
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

async function getOrderSnapshot(orderId: string): Promise<CashierOrder | null> {
  if (adminDb && adminDb.collection) {
    try {
      const snap = await adminDb.collection('cashier_orders').doc(orderId).get()
      if (snap.exists) {
        return { id: snap.id, ...snap.data() } as CashierOrder
      }
    } catch {}
  }
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'cashier_orders', orderId))
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as CashierOrder
      }
    } catch {}
  }
  return null
}

async function saveOrderSnapshot(orderId: string, data: Partial<CashierOrder>): Promise<void> {
  const cleaned = cleanFirestorePayload(data as Record<string, unknown>)
  if (adminDb && adminDb.collection) {
    try {
      await adminDb.collection('cashier_orders').doc(orderId).set(cleaned, { merge: true })
      return
    } catch {}
  }
  if (db) {
    try {
      await setDoc(doc(db, 'cashier_orders', orderId), cleaned, { merge: true })
      return
    } catch {}
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyStaffAuth(request, ['cashier', 'admin'])
  if (!authResult.authorized) {
    return authResult.errorResponse!
  }

  try {
    const { id: orderId } = await params
    const body = await request.json()
    const { action, cashierUid, referenceNumber, txId, payoutTxId, actorUid, actorRole, cashierName } = body
    const finalRef = payoutTxId || txId || referenceNumber || `TX-${Date.now().toString(36).toUpperCase()}`

    // Idempotencia: soporte vía encabezado Idempotency-Key o campo en payload
    const idempotencyKey = request.headers.get('idempotency-key') || body.idempotencyKey || undefined

    const effectiveCashierUid = cashierUid || actorUid || authResult.user?.uid || 'csh_carlosandroid_001'
    const effectiveCashierName = cashierName || authResult.user?.name || 'Cajero Oficial'

    // Acción 1: Bloqueo Concurrente / Toma de Orden (Optimistic Locking & TTL)
    if (action === 'take_order') {
      const order = await getOrderSnapshot(orderId)
      if (!order) {
        return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404, headers: corsHeaders })
      }

      const evalTake = canCashierTakeOrder(order, effectiveCashierUid)
      if (!evalTake.canTake) {
        return NextResponse.json(
          {
            success: false,
            code: evalTake.reason || 'ORDER_LOCKED_BY_OTHER_CASHIER',
            error: evalTake.reason === 'ORDER_TERMINATED'
              ? 'La orden ya ha finalizado o fue cancelada'
              : 'La orden está siendo procesada por otro cajero'
          },
          { status: 409, headers: corsHeaders }
        )
      }

      const lockedOrder = applyOrderLock(order, effectiveCashierUid, effectiveCashierName)
      await saveOrderSnapshot(orderId, {
        status: 'assigned',
        lockedByCashierUid: lockedOrder.lockedByCashierUid,
        lockedByCashierName: lockedOrder.lockedByCashierName,
        lockedAt: lockedOrder.lockedAt,
        lockExpiresAt: lockedOrder.lockExpiresAt,
        orderVersion: lockedOrder.orderVersion
      })

      return NextResponse.json(
        { success: true, message: 'Orden tomada con éxito', order: lockedOrder },
        { headers: corsHeaders }
      )
    }

    // Acción 2: Liberar Orden
    if (action === 'release_order') {
      const order = await getOrderSnapshot(orderId)
      if (!order) {
        return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404, headers: corsHeaders })
      }

      const isAdmin = authResult.user?.role?.includes('admin')
      if (order.lockedByCashierUid && order.lockedByCashierUid !== effectiveCashierUid && !isAdmin) {
        return NextResponse.json(
          { success: false, error: 'No tienes permiso para liberar una orden bloqueada por otro cajero' },
          { status: 403, headers: corsHeaders }
        )
      }

      const releasedOrder = releaseOrderLock(order, effectiveCashierUid)
      await saveOrderSnapshot(orderId, {
        status: 'pending',
        lockedByCashierUid: undefined,
        lockedByCashierName: undefined,
        lockedAt: undefined,
        lockExpiresAt: undefined,
        orderVersion: releasedOrder.orderVersion
      })

      return NextResponse.json(
        { success: true, message: 'Orden liberada con éxito', order: releasedOrder },
        { headers: corsHeaders }
      )
    }

    // Acción 3: Aprobar Depósito (con comprobación de idempotencia)
    if (action === 'approve_deposit') {
      try {
        const order = await getOrderSnapshot(orderId)
        if (order) {
          const idemp = checkIdempotency(order, idempotencyKey)
          if (idemp.isDuplicate) {
            return NextResponse.json(
              { success: true, message: 'Depósito previamente aprobado (Idempotente)', status: idemp.status, idempotent: true },
              { headers: corsHeaders }
            )
          }
        }

        const result = await approveDepositOrder({
          orderId,
          cashierUid: effectiveCashierUid,
          referenceNumber: finalRef,
          actorUid: actorUid || effectiveCashierUid,
          actorRole: actorRole || 'cashier',
          idempotencyKey
        })
        return NextResponse.json({ success: true, message: result.message }, { headers: corsHeaders })
      } catch (err: any) {
        console.error('[ActionAPI] approveDepositOrder error:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error al validar depósito' }, { status: 400, headers: corsHeaders })
      }
    }

    // Acción 4: Completar Retiro (con comprobación de bloqueo concurrente e idempotencia)
    if (action === 'complete_withdrawal') {
      try {
        const order = await getOrderSnapshot(orderId)
        if (order) {
          const idemp = checkIdempotency(order, idempotencyKey)
          if (idemp.isDuplicate) {
            return NextResponse.json(
              { success: true, message: 'Retiro previamente liquidado (Idempotente)', status: idemp.status, idempotent: true },
              { headers: corsHeaders }
            )
          }

          if (isOrderLockActive(order) && order.lockedByCashierUid && order.lockedByCashierUid !== effectiveCashierUid) {
            return NextResponse.json(
              {
                success: false,
                code: 'ORDER_LOCKED_BY_OTHER_CASHIER',
                error: 'Esta orden está siendo procesada por otro cajero'
              },
              { status: 409, headers: corsHeaders }
            )
          }
        }

        const result = await completeWithdrawalOrder({
          orderId,
          cashierUid: effectiveCashierUid,
          payoutTxId: finalRef,
          actorUid: actorUid || effectiveCashierUid,
          actorRole: actorRole || 'cashier',
          cashierName: effectiveCashierName,
          idempotencyKey
        })
        return NextResponse.json({ success: true, message: result.message }, { headers: corsHeaders })
      } catch (err: any) {
        console.error('[ActionAPI] completeWithdrawalOrder error:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error al liquidar el retiro' }, { status: 400, headers: corsHeaders })
      }
    }

    // Acción 5: Cancelar orden
    if (action === 'cancel') {
      try {
        const result = await cancelWithdrawOrderAtomics({
          orderId,
          actorUid: actorUid || 'usr_unknown',
          actorRole: actorRole || 'player'
        })
        return NextResponse.json({ success: true, message: result.message }, { headers: corsHeaders })
      } catch (err: any) {
        console.error('[ActionAPI] cancel order error:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error al cancelar la orden' }, { status: 400, headers: corsHeaders })
      }
    }

    // Acción 6: Recarga de Saldo Flotante
    if (action === 'recharge_float') {
      try {
        const { amountUSDT, notes, adminUid, adminName } = body
        const result = await rechargeCashierFloatAtomics({
          cashierUid: effectiveCashierUid,
          amountUSDT: Number(amountUSDT || 0),
          notes: notes || 'Recarga de saldo flotante por Super Admin',
          adminUid: adminUid || actorUid || 'adm_super_001',
          adminName: adminName || 'Super Admin'
        })
        return NextResponse.json({ success: true, message: result.message }, { headers: corsHeaders })
      } catch (err: any) {
        console.error('[ActionAPI] recharge_float error:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error en recarga de saldo flotante' }, { status: 400, headers: corsHeaders })
      }
    }

    return NextResponse.json({ success: false, error: 'Acción no soportada' }, { status: 400, headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}
