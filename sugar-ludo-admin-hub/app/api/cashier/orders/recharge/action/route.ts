import { NextResponse } from 'next/server'
import { rechargeCashierFloatAtomics } from '@/lib/atomic-transactions'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { cashierUid, amountUSDT, notes, adminUid, adminName } = body

    if (!cashierUid || !amountUSDT || amountUSDT <= 0) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos (cashierUid y amountUSDT > 0 requeridos)' },
        { status: 400 }
      )
    }

    const result = await rechargeCashierFloatAtomics({
      cashierUid,
      amountUSDT: Number(amountUSDT),
      notes: notes || 'Recarga de saldo flotante por Super Admin',
      adminUid: adminUid || 'adm_super_001',
      adminName: adminName || 'Super Admin'
    })

    // Sincronizar en system_config/cashier_accounts para coherencia global
    try {
      const configDocRef = doc(db, 'system_config', 'cashier_accounts')
      const configSnap = await getDoc(configDocRef)
      if (configSnap.exists()) {
        const configData = configSnap.data() || {}
        const accounts = Array.isArray(configData.accounts) ? configData.accounts : []
        const updatedAccounts = accounts.map((acc: any) => {
          if (acc.uid === cashierUid) {
            const currentUSDT = Number(acc.floatBalanceUSDT ?? (Number(acc.floatBalanceCoins || 0) / 100))
            const newUSDT = parseFloat((currentUSDT + Number(amountUSDT)).toFixed(2))
            const newCoins = Math.round(newUSDT * 100)
            return {
              ...acc,
              floatBalanceUSDT: newUSDT,
              floatBalanceCoins: newCoins,
              lastRechargeAt: Date.now()
            }
          }
          return acc
        })
        await updateDoc(configDocRef, { accounts: updatedAccounts, updatedAt: Date.now() })
      }
    } catch (e: any) {
      console.warn('[recharge action API] Error sincronizando en cashier_accounts:', e?.message)
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[recharge action API] Error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Error al recargar saldo flotante' }, { status: 500 })
  }
}
