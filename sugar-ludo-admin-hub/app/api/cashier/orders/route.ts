import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { CashierOrder } from '@/types/cashier'
import { MOCK_ORDERS } from '@/lib/mock-data'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const cashierUid = searchParams.get('cashierUid')

    let ordersList: CashierOrder[] = []

    // 1. Intentar consultar órdenes reales activas en Firestore (con límite de 25 para $0.00 lecturas)
    if (adminDb && adminDb.collection) {
      try {
        let query: any = adminDb.collection('cashier_orders').limit(25)

        if (status && status !== 'all') {
          query = query.where('status', '==', status)
        }
        if (type && type !== 'all') {
          query = query.where('type', '==', type)
        }
        if (cashierUid && cashierUid !== 'all') {
          query = query.where('cashierUid', '==', cashierUid)
        }

        const snapshot = await query.get()
        if (!snapshot.empty) {
          snapshot.forEach((doc: any) => {
            ordersList.push({ id: doc.id, ...doc.data() } as CashierOrder)
          })
        }
      } catch (dbErr: any) {
        console.warn('[CashierOrdersAPI] Firestore query notice:', dbErr.message)
      }
    }

    // 2. Si no hay registros en Firestore, usar fallback de mock-data (que ahora es [])
    if (ordersList.length === 0 && MOCK_ORDERS.length > 0) {
      ordersList = [...MOCK_ORDERS]
      if (status && status !== 'all') {
        ordersList = ordersList.filter(o => o.status === status)
      }
      if (type && type !== 'all') {
        ordersList = ordersList.filter(o => o.type === type)
      }
    }

    return NextResponse.json({
      success: true,
      orders: ordersList,
      totalCount: ordersList.length
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
