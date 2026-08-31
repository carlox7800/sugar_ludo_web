import {
  DetailedTelemetry,
  CompetitiveTierRealConfig,
  CoinPackageConfig,
  RealGameTournamentConfig,
  SeasonRankingConfig,
  CashierManagementProfile,
  StaffChatMessage,
  ProcessedWithdrawalAudit
} from '../types/admin-expanded'

export const MOCK_DETAILED_TELEMETRY: DetailedTelemetry = {
  totalDownloadsCount: 24890,
  totalRegisteredUsers: 18450,
  
  // 4 Estados en Vivo
  playersInLobby: 350,
  playersInAITraining: 620,
  playersInOnlineTraining: 310,
  playersInCompetitive: 202,
  
  totalOnlinePlayers: 1482,
  serverLatencyMs: 34,
  activeMatchRooms: 412,
  serverStatus: 'online',
  updatedAt: Date.now()
}

// ----------------------------------------------------------------------------
// MATRIZ REAL DEL MODO COMPETITIVO (Sugar-Ludo/components/competitive-training.tsx)
// 2J: Entry 100 SC, Pot 200 SC, Premios: [150] (Rake: 50 SC = 25%)
// 3J: Entry 120 SC, Pot 360 SC, Premios: [200, 80] (Rake: 80 SC = 22.2%)
// 4J: Entry 150 SC, Pot 600 SC, Premios: [300, 150] (Rake: 150 SC = 25%)
// 5J: Entry 200 SC, Pot 1000 SC, Premios: [400, 200, 100] (Rake: 300 SC = 30%)
// 6J: Entry 300 SC, Pot 1800 SC, Premios: [600, 450, 250, 100] (Rake: 400 SC = 22.2%)
// ----------------------------------------------------------------------------
export const MOCK_REAL_COMPETITIVE_MATRIX: CompetitiveTierRealConfig[] = [
  {
    playerCount: 2,
    entryFeeSC: 100,
    potSC: 200,
    prizesSC: [150],
    houseRakeSC: 50,
    rakePercent: 25.0
  },
  {
    playerCount: 3,
    entryFeeSC: 120,
    potSC: 360,
    prizesSC: [200, 80],
    houseRakeSC: 80,
    rakePercent: 22.2
  },
  {
    playerCount: 4,
    entryFeeSC: 150,
    potSC: 600,
    prizesSC: [300, 150],
    houseRakeSC: 150,
    rakePercent: 25.0
  },
  {
    playerCount: 5,
    entryFeeSC: 200,
    potSC: 1000,
    prizesSC: [400, 200, 100],
    houseRakeSC: 300,
    rakePercent: 30.0
  },
  {
    playerCount: 6,
    entryFeeSC: 300,
    potSC: 1800,
    prizesSC: [600, 450, 250, 100],
    houseRakeSC: 400,
    rakePercent: 22.2
  }
]

// ----------------------------------------------------------------------------
// BÓVEDA DE MONEDAS: PAQUETES REALES EXTRAÍDOS DE Sugar-Ludo/lib/store-service.ts
// ----------------------------------------------------------------------------
export const MOCK_COIN_PACKAGES: CoinPackageConfig[] = [
  {
    id: 'pack_5',
    name: 'Bolsa Dulce',
    priceUSDT: 5.0,
    coinsAmount: 500,
    bonusCoins: 50,
    badgeTag: '+10% Extra',
    isActive: true
  },
  {
    id: 'pack_10',
    name: 'Frasco Dorado',
    priceUSDT: 10.0,
    coinsAmount: 1000,
    bonusCoins: 150,
    badgeTag: 'Más Popular',
    isPopular: true,
    isActive: true
  },
  {
    id: 'pack_25',
    name: 'Cofre Imperial',
    priceUSDT: 25.0,
    coinsAmount: 2500,
    bonusCoins: 625,
    badgeTag: 'Mejor Valor',
    isActive: true
  },
  {
    id: 'pack_50',
    name: 'Cofre Sugar',
    priceUSDT: 50.0,
    coinsAmount: 500,
    bonusCoins: 1500,
    badgeTag: '+30% Extra',
    isActive: true
  },
  {
    id: 'pack_100',
    name: 'Cofre Titán',
    priceUSDT: 100.0,
    coinsAmount: 10000,
    bonusCoins: 3500,
    badgeTag: '+35% VIP',
    isActive: true
  }
]

// ----------------------------------------------------------------------------
// LOS 2 EVENTOS REALES EXTRAÍDOS DIRECTAMENTE DE Sugar-Ludo/lib/tournaments-service.ts
// ----------------------------------------------------------------------------
export const MOCK_REAL_GAME_TOURNAMENTS: RealGameTournamentConfig[] = [
  {
    id: 'tour_1',
    title: 'Copa Galáctica Cyber Candy',
    subtitle: 'Torneo oficial de 4 jugadores con eliminatorias directas.',
    badge: 'En Curso',
    potSC: 50000,
    entryFeeSC: 250,
    endDate: 'Termina en 3 días',
    playersRegistered: 128,
    maxPlayers: 256,
    bannerGradient: 'linear-gradient(135deg, oklch(0.7 0.27 350 / 0.4), oklch(0.14 0.04 45 / 0.8))',
    accentColor: 'var(--candy-magenta)',
    rules: 'Partidas 4 Jugadores • Sin tiempo de espera • +25% XP extra',
    isActive: true,
    firstPlacePct: 50.0,   // 25,000 SC ($250 USDT)
    secondPlacePct: 30.0,  // 15,000 SC ($150 USDT)
    thirdPlacePct: 20.0    // 10,000 SC ($100 USDT)
  },
  {
    id: 'tour_2',
    title: 'Desafío Relámpago Hexagonal',
    subtitle: 'El campo de batalla más grande: 6 jugadores, 1 solo campeón.',
    badge: 'Inscripción Abierta',
    potSC: 80000,
    entryFeeSC: 500,
    endDate: 'Inicia en 12 horas',
    playersRegistered: 48,
    maxPlayers: 64,
    bannerGradient: 'linear-gradient(135deg, oklch(0.82 0.15 200 / 0.4), oklch(0.12 0.02 285 / 0.8))',
    accentColor: 'var(--candy-cyan)',
    rules: 'Tablero Hexagonal • Reglas Clásicas • Pozo acumulado dinámico',
    isActive: true,
    firstPlacePct: 55.0,   // 44,000 SC ($440 USDT)
    secondPlacePct: 30.0,  // 24,000 SC ($240 USDT)
    thirdPlacePct: 15.0    // 12,000 SC ($120 USDT)
  }
]

// ----------------------------------------------------------------------------
// SISTEMA REAL DE TEMPORADA Y RANKING POR COPAS (Sugar-Ludo/lib/missions-service.ts)
// ----------------------------------------------------------------------------
export const MOCK_SEASON_RANKING: SeasonRankingConfig = {
  seasonNumber: 1,
  seasonName: 'Temporada 1 - Galáctica',
  durationDays: 7,
  timeRemainingFormatted: '3d 14h restantes',
  isActive: true,
  firstPlacePrizeSC: 15000,  // $150.00 USDT
  secondPlacePrizeSC: 8000,  // $80.00 USDT
  thirdPlacePrizeSC: 4000    // $40.00 USDT
}

export const MOCK_CASHIERS_MANAGEMENT: CashierManagementProfile[] = [
  {
    uid: 'csh_carlosandroid_001',
    name: 'carlosandroid (Cajero)',
    email: 'carlos.cajero@sugarludo.com',
    password: 'CajeroSugar2026!',
    avatarUrl: 'https://i.ibb.co/3YBC35Xm/avatar-1786744277377.jpg',
    shiftStatus: 'on_shift',
    floatBalanceCoins: 30000,
    assignedShiftAt: Date.now(),
    lastRechargeAt: Date.now(),
    ordersCompletedToday: 0,
    commissionEarnedTodayCoins: 0,
    paymentMethodsCount: 2,
    phone: '+58 412-0000000',
    idDocument: 'V-12345678',
    role: 'cashier'
  }
]

export const MOCK_STAFF_CHAT: StaffChatMessage[] = []

export const MOCK_WITHDRAWAL_AUDITS: ProcessedWithdrawalAudit[] = []
