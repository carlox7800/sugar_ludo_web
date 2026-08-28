import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { CashierOrder } from '@/types/cashier'

// Memoria compartida en el proceso de servidor para recepción instantánea de órdenes locales y en la nube
const liveServerOrders: CashierOrder[] = []

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

    // 2. Si adminDb no trajo registros, consultar Firestore REST API directa
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
          }
        }
      } catch (restErr: any) {
        console.warn('[CashierOrdersAPI] Firestore REST query notice:', restErr.message)
      }
    }

    // 3. Fusionar con las órdenes recibidas en memoria por POST directo
    if (liveServerOrders.length > 0) {
      const existingIds = new Set(ordersList.map(o => o.id))
      for (const liveOrd of liveServerOrders) {
        if (!existingIds.has(liveOrd.id)) {
          ordersList.unshift(liveOrd)
        }
      }
    }

    // 4. Aplicar filtros
    if (status && status !== 'all') {
      ordersList = ordersList.filter(o => o.status === status)
    }
    if (type && type !== 'all') {
      ordersList = ordersList.filter(o => o.type === type)
    }
    if (cashierUid && cashierUid !== 'all') {
      ordersList = ordersList.filter(o => !o.cashierUid || o.cashierUid === cashierUid)
    }

    return NextResponse.json(
      {
        success: true,
        orders: ordersList,
        totalCount: ordersList.length
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body || !body.id) {
      return NextResponse.json({ success: false, error: 'Orden inválida' }, { status: 400 })
    }

    const orderData: CashierOrder = {
      id: body.id,
      type: body.type || 'deposit',
      status: body.status || 'pending',
      playerUid: body.playerUid || '',
      playerName: body.playerName || 'Jugador',
      amountFiat: Number(body.amountFiat || 0),
      currency: body.currency || 'USDT',
      exchangeRate: Number(body.exchangeRate || 100),
      amountSugarCoins: Number(body.amountSugarCoins || 0),
      cashierCommissionCoins: Number(body.cashierCommissionCoins || 0),
      paymentMethod: body.paymentMethod || 'usdt_trc20',
      receiptReferenceNumber: body.receiptReferenceNumber || '',
      createdAt: body.createdAt || Date.now(),
      expiresAt: body.expiresAt || (Date.now() + 1800000)
    }

    // Agregar a la memoria local del servidor
    const idx = liveServerOrders.findIndex(o => o.id === orderData.id)
    if (idx >= 0) {
      liveServerOrders[idx] = orderData
    } else {
      liveServerOrders.unshift(orderData)
    }

    // Intentar guardar en Firestore con adminDb si está disponible
    if (adminDb && adminDb.collection) {
      try {
        await adminDb.collection('cashier_orders').doc(orderData.id).set(orderData)
      } catch {}
    }

    return NextResponse.json(
      { success: true, order: orderData },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    )
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
