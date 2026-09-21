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
})


