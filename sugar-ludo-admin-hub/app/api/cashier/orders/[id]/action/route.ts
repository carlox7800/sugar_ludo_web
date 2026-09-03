import { NextResponse } from 'next/server'
import { approveDepositOrder, completeWithdrawalOrder, rechargeCashierFloatAtomics, cancelWithdrawOrderAtomics } from '@/lib/atomic-transactions'
import fs from 'fs'
import path from 'path'
import { CashierOrder } from '@/types/cashier'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'cashier_orders.json')

function updateDiskOrderStatus(orderId: string, status: string, refNum?: string) {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      const orders: CashierOrder[] = JSON.parse(raw || '[]')
      const updated = orders.map(o => o.id === orderId ? {
        ...o,
        status: status as any,
        receiptReferenceNumber: refNum || o.receiptReferenceNumber,
        completedAt: Date.now()
      } : o)
      fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8')
    }
  } catch {}
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const body = await request.json()
    const { action, cashierUid, referenceNumber, txId, payoutTxId, actorUid, actorRole } = body
    const finalRef = payoutTxId || txId || referenceNumber || `TX-${Date.now().toString(36).toUpperCase()}`

    if (action === 'approve_deposit') {
      updateDiskOrderStatus(orderId, 'completed', finalRef)
      try {
        const result = await approveDepositOrder({
          orderId,
          cashierUid: cashierUid || 'csh_carlosandroid_001',
          referenceNumber: finalRef,
          actorUid: actorUid || 'csh_carlosandroid_001',
          actorRole: actorRole || 'cashier'
        })
        return NextResponse.json({ success: true, message: result.message }, { headers: corsHeaders })
      } catch (err: any) {
        console.error('[ActionAPI] approveDepositOrder error:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error al validar depósito' }, { status: 400, headers: corsHeaders })
      }
    }

    if (action === 'complete_withdrawal') {
      try {
        const result = await completeWithdrawalOrder({
          orderId,
          cashierUid: cashierUid || 'csh_carlosandroid_001',
          payoutTxId: finalRef,
          actorUid: actorUid || 'csh_carlosandroid_001',
          actorRole: actorRole || 'cashier'
        })
        updateDiskOrderStatus(orderId, 'completed', finalRef)
        return NextResponse.json({ success: true, message: result.message }, { headers: corsHeaders })
      } catch (err: any) {
        console.error('[ActionAPI] completeWithdrawalOrder error:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error al liquidar el retiro' }, { status: 400, headers: corsHeaders })
      }
    }

    if (action === 'cancel') {
      try {
        const result = await cancelWithdrawOrderAtomics({
          orderId,
          actorUid: actorUid || 'usr_unknown',
          actorRole: actorRole || 'player'
        })
        updateDiskOrderStatus(orderId, 'cancelled')
        return NextResponse.json({ success: true, message: result.message }, { headers: corsHeaders })
      } catch (err: any) {
        console.error('[ActionAPI] cancel order error:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error al cancelar la orden' }, { status: 400, headers: corsHeaders })
      }
    }

    if (action === 'recharge_float') {
      try {
        const { amountUSDT, notes, adminUid, adminName } = body
        const result = await rechargeCashierFloatAtomics({
          cashierUid: cashierUid || 'csh_carlosandroid_001',
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
