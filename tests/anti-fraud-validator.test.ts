import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePlayerBalanceAudit } from '../sugar-ludo-admin-hub/lib/anti-fraud-evaluator.ts'

describe('Suite: Validador Antifraude Automatizado de Retiros ($0.00 Spark)', () => {
  it('debe certificar (score 100) un saldo legítimo respaldado por depósitos y partidas ganadas', () => {
    const audit = evaluatePlayerBalanceAudit({
      currentCoins: 1200,
      escrowLockedCoins: 500, // Total activo: 1700 SC
      accountingSummary: {
        totalDepositedCoins: 1500,
        totalWonCoins: 800,
        totalMatchFeesCoins: 800, // Turnover: 800/1500 = 53.3% >= 50%
        totalWithdrawnCoins: 0
      },
      welcomeBonus: 200
      // Max teórico: 200 + 1500 + 800 - 800 - 0 = 1700 SC
      // Activo (1700) <= Max teórico (1700) -> Delta = 0
    })

    assert.equal(audit.status, 'certified')
    assert.equal(audit.score, 100)
    assert.ok(audit.reason.includes('certificado'))
    assert.equal(audit.details?.discrepancyDelta, 0)
  })

  it('debe advertir con estado "low_turnover" (score 70) si el usuario jugó menos del 50% de sus depósitos', () => {
    const audit = evaluatePlayerBalanceAudit({
      currentCoins: 1900,
      escrowLockedCoins: 0,
      accountingSummary: {
        totalDepositedCoins: 2000,
        totalWonCoins: 100,
        totalMatchFeesCoins: 200, // Turnover: 200/2000 = 10% < 50%
        totalWithdrawnCoins: 0
      },
      welcomeBonus: 200
      // Max teórico: 200 + 2000 + 100 - 200 = 2100 SC
      // Activo (1900) <= Max teórico (2100) -> Balance legítimo, pero turnover 10% < 50%
    })

    assert.equal(audit.status, 'low_turnover')
    assert.equal(audit.score, 70)
    assert.ok(audit.reason.includes('Turnover de juego (10%) inferior al umbral del 50%'))
  })

  it('debe bloquear tajantemente (status "blocked", score 0) si detecta saldo huérfano / inyección (> 100 SC)', () => {
    const audit = evaluatePlayerBalanceAudit({
      currentCoins: 5000,
      escrowLockedCoins: 1000, // Total activo: 6000 SC
      accountingSummary: {
        totalDepositedCoins: 1000,
        totalWonCoins: 500,
        totalMatchFeesCoins: 300,
        totalWithdrawnCoins: 0
      },
      welcomeBonus: 200
      // Max teórico: 200 + 1000 + 500 - 300 = 1400 SC
      // Total activo (6000) excede 1400 por +4600 SC
    })

    assert.equal(audit.status, 'blocked')
    assert.equal(audit.score, 0)
    assert.ok(audit.reason.includes('Discrepancia contable crítica'))
    assert.ok(audit.details?.discrepancyDelta! > 100)
  })

  it('debe reconstruir con éxito la contabilidad desde walletHistory si no existe accountingSummary', () => {
    const audit = evaluatePlayerBalanceAudit({
      currentCoins: 400,
      escrowLockedCoins: 300,
      walletHistory: [
        { id: '1', type: 'deposit', amount: 500, description: 'Depósito Aprobado P2P' },
        { id: '2', type: 'bet', amount: -200, description: 'Entrada Mesa 4J' },
        { id: '3', type: 'win', amount: 350, description: 'Ganancia 1er Lugar' }
      ],
      welcomeBonus: 200
      // Max teórico: 200 (welcome) + 500 (deposit) + 350 (win) - 200 (fee) = 850 SC
      // Activo: 700 SC <= 850 SC
      // Turnover: 200/500 = 40% < 50% -> low_turnover
    })

    assert.equal(audit.status, 'low_turnover')
    assert.equal(audit.details?.totalDepositedCoins, 500)
    assert.equal(audit.details?.totalWonCoins, 350)
    assert.equal(audit.details?.totalMatchFeesCoins, 200)
  })

  it('debe respetar el margen de tolerancia de seguridad (100 SC) para evitar falsos positivos por redondeo', () => {
    const audit = evaluatePlayerBalanceAudit({
      currentCoins: 550,
      escrowLockedCoins: 0,
      accountingSummary: {
        totalDepositedCoins: 500,
        totalWonCoins: 0,
        totalMatchFeesCoins: 300, // Turnover: 60% >= 50%
        totalWithdrawnCoins: 0
      },
      welcomeBonus: 200
      // Max teórico: 200 + 500 - 300 = 400 SC
      // Saldo activo = 550 SC (+150 delta > 100) -> blocked
    })
    assert.equal(audit.status, 'blocked')

    const auditOk = evaluatePlayerBalanceAudit({
      currentCoins: 450,
      escrowLockedCoins: 0,
      accountingSummary: {
        totalDepositedCoins: 500,
        totalWonCoins: 0,
        totalMatchFeesCoins: 300, // Turnover: 60% >= 50%
        totalWithdrawnCoins: 0
      },
      welcomeBonus: 200
      // Max teórico: 200 + 500 - 300 = 400 SC
      // Saldo activo = 450 SC (+50 delta <= 100) -> tolerable, certified
    })
    assert.equal(auditOk.status, 'certified')
  })
})
