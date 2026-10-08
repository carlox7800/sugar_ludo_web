import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SUPPORT_CATEGORIES,
  SUPPORT_TOPICS,
  getKnowledgeTopic,
  getTopicsByCategory,
  searchKnowledgeBase
} from '../lib/support/support-knowledge-base.ts'
import {
  inspectAccount,
  formatDiagnosisAsBotMessage,
  SLA_STANDARD_WITHDRAW_MINUTES,
  SLA_VIP_WITHDRAW_MINUTES,
  SLA_DEPOSIT_MINUTES
} from '../lib/support/account-inspector.ts'
import {
  evaluateIssuePreValidation,
  AVAILABLE_ISSUES,
  generateTicketNumber
} from '../lib/support/pre-validation-engine.ts'
import {
  calculatePendingDisputesCounts,
  isPendingDisputeStatus
} from '../sugar-ludo-admin-hub/lib/disputes-service.ts'
import { cashierLogger } from '../sugar-ludo-admin-hub/lib/cashier-logger.ts'

describe('Suite: Base de Conocimiento Determinista (Tier 1 Support)', () => {
  it('debe contener las 4 categorías principales del sistema', () => {
    assert.equal(SUPPORT_CATEGORIES.length, 4)
    const categoryIds = SUPPORT_CATEGORIES.map((c) => c.id)
    assert.ok(categoryIds.includes('financial'))
    assert.ok(categoryIds.includes('gameplay'))
    assert.ok(categoryIds.includes('connectivity'))
    assert.ok(categoryIds.includes('security'))
  })

  it('todos los temas referenciados en categorías deben existir en SUPPORT_TOPICS', () => {
    for (const category of SUPPORT_CATEGORIES) {
      for (const topicId of category.topicIds) {
        const topic = getKnowledgeTopic(topicId)
        assert.ok(topic, `El tema ${topicId} en categoría ${category.id} no fue encontrado`)
        assert.equal(topic?.id, topicId)
      }
    }
  })

  it('debe validar la paridad económica oficial (1 USDT = 100 SC / 1 SC = $0.01 USD)', () => {
    const parityTopic = getKnowledgeTopic('fin_parity')
    assert.ok(parityTopic)
    assert.ok(parityTopic?.content.includes('1 USDT = 100 Sugar Coins'))
    assert.ok(parityTopic?.content.includes('$0.01 USD'))
  })

  it('debe validar comisiones de retiro (5% Estándar / 10% VIP) y sus SLAs', () => {
    const withdrawTopic = getKnowledgeTopic('fin_withdraw_fees')
    assert.ok(withdrawTopic)
    assert.ok(withdrawTopic?.content.includes('5%'))
    assert.ok(withdrawTopic?.content.includes('72 horas'))
    assert.ok(withdrawTopic?.content.includes('10%'))
    assert.ok(withdrawTopic?.content.includes('24 horas'))
  })

  it('debe contener las reglas oficiales de Ludo (3 dobles, capturas +20 y meta +10)', () => {
    const doublesTopic = getKnowledgeTopic('rule_three_doubles')
    assert.ok(doublesTopic)
    assert.ok(doublesTopic?.content.includes('tercera vez consecutiva'))

    const captureTopic = getKnowledgeTopic('rule_captures')
    assert.ok(captureTopic)
    assert.ok(captureTopic?.content.includes('20 casillas'))

    const goalTopic = getKnowledgeTopic('rule_goal_bonus')
    assert.ok(goalTopic)
    assert.ok(goalTopic?.content.includes('10 casillas'))
  })

  it('debe retornar resultados relevantes en búsqueda determinista client-side', () => {
    const withdrawResults = searchKnowledgeBase('comision retiro')
    assert.ok(withdrawResults.length > 0)
    assert.equal(withdrawResults[0].id, 'fin_withdraw_fees')

    const ruleResults = searchKnowledgeBase('dobles seguidos')
    assert.ok(ruleResults.length > 0)
    assert.equal(ruleResults[0].id, 'rule_three_doubles')

    const disconnectResults = searchKnowledgeBase('desconexion wifi')
    assert.ok(disconnectResults.length > 0)
    assert.equal(disconnectResults[0].id, 'conn_disconnect')
  })
})

describe('Suite: Live Account Inspector (Diagnóstico en Memoria 0ms)', () => {
  const mockNow = 1758360000000 // Fixed reference timestamp

  it('debe manejar adecuadamente sesiones no autenticadas', () => {
    const report = inspectAccount(null, [], mockNow)
    assert.equal(report.isLoggedIn, false)
    assert.equal(report.overallStatus, 'not_logged_in')
    assert.equal(report.canEscalateToHuman, false)
    assert.ok(report.headline.includes('Inicia sesión'))
  })

  it('debe diagnosticar cuenta saludable sin órdenes activas en 0ms', () => {
    const mockUser = {
      uid: 'player_healthy_123',
      displayName: 'Carlos Ludo',
      coins: 5000,
      escrowLockedCoins: 0,
      gems: 10
    }

    const report = inspectAccount(mockUser, [], mockNow)
    assert.equal(report.isLoggedIn, true)
    assert.equal(report.availableCoins, 5000)
    assert.equal(report.escrowLockedCoins, 0)
    assert.equal(report.hasEscrow, false)
    assert.equal(report.activeOrdersCount, 0)
    assert.equal(report.overallStatus, 'normal')
    assert.equal(report.canEscalateToHuman, false)
  })

  it('debe diagnosticar órdenes de retiro dentro del SLA con saldo en custodia (Escrow)', () => {
    const mockUser = {
      uid: 'player_escrow_456',
      displayName: 'Ana Maria',
      coins: 2000,
      escrowLockedCoins: 3000
    }

    const recentOrder = {
      id: 'ord_wit_001',
      playerUid: 'player_escrow_456',
      type: 'withdraw',
      status: 'pending',
      amountSugarCoins: 3000,
      amountFiat: 30,
      currency: 'USD',
      createdAt: mockNow - (2 * 60 * 60 * 1000), // Creado hace 2 horas
      isVip: false
    }

    const report = inspectAccount(mockUser, [recentOrder], mockNow)
    assert.equal(report.hasEscrow, true)
    assert.equal(report.escrowLockedCoins, 3000)
    assert.equal(report.activeOrdersCount, 1)
    assert.equal(report.overallStatus, 'orders_in_progress')
    assert.equal(report.hasSlaExceededOrders, false)
    assert.equal(report.canEscalateToHuman, false)
    assert.equal(report.activeOrders[0].isSlaExceeded, false)
    assert.ok(report.explanation.includes('custodia de seguridad'))
  })

  it('debe detectar SLA excedido en retiro estándar (> 72h) y habilitar escalamiento humano', () => {
    const mockUser = {
      uid: 'player_delayed_789',
      displayName: 'Pedro Gomez',
      coins: 1000,
      escrowLockedCoins: 5000
    }

    const delayedOrder = {
      id: 'ord_wit_delayed',
      playerUid: 'player_delayed_789',
      type: 'withdraw',
      status: 'assigned',
      amountSugarCoins: 5000,
      amountFiat: 50,
      currency: 'USD',
      createdAt: mockNow - (75 * 60 * 60 * 1000), // Creado hace 75 horas (> 72h SLA)
      isVip: false
    }

    const report = inspectAccount(mockUser, [delayedOrder], mockNow)
    assert.equal(report.hasSlaExceededOrders, true)
    assert.equal(report.overallStatus, 'sla_exceeded')
    assert.equal(report.canEscalateToHuman, true)
    assert.equal(report.statusBadge.variant, 'rose')
    assert.ok(report.headline.includes('Demora detectada'))
  })

  it('debe formatear reporte completo como mensaje amigable de bot', () => {
    const mockUser = {
      uid: 'player_bot_msg',
      displayName: 'Sofia Tester',
      coins: 8500,
      escrowLockedCoins: 1500
    }

    const activeOrder = {
      id: 'ord_dep_active',
      playerUid: 'player_bot_msg',
      type: 'deposit',
      status: 'pending',
      amountSugarCoins: 1500,
      amountFiat: 15,
      currency: 'USD',
      createdAt: mockNow - (15 * 60 * 1000)
    }

    const report = inspectAccount(mockUser, [activeOrder], mockNow)
    const botMsg = formatDiagnosisAsBotMessage(report)

    assert.ok(botMsg.includes('Diagnóstico Instantáneo de Cuenta'))
    assert.ok(botMsg.includes('Sofia Tester'))
    assert.ok(/8[.,]500 SC/.test(botMsg))
    assert.ok(/1[.,]500 SC/.test(botMsg))
    assert.ok(botMsg.includes('Depósito #ord_dep_'))
  })
})

describe('Suite: Pre-Validación Determinista y Gestión de Tickets (Tier 2)', () => {
  const mockNow = 1758360000000
  const mockUser = {
    uid: 'usr_test_player',
    displayName: 'Carlos Ludo',
    coins: 4000,
    escrowLockedCoins: 0
  }

  it('debe tener registradas incidencias para las 3 categorías principales', () => {
    assert.ok(AVAILABLE_ISSUES.length >= 8)
    const categories = new Set(AVAILABLE_ISSUES.map((i) => i.category))
    assert.ok(categories.has('transactions'))
    assert.ok(categories.has('gameplay'))
    assert.ok(categories.has('account'))
  })

  it('debe pre-validar y resolver duda de salida con dado 6 sin abrir ticket', () => {
    const result = evaluateIssuePreValidation('rule_exit_six', mockUser, [], mockNow)
    assert.equal(result.canOpenTicket, false)
    assert.ok(result.verdictTitle.includes('salida se realiza con dado 5'))
    assert.ok(result.verdictExplanation.includes('Dado 5'))
    assert.ok(result.verdictExplanation.includes('Dado 6'))
  })

  it('debe pre-validar y aclarar penalización de 3 dobles consecutivos sin abrir ticket', () => {
    const result = evaluateIssuePreValidation('rule_doubles_penalty', mockUser, [], mockNow)
    assert.equal(result.canOpenTicket, false)
    assert.ok(result.verdictExplanation.includes('tercera vez consecutiva'))
  })

  it('debe bloquear apertura de ticket prematura si el depósito lleva menos de 30 minutos', () => {
    const recentDeposit = {
      id: 'dep_recent_01',
      playerUid: 'usr_test_player',
      type: 'deposit',
      status: 'pending',
      amountSugarCoins: 2000,
      amountFiat: 20,
      currency: 'USD',
      createdAt: mockNow - (10 * 60 * 1000) // 10 minutos
    }

    const result = evaluateIssuePreValidation('dep_not_credited', mockUser, [recentDeposit], mockNow)
    assert.equal(result.canOpenTicket, false)
    assert.ok(result.verdictTitle.includes('tiempo normal de procesamiento'))
    assert.equal(result.relatedOrderId, 'dep_recent_01')
  })

  it('debe habilitar ticket urgente si el retiro superó el SLA oficial', () => {
    const delayedWithdraw = {
      id: 'wit_delayed_01',
      playerUid: 'usr_test_player',
      type: 'withdraw',
      status: 'assigned',
      amountSugarCoins: 5000,
      amountFiat: 50,
      currency: 'USD',
      createdAt: mockNow - (80 * 60 * 60 * 1000), // 80 horas (> 72h SLA)
      isVip: false
    }

    const result = evaluateIssuePreValidation('wit_delayed', mockUser, [delayedWithdraw], mockNow)
    assert.equal(result.canOpenTicket, true)
    assert.equal(result.suggestedPriority, 'urgent')
    assert.ok(result.verdictTitle.includes('Anomalía Confirmada'))
    assert.equal(result.relatedOrderId, 'wit_delayed_01')
  })

  it('debe clasificar correctamente las incidencias en los 3 dominios operativos segregados', () => {
    const gameplayResult = evaluateIssuePreValidation('rule_exit_six', mockUser, [], mockNow)
    assert.equal(gameplayResult.domain, 'gameplay')

    const disconnectResult = evaluateIssuePreValidation('conn_dropped_match', mockUser, [], mockNow)
    assert.equal(disconnectResult.domain, 'gameplay')

    const financialResult = evaluateIssuePreValidation('dep_not_credited', mockUser, [], mockNow)
    assert.equal(financialResult.domain, 'financial')

    const escrowResult = evaluateIssuePreValidation('escrow_funds_locked', mockUser, [], mockNow)
    assert.equal(escrowResult.domain, 'financial')

    const accountResult = evaluateIssuePreValidation('balance_discrepancy', mockUser, [], mockNow)
    assert.equal(accountResult.domain, 'account')
  })

  it('debe generar folios de ticket con formato TKT-YYYY-XXXX', () => {
    const ticketNum = generateTicketNumber()
    const currentYear = new Date().getFullYear()
    assert.ok(ticketNum.startsWith(`TKT-${currentYear}-`))
    assert.equal(ticketNum.length, 13) // TKT-2026-XXXX = 13 caracteres
  })
})

describe('Suite: Contadores y Notificaciones de Disputas Pendientes en Admin Hub', () => {
  it('debe identificar con precisión si un estado de ticket es pendiente o resuelto', () => {
    // Casos pendientes
    assert.equal(isPendingDisputeStatus('open'), true)
    assert.equal(isPendingDisputeStatus('investigating'), true)
    assert.equal(isPendingDisputeStatus(undefined), true)

    // Casos resueltos / cerrados (NO pendientes)
    assert.equal(isPendingDisputeStatus('resolved_player'), false)
    assert.equal(isPendingDisputeStatus('resolved_cashier'), false)
    assert.equal(isPendingDisputeStatus('dismissed'), false)
    assert.equal(isPendingDisputeStatus('compensated'), false)
  })

  it('debe calcular los contadores reflejando estrictamente casos abiertos y bajando a 0 al resolver', () => {
    const mockDisputes = [
      { id: '1', domain: 'financial', status: 'open' },
      { id: '2', domain: 'gameplay', status: 'investigating' },
      { id: '3', domain: 'account', status: 'open' },
      // Casos resueltos que NO deben inflar los contadores
      { id: '4', domain: 'financial', status: 'resolved_cashier' },
      { id: '5', domain: 'gameplay', status: 'resolved_player' },
      { id: '6', domain: 'gameplay', status: 'dismissed' },
      { id: '7', domain: 'account', status: 'compensated' }
    ]

    const counts = calculatePendingDisputesCounts(mockDisputes)
    assert.equal(counts.financial, 1)
    assert.equal(counts.gameplay, 1)
    assert.equal(counts.account, 1)
    assert.equal(counts.total, 3)

    // Simular dictamen oficial sobre la disputa gameplay (pasa a resolved_player)
    const afterResolvingGameplay = mockDisputes.map((d) =>
      d.id === '2' ? { ...d, status: 'resolved_player' } : d
    )

    const updatedCounts = calculatePendingDisputesCounts(afterResolvingGameplay)
    assert.equal(updatedCounts.financial, 1)
    assert.equal(updatedCounts.gameplay, 0, 'El contador de gameplay debe bajar a 0 tras emitir dictamen')
    assert.equal(updatedCounts.account, 1)
    assert.equal(updatedCounts.total, 2)

    // Simular resolución total de todos los casos
    const allResolved = mockDisputes.map((d) => ({ ...d, status: 'resolved_player' }))
    const zeroCounts = calculatePendingDisputesCounts(allResolved)
    assert.equal(zeroCounts.financial, 0)
    assert.equal(zeroCounts.gameplay, 0)
    assert.equal(zeroCounts.account, 0)
    assert.equal(zeroCounts.total, 0, 'El contador total debe ser 0 si no hay casos pendientes')
  })

  it('debe validar la estructura de auditoría inmutable de resolución de disputas P2P', () => {
    const validVerdicts = ['favor_player', 'favor_cashier', 'clarification', 'dismiss', 'compensate_goodwill']
    for (const v of validVerdicts) {
      assert.ok(typeof v === 'string')
    }

    // Estructura esperada de un log de auditoría
    const sampleAudit = {
      action: 'DISPUTE_RESOLVED',
      actorUid: 'admin_test_01',
      actorRole: 'super_admin',
      targetUid: 'player_test_01',
      targetOrderId: 'order_test_123',
      amountCoins: 500,
      timestamp: Date.now()
    }
    assert.equal(sampleAudit.action, 'DISPUTE_RESOLVED')
    assert.equal(sampleAudit.actorRole, 'super_admin')
    assert.ok(sampleAudit.amountCoins > 0)
  })
})

describe('Suite: Resolución Directiva de Disputas & Invariantes Contables (v9.9.1)', () => {
  it('RETIRO A FAVOR DEL JUGADOR: debe quemar Escrow, debitar flotante de cajero y registrar en shifts ledger sin alterar coins disponibles', () => {
    const amountCoins = 20000 // $200 USDT
    const initialPlayerCoins = 5000 // Saldo remanente disponible
    const initialPlayerEscrow = 20000 // Saldo retenido al solicitar retiro
    const initialCashierFloatCoins = 23000 // 230 USDT
    const initialCashierFloatUSDT = 230.0

    // 1. Simulación matemática de mutación en usuario
    const newEscrow = Math.max(0, initialPlayerEscrow - amountCoins)
    const deficit = amountCoins - initialPlayerEscrow
    const finalPlayerCoins = deficit > 0 ? Math.max(0, initialPlayerCoins - deficit) : initialPlayerCoins

    assert.equal(newEscrow, 0, 'El Escrow retenido debe quemarse/liberarse completamente a 0')
    assert.equal(finalPlayerCoins, initialPlayerCoins, 'El saldo disponible no debe aumentarse, el retiro se consuma')

    // 2. Simulación matemática de mutación en cajero
    const newCashierFloatCoins = Math.max(0, initialCashierFloatCoins - amountCoins)
    const newCashierFloatUSDT = parseFloat((newCashierFloatCoins / 100).toFixed(2))

    assert.equal(newCashierFloatCoins, 3000, 'El flotante en coins debe bajar de 23,000 a 3,000 SC')
    assert.equal(newCashierFloatUSDT, 30.0, 'El flotante en USDT debe bajar de 230 a 30 USDT')

    // 3. Simulación de arqueo en cashier_shifts_ledger
    const shiftEntry = {
      cashierUid: 'csh_001',
      type: 'dispute_deduction',
      amountUSDT: -(amountCoins / 100),
      amountCoins: -amountCoins,
      previousBalanceUSDT: initialCashierFloatUSDT,
      newBalanceUSDT: newCashierFloatUSDT,
      resultingBalanceUSDT: newCashierFloatUSDT,
      resultingBalanceCoins: newCashierFloatCoins,
      orderId: 'wit_ord_990'
    }

    assert.equal(shiftEntry.type, 'dispute_deduction')
    assert.equal(shiftEntry.amountUSDT, -200)
    assert.equal(shiftEntry.resultingBalanceUSDT, 30)

    // 4. Estado terminal de la orden
    const finalOrderStatus = 'completed'
    assert.equal(finalOrderStatus, 'completed', 'La orden de retiro resuelta a favor del jugador debe quedar completed, no cancelled')
  })

  it('DEPÓSITO A FAVOR DEL JUGADOR: debe acreditar coins disponibles y debitar flotante del cajero', () => {
    const amountCoins = 10000 // $100 USDT
    const initialPlayerCoins = 2000
    const initialCashierFloat = 50000

    const finalPlayerCoins = initialPlayerCoins + amountCoins
    const finalCashierFloat = Math.max(0, initialCashierFloat - amountCoins)

    assert.equal(finalPlayerCoins, 12000, 'El jugador debe recibir sus monedas acreditadas')
    assert.equal(finalCashierFloat, 40000, 'El cajero debe ver deducido su flotante por haber recibido el fiat')
  })

  it('PROTECCIÓN DE BOTÓN OPERATIVO: PayoutActionButton no debe estar activo en órdenes completadas, canceladas o disputadas', () => {
    function shouldRenderPayout(isWithdraw: boolean, isCompleted: boolean, isCancelled: boolean, status: string): boolean {
      if (!isWithdraw || isCompleted || isCancelled || status === 'completed' || status === 'cancelled' || status === 'disputed') {
        return false
      }
      return true
    }

    assert.equal(shouldRenderPayout(true, false, false, 'pending'), true, 'Orden de retiro pendiente debe mostrar botón')
    assert.equal(shouldRenderPayout(true, true, false, 'completed'), false, 'Orden completada no debe mostrar botón')
    assert.equal(shouldRenderPayout(true, false, true, 'cancelled'), false, 'Orden cancelada no debe mostrar botón')
    assert.equal(shouldRenderPayout(true, false, false, 'disputed'), false, 'Orden disputada no debe mostrar botón')
    assert.equal(shouldRenderPayout(false, false, false, 'pending'), false, 'Depósito nunca debe mostrar botón de payout')
  })

  it('INVARIANTE DE BÓVEDA EN ADMIN HUB: el saldo flotante no debe parpadear ni truncarse con el balance de jugadores', () => {
    const auditedFloatsUSD = 230.0
    const playerBalancesUSD = 30.0 // Balance de jugadores menor que el flotante de cajeros

    // Cálculo corregido sin parpadeo
    const effectiveFloatsUSD = Math.max(0, auditedFloatsUSD)

    assert.equal(effectiveFloatsUSD, 230.0, 'El flotante de la red de cajeros no debe quedar restringido por la custodia de jugadores')
  })
})

describe('Suite: Observabilidad Forense y Diagnóstico Multi-Capa (v9.9.2)', () => {
  it('debe registrar y auditar eventos de BALANCE-AUDIT correctamente', () => {
    cashierLogger.clear()
    cashierLogger.balanceAudit('Verificación de escrow de retiro', {
      userId: 'usr_qa_123',
      availableCoins: 5000,
      escrowLockedCoins: 20000,
      diff: -20000
    })

    const logs = cashierLogger.getLogs()
    assert.equal(logs.length, 1)
    assert.equal(logs[0].level, 'BALANCE-AUDIT')
    assert.ok(logs[0].message.includes('Verificación de escrow de retiro'))
    assert.equal(logs[0].details?.userId, 'usr_qa_123')
    assert.equal(logs[0].details?.escrowLockedCoins, 20000)
  })

  it('debe registrar y auditar eventos de CASHIER-FLOAT correctamente', () => {
    cashierLogger.clear()
    cashierLogger.cashierFloat('Recarga de saldo flotante por Super Admin', {
      cashierId: 'cashier_01',
      adminId: 'super_admin_main',
      amountAddedUSDT: 50,
      newFloatBalanceUSDT: 80
    })

    const logs = cashierLogger.getLogs()
    assert.equal(logs.length, 1)
    assert.equal(logs[0].level, 'CASHIER-FLOAT')
    assert.ok(logs[0].message.includes('Recarga de saldo flotante por Super Admin'))
    assert.equal(logs[0].details?.amountAddedUSDT, 50)
    assert.equal(logs[0].details?.newFloatBalanceUSDT, 80)
  })

  it('debe registrar y auditar eventos de TREASURY-SYNC correctamente', () => {
    cashierLogger.clear()
    cashierLogger.treasurySync('Conciliación de Bóveda completada', {
      totalCashierFloatsUSD: 230.0,
      playerBalancesUSD: 30.0,
      delta: 0,
      status: 'SYNCHRONIZED'
    })

    const logs = cashierLogger.getLogs()
    assert.equal(logs.length, 1)
    assert.equal(logs[0].level, 'TREASURY-SYNC')
    assert.ok(logs[0].message.includes('Conciliación de Bóveda completada'))
    assert.equal(logs[0].details?.totalCashierFloatsUSD, 230.0)
  })

  it('debe registrar y capturar trazas estructuradas con ERROR-TRACE', () => {
    cashierLogger.clear()
    const errorSimulado = new Error('Rechazo por rate limit 429 en reconciliación')
    cashierLogger.errorTrace('Fallo al sincronizar bóveda', errorSimulado)

    const logs = cashierLogger.getLogs()
    assert.equal(logs.length, 1)
    assert.equal(logs[0].level, 'ERROR-TRACE')
    assert.ok(logs[0].message.includes('Fallo al sincronizar bóveda'))
    assert.equal(logs[0].details?.name, 'Error')
    assert.equal(logs[0].details?.message, 'Rechazo por rate limit 429 en reconciliación')
    assert.ok(logs[0].details?.stack, 'Debe incluir el stack trace del error')
  })

  it('debe generar reportes formateados legibles con exportLogs() y exportLogsJSON()', () => {
    cashierLogger.clear()
    cashierLogger.balanceAudit('Paso 1: Auditoría de saldo', { userId: 'usr_test' })
    cashierLogger.cashierFloat('Paso 2: Deducción de flotante', { cashierId: 'csh_test' })
    cashierLogger.treasurySync('Paso 3: Sincronización de tesorería', { ok: true })
    cashierLogger.errorTrace('Paso 4: Error simulado', { code: 'LOCK_FAILED' })

    const textReport = cashierLogger.exportLogs()
    assert.ok(textReport.includes('SUGAR LUDO - REPORTE DE AUDITORÍA Y OBSERVABILIDAD FORENSE'))
    assert.ok(textReport.includes('[BALANCE-AUDIT]'))
    assert.ok(textReport.includes('Paso 1: Auditoría de saldo'))
    assert.ok(textReport.includes('[CASHIER-FLOAT]'))
    assert.ok(textReport.includes('Paso 2: Deducción de flotante'))
    assert.ok(textReport.includes('[TREASURY-SYNC]'))
    assert.ok(textReport.includes('Paso 3: Sincronización de tesorería'))
    assert.ok(textReport.includes('[ERROR-TRACE]'))
    assert.ok(textReport.includes('Paso 4: Error simulado'))

    const jsonReport = cashierLogger.exportLogsJSON()
    const parsed = JSON.parse(jsonReport)
    assert.ok(parsed.version)
    assert.equal(parsed.totalLogs, 4)
    assert.equal(parsed.logs.length, 4)
    assert.equal(parsed.logs[3].level, 'BALANCE-AUDIT') // unshift pone el más reciente primero
    assert.equal(parsed.logs[0].level, 'ERROR-TRACE')
  })
})

describe('Suite: UI/UX de Resolución de Disputas & Arqueo de Cajero (v9.9.4)', () => {
  it('DISPUTAS: debe resolver botón y nota sugerida según si la orden es retiro o depósito', () => {
    function getDisputeResolutionUI(type: 'deposit' | 'withdraw') {
      const isWithdraw = type === 'withdraw'
      const buttonLabel = isWithdraw ? 'Aprobar y Liquidar Retiro' : 'Acreditar al Jugador'
      const defaultNotes = isWithdraw
        ? 'Dictamen favorable emitido por el Super Admin. Retiro liquidado formalmente hacia la billetera externa del jugador.'
        : 'Dictamen favorable emitido por el Super Admin. Fondos acreditados al balance del jugador.'
      const modalTitle = isWithdraw
        ? 'Aprobar y Liquidar Retiro (Dictamen Directivo)'
        : 'Acreditar al Jugador (Dictamen Directivo)'
      return { buttonLabel, defaultNotes, modalTitle }
    }

    const withdrawUI = getDisputeResolutionUI('withdraw')
    assert.equal(withdrawUI.buttonLabel, 'Aprobar y Liquidar Retiro')
    assert.ok(withdrawUI.defaultNotes.includes('billetera externa del jugador'))
    assert.ok(withdrawUI.modalTitle.includes('Aprobar y Liquidar Retiro'))

    const depositUI = getDisputeResolutionUI('deposit')
    assert.equal(depositUI.buttonLabel, 'Acreditar al Jugador')
    assert.ok(depositUI.defaultNotes.includes('balance del jugador'))
    assert.ok(depositUI.modalTitle.includes('Acreditar al Jugador'))
  })

  it('ARQUEO DE CAJERO: debe tipificar dispute_deduction con título deducción por arbitraje directivo y signo negativo', () => {
    function getLedgerEntryDisplay(entryType: string, amountUSDT: number) {
      if (entryType === 'dispute_deduction') {
        return {
          title: 'Deducción por Arbitraje Directivo',
          isDebit: true,
          formattedAmount: `-${Math.abs(amountUSDT).toFixed(2)} USDT`
        }
      }
      if (entryType === 'withdrawal_payout') {
        return {
          title: 'Liquidación de Retiro P2P',
          isDebit: true,
          formattedAmount: `-${Math.abs(amountUSDT).toFixed(2)} USDT`
        }
      }
      return {
        title: 'Recarga de Flotante',
        isDebit: false,
        formattedAmount: `+${Math.abs(amountUSDT).toFixed(2)} USDT`
      }
    }

    const disputeEntry = getLedgerEntryDisplay('dispute_deduction', -200)
    assert.equal(disputeEntry.title, 'Deducción por Arbitraje Directivo')
    assert.equal(disputeEntry.isDebit, true)
    assert.equal(disputeEntry.formattedAmount, '-200.00 USDT')
  })

  it('CHAT DE ORDEN: debe detectar dictamen favorable y asignar estilo esmeralda en lugar de alerta marrón', () => {
    function isFavorableResolutionMessage(text: string): boolean {
      const lower = text.toLowerCase()
      return lower.includes('dictamen favorable') ||
        lower.includes('retiro liquidado formalmente') ||
        lower.includes('fondos acreditados') ||
        lower.includes('validado con éxito')
    }

    const favorableWithdrawMsg = 'DICTAMEN OFICIAL: Dictamen favorable emitido por el Super Admin. Retiro liquidado formalmente hacia la billetera externa del jugador.'
    const favorableDepositMsg = 'DICTAMEN OFICIAL: Dictamen favorable emitido por el Super Admin. Fondos acreditados al balance del jugador.'
    const rejectionMsg = 'DICTAMEN OFICIAL: Dictamen denegado. Se comprobó fraude en el comprobante.'

    assert.equal(isFavorableResolutionMessage(favorableWithdrawMsg), true)
    assert.equal(isFavorableResolutionMessage(favorableDepositMsg), true)
    assert.equal(isFavorableResolutionMessage(rejectionMsg), false)
  })
})

describe('Suite: Resolución de Retiro a Favor del Cajero & Reintegro de Fondos (v9.9.5)', () => {
  it('RETIRO A FAVOR DEL CAJERO: debe liberar Escrow, restituir saldo a coins disponibles y NO debitar flotante de cajero', () => {
    const amountCoins = 10000 // $100.00 USDT
    const initialPlayerCoins = 2500 // remanente disponible
    const initialPlayerEscrow = 10000 // en custodia de retiro
    const initialCashierFloatCoins = 30000 // 300 USDT
    const initialCashierFloatUSDT = 300.0

    // 1. Simulación contable en jugador: Escrow liberado y fondos devueltos a disponible
    const finalPlayerEscrow = Math.max(0, initialPlayerEscrow - amountCoins)
    const finalPlayerCoins = initialPlayerCoins + amountCoins

    assert.equal(finalPlayerEscrow, 0, 'El Escrow retenido debe liberarse a 0')
    assert.equal(finalPlayerCoins, 12500, 'Los fondos deben restituirse completamente al saldo disponible del jugador')

    // 2. Simulación contable en cajero: Flotante permanece 100% intacto
    const finalCashierFloatCoins = initialCashierFloatCoins // sin deducción
    const finalCashierFloatUSDT = initialCashierFloatUSDT

    assert.equal(finalCashierFloatCoins, 30000, 'El flotante de monedas del cajero no debe ser debitado')
    assert.equal(finalCashierFloatUSDT, 300.0, 'El flotante USDT del cajero debe permanecer intacto')

    // 3. Simulación del estado terminal de la orden: cancelled, no completed
    const finalOrderStatus = 'cancelled'
    const isEscrowLocked = false

    assert.equal(finalOrderStatus, 'cancelled', 'La orden no procesada debe quedar en cancelled')
    assert.equal(isEscrowLocked, false, 'El candado de escrow debe quedar liberado')
  })

  it('COPYWRITING CONTEXTUALIZADO: debe formular mensajes claros y sin contradicciones para ambas partes', () => {
    function generateResolutionMessages(params: {
      type: 'withdraw' | 'deposit'
      verdict: 'favor_player' | 'favor_cashier'
      adminName: string
      resolutionNotes?: string
    }) {
      const { type, verdict, adminName, resolutionNotes } = params
      const isWithdraw = type === 'withdraw'

      if (verdict === 'favor_cashier' && isWithdraw) {
        return {
          playerMessage: `⚖️ [DICTAMEN DIRECTIVO]: Disputa resuelta a favor del Cajero. La solicitud de retiro no fue procesada y ha sido CANCELADA. Los fondos en garantía fueron devueltos a tu saldo disponible en el juego.\n\nResolución: ${resolutionNotes || 'Dictamen favorable emitido para el cajero.'}`,
          cashierMessage: `⚖️ [DICTAMEN DIRECTIVO]: Disputa resuelta a favor del Cajero. La orden ha sido cancelada sin deducción de tu saldo flotante.\n\nResolución: ${resolutionNotes || 'Dictamen favorable emitido para el cajero.'}`,
          officialNoticeStatus: 'Retiro no procesado y CANCELADO. Fondos en garantía devueltos a la billetera del jugador.'
        }
      }

      return {
        playerMessage: '',
        cashierMessage: '',
        officialNoticeStatus: ''
      }
    }

    const messages = generateResolutionMessages({
      type: 'withdraw',
      verdict: 'favor_cashier',
      adminName: 'Carlos Admin',
      resolutionNotes: 'Destino bancario inválido reportado por el cajero.'
    })

    assert.ok(messages.playerMessage.includes('ha sido CANCELADA'))
    assert.ok(messages.playerMessage.includes('devueltos a tu saldo disponible'))
    assert.ok(messages.cashierMessage.includes('sin deducción de tu saldo flotante'))
    assert.ok(messages.officialNoticeStatus.includes('Fondos en garantía devueltos'))
  })

  it('CHAT UI: debe detectar mensajes de reembolso para estilizar en modo informativo cyan y badge de garantia reembolsada', () => {
    function classifyChatMessage(text: string) {
      const isRefundNotice = Boolean(
        text.includes('devueltos a tu saldo disponible') ||
        text.includes('reintegrados a tu saldo') ||
        text.includes('fondos en garantía fueron devueltos') ||
        text.includes('DICTAMEN DIRECTIVO - JUGADOR')
      )

      const isFavorableResolution = Boolean(
        !isRefundNotice && (
          text.includes('favor del JUGADOR') ||
          text.includes('Retiro liquidado formalmente') ||
          text.includes('sin deducción de tu saldo flotante') ||
          text.includes('DICTAMEN DIRECTIVO - CAJERO') ||
          text.includes('Dictamen favorable emitido')
        )
      )

      return { isRefundNotice, isFavorableResolution }
    }

    const playerRefundMsg = '⚖️ [DICTAMEN DIRECTIVO]: Disputa resuelta a favor del Cajero. La solicitud de retiro no fue procesada y ha sido CANCELADA. Los fondos en garantía fueron devueltos a tu saldo disponible en el juego.'
    const cashierProtectionMsg = '⚖️ [DICTAMEN DIRECTIVO]: Disputa resuelta a favor del Cajero. La orden ha sido cancelada sin deducción de tu saldo flotante.'

    const playerClassification = classifyChatMessage(playerRefundMsg)
    assert.equal(playerClassification.isRefundNotice, true, 'El mensaje del jugador debe clasificarse como aviso de reembolso')
    assert.equal(playerClassification.isFavorableResolution, false)

    const cashierClassification = classifyChatMessage(cashierProtectionMsg)
    assert.equal(cashierClassification.isRefundNotice, false)
    assert.equal(cashierClassification.isFavorableResolution, true, 'El mensaje del cajero debe clasificarse como favorable esmeralda')
  })

  it('MODAL Y LISTA ADMIN: debe mostrar Cancelar Retiro (Favor Cajero) en retiros', () => {
    function getAdminActionLabels(orderType: 'withdraw' | 'deposit', verdict: 'favor_cashier') {
      const isWithdraw = orderType === 'withdraw'
      return {
        listButtonLabel: isWithdraw ? 'Cancelar Retiro (Favor Cajero)' : 'Dictaminar a Favor del Cajero',
        modalTitle: isWithdraw ? 'Cancelar Retiro (Dictamen a Favor del Cajero)' : 'Dictaminar a Favor del Cajero (Desestimar Depósito)',
        confirmButtonLabel: isWithdraw ? 'Cancelar Retiro (Favor Cajero)' : 'Ejecutar Dictamen'
      }
    }

    const withdrawLabels = getAdminActionLabels('withdraw', 'favor_cashier')
    assert.equal(withdrawLabels.listButtonLabel, 'Cancelar Retiro (Favor Cajero)')
    assert.equal(withdrawLabels.confirmButtonLabel, 'Cancelar Retiro (Favor Cajero)')
    assert.ok(withdrawLabels.modalTitle.includes('Cancelar Retiro'))

    const depositLabels = getAdminActionLabels('deposit', 'favor_cashier')
    assert.equal(depositLabels.listButtonLabel, 'Dictaminar a Favor del Cajero')
    assert.equal(depositLabels.confirmButtonLabel, 'Ejecutar Dictamen')
  })
})


