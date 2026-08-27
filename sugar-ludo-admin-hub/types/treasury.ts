/**
 * ============================================================================
 * SUGAR LUDO - ESQUEMAS DE TESORERÍA, FEES Y TELEMETRÍA GLOBAL
 * ============================================================================
 */

export interface TreasuryVault {
  totalVaultUSD: number             // Respaldo total del ecosistema en USD/USDT
  totalVaultSugarCoins: number      // Equivalente en Sugar Coins (SC)
  
  // Pasivo (Custodia de Jugadores)
  playerBalancesUSD: number         // Saldo total en billeteras de jugadores
  playerBalancesCoins: number       // SC totales en poder de jugadores
  
  // Saldo Flotante en Cajeros
  cashierFloatsUSD: number          // Saldo de garantía distribuido en cajeros
  cashierFloatsCoins: number
  
  // Activo Retirable (Ganancias Netas de la Casa)
  houseNetProfitsUSD: number        // Ganancias disponibles para retiro de directiva
  houseNetProfitsCoins: number
  
  lastAuditedAt: number
}

export interface HouseProfitBreakdown {
  tableRakeCoins: number            // Comisiones de mesas competitivas
  tableRakeUSD: number
  
  storeSalesCoins: number           // Ventas en tienda de skins, dados y tableros
  storeSalesUSD: number
  
  tournamentMarginCoins: number     // Margen de inscripciones de torneos
  tournamentMarginUSD: number
  
  cashierOperationsCoins: number    // Margen por operaciones de cajeros
  cashierOperationsUSD: number
  
  // Comisiones por Retiro (Withdrawal Fees)
  normalWithdrawalFeesCoins: number // Retiro Normal (5%)
  normalWithdrawalFeesUSD: number
  
  vipWithdrawalFeesCoins: number    // Retiro VIP (10%)
  vipWithdrawalFeesUSD: number
  
  totalProfitCoins: number
  totalProfitUSD: number
}

export interface GameTelemetry {
  totalPlayersOnline: number
  offlineMatchesCount: number
  onlineTrainingPlayersCount: number
  competitivePlayersCount: number
  activeRoomsCount: number
  serverLatencyMs: number
  serverStatus: 'healthy' | 'degraded' | 'offline'
  updatedAt: number
}

export interface DisputeCase {
  id: string
  orderId: string
  type: 'deposit' | 'withdraw'
  playerUid: string
  playerName: string
  cashierUid: string
  cashierName: string
  amountFiat: number
  currency: string
  amountSugarCoins: number
  reason: string
  openedBy: 'player' | 'cashier'
  openedAt: number
  status: 'open' | 'investigating' | 'resolved_player' | 'resolved_cashier'
  resolutionNotes?: string
  resolvedBy?: string
  resolvedAt?: number
  evidenceReceiptUrl?: string
}

export interface StoreItemPriceConfig {
  id: string
  name: string
  category: 'dice' | 'board' | 'token' | 'booster' | 'emote'
  priceCoins: number
  priceUSDT: number
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  icon?: string
  description?: string
  isActive: boolean
  salesCount: number
}
