import { NextResponse } from 'next/server'
import { adminDb, hasAdminCredentials } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, setDoc, writeBatch, limit, query } from 'firebase/firestore'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      scope, 
      purgeOrdersHistory, 
      purgeShiftLedger, 
      resetTelemetryMetrics, 
      adminUid, 
      adminName 
    } = body

    if (!scope || !['treasury_only', 'cashiers_only', 'total_hard_reset'].includes(scope)) {
      return NextResponse.json(
        { success: false, error: 'Alcance de reinicio contable inválido.' },
        { status: 400, headers: corsHeaders }
      )
    }

    const now = Date.now()

    // =========================================================================
    // MODO 1: ADMIN SDK PRIVILEGIADO (Si existen credenciales en el servidor)
    // =========================================================================
    if (adminDb && hasAdminCredentials) {
      const ledgerRef = adminDb.collection('system_treasury').doc('global_ledger')
      const ledgerSnap = await ledgerRef.get()
      const ledgerData = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {}

    // =========================================================================
    // 1. REINICIO DE TESORERÍA SOLAMENTE (houseNetProfits = 0, NO TOCA JUGADORES)
    // =========================================================================
    if (scope === 'treasury_only') {
      const currentVaultUSD = Number(ledgerData.totalVaultUSD || 0)
      const currentHouseProfitsUSD = Number(ledgerData.houseNetProfitsUSD || 0)
      const newVaultUSD = Math.max(0, currentVaultUSD - currentHouseProfitsUSD)

      await ledgerRef.set({
        totalVaultUSD: newVaultUSD,
        totalVaultSugarCoins: Math.round(newVaultUSD * 100),
        houseNetProfitsUSD: 0,
        houseNetProfitsCoins: 0,
        profitsBreakdown: {
          tableRakeUSD: 0,
          storeSalesUSD: 0,
          withdrawalFeesUSD: 0,
          normalWithdrawalFeesUSD: 0,
          vipWithdrawalFeesUSD: 0,
          normalWithdrawalFeesCoins: 0,
          vipWithdrawalFeesCoins: 0
        },
        lastAuditedAt: now
      }, { merge: true })

      // Purgar estadísticas diarias acumuladas
      try {
        const statsSnap = await adminDb.collection('daily_stats').limit(100).get()
        if (!statsSnap.empty) {
          const batch = adminDb.batch()
          statsSnap.forEach((docSnap: any) => batch.delete(docSnap.ref))
          await batch.commit()
        }
      } catch (err: any) {
        console.warn('[AdminResetAPI] Purga daily_stats notice:', err.message)
      }
    }

    // =========================================================================
    // 2. REINICIO DE CAJEROS SOLAMENTE (Flotante = 0, NO TOCA JUGADORES)
    // =========================================================================
    if (scope === 'cashiers_only') {
      // 2.1. Resetear flotantes en cashier_profiles
      try {
        const cashiersSnap = await adminDb.collection('cashier_profiles').get()
        if (!cashiersSnap.empty) {
          const batch = adminDb.batch()
          cashiersSnap.forEach((cDoc: any) => {
            batch.update(cDoc.ref, {
              floatBalanceCoins: 0,
              floatBalanceUSDT: 0,
              totalPaidWithdrawalsUSDT: 0,
              totalPaidWithdrawalsCoins: 0,
              lastResetAt: now
            })
          })
          await batch.commit()
        }
      } catch (cErr: any) {
        console.warn('[AdminResetAPI] Reset cashier_profiles notice:', cErr.message)
      }

      // 2.2. Actualizar system_config/cashier_accounts
      try {
        const configRef = adminDb.collection('system_config').doc('cashier_accounts')
        const configSnap = await configRef.get()
        if (configSnap.exists) {
          const accounts = configSnap.data()?.accounts || []
          const resetAccounts = accounts.map((c: any) => ({
            ...c,
            floatBalanceCoins: 0,
            floatBalanceUSDT: 0,
            totalPaidWithdrawalsUSDT: 0,
            lastResetAt: now
          }))
          await configRef.set({ accounts: resetAccounts, updatedAt: now }, { merge: true })
        }
      } catch {}

      // 2.3. Ajustar ledger global
      await ledgerRef.set({
        cashierFloatsUSD: 0,
        cashierFloatsCoins: 0,
        lastAuditedAt: now
      }, { merge: true })

      // 2.4. Purga opcional de libro de turnos
      if (purgeShiftLedger) {
        try {
          const shiftsSnap = await adminDb.collection('cashier_shifts_ledger').limit(200).get()
          if (!shiftsSnap.empty) {
            const batch = adminDb.batch()
            shiftsSnap.forEach((sDoc: any) => batch.delete(sDoc.ref))
            await batch.commit()
          }
        } catch {}
      }
    }

    // =========================================================================
    // 3. HARD RESET TOTAL (Bóveda completa, cajeros y balance de prueba)
    // =========================================================================
    if (scope === 'total_hard_reset') {
      await ledgerRef.set({
        id: 'global_ledger',
        totalVaultUSD: 0.0,
        totalVaultSugarCoins: 0,
        playerCustodyUSD: 0.0,
        playerCustodyCoins: 0,
        cashierFloatsUSD: 0.0,
        cashierFloatsCoins: 0,
        houseNetProfitsUSD: 0.0,
        houseNetProfitsCoins: 0,
        profitsBreakdown: {
          tableRakeUSD: 0,
          storeSalesUSD: 0,
          withdrawalFeesUSD: 0,
          normalWithdrawalFeesUSD: 0,
          vipWithdrawalFeesUSD: 0
        },
        lastAuditedAt: now
      })

      // Resetear usuarios en users
      try {
        const usersSnap = await adminDb.collection('users').limit(150).get()
        if (!usersSnap.empty) {
          const batch = adminDb.batch()
          usersSnap.forEach((uDoc: any) => {
            batch.update(uDoc.ref, {
              coins: 0,
              escrowLockedCoins: 0,
              lastActiveAt: now
            })
          })
          await batch.commit()
        }
      } catch (uErr: any) {
        console.warn('[AdminResetAPI] Reset users notice (Admin SDK):', uErr?.message)
      }

      // Resetear cajeros
      try {
        const cashiersSnap = await adminDb.collection('cashier_profiles').get()
        if (!cashiersSnap.empty) {
          const batch = adminDb.batch()
          cashiersSnap.forEach((cDoc: any) => {
            batch.update(cDoc.ref, {
              floatBalanceCoins: 0,
              floatBalanceUSDT: 0,
              totalPaidWithdrawalsUSDT: 0,
              totalPaidWithdrawalsCoins: 0,
              lastActiveAt: now
            })
          })
          await batch.commit()
        }
      } catch {}

      // Purgar órdenes si fue solicitado
      if (purgeOrdersHistory) {
        try {
          const ordersSnap = await adminDb.collection('cashier_orders').limit(200).get()
          if (!ordersSnap.empty) {
            const batch = adminDb.batch()
            ordersSnap.forEach((oDoc: any) => batch.delete(oDoc.ref))
            await batch.commit()
          }
        } catch {}
      }

      // Purgar libro de turnos si fue solicitado
      if (purgeShiftLedger) {
        try {
          const shiftsSnap = await adminDb.collection('cashier_shifts_ledger').limit(200).get()
          if (!shiftsSnap.empty) {
            const batch = adminDb.batch()
            shiftsSnap.forEach((sDoc: any) => batch.delete(sDoc.ref))
            await batch.commit()
          }
        } catch {}
      }
    }

    // =========================================================================
    // 4. RESET OPCIONAL DE TELEMETRÍA (system_treasury/live_telemetry)
    // =========================================================================
    if (resetTelemetryMetrics) {
      try {
        const telRef = adminDb.collection('system_treasury').doc('live_telemetry')
        await telRef.set({
          totalPlayersOnline: 0,
          offlineMatchesCount: 0,
          onlineTrainingPlayersCount: 0,
          competitivePlayersCount: 0,
          activeRoomsCount: 0,
          playersInLobby: 0,
          playersInAITraining: 0,
          playersInOnlineTraining: 0,
          playersInCompetitive: 0,
          serverStatus: 'healthy',
          updatedAt: now
        }, { merge: true })
      } catch (telErr: any) {
        console.warn('[AdminResetAPI] Reset live_telemetry notice:', telErr.message)
      }
    }

    // =========================================================================
    // 5. REGISTRO INMUTABLE DE AUDITORÍA
    // =========================================================================
    try {
      const auditRef = adminDb.collection('audit_logs').doc()
      await auditRef.set({
        id: auditRef.id,
        action: 'ECONOMIC_HARD_RESET_SERVER',
        scope,
        adminUid: adminUid || 'adm_super_001',
        adminName: adminName || 'Super Admin',
        previousVault: ledgerData,
        purgeOrdersHistory: Boolean(purgeOrdersHistory),
        purgeShiftLedger: Boolean(purgeShiftLedger),
        resetTelemetryMetrics: Boolean(resetTelemetryMetrics),
        timestamp: now
      })
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Reinicio contable ejecutado con éxito bajo alcance: ${scope.toUpperCase()} (Admin SDK)`
    }, { headers: corsHeaders })
  }

  // =========================================================================
  // MODO 2: MOTOR HÍBRIDO DE RESPALDO (SDK Cliente en Node.js)
  // =========================================================================
  const ledgerRef = doc(db, 'system_treasury', 'global_ledger')

  // 1. REINICIO DE TESORERÍA SOLAMENTE
  if (scope === 'treasury_only') {
    await setDoc(ledgerRef, {
      houseNetProfitsUSD: 0,
      houseNetProfitsCoins: 0,
      profitsBreakdown: {
        tableRakeUSD: 0,
        storeSalesUSD: 0,
        withdrawalFeesUSD: 0,
        normalWithdrawalFeesUSD: 0,
        vipWithdrawalFeesUSD: 0,
        normalWithdrawalFeesCoins: 0,
        vipWithdrawalFeesCoins: 0
      },
      lastAuditedAt: now
    }, { merge: true })

    try {
      const statsSnap = await getDocs(query(collection(db, 'daily_stats'), limit(100)))
      if (!statsSnap.empty) {
        const batch = writeBatch(db)
        statsSnap.forEach((docSnap) => batch.delete(docSnap.ref))
        await batch.commit()
      }
    } catch {}
  }

  // 2. REINICIO DE CAJEROS SOLAMENTE
  if (scope === 'cashiers_only') {
    try {
      const cashiersSnap = await getDocs(collection(db, 'cashier_profiles'))
      if (!cashiersSnap.empty) {
        const batch = writeBatch(db)
        cashiersSnap.forEach((cDoc) => {
          batch.update(cDoc.ref, {
            floatBalanceCoins: 0,
            floatBalanceUSDT: 0,
            totalPaidWithdrawalsUSDT: 0,
            totalPaidWithdrawalsCoins: 0,
            lastActiveAt: now
          })
        })
        await batch.commit()
      }
    } catch {}

    try {
      const configRef = doc(db, 'system_config', 'cashier_accounts')
      await setDoc(configRef, { updatedAt: now }, { merge: true })
    } catch {}

    await setDoc(ledgerRef, {
      cashierFloatsUSD: 0,
      cashierFloatsCoins: 0,
      lastAuditedAt: now
    }, { merge: true })

    if (purgeShiftLedger) {
      try {
        const shiftsSnap = await getDocs(query(collection(db, 'cashier_shifts_ledger'), limit(150)))
        if (!shiftsSnap.empty) {
          const batch = writeBatch(db)
          shiftsSnap.forEach((sDoc) => batch.delete(sDoc.ref))
          await batch.commit()
        }
      } catch {}
    }
  }

  // 3. HARD RESET TOTAL (Bóveda completa, usuarios, cajeros y órdenes de prueba)
  if (scope === 'total_hard_reset') {
    await setDoc(ledgerRef, {
      id: 'global_ledger',
      totalVaultUSD: 0.0,
      totalVaultSugarCoins: 0,
      playerCustodyUSD: 0.0,
      playerCustodyCoins: 0,
      cashierFloatsUSD: 0.0,
      cashierFloatsCoins: 0,
      houseNetProfitsUSD: 0.0,
      houseNetProfitsCoins: 0,
      profitsBreakdown: {
        tableRakeUSD: 0,
        storeSalesUSD: 0,
        withdrawalFeesUSD: 0,
        normalWithdrawalFeesUSD: 0,
        vipWithdrawalFeesUSD: 0
      },
      lastAuditedAt: now
    })

    // 3.1. Resetear saldos de todos los usuarios en users (100% compatible con firestore.rules Cláusula 3)
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(150)))
      if (!usersSnap.empty) {
        const batch = writeBatch(db)
        usersSnap.forEach((uDoc) => {
          batch.update(uDoc.ref, {
            coins: 0,
            escrowLockedCoins: 0,
            lastActiveAt: now
          })
        })
        await batch.commit()
      }
    } catch (uErr: any) {
      console.warn('[AdminResetAPI] Reset users notice (Hybrid):', uErr?.message)
    }

    // 3.2. Resetear cajeros
    try {
      const cashiersSnap = await getDocs(collection(db, 'cashier_profiles'))
      if (!cashiersSnap.empty) {
        const batch = writeBatch(db)
        cashiersSnap.forEach((cDoc) => {
          batch.update(cDoc.ref, {
            floatBalanceCoins: 0,
            floatBalanceUSDT: 0,
            totalPaidWithdrawalsUSDT: 0,
            totalPaidWithdrawalsCoins: 0,
            lastActiveAt: now
          })
        })
        await batch.commit()
      }
    } catch {}

    // 3.3. Neutralizar órdenes de prueba para que /api/admin/treasury/reconcile no resucite las ganancias
    if (purgeOrdersHistory) {
      try {
        const ordersSnap = await getDocs(query(collection(db, 'cashier_orders'), limit(150)))
        if (!ordersSnap.empty) {
          const batch = writeBatch(db)
          ordersSnap.forEach((oDoc) => {
            batch.update(oDoc.ref, {
              status: 'cancelled',
              reconcileExcluded: true,
              cancelledAt: now
            })
          })
          await batch.commit()
        }
      } catch {}
    }

    // 3.4. Purgar libro de turnos si fue solicitado
    if (purgeShiftLedger) {
      try {
        const shiftsSnap = await getDocs(query(collection(db, 'cashier_shifts_ledger'), limit(150)))
        if (!shiftsSnap.empty) {
          const batch = writeBatch(db)
          shiftsSnap.forEach((sDoc) => batch.delete(sDoc.ref))
          await batch.commit()
        }
      } catch {}
    }

    // 3.5. Purgar estadísticas diarias
    try {
      const statsSnap = await getDocs(query(collection(db, 'daily_stats'), limit(50)))
      if (!statsSnap.empty) {
        const batch = writeBatch(db)
        statsSnap.forEach((sDoc) => batch.delete(sDoc.ref))
        await batch.commit()
      }
    } catch {}
  }

  // 4. RESET OPCIONAL DE TELEMETRÍA
  if (resetTelemetryMetrics) {
    try {
      const telRef = doc(db, 'system_treasury', 'live_telemetry')
      await setDoc(telRef, {
        totalPlayersOnline: 0,
        offlineMatchesCount: 0,
        onlineTrainingPlayersCount: 0,
        competitivePlayersCount: 0,
        activeRoomsCount: 0,
        playersInLobby: 0,
        playersInAITraining: 0,
        playersInOnlineTraining: 0,
        playersInCompetitive: 0,
        serverStatus: 'healthy',
        updatedAt: now
      }, { merge: true })
    } catch {}
  }

  // 5. REGISTRO INMUTABLE DE AUDITORÍA
  try {
    const auditRef = doc(collection(db, 'audit_logs'))
    await setDoc(auditRef, {
      id: auditRef.id,
      action: 'ECONOMIC_HARD_RESET_HYBRID_SERVER',
      scope,
      adminUid: adminUid || 'adm_super_001',
      adminName: adminName || 'Super Admin',
      purgeOrdersHistory: Boolean(purgeOrdersHistory),
      purgeShiftLedger: Boolean(purgeShiftLedger),
      resetTelemetryMetrics: Boolean(resetTelemetryMetrics),
      timestamp: now
    })
  } catch {}

  return NextResponse.json({
    success: true,
    message: `Reinicio contable ejecutado con éxito bajo alcance: ${scope.toUpperCase()} (Motor Híbrido)`
  }, { headers: corsHeaders })

} catch (err: any) {
  console.error('[AdminResetAPI] Error general en reinicio contable:', err)
  return NextResponse.json(
    { success: false, error: err.message || 'Error al ejecutar el reinicio contable.' },
    { status: 500, headers: corsHeaders }
  )
}
}
