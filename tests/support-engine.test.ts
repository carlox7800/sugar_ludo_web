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
