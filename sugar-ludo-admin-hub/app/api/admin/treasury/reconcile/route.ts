import { NextResponse } from 'next/server'
import { adminDb, hasAdminCredentials } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { adminUid, adminName } = body
    const now = Date.now()

    let totalPlayerCoins = 0
    let totalCashierFloatUSD = 0
    let totalCashierFloatCoins = 0
    let houseNetProfitsUSD = 0
    let normalWithdrawalFeesUSD = 0
    let vipWithdrawalFeesUSD = 0
    let totalCompletedOrders = 0

    // 1. Calcular saldos reales de jugadores y órdenes vía Admin SDK si hay credenciales
    if (adminDb && hasAdminCredentials) {
      // Sumar saldos de usuarios (coins + escrowLockedCoins)
      const usersSnap = await adminDb.collection('users').get()
      usersSnap.forEach((d: any) => {
        const u = d.data() || {}
        totalPlayerCoins += Number(u.coins || 0) + Number(u.escrowLockedCoins || 0)
      })

      // Sumar flotantes de cajeros
      const cashiersSnap = await adminDb.collection('cashier_profiles').get()
      cashiersSnap.forEach((d: any) => {
        const c = d.data() || {}
        const fUSDT = Number(c.floatBalanceUSDT ?? (Number(c.floatBalanceCoins || 0) / 100))
        const fCoins = Number(c.floatBalanceCoins ?? Math.round(fUSDT * 100))
        totalCashierFloatUSD += fUSDT
        totalCashierFloatCoins += fCoins
      })

      // Leer desglose previo y hardResetAt
      const ledgerSnap = await adminDb.collection('system_treasury').doc('global_ledger').get()
      const prevData = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {}
      const hardResetAt = Number(prevData.hardResetAt || 0)
      const prevProfits = prevData.profitsBreakdown || {}
      const tableRakeUSD = Number(prevProfits.tableRakeUSD || 0)
      const storeSalesUSD = Number(prevProfits.storeSalesUSD || 0)
      const tournamentMarginUSD = Number(prevProfits.tournamentMarginUSD || 0)
      houseNetProfitsUSD += tableRakeUSD + storeSalesUSD + tournamentMarginUSD

      // Sumar comisiones de retiros liquidados posteriores al hardResetAt
      const ordersSnap = await adminDb.collection('cashier_orders').where('status', '==', 'completed').get()
      totalCompletedOrders = ordersSnap.size
      ordersSnap.forEach((d: any) => {
        const o = d.data() || {}
        const orderCompletedAt = Number(o.completedAt || o.createdAt || 0)
        if (o.type === 'withdraw' && !o.reconcileExcluded && orderCompletedAt > hardResetAt) {
          const isVip = Boolean(o.isVip || o.isVipWithdraw || o.paymentMethod === 'usdt_bep20' || o.paymentMethod === 'usdt_trc20_vip')
          const amountFiat = Number(o.amountFiat || (Number(o.amountSugarCoins || 0) / 100))
          const feePercent = isVip ? 0.10 : 0.05
          const feeUSD = parseFloat((amountFiat * feePercent).toFixed(2))
          if (isVip) {
            vipWithdrawalFeesUSD += feeUSD
          } else {
            normalWithdrawalFeesUSD += feeUSD
          }
          houseNetProfitsUSD += feeUSD
        }
      })

      const playerCustodyUSD = parseFloat((totalPlayerCoins / 100).toFixed(2))
      const houseNetProfitsCoins = Math.round(houseNetProfitsUSD * 100)
      const totalVaultUSD = parseFloat((playerCustodyUSD + houseNetProfitsUSD).toFixed(2))
      const totalVaultSugarCoins = Math.round(totalVaultUSD * 100)

      const updatedLedger = {
        id: 'global_ledger',
        hardResetAt,
        totalVaultUSD,
        totalVaultSugarCoins,
        playerCustodyUSD,
        playerCustodyCoins: totalPlayerCoins,
        cashierFloatsUSD: parseFloat(totalCashierFloatUSD.toFixed(2)),
        cashierFloatsCoins: totalCashierFloatCoins,
        houseNetProfitsUSD: parseFloat(houseNetProfitsUSD.toFixed(2)),
        houseNetProfitsCoins,
        profitsBreakdown: {
          withdrawalFeesUSD: parseFloat((normalWithdrawalFeesUSD + vipWithdrawalFeesUSD).toFixed(2)),
          normalWithdrawalFeesUSD: parseFloat(normalWithdrawalFeesUSD.toFixed(2)),
          vipWithdrawalFeesUSD: parseFloat(vipWithdrawalFeesUSD.toFixed(2)),
          tableRakeUSD,
          storeSalesUSD,
          tournamentMarginUSD
        },
        lastAuditedAt: now,
        lastAuditedBy: adminName || adminUid || 'Super Admin'
      }

      await adminDb.collection('system_treasury').doc('global_ledger').set(updatedLedger, { merge: true })

      return NextResponse.json({
        success: true,
        message: 'Conciliación de tesorería completada exitosamente vía Admin SDK.',
        ledger: updatedLedger,
        stats: {
          totalUsersAudited: usersSnap.size,
          totalCompletedOrders,
          totalPlayerCoins,
          playerCustodyUSD
        }
      })
    }

    // 2. Motor Híbrido de Respaldo (SDK cliente db)
    const usersSnap = await getDocs(collection(db, 'users'))
    usersSnap.forEach((d) => {
      const u = d.data() || {}
      totalPlayerCoins += Number(u.coins || 0) + Number(u.escrowLockedCoins || 0)
    })

    const cashiersSnap = await getDocs(collection(db, 'cashier_profiles'))
    cashiersSnap.forEach((d) => {
      const c = d.data() || {}
      const fUSDT = Number(c.floatBalanceUSDT ?? (Number(c.floatBalanceCoins || 0) / 100))
      const fCoins = Number(c.floatBalanceCoins ?? Math.round(fUSDT * 100))
      totalCashierFloatUSD += fUSDT
      totalCashierFloatCoins += fCoins
    })

    // Leer desglose previo y hardResetAt en motor híbrido
    const ledgerDocRef = doc(db, 'system_treasury', 'global_ledger')
    const ledgerSnap = await getDoc(ledgerDocRef)
    const prevData = ledgerSnap.exists() ? (ledgerSnap.data() || {}) : {}
    const hardResetAt = Number(prevData.hardResetAt || 0)
    const prevProfits = prevData.profitsBreakdown || {}
    const tableRakeUSD = Number(prevProfits.tableRakeUSD || 0)
    const storeSalesUSD = Number(prevProfits.storeSalesUSD || 0)
    const tournamentMarginUSD = Number(prevProfits.tournamentMarginUSD || 0)
    houseNetProfitsUSD += tableRakeUSD + storeSalesUSD + tournamentMarginUSD

    const ordersSnap = await getDocs(collection(db, 'cashier_orders'))
    ordersSnap.forEach((d) => {
      const o = d.data() || {}
      const orderCompletedAt = Number(o.completedAt || o.createdAt || 0)
      if (o.status === 'completed' && o.type === 'withdraw' && !o.reconcileExcluded && orderCompletedAt > hardResetAt) {
        totalCompletedOrders++
        const isVip = Boolean(o.isVip || o.isVipWithdraw || o.paymentMethod === 'usdt_bep20' || o.paymentMethod === 'usdt_trc20_vip')
        const amountFiat = Number(o.amountFiat || (Number(o.amountSugarCoins || 0) / 100))
        const feePercent = isVip ? 0.10 : 0.05
        const feeUSD = parseFloat((amountFiat * feePercent).toFixed(2))
        if (isVip) {
          vipWithdrawalFeesUSD += feeUSD
        } else {
          normalWithdrawalFeesUSD += feeUSD
        }
        houseNetProfitsUSD += feeUSD
      }
    })

    const playerCustodyUSD = parseFloat((totalPlayerCoins / 100).toFixed(2))
    const houseNetProfitsCoins = Math.round(houseNetProfitsUSD * 100)
    const totalVaultUSD = parseFloat((playerCustodyUSD + houseNetProfitsUSD).toFixed(2))
    const totalVaultSugarCoins = Math.round(totalVaultUSD * 100)

    const updatedLedger = {
      id: 'global_ledger',
      hardResetAt,
      totalVaultUSD,
      totalVaultSugarCoins,
      playerCustodyUSD,
      playerCustodyCoins: totalPlayerCoins,
      cashierFloatsUSD: parseFloat(totalCashierFloatUSD.toFixed(2)),
      cashierFloatsCoins: totalCashierFloatCoins,
      houseNetProfitsUSD: parseFloat(houseNetProfitsUSD.toFixed(2)),
      houseNetProfitsCoins,
      profitsBreakdown: {
        withdrawalFeesUSD: parseFloat((normalWithdrawalFeesUSD + vipWithdrawalFeesUSD).toFixed(2)),
        normalWithdrawalFeesUSD: parseFloat(normalWithdrawalFeesUSD.toFixed(2)),
        vipWithdrawalFeesUSD: parseFloat(vipWithdrawalFeesUSD.toFixed(2)),
        tableRakeUSD,
        storeSalesUSD,
        tournamentMarginUSD
      },
      lastAuditedAt: now,
      lastAuditedBy: adminName || adminUid || 'Super Admin'
    }

    await setDoc(doc(db, 'system_treasury', 'global_ledger'), updatedLedger, { merge: true })

    return NextResponse.json({
      success: true,
      message: 'Conciliación de tesorería completada exitosamente vía motor híbrido.',
      ledger: updatedLedger,
      stats: {
        totalUsersAudited: usersSnap.size,
        totalCompletedOrders,
        totalPlayerCoins,
        playerCustodyUSD
      }
    })
  } catch (err: any) {
    console.error('[TreasuryReconcile] Error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Error en conciliación de tesorería' }, { status: 500 })
  }
}
