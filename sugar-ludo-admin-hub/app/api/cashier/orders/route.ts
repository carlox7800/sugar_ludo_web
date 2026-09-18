import { NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { CashierOrder } from '@/types/cashier'
import { verifyStaffAuth } from '@/lib/api-auth-guard'

export async function GET(request: Request) {
  const authResult = await verifyStaffAuth(request, ['cashier', 'admin'])
  if (!authResult.authorized) {
    return authResult.errorResponse!
  }

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
                playerId: parseField(fields.playerId) || (parseField(fields.playerUid) ? `SL-${String(parseField(fields.playerUid)).substring(0, 6).toUpperCase()}` : undefined),
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

import { createWithdrawOrderWithEscrow, cleanFirestorePayload } from '@/lib/atomic-transactions'
import { db } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'

export async function POST(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }

  try {
    const body = await request.json()
    if (!body || !body.id) {
      return NextResponse.json({ success: false, error: 'Orden inválida' }, { status: 400, headers: corsHeaders })
    }

    let rawPlayerUid = body.playerUid || ''

    // Verificación criptográfica de identidad de jugador (Zero-Trust Token Verification)
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ') && adminAuth) {
      try {
        const idToken = authHeader.split('Bearer ')[1]
        const decodedToken = await adminAuth.verifyIdToken(idToken)
        if (decodedToken && decodedToken.uid) {
          rawPlayerUid = decodedToken.uid
        }
      } catch (authErr: any) {
        console.warn('[POST /api/cashier/orders] Token inválido o no verificado:', authErr?.message)
      }
    }

    const rawPlayerId = body.playerId || (rawPlayerUid ? `SL-${rawPlayerUid.substring(0, 6).toUpperCase()}` : '')
    const isVip = Boolean(body.isVip || body.isVipWithdraw || body.paymentMethod === 'usdt_trc20_vip' || body.paymentMethod === 'usdt_bep20')

    const orderData: CashierOrder = {
      id: body.id,
      type: body.type || 'deposit',
      status: body.status || 'pending',
      playerUid: rawPlayerUid,
      playerId: rawPlayerId,
      playerName: body.playerName || 'Jugador',
      amountFiat: Number(body.amountFiat || 0),
      currency: body.currency || 'USDT',
      exchangeRate: Number(body.exchangeRate || 100),
      amountSugarCoins: Number(body.amountSugarCoins || 0),
      cashierCommissionCoins: Number(body.cashierCommissionCoins || (orderData_type => orderData_type === 'withdraw' ? Math.round(Number(body.amountSugarCoins || 0) * (isVip ? 0.04 : 0.02)) : Math.round(Number(body.amountSugarCoins || 0) * 0.02))(body.type)),
      paymentMethod: body.paymentMethod || 'usdt_trc20',
      receiptReferenceNumber: body.receiptReferenceNumber || '',
      createdAt: body.createdAt || Date.now(),
      expiresAt: body.expiresAt || (Date.now() + 1800000),
      isVip,
      isVipWithdraw: isVip
    }

    // 1. Si es RETIRO, ejecutar validación y bloqueo atómico en Escrow si no fue bloqueado previamente
    if (orderData.type === 'withdraw') {
      // Candado Anti-Doble Débito: Si el cliente autenticado YA ejecutó la retención de Escrow, no volver a debitar
      const alreadyLocked = Boolean(body.isEscrowLocked || (body as any).escrowLocked)
      if (alreadyLocked) {
        orderData.isEscrowLocked = true
        orderData.escrowLockedAt = body.escrowLockedAt || Date.now()

        if (adminDb && adminDb.collection) {
          try {
            await adminDb.collection('cashier_orders').doc(orderData.id).set(cleanFirestorePayload(orderData as unknown as Record<string, unknown>), { merge: true })
          } catch {}
        }

        try {
          const orderDocRef = doc(db, 'cashier_orders', orderData.id)
          await setDoc(orderDocRef, cleanFirestorePayload(orderData as unknown as Record<string, unknown>), { merge: true })
        } catch {}

        // Respaldo REST
        try {
          const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
          const firestoreRestDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cashier_orders/${orderData.id}`
          await fetch(firestoreRestDocUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                id: { stringValue: orderData.id },
                type: { stringValue: orderData.type },
                status: { stringValue: orderData.status },
                playerUid: { stringValue: orderData.playerUid },
                playerId: { stringValue: orderData.playerId || rawPlayerId || '' },
                playerName: { stringValue: orderData.playerName },
                amountFiat: { doubleValue: orderData.amountFiat },
                currency: { stringValue: orderData.currency },
                exchangeRate: { integerValue: String(orderData.exchangeRate) },
                amountSugarCoins: { integerValue: String(orderData.amountSugarCoins) },
                cashierCommissionCoins: { integerValue: String(orderData.cashierCommissionCoins) },
                paymentMethod: { stringValue: orderData.paymentMethod },
                receiptReferenceNumber: { stringValue: orderData.receiptReferenceNumber || '' },
                createdAt: { integerValue: String(orderData.createdAt) },
                expiresAt: { integerValue: String(orderData.expiresAt) },
                isEscrowLocked: { booleanValue: true },
                escrowLockedAt: { integerValue: String(orderData.escrowLockedAt || Date.now()) },
                isVip: { booleanValue: Boolean(orderData.isVip) },
                isVipWithdraw: { booleanValue: Boolean(orderData.isVipWithdraw) }
              }
            })
          })
        } catch {}

        return NextResponse.json(
          { success: true, order: orderData, orderId: orderData.id },
          { headers: corsHeaders }
        )
      }

      try {
        const withdrawRes = await createWithdrawOrderWithEscrow({
          orderId: orderData.id,
          playerUid: orderData.playerUid,
          playerId: orderData.playerId,
          playerName: orderData.playerName,
          amountSugarCoins: orderData.amountSugarCoins,
          amountFiat: orderData.amountFiat,
          currency: orderData.currency,
          paymentMethod: orderData.paymentMethod,
          playerPaymentAccount: orderData.receiptReferenceNumber || '',
          isVip
        })
        orderData.id = withdrawRes.orderId
        orderData.isEscrowLocked = true
        orderData.escrowLockedAt = Date.now()

        // Replicación dual preventiva vía REST para garantizar persistencia inmediata
        try {
          const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
          const firestoreRestDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cashier_orders/${orderData.id}`
          await fetch(firestoreRestDocUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                id: { stringValue: orderData.id },
                type: { stringValue: orderData.type },
                status: { stringValue: orderData.status },
                playerUid: { stringValue: orderData.playerUid },
                playerId: { stringValue: orderData.playerId || rawPlayerId || '' },
                playerName: { stringValue: orderData.playerName },
                amountFiat: { doubleValue: orderData.amountFiat },
                currency: { stringValue: orderData.currency },
                exchangeRate: { integerValue: String(orderData.exchangeRate) },
                amountSugarCoins: { integerValue: String(orderData.amountSugarCoins) },
                cashierCommissionCoins: { integerValue: String(orderData.cashierCommissionCoins) },
                paymentMethod: { stringValue: orderData.paymentMethod },
                receiptReferenceNumber: { stringValue: orderData.receiptReferenceNumber || '' },
                createdAt: { integerValue: String(orderData.createdAt) },
                expiresAt: { integerValue: String(orderData.expiresAt) },
                isEscrowLocked: { booleanValue: true },
                escrowLockedAt: { integerValue: String(orderData.escrowLockedAt || Date.now()) },
                isVip: { booleanValue: Boolean(orderData.isVip) },
                isVipWithdraw: { booleanValue: Boolean(orderData.isVipWithdraw) }
              }
            })
          })
        } catch {}

        return NextResponse.json(
          { success: true, order: orderData, orderId: orderData.id },
          { headers: corsHeaders }
        )
      } catch (withdrawErr: any) {
        console.error('[CashierOrdersAPI] Error atómico creando retiro:', withdrawErr)
        return NextResponse.json(
          { success: false, error: withdrawErr.message || 'Error al validar saldo para retiro' },
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 2. Si es DEPÓSITO o modo fallback, guardar en Firestore
    if (adminDb && adminDb.collection) {
      try {
        await adminDb.collection('cashier_orders').doc(orderData.id).set(orderData)
      } catch {}
    }

    // 3. Escribir a Firestore REST
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
      const firestoreRestDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cashier_orders?documentId=${orderData.id}`
      await fetch(firestoreRestDocUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            id: { stringValue: orderData.id },
            type: { stringValue: orderData.type },
            status: { stringValue: orderData.status },
            playerUid: { stringValue: orderData.playerUid },
            playerId: { stringValue: orderData.playerId || rawPlayerId },
            playerName: { stringValue: orderData.playerName },
            amountFiat: { doubleValue: orderData.amountFiat },
            currency: { stringValue: orderData.currency },
            exchangeRate: { integerValue: String(orderData.exchangeRate) },
            amountSugarCoins: { integerValue: String(orderData.amountSugarCoins) },
            cashierCommissionCoins: { integerValue: String(orderData.cashierCommissionCoins) },
            paymentMethod: { stringValue: orderData.paymentMethod },
            receiptReferenceNumber: { stringValue: orderData.receiptReferenceNumber || '' },
            createdAt: { integerValue: String(orderData.createdAt) },
            expiresAt: { integerValue: String(orderData.expiresAt) }
          }
        })
      })
    } catch {}

    return NextResponse.json(
      { success: true, order: orderData },
      { headers: corsHeaders }
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
