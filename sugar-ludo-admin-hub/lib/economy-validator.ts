/**
 * Validador e Invariantes de Economía y Control Remoto (Fase 1)
 * Garantiza conservación financiera, rangos de tarifas (100 a 300 SC), comisiones y formato dual-write.
 */

export interface CompetitiveTierValidation {
  playerCount: number
  entryFeeSC: number
  potSC: number
  prizesSC: number[]
  houseRakeSC: number
  rakePercent: number
}

export interface EconomyValidationResult {
  valid: boolean
  errors: string[]
  sanitized?: any
}

export const DEFAULT_ECONOMY_MATRIX: Record<number, { entry: number; pot: number; prizes: number[] }> = {
  2: { entry: 100, pot: 200, prizes: [150] },
  3: { entry: 120, pot: 360, prizes: [200, 80] },
  4: { entry: 150, pot: 600, prizes: [300, 150] },
  5: { entry: 200, pot: 1000, prizes: [400, 200, 100] },
  6: { entry: 300, pot: 1800, prizes: [600, 450, 250, 100] },
}

export function validateCompetitiveTier(tier: any): { valid: boolean; error?: string } {
  if (!tier || typeof tier !== 'object') {
    return { valid: false, error: 'Tier inválido o vacío' }
  }

  const pCount = Number(tier.playerCount)
  if (!Number.isInteger(pCount) || pCount < 2 || pCount > 6) {
    return { valid: false, error: `Número de jugadores inválido: ${tier.playerCount} (debe ser de 2 a 6)` }
  }

  const entry = Number(tier.entryFeeSC ?? tier.entry)
  if (!Number.isInteger(entry) || entry < 50 || entry > 2000) {
    return { valid: false, error: `Tarifa de entrada inválida para ${pCount}J: ${entry} SC (rango permitido: 50 - 2000 SC)` }
  }

  const expectedPot = entry * pCount
  const pot = Number(tier.potSC ?? tier.pot ?? expectedPot)
  if (pot !== expectedPot) {
    return { valid: false, error: `Invariante violado: Pozo ${pot} SC no coincide con ${pCount} jugadores * ${entry} SC (${expectedPot} SC)` }
  }

  const prizes = Array.isArray(tier.prizesSC) ? tier.prizesSC : (Array.isArray(tier.prizes) ? tier.prizes : [])
  if (prizes.length === 0) {
    return { valid: false, error: `La matriz para ${pCount}J debe definir al menos un premio` }
  }

  const totalPrizes = prizes.reduce((acc: number, p: any) => acc + (Number(p) || 0), 0)
  if (totalPrizes > pot) {
    return { valid: false, error: `Déficit financiero detectado para ${pCount}J: Suma de premios (${totalPrizes} SC) supera el pozo (${pot} SC)` }
  }

  const houseRake = pot - totalPrizes
  if (houseRake < 0) {
    return { valid: false, error: `Rake negativo detectado en ${pCount}J` }
  }

  const rakePct = Number(((houseRake / pot) * 100).toFixed(1))
  if (rakePct > 35.0) {
    return { valid: false, error: `Rake excesivo para ${pCount}J: ${rakePct}% supera el tope máximo del 35%` }
  }

  return { valid: true }
}

export function validateEconomyConfig(payload: any): EconomyValidationResult {
  const errors: string[] = []

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['El cuerpo de configuración económica debe ser un objeto JSON válido'] }
  }

  // 1. Validar Matriz Competitiva
  let parsedMatrix: Record<number, { entry: number; pot: number; prizes: number[] }> = {}
  let parsedTierList: any[] = []

  if (Array.isArray(payload.competitiveMatrix) && payload.competitiveMatrix.length > 0) {
    for (const tier of payload.competitiveMatrix) {
      const v = validateCompetitiveTier(tier)
      if (!v.valid) {
        errors.push(v.error!)
      } else {
        const pCount = Number(tier.playerCount)
        const entry = Number(tier.entryFeeSC)
        const pot = entry * pCount
        const prizes = (tier.prizesSC || []).map((p: any) => Number(p))
        const houseRake = pot - prizes.reduce((a: number, b: number) => a + b, 0)
        const rakePercent = Number(((houseRake / pot) * 100).toFixed(1))

        parsedMatrix[pCount] = { entry, pot, prizes }
        parsedTierList.push({
          playerCount: pCount,
          entryFeeSC: entry,
          potSC: pot,
          prizesSC: prizes,
          houseRakeSC: houseRake,
          rakePercent
        })
      }
    }
  } else if (payload.matrix && typeof payload.matrix === 'object') {
    for (const [key, val] of Object.entries(payload.matrix)) {
      const pCount = Number(key)
      const tVal: any = val
      const v = validateCompetitiveTier({ playerCount: pCount, entryFeeSC: tVal.entry, potSC: tVal.pot, prizesSC: tVal.prizes })
      if (!v.valid) {
        errors.push(v.error!)
      } else {
        const entry = Number(tVal.entry)
        const pot = entry * pCount
        const prizes = (tVal.prizes || []).map((p: any) => Number(p))
        const houseRake = pot - prizes.reduce((a: number, b: number) => a + b, 0)
        const rakePercent = Number(((houseRake / pot) * 100).toFixed(1))

        parsedMatrix[pCount] = { entry, pot, prizes }
        parsedTierList.push({
          playerCount: pCount,
          entryFeeSC: entry,
          potSC: pot,
          prizesSC: prizes,
          houseRakeSC: houseRake,
          rakePercent
        })
      }
    }
  }

  // 2. Validar Tarifas de Retiro de Cajeros (Fees)
  const normalFee = Number(payload.normalFee ?? 5.0)
  const vipFee = Number(payload.vipFee ?? 10.0)

  if (isNaN(normalFee) || normalFee < 0 || normalFee > 30) {
    errors.push(`Tarifa Estándar inválida: ${payload.normalFee} (debe estar entre 0% y 30%)`)
  }
  if (isNaN(vipFee) || vipFee < 0 || vipFee > 30) {
    errors.push(`Tarifa VIP inválida: ${payload.vipFee} (debe estar entre 0% y 30%)`)
  }

  // 3. Validar Multiplicadores de Eventos y XP
  const doubleXpActive = Boolean(payload.doubleXpActive)
  const goldRushMultiplier = Number(payload.goldRushMultiplier ?? 1)
  if (isNaN(goldRushMultiplier) || goldRushMultiplier < 1 || goldRushMultiplier > 10) {
    errors.push(`Multiplicador Fiebre de Oro inválido: ${payload.goldRushMultiplier} (debe ser entre 1x y 10x)`)
  }

  const tournamentBonusPct = Number(payload.tournamentBonusPct ?? 0)
  if (isNaN(tournamentBonusPct) || tournamentBonusPct < 0 || tournamentBonusPct > 100) {
    errors.push(`Bono de torneo inválido: ${payload.tournamentBonusPct} (debe ser entre 0% y 100%)`)
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // Construir objeto sanitizado con compatibilidad Dual-Write
  const sanitized = {
    ...payload,
    competitiveMatrix: parsedTierList.length > 0 ? parsedTierList : payload.competitiveMatrix,
    matrix: Object.keys(parsedMatrix).length > 0 ? parsedMatrix : payload.matrix,
    normalFee,
    vipFee,
    doubleXpActive,
    goldRushMultiplier,
    tournamentBonusPct,
    items: Array.isArray(payload.items) ? payload.items : [],
    packages: Array.isArray(payload.packages) ? payload.packages : [],
    tournaments: Array.isArray(payload.tournaments) ? payload.tournaments : [],
    seasonRanking: payload.seasonRanking || null,
    updatedAt: Number(payload.updatedAt) || Date.now()
  }

  return { valid: true, errors: [], sanitized }
}

/**
 * Prepara el documento Dual-Write para escribir atómicamente tanto el formato
 * canónico como el formato legacy que esperan los clientes web/móviles actuales.
 */
export function formatDualWritePayload(config: any) {
  const matrix = config.matrix || {}
  const competitiveMatrix = config.competitiveMatrix || []

  return {
    ...config,
    // Formato canónico
    competitiveMatrix,
    // Formato legacy dictionary para economy-service v9.5.x
    matrix,
    updatedAt: Date.now()
  }
}
