/**
 * ============================================================================
 * ESQUEMAS AVANZADOS: TELEMETRÍA, ECONOMÍA, EVENTOS REALES Y GESTIÓN DE CAJEROS
 * ============================================================================
 */

export interface DetailedTelemetry {
  totalDownloadsCount: number
  totalRegisteredUsers: number
  
  // 4 Estados de Jugadores en Vivo
  playersInLobby: number           // En navegación / inactivos sin jugar
  playersInAITraining: number      // Entrenamiento offline con IA
  playersInOnlineTraining: number  // Salas online de práctica
  playersInCompetitive: number     // Mesas con dinero real / SC

  totalOnlinePlayers: number
  serverLatencyMs: number
  activeMatchRooms: number
  serverStatus: 'online' | 'degraded' | 'offline'
  updatedAt: number
}

// ----------------------------------------------------------------------------
// ESTRUCTURA REAL DE MODO COMPETITIVO (Sugar-Ludo/components/competitive-training.tsx)
// ----------------------------------------------------------------------------
export interface CompetitiveTierRealConfig {
  playerCount: 2 | 3 | 4 | 5 | 6
  entryFeeSC: number               // Costo de entrada (Buy-in por jugador en SC)
  potSC: number                    // Pozo total generado (entryFeeSC * playerCount)
  prizesSC: number[]               // Premios asignados en SC [1°, 2°, 3°, 4°]
  houseRakeSC: number              // Rake retenido en SC (potSC - suma(prizesSC))
  rakePercent: number              // Rake en porcentaje ((houseRakeSC / potSC) * 100)
}

export interface CoinPackageConfig {
  id: string
  name: string
  priceUSDT: number
  coinsAmount: number
  bonusCoins: number
  badgeTag?: string
  isPopular?: boolean
  isActive: boolean
}

// ----------------------------------------------------------------------------
// ESTRUCTURAS REALES AUDITADAS DEL JUEGO (Sugar-Ludo/lib/tournaments-service.ts)
// ----------------------------------------------------------------------------
export interface RealGameTournamentConfig {
  id: string                      // 'tour_1' | 'tour_2'
  title: string                   // 'Copa Galáctica Cyber Candy' | 'Desafío Relámpago Hexagonal'
  subtitle: string
  badge: string                   // 'En Curso' | 'Inscripción Abierta'
  potSC: number                   // 50,000 SC | 80,000 SC
  entryFeeSC: number              // 250 SC | 500 SC
  endDate: string                 // 'Termina en 3 días' | 'Inicia en 12 horas'
  playersRegistered: number
  maxPlayers: number
  bannerGradient: string
  accentColor: string
  rules: string
  isActive: boolean
  firstPlacePct: number           // ej. 50%
  secondPlacePct: number          // ej. 30%
  thirdPlacePct: number           // ej. 20%
}

// ----------------------------------------------------------------------------
// ESTRUCTURA REAL DE TEMPORADA Y RANKING POR COPAS (missions-service.ts)
// ----------------------------------------------------------------------------
export interface SeasonRankingConfig {
  seasonNumber: number            // 1
  seasonName: string              // 'Temporada 1 - Galáctica'
  durationDays: number            // 7 días por ciclo semanal
  timeRemainingFormatted: string  // '3d 14h restantes'
  isActive: boolean
  
  // Recompensas para los 3 primeros lugares del ranking global
  firstPlacePrizeSC: number       // ej. 15,000 SC ($150 USDT)
  secondPlacePrizeSC: number      // ej. 8,000 SC ($80 USDT)
  thirdPlacePrizeSC: number       // ej. 4,000 SC ($40 USDT)
}

export interface CashierManagementProfile {
  uid: string
  name: string
  email: string
  avatarUrl?: string
  phone?: string
  idDocument?: string
  shiftStatus: 'on_shift' | 'off_shift' | 'break'
  floatBalanceCoins: number
  assignedShiftAt?: number
  lastRechargeAt?: number
  ordersCompletedToday: number
  commissionEarnedTodayCoins: number
  paymentMethodsCount: number
  password?: string
  role?: 'cashier'
}

export interface StaffChatMessage {
  id: string
  senderUid: string
  senderName: string
  senderRole: 'super_admin' | 'cashier' | 'system'
  message: string
  attachmentUrl?: string
  timestamp: number
}

export interface ProcessedWithdrawalAudit {
  id: string
  orderId: string
  playerUid: string
  playerName: string
  cashierUid: string
  cashierName: string
  amountSugarCoins: number
  amountFiatUSDT: number
  feePercent: number
  feeCoins: number
  netFiatUSDT: number
  walletTxHash?: string           // Hash de la transacción blockchain (TxID)
  receiptProofUrl?: string        // Captura bancaria o del explorador
  processedAt: number
}

// ----------------------------------------------------------------------------
// ESQUEMAS DE AUTENTICACIÓN Y GESTIÓN DE ADMINISTRADORES
// ----------------------------------------------------------------------------
export interface AdminUserProfile {
  uid: string
  username: string
  email: string
  displayName: string
  role: 'super_admin' | 'financial_admin' | 'support_admin'
  avatarUrl?: string
  createdAt: number
  lastLoginAt: number
  isActive: boolean
  password?: string
}
