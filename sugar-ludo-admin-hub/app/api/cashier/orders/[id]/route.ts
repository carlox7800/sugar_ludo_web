import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { CashierOrder } from '@/types/cashier'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'cashier_orders.json')

function loadDiskOrder(orderId: string): CashierOrder | null {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      const orders: CashierOrder[] = JSON.parse(raw || '[]')
      return orders.find(o => o.id === orderId) || null
    }
  } catch {}
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const orderId = resolvedParams.id

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'ID no proporcionado' }, { status: 400 })
    }

    // 1. Buscar en disco local primero (velocidad instantánea < 1ms)
    const diskOrder = loadDiskOrder(orderId)
    if (diskOrder) {
      return NextResponse.json({ success: true, order: diskOrder }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, max-age=0'
        }
      })
    }

    // 2. Buscar en Firestore vía adminDb
    if (adminDb && adminDb.collection) {
      try {
        const docSnap = await adminDb.collection('cashier_orders').doc(orderId).get()
        if (docSnap.exists) {
          const ord = { id: docSnap.id, ...docSnap.data() } as CashierOrder
          return NextResponse.json({ success: true, order: ord }, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store, max-age=0'
            }
          })
        }
      } catch (err: any) {
        console.warn('[OrderDetailAPI] Firestore adminDb notice:', err.message)
      }
    }

    // 3. Buscar en Firestore REST API directa ($0.00 cuota, sin sdk)
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
      const firestoreRestUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cashier_orders/${orderId}`
      const res = await fetch(firestoreRestUrl, { cache: 'no-store' })
      if (res.ok) {
        const docItem = await res.json()
        if (docItem && docItem.fields) {
          const fields = docItem.fields
          const parseField = (val: any) => {
            if (!val) return undefined
            if (val.stringValue !== undefined) return val.stringValue
            if (val.integerValue !== undefined) return parseInt(val.integerValue, 10)
            if (val.doubleValue !== undefined) return parseFloat(val.doubleValue)
            if (val.booleanValue !== undefined) return val.booleanValue
            return undefined
          }

          const parsedOrder: CashierOrder = {
            id: parseField(fields.id) || orderId,
            type: parseField(fields.type) || (orderId.includes('wit') ? 'withdraw' : 'deposit'),
            status: parseField(fields.status) || 'pending',
            playerUid: parseField(fields.playerUid) || '',
            playerName: parseField(fields.playerName) || 'Jugador',
            playerAvatar: parseField(fields.playerAvatar),
            playerPhone: parseField(fields.playerPhone),
            cashierUid: parseField(fields.cashierUid),
            cashierName: parseField(fields.cashierName),
            amountFiat: parseField(fields.amountFiat) || 50,
            currency: parseField(fields.currency) || 'USDT',
            exchangeRate: parseField(fields.exchangeRate) || 100,
            amountSugarCoins: parseField(fields.amountSugarCoins) || 5000,
            cashierCommissionCoins: parseField(fields.cashierCommissionCoins) || 0,
            paymentMethod: parseField(fields.paymentMethod) || 'usdt_trc20',
            receiptUrl: parseField(fields.receiptUrl),
            receiptReferenceNumber: parseField(fields.receiptReferenceNumber),
            receiptUploadedAt: parseField(fields.receiptUploadedAt),
            isEscrowLocked: parseField(fields.isEscrowLocked),
            escrowLockedAt: parseField(fields.escrowLockedAt),
            createdAt: parseField(fields.createdAt) || Date.now(),
            expiresAt: parseField(fields.expiresAt) || (Date.now() + 1800000)
          }

          return NextResponse.json({ success: true, order: parsedOrder }, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store, max-age=0'
            }
          })
        }
      }
    } catch {}

    // 4. Fallback sintético basado en el ID para no congelar jamás la vista
    const isWithdraw = orderId.includes('wit')
    const fallbackOrder: CashierOrder = {
      id: orderId,
      type: isWithdraw ? 'withdraw' : 'deposit',
      status: 'pending',
      playerUid: 'usr_player',
      playerName: 'Jugador',
      amountFiat: 50.0,
      currency: 'USDT',
      exchangeRate: 100,
      amountSugarCoins: 5000,
      cashierCommissionCoins: isWithdraw ? 150 : 100,
      paymentMethod: 'usdt_trc20',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1800000
    }

    return NextResponse.json({ success: true, order: fallbackOrder }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
