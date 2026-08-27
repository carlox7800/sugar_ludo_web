/**
 * ============================================================================
 * CALCULADOR FINANCIERO Y DE TESORERÍA - SUGAR LUDO
 * ============================================================================
 * Paridad fija: 1 USDT = 100 Sugar Coins (SC)
 * 1 SC = 0.01 USD
 */

export const SC_PER_USDT = 100
export const NORMAL_WITHDRAW_FEE_PCT = 0.05 // 5%
export const VIP_WITHDRAW_FEE_PCT = 0.10    // 10%

export interface WithdrawalCalculation {
  requestedCoins: number
  feePercent: number
  feeCoins: number
  feeUSD: number
  netCoins: number
  netUSD: number
  estimatedHours: number
}

/**
 * Calcula el desglose financiero de una solicitud de retiro
 */
export function calculateWithdrawal(amountCoins: number, isVip: boolean): WithdrawalCalculation {
  const feePercent = isVip ? VIP_WITHDRAW_FEE_PCT : NORMAL_WITHDRAW_FEE_PCT
  const estimatedHours = isVip ? 24 : 72
  
  const feeCoins = Math.round(amountCoins * feePercent)
  const netCoins = amountCoins - feeCoins
  
  const feeUSD = feeCoins / SC_PER_USDT
  const netUSD = netCoins / SC_PER_USDT

  return {
    requestedCoins: amountCoins,
    feePercent: feePercent * 100,
    feeCoins,
    feeUSD,
    netCoins,
    netUSD,
    estimatedHours
  }
}

/**
 * Convierte Sugar Coins a USD/USDT
 */
export function coinsToUSD(coins: number): number {
  return coins / SC_PER_USDT
}

/**
 * Convierte USD/USDT a Sugar Coins
 */
export function usdToCoins(usd: number): number {
  return Math.round(usd * SC_PER_USDT)
}
