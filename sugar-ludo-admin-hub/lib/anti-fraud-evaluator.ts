import type { FraudAuditResult } from '../types/cashier.ts'

export interface PlayerWalletTransaction {
  id?: string
  orderId?: string
  type: string
  amount: number
  description: string
  timestamp?: number
}

export interface BalanceAuditParams {
  currentCoins: number
  escrowLockedCoins: number
  accountingSummary?: {
    totalDepositedCoins?: number
    totalWonCoins?: number
    totalMatchFeesCoins?: number
    totalWithdrawnCoins?: number
    totalMatchesPlayed?: number
    totalMatchesWon?: number
  }
  walletHistory?: PlayerWalletTransaction[]
  welcomeBonus?: number
}

/**
 * ============================================================================
 * MOTOR ANTIFRAUDE DETERMINISTA Y AUDITORÍA DE SALDO (Spark $0.00 / 1 Lectura)
 * ============================================================================
 * Evalúa la coherencia matemática entre el saldo disponible + en custodia
 * y el historial rastreable de depósitos, premios, buy-ins y retiros.
 */
export function evaluatePlayerBalanceAudit(params: BalanceAuditParams): FraudAuditResult {
  let totalDeposited = 0
  let totalWon = 0
  let totalMatchFees = 0
  let totalWithdrawn = 0

  if (params.accountingSummary && (
    params.accountingSummary.totalDepositedCoins !== undefined ||
    params.accountingSummary.totalWonCoins !== undefined ||
    params.accountingSummary.totalMatchFeesCoins !== undefined ||
    params.accountingSummary.totalWithdrawnCoins !== undefined
  )) {
    totalDeposited = Number(params.accountingSummary.totalDepositedCoins || 0)
    totalWon = Number(params.accountingSummary.totalWonCoins || 0)
    totalMatchFees = Number(params.accountingSummary.totalMatchFeesCoins || 0)
    totalWithdrawn = Number(params.accountingSummary.totalWithdrawnCoins || 0)
  } else if (Array.isArray(params.walletHistory)) {
    for (const tx of params.walletHistory) {
      if (!tx) continue
      const desc = (tx.description || '').toLowerCase()
      const type = (tx.type || '').toLowerCase()
      const amt = Number(tx.amount || 0)

      if (type === 'deposit' || desc.includes('depósito') || desc.includes('deposito')) {
        totalDeposited += Math.abs(amt)
      } else if (
        type === 'win' || 
        type === 'prize' || 
        type === 'match_win' || 
        desc.includes('victoria') || 
        desc.includes('premio') || 
        desc.includes('ganancia')
      ) {
        totalWon += Math.abs(amt)
      } else if (
        type === 'bet' || 
        type === 'entry_fee' || 
        type === 'fee' || 
        desc.includes('apuesta') || 
        desc.includes('buy-in') || 
        desc.includes('entrada') || 
        desc.includes('partida') ||
        desc.includes('mesa')
      ) {
        totalMatchFees += Math.abs(amt)
      } else if (type === 'withdraw' || desc.includes('retiro')) {
        totalWithdrawn += Math.abs(amt)
      }
    }
  }

  const welcomeBonus = params.welcomeBonus !== undefined ? params.welcomeBonus : 200
  // Techo máximo legítimo que el jugador podría poseer
  const theoreticalMax = welcomeBonus + totalDeposited + totalWon - totalMatchFees - totalWithdrawn
  const totalActiveBalance = Math.max(0, params.currentCoins) + Math.max(0, params.escrowLockedCoins)
  const discrepancyDelta = totalActiveBalance - theoreticalMax

  // Ratio de rotación de fondos (TurnOver)
  const turnoverRatio = totalDeposited > 0 ? (totalMatchFees / totalDeposited) : 1

  let status: 'certified' | 'low_turnover' | 'blocked' = 'certified'
  let score = 100
  let reason = 'Retiro 100% certificado por auditoría matemática. Saldo y turnover respaldados por historial legítimo.'

  // Tolerancia de seguridad de 100 SC para redondeos o compensaciones menores
  if (discrepancyDelta > 100) {
    status = 'blocked'
    score = 0
    reason = `Discrepancia contable crítica: Saldo total (${totalActiveBalance} SC) excede el balance máximo rastreable (${Math.max(0, Math.round(theoreticalMax))} SC) por +${Math.round(discrepancyDelta)} SC. Riesgo de inyección arbitraria de fondos.`
  } else if (totalDeposited > 0 && turnoverRatio < 0.5) {
    status = 'low_turnover'
    score = 70
    reason = `Alerta de Cumplimiento: Turnover de juego (${Math.round(turnoverRatio * 100)}%) inferior al umbral del 50%. Fondos depositados con escasa o nula circulación en partidas.`
  }

  return {
    status,
    score,
    reason,
    details: {
      theoreticalMaxCoins: Math.round(theoreticalMax),
      currentCoins: Math.round(params.currentCoins),
      escrowLockedCoins: Math.round(params.escrowLockedCoins),
      totalDepositedCoins: Math.round(totalDeposited),
      totalWonCoins: Math.round(totalWon),
      totalMatchFeesCoins: Math.round(totalMatchFees),
      totalWithdrawnCoins: Math.round(totalWithdrawn),
      turnoverRatio: Number(turnoverRatio.toFixed(2)),
      discrepancyDelta: Math.max(0, Math.round(discrepancyDelta))
    },
    auditedAt: Date.now()
  }
}
