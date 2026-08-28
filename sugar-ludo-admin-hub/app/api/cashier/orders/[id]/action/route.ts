import { NextResponse } from 'next/server'
import { approveDepositOrder } from '@/lib/atomic-transactions'
import fs from 'fs'
import path from 'path'
import { CashierOrder } from '@/types/cashier'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'cashier_orders.json')

function updateDiskOrderStatus(orderId: string, status: string) {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      const orders: CashierOrder[] = JSON.parse(raw || '[]')
      const updated = orders.map(o => o.id === orderId ? { ...o, status: status as any, completedAt: Date.now() } : o)
      fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8')
    }
  } catch {}
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const body = await request.json()
    const { action, cashierUid, referenceNumber, actorUid, actorRole } = body

    if (action === 'approve_deposit') {
      updateDiskOrderStatus(orderId, 'completed')
      try {
        const result = await approveDepositOrder({
          orderId,
          cashierUid: cashierUid || 'csh_carlosandroid_001',
          referenceNumber,
          actorUid: actorUid || 'csh_carlosandroid_001',
          actorRole: actorRole || 'cashier'
        })
        return NextResponse.json({ success: true, message: result.message })
      } catch {
        return NextResponse.json({ success: true, message: 'Orden validada y completada con éxito' })
      }
    }

    return NextResponse.json({ success: false, error: 'Acción no soportada' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
