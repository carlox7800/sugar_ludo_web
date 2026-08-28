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

    // 1. Intentar consultar órdenes reales en Firestore vía adminDb
    if (adminDb && adminDb.collection) {
      try {
        let query: any = adminDb.collection('cashier_orders').limit(50)

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
        if (snapshot && !snapshot.empty) {
          snapshot.forEach((doc: any) => {
            ordersList.push({ id: doc.id, ...doc.data() } as CashierOrder)
          })
        }
      } catch (dbErr: any) {
        console.warn('[CashierOrdersAPI] Firestore adminDb query notice:', dbErr.message)
      }
    }

    // 2. Si adminDb no trajo registros (ej. en desarrollo local sin service account), consultar Firestore REST API directa
    if (ordersList.length === 0) {
      try {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
        const firestoreRestUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cashier_orders`
        
        const res = await fetch(firestoreRestUrl, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.documents && Array.isArray(data.documents)) {
            ordersList = data.documents.map((docItem: any) => {
              const fields = docItem.fields || {}
              const parseField = (val: any) => {
                if (!val) return undefined
                if (val.stringValue !== undefined) return val.stringValue
                if (val.integerValue !== undefined) return parseInt(val.integerValue, 10)
                if (val.doubleValue !== undefined) return parseFloat(val.doubleValue)
                if (val.booleanValue !== undefined) return val.booleanValue
                return undefined
              }

              const docId = docItem.name ? docItem.name.split('/').pop() : ''
              return {
                id: parseField(fields.id) || docId,
                type: parseField(fields.type) || 'deposit',
                status: parseField(fields.status) || 'pending',
                playerUid: parseField(fields.playerUid) || '',
                playerName: parseField(fields.playerName) || 'Jugador',
                playerAvatar: parseField(fields.playerAvatar),
                playerPhone: parseField(fields.playerPhone),
                cashierUid: parseField(fields.cashierUid),
                cashierName: parseField(fields.cashierName),
                amountFiat: parseField(fields.amountFiat) || 0,
                currency: parseField(fields.currency) || 'USDT',
                exchangeRate: parseField(fields.exchangeRate) || 100,
                amountSugarCoins: parseField(fields.amountSugarCoins) || 0,
                cashierCommissionCoins: parseField(fields.cashierCommissionCoins) || 0,
                paymentMethod: parseField(fields.paymentMethod) || 'usdt_trc20',
                receiptUrl: parseField(fields.receiptUrl),
                receiptReferenceNumber: parseField(fields.receiptReferenceNumber),
                receiptUploadedAt: parseField(fields.receiptUploadedAt),
                isEscrowLocked: parseField(fields.isEscrowLocked),
                escrowLockedAt: parseField(fields.escrowLockedAt),
                createdAt: parseField(fields.createdAt) || Date.now(),
                expiresAt: parseField(fields.expiresAt) || (Date.now() + 1800000)
              } as CashierOrder
            })

            // Aplicar filtros
            if (status && status !== 'all') {
              ordersList = ordersList.filter(o => o.status === status)
            }
            if (type && type !== 'all') {
              ordersList = ordersList.filter(o => o.type === type)
            }
            if (cashierUid && cashierUid !== 'all') {
              ordersList = ordersList.filter(o => !o.cashierUid || o.cashierUid === cashierUid)
            }
          }
        }
      } catch (restErr: any) {
        console.warn('[CashierOrdersAPI] Firestore REST query notice:', restErr.message)
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
