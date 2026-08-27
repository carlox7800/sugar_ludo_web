import { NextResponse } from 'next/server'
import { approveDepositOrder } from '@/lib/atomic-transactions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const body = await request.json()
    const { action, cashierUid, referenceNumber, actorUid, actorRole } = body

    if (action === 'approve_deposit') {
      const result = await approveDepositOrder({
        orderId,
        cashierUid: cashierUid || 'csh_carlosandroid_001',
        referenceNumber,
        actorUid: actorUid || 'csh_carlosandroid_001',
        actorRole: actorRole || 'cashier'
      })
      return NextResponse.json({ success: true, message: result.message })
    }

    return NextResponse.json({ success: false, error: 'Acción no soportada' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
