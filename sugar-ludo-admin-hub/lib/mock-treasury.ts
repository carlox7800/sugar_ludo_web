import {
  TreasuryVault,
  HouseProfitBreakdown,
  GameTelemetry,
  DisputeCase,
  StoreItemPriceConfig
} from '../types/treasury'

export const MOCK_TREASURY_VAULT: TreasuryVault = {
  totalVaultUSD: 78500.0,
  totalVaultSugarCoins: 7850000,
  playerBalancesUSD: 45000.0,
  playerBalancesCoins: 4500000,
  cashierFloatsUSD: 15600.0,
  cashierFloatsCoins: 1560000,
  houseNetProfitsUSD: 17900.0,
  houseNetProfitsCoins: 1790000,
  lastAuditedAt: Date.now()
}

export const MOCK_HOUSE_PROFIT_BREAKDOWN: HouseProfitBreakdown = {
  tableRakeCoins: 720000,
  tableRakeUSD: 7200.0,
  storeSalesCoins: 430000,
  storeSalesUSD: 4300.0,
  tournamentMarginCoins: 210000,
  tournamentMarginUSD: 2100.0,
  cashierOperationsCoins: 180000,
  cashierOperationsUSD: 1800.0,
  normalWithdrawalFeesCoins: 150000,
  normalWithdrawalFeesUSD: 1500.0,
  vipWithdrawalFeesCoins: 100000,
  vipWithdrawalFeesUSD: 1000.0,
  totalProfitCoins: 1790000,
  totalProfitUSD: 17900.0
}

export const MOCK_GAME_TELEMETRY: GameTelemetry = {
  totalPlayersOnline: 1482,
  offlineMatchesCount: 620,
  onlineTrainingPlayersCount: 310,
  competitivePlayersCount: 202,
  activeRoomsCount: 412,
  serverLatencyMs: 34,
  serverStatus: 'healthy',
  updatedAt: Date.now()
}

export const MOCK_DISPUTE_CASES: DisputeCase[] = []

// -----------------------------------------------------------------------------
// CATÁLOGO REAL SINCRONIZADO DIRECTAMENTE DE Sugar-Ludo/lib/store-service.ts
// -----------------------------------------------------------------------------
export const MOCK_REAL_STORE_CATALOG: StoreItemPriceConfig[] = [
  // --- TABLEROS (boards) ---
  {
    id: 'board_default',
    name: 'Clásico Cyber',
    category: 'board',
    priceCoins: 0,
    priceUSDT: 0.0,
    rarity: 'common',
    icon: '🏁',
    description: 'El tablero insignia oficial de Sugar Ludo (Set Base gratuito).',
    isActive: true,
    salesCount: 14500
  },
  {
    id: 'board_candy_pop',
    name: 'Sugar Candy Pop',
    category: 'board',
    priceCoins: 500,
    priceUSDT: 5.0,
    rarity: 'rare',
    icon: '🍭',
    description: 'Estilo vibrante de confitería con colores pastel y destellos dulces.',
    isActive: true,
    salesCount: 890
  },
  {
    id: 'board_neon_matrix',
    name: 'Neon Cyber Matrix',
    category: 'board',
    priceCoins: 800,
    priceUSDT: 8.0,
    rarity: 'epic',
    icon: '🌌',
    description: 'Fondo oscuro con circuitos y bordes holográficos luminiscentes.',
    isActive: true,
    salesCount: 620
  },
  {
    id: 'board_royal_gold',
    name: 'Royal Imperial Gold',
    category: 'board',
    priceCoins: 1500,
    priceUSDT: 15.0,
    rarity: 'legendary',
    icon: '👑',
    description: 'Diseño de ultra lujo con acabados en oro pulido y piedras preciosas.',
    isActive: true,
    salesCount: 410
  },

  // --- FICHAS / SKINS (tokens) ---
  {
    id: 'token_default',
    name: 'Fichas Estándar',
    category: 'token',
    priceCoins: 0,
    priceUSDT: 0.0,
    rarity: 'common',
    icon: '⚪',
    description: 'Fichas tradicionales lisas con relieve 3D (Set Base gratuito).',
    isActive: true,
    salesCount: 14500
  },
  {
    id: 'token_crystal_gems',
    name: 'Gemas de Cristal',
    category: 'token',
    priceCoins: 400,
    priceUSDT: 4.0,
    rarity: 'rare',
    icon: '💎',
    description: 'Fichas talladas en diamante con reflejos prismáticos.',
    isActive: true,
    salesCount: 940
  },
  {
    id: 'token_glazed_candy',
    name: 'Caramelos Glaseados',
    category: 'token',
    priceCoins: 600,
    priceUSDT: 6.0,
    rarity: 'epic',
    icon: '🍬',
    description: 'Fichas deliciosas de caramelo con chispas de azúcar.',
    isActive: true,
    salesCount: 780
  },
  {
    id: 'token_pure_gold',
    name: 'Fichas Oro Puro 24K',
    category: 'token',
    priceCoins: 1000,
    priceUSDT: 10.0,
    rarity: 'legendary',
    icon: '🪙',
    description: 'Monedas macizas de oro con el sello real de Sugar Ludo.',
    isActive: true,
    salesCount: 510
  },

  // --- DADOS 3D (dice) ---
  {
    id: 'dice_default',
    name: 'Dado Clásico',
    category: 'dice',
    priceCoins: 0,
    priceUSDT: 0.0,
    rarity: 'common',
    icon: '🎲',
    description: 'Dado cúbico estándar blanco y pulido (Set Base gratuito).',
    isActive: true,
    salesCount: 14500
  },
  {
    id: 'dice_neon_cyan',
    name: 'Dado Neón Cyan',
    category: 'dice',
    priceCoins: 350,
    priceUSDT: 3.5,
    rarity: 'rare',
    icon: '💠',
    description: 'Dado futurista con estela de luz cian en cada giro.',
    isActive: true,
    salesCount: 1120
  },
  {
    id: 'dice_crimson_fire',
    name: 'Dado Fuego Carmesí',
    category: 'dice',
    priceCoins: 500,
    priceUSDT: 5.0,
    rarity: 'epic',
    icon: '🔥',
    description: 'Emite llamas ardientes y chispas al rodar en la mesa.',
    isActive: true,
    salesCount: 860
  },
  {
    id: 'dice_24k_gold',
    name: 'Dado Golden Crown',
    category: 'dice',
    priceCoins: 900,
    priceUSDT: 9.0,
    rarity: 'legendary',
    icon: '✨',
    description: 'Dado fundido en oro macizo con números de rubí.',
    isActive: true,
    salesCount: 430
  },

  // --- EMOTES DE PAGO REALES (5 Premium de la tienda) ---
  {
    id: 'emote_toxic_salt',
    name: 'Lluvia de Sal',
    category: 'emote',
    priceCoins: 250,
    priceUSDT: 2.5,
    rarity: 'rare',
    icon: '🧂',
    description: 'Salero animado que rocía cristales de sal con burla picante.',
    isActive: true,
    salesCount: 650
  },
  {
    id: 'emote_ghost_rip',
    name: 'Fantasma RIP',
    category: 'emote',
    priceCoins: 250,
    priceUSDT: 2.5,
    rarity: 'rare',
    icon: '👻',
    description: 'Fantasmita etéreo con alas y halo dorado cuando envías al rival a casa.',
    isActive: true,
    salesCount: 720
  },
  {
    id: 'emote_mind_blown',
    name: 'Cerebro Galáctico',
    category: 'emote',
    priceCoins: 350,
    priceUSDT: 3.5,
    rarity: 'epic',
    icon: '🤯',
    description: 'Cabeza cósmica en shock con explosión de chispas y humo estelar.',
    isActive: true,
    salesCount: 890
  },
  {
    id: 'emote_rage_demon',
    name: 'Furia Sugar',
    category: 'emote',
    priceCoins: 350,
    priceUSDT: 3.5,
    rarity: 'epic',
    icon: '😈',
    description: 'Diablillo furioso con cuernos neón y humo saliendo por la nariz.',
    isActive: true,
    salesCount: 540
  },
  {
    id: 'emote_king_crown',
    name: 'Corona Diamante MVP',
    category: 'emote',
    priceCoins: 500,
    priceUSDT: 5.0,
    rarity: 'legendary',
    icon: '👑',
    description: 'Corona imperial de oro y diamantes flotante con destellos estelares.',
    isActive: true,
    salesCount: 980
  },

  // --- POTENCIADORES DE EXPERIENCIA (Boosters reales) ---
  {
    id: 'booster_xp_2x_24h',
    name: 'XP Booster 2X (24 Horas)',
    category: 'booster',
    priceCoins: 150,
    priceUSDT: 1.5,
    rarity: 'rare',
    icon: '⚡',
    description: 'Duplica toda la experiencia ganada en partidas durante 24 horas.',
    isActive: true,
    salesCount: 1430
  },
  {
    id: 'booster_xp_2x_3d',
    name: 'XP Booster 2X (3 Días)',
    category: 'booster',
    priceCoins: 350,
    priceUSDT: 3.5,
    rarity: 'epic',
    icon: '⚡⚡',
    description: 'Duplica la experiencia en todas las partidas durante 72 horas continuas.',
    isActive: true,
    salesCount: 820
  },
  {
    id: 'booster_xp_3x_24h',
    name: 'XP Booster 3X Ultra (24 Horas)',
    category: 'booster',
    priceCoins: 300,
    priceUSDT: 3.0,
    rarity: 'legendary',
    icon: '🚀',
    description: '¡Multiplica tu experiencia por 3 en cada victoria por 24 horas!',
    isActive: true,
    salesCount: 670
  }
]
