import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { 
  validateCompetitiveTier, 
  validateEconomyConfig, 
  formatDualWritePayload,
  DEFAULT_ECONOMY_MATRIX
} from '../sugar-ludo-admin-hub/lib/economy-validator.ts'

describe('Fase 1: Control Remoto y Validación de Invariantes de Economía', () => {

  it('debe validar exitosamente todos los tiers oficiales por defecto (2 a 6 jugadores, 100 a 300 SC)', () => {
    const defaultTiers = [
      { playerCount: 2, entryFeeSC: 100, potSC: 200, prizesSC: [150] },
      { playerCount: 3, entryFeeSC: 120, potSC: 360, prizesSC: [200, 80] },
      { playerCount: 4, entryFeeSC: 150, potSC: 600, prizesSC: [300, 150] },
      { playerCount: 5, entryFeeSC: 200, potSC: 1000, prizesSC: [400, 200, 100] },
      { playerCount: 6, entryFeeSC: 300, potSC: 1800, prizesSC: [600, 450, 250, 100] },
    ]

    for (const tier of defaultTiers) {
      const result = validateCompetitiveTier(tier)
      assert.equal(result.valid, true, `Tier ${tier.playerCount}J debería ser válido`)
    }
  })

  it('INVARIANTE FINANCIERO: debe rechazar inmediatamente cualquier tier con déficit financiero (premios > pozo)', () => {
    const deficitTier = {
      playerCount: 2,
      entryFeeSC: 100,
      potSC: 200,
      prizesSC: [250] // Premios superan el pozo de 200
    }
    const result = validateCompetitiveTier(deficitTier)
    assert.equal(result.valid, false)
    assert.match(result.error || '', /Déficit financiero detectado/)
  })

  it('INVARIANTE MATEMÁTICO: debe rechazar pozo incoherente (pozo != entry * playerCount)', () => {
    const corruptTier = {
      playerCount: 4,
      entryFeeSC: 150,
      potSC: 500, // 4 * 150 = 600, no 500
      prizesSC: [300, 150]
    }
    const result = validateCompetitiveTier(corruptTier)
    assert.equal(result.valid, false)
    assert.match(result.error || '', /Invariante violado/)
  })

  it('CANDADO RAKE: debe rechazar rakes abusivos que superen el 35%', () => {
    const abusiveTier = {
      playerCount: 2,
      entryFeeSC: 100,
      potSC: 200,
      prizesSC: [100] // Rake de 100/200 = 50%
    }
    const result = validateCompetitiveTier(abusiveTier)
    assert.equal(result.valid, false)
    assert.match(result.error || '', /Rake excesivo/)
  })

  it('debe validar y sanitizar una configuración económica global completa', () => {
    const fullPayload = {
      competitiveMatrix: [
        { playerCount: 2, entryFeeSC: 100, potSC: 200, prizesSC: [150] },
        { playerCount: 3, entryFeeSC: 120, potSC: 360, prizesSC: [200, 80] },
        { playerCount: 4, entryFeeSC: 150, potSC: 600, prizesSC: [300, 150] },
        { playerCount: 5, entryFeeSC: 200, potSC: 1000, prizesSC: [400, 200, 100] },
        { playerCount: 6, entryFeeSC: 300, potSC: 1800, prizesSC: [600, 450, 250, 100] },
      ],
      normalFee: 5.0,
      vipFee: 10.0,
      doubleXpActive: true,
      goldRushMultiplier: 2.5,
      tournamentBonusPct: 15,
      items: [{ id: 'emote_toxic_salt', priceCoins: 250 }]
    }

    const res = validateEconomyConfig(fullPayload)
    assert.equal(res.valid, true)
    assert.equal(res.errors.length, 0)
    assert.equal(res.sanitized.doubleXpActive, true)
    assert.equal(res.sanitized.goldRushMultiplier, 2.5)
    assert.equal(res.sanitized.normalFee, 5.0)
    assert.equal(res.sanitized.vipFee, 10.0)
    assert.equal(res.sanitized.tournamentBonusPct, 15)
  })

  it('DUAL-WRITE: formatDualWritePayload debe incluir formato canónico y formato legacy dictionary', () => {
    const input = {
      competitiveMatrix: [
        { playerCount: 2, entryFeeSC: 100, potSC: 200, prizesSC: [150] },
        { playerCount: 6, entryFeeSC: 300, potSC: 1800, prizesSC: [600, 450, 250, 100] }
      ],
      matrix: {
        2: { entry: 100, pot: 200, prizes: [150] },
        6: { entry: 300, pot: 1800, prizes: [600, 450, 250, 100] }
      },
      normalFee: 5.0
    }

    const dualWrite = formatDualWritePayload(input)
    assert.ok(dualWrite.competitiveMatrix, 'Debe incluir competitiveMatrix canónico')
    assert.ok(dualWrite.matrix, 'Debe incluir matrix legacy dictionary')
    assert.equal(dualWrite.matrix[2].entry, 100)
    assert.equal(dualWrite.matrix[6].entry, 300)
    assert.ok(dualWrite.updatedAt > 0)
  })

  it('PARIDAD DE CONSTANTES: DEFAULT_ECONOMY_MATRIX debe cubrir 2 a 6 jugadores con 100 a 300 SC', () => {
    assert.equal(DEFAULT_ECONOMY_MATRIX[2].entry, 100)
    assert.equal(DEFAULT_ECONOMY_MATRIX[3].entry, 120)
    assert.equal(DEFAULT_ECONOMY_MATRIX[4].entry, 150)
    assert.equal(DEFAULT_ECONOMY_MATRIX[5].entry, 200)
    assert.equal(DEFAULT_ECONOMY_MATRIX[6].entry, 300)
  })

  it('FASE 3: debe validar y permitir activar/pausar consumibles y configurar precios en caliente', () => {
    const consumablesPayload = {
      competitiveMatrix: [
        { playerCount: 2, entryFeeSC: 100, potSC: 200, prizesSC: [150] }
      ],
      items: [
        { id: 'emote_toxic_salt', name: 'Lluvia de Sal', category: 'emote', priceCoins: 250, isActive: true },
        { id: 'emote_ghost_rip', name: 'Fantasma RIP', category: 'emote', priceCoins: 200, isActive: false },
        { id: 'booster_xp_2x_24h', name: 'XP Booster 2X (24 Horas)', category: 'booster', priceCoins: 120, isActive: true }
      ],
      doubleXpActive: true,
      goldRushMultiplier: 3.0,
      tournamentBonusPct: 25
    }

    const res = validateEconomyConfig(consumablesPayload)
    assert.equal(res.valid, true)
    assert.equal(res.sanitized.items.length, 3)
    assert.equal(res.sanitized.items[0].priceCoins, 250)
    assert.equal(res.sanitized.items[0].isActive, true)
    assert.equal(res.sanitized.items[1].isActive, false)
    assert.equal(res.sanitized.doubleXpActive, true)
    assert.equal(res.sanitized.goldRushMultiplier, 3.0)
    assert.equal(res.sanitized.tournamentBonusPct, 25)
  })

  it('FASE 3: debe rechazar multiplicadores Fiebre de Oro corruptos o fuera de rango (1x a 10x)', () => {
    const corruptGoldRush = {
      competitiveMatrix: [
        { playerCount: 2, entryFeeSC: 100, potSC: 200, prizesSC: [150] }
      ],
      goldRushMultiplier: 25 // Excede el tope de 10x
    }
    const res = validateEconomyConfig(corruptGoldRush)
    assert.equal(res.valid, false)
    assert.match(res.errors[0], /Multiplicador Fiebre de Oro inválido/)
  })

})
