import { db } from './firebase'
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { recordWalletTransaction } from './wallet-service'

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type ItemCategory = 'board' | 'token' | 'dice' | 'emote' | 'booster'

export interface CoinPackage {
  id: string
  name: string
  usdtCost: number
  baseCoins: number
  bonusPercent: number
  totalCoins: number
  tag?: string
  icon: string
  image?: string
}

export interface StoreItem {
  id: string
  name: string
  category: ItemCategory
  priceSC: number
  rarity: ItemRarity
  description: string
  icon: string
  accentColor: string
  previewData?: {
    theme?: string
    style?: string
    effect?: string
    animation?: string
    multiplier?: number
    durationHours?: number
  }
}

export interface UserInventory {
  ownedItems: string[]
  equipped: {
    board: string
    token: string
    dice: string
  }
  activeBoosters?: {
    id: string
    multiplier: number
    expiresAt: number
  }[]
}

// -----------------------------------------------------------------------------
// CATALOG DEFINITIONS
// -----------------------------------------------------------------------------

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'pack_5',
    name: 'Bolsa Dulce',
    usdtCost: 5,
    baseCoins: 500,
    bonusPercent: 10,
    totalCoins: 550,
    tag: '+10% Extra',
    icon: '🍭',
    image: '/store/bolsa_dulce.png'
  },
  {
    id: 'pack_10',
    name: 'Frasco Dorado',
    usdtCost: 10,
    baseCoins: 1000,
    bonusPercent: 15,
    totalCoins: 1150,
    tag: 'Más Popular',
    icon: '🍯',
    image: '/store/frasco_dorado.png'
  },
  {
    id: 'pack_25',
    name: 'Cofre Imperial',
    usdtCost: 25,
    baseCoins: 2500,
    bonusPercent: 25,
    totalCoins: 3125,
    tag: 'Mejor Valor',
    icon: '💎',
    image: '/store/cofre_imperial.png'
  },
  {
    id: 'pack_50',
    name: 'Cofre Sugar',
    usdtCost: 50,
    baseCoins: 5000,
    bonusPercent: 30,
    totalCoins: 6500,
    tag: '+30% Extra',
    icon: '👑',
    image: '/store/cofre_sugar.png'
  },
  {
    id: 'pack_100',
    name: 'Cofre Titán',
    usdtCost: 100,
    baseCoins: 10000,
    bonusPercent: 35,
    totalCoins: 13500,
    tag: '+35% Extra',
    icon: '🏛️',
    image: '/store/cofre_titan.png'
  }
]

export const CUSTOMIZATION_ITEMS: StoreItem[] = [
  // --- TABLEROS ---
  {
    id: 'board_default',
    name: 'Clásico Cyber',
    category: 'board',
    priceSC: 0,
    rarity: 'common',
    description: 'El tablero insignia oficial de Sugar Ludo.',
    icon: '🏁',
    accentColor: 'var(--candy-cyan)',
    previewData: { theme: 'classic' }
  },
  {
    id: 'board_candy_pop',
    name: 'Sugar Candy Pop',
    category: 'board',
    priceSC: 500,
    rarity: 'rare',
    description: 'Estilo vibrante de confitería con colores pastel y destellos dulces.',
    icon: '🍭',
    accentColor: 'var(--candy-magenta)',
    previewData: { theme: 'sugar' }
  },
  {
    id: 'board_neon_matrix',
    name: 'Neon Cyber Matrix',
    category: 'board',
    priceSC: 800,
    rarity: 'epic',
    description: 'Fondo oscuro con circuitos y bordes holográficos luminiscentes.',
    icon: '🌌',
    accentColor: '#38bdf8',
    previewData: { theme: 'neon' }
  },
  {
    id: 'board_royal_gold',
    name: 'Royal Imperial Gold',
    category: 'board',
    priceSC: 1500,
    rarity: 'legendary',
    description: 'Diseño de ultra lujo con acabados en oro pulido y piedras preciosas.',
    icon: '👑',
    accentColor: 'var(--candy-gold)',
    previewData: { theme: 'royal' }
  },

  // --- FICHAS ---
  {
    id: 'token_default',
    name: 'Fichas Estándar',
    category: 'token',
    priceSC: 0,
    rarity: 'common',
    description: 'Fichas tradicionales lisas con relieve 3D.',
    icon: '⚪',
    accentColor: 'var(--candy-cyan)',
    previewData: { style: 'classic' }
  },
  {
    id: 'token_crystal_gems',
    name: 'Gemas de Cristal',
    category: 'token',
    priceSC: 400,
    rarity: 'rare',
    description: 'Fichas talladas en diamante con reflejos prismáticos.',
    icon: '💎',
    accentColor: '#00ddff',
    previewData: { style: 'gem' }
  },
  {
    id: 'token_glazed_candy',
    name: 'Caramelos Glaseados',
    category: 'token',
    priceSC: 600,
    rarity: 'epic',
    description: 'Fichas deliciosas de caramelo con chispas de azúcar.',
    icon: '🍬',
    accentColor: 'var(--candy-magenta)',
    previewData: { style: 'candy' }
  },
  {
    id: 'token_pure_gold',
    name: 'Fichas Oro Puro 24K',
    category: 'token',
    priceSC: 1000,
    rarity: 'legendary',
    description: 'Monedas macizas de oro con el sello real de Sugar Ludo.',
    icon: '🪙',
    accentColor: 'var(--candy-gold)',
    previewData: { style: 'gold' }
  },

  // --- DADOS ---
  {
    id: 'dice_default',
    name: 'Dado Clásico',
    category: 'dice',
    priceSC: 0,
    rarity: 'common',
    description: 'Dado cúbico estándar blanco y pulido.',
    icon: '🎲',
    accentColor: '#ffffff',
    previewData: { effect: 'classic' }
  },
  {
    id: 'dice_neon_cyan',
    name: 'Dado Neón Cyan',
    category: 'dice',
    priceSC: 350,
    rarity: 'rare',
    description: 'Dado futurista con estela de luz cian en cada giro.',
    icon: '💠',
    accentColor: 'var(--candy-cyan)',
    previewData: { effect: 'neon' }
  },
  {
    id: 'dice_crimson_fire',
    name: 'Dado Fuego Carmesí',
    category: 'dice',
    priceSC: 500,
    rarity: 'epic',
    description: 'Emite llamas ardientes y chispas al rodar en la mesa.',
    icon: '🔥',
    accentColor: '#ff0055',
    previewData: { effect: 'fire' }
  },
  {
    id: 'dice_24k_gold',
    name: 'Dado Golden Crown',
    category: 'dice',
    priceSC: 900,
    rarity: 'legendary',
    description: 'Dado fundido en oro macizo con números de rubí.',
    icon: '✨',
    accentColor: 'var(--candy-gold)',
    previewData: { effect: 'gold' }
  }
]

export const EMOTE_ITEMS: StoreItem[] = [
  {
    id: 'emote_lol_bounce',
    name: 'Risa en Bucle (LOL)',
    category: 'emote',
    priceSC: 250,
    rarity: 'rare',
    description: 'Carcajada imparable con efecto de rebote elástico.',
    icon: '🤣',
    accentColor: 'var(--candy-gold)',
    previewData: { animation: 'bounce' }
  },
  {
    id: 'emote_on_fire',
    name: 'En Llamas (On Fire)',
    category: 'emote',
    priceSC: 250,
    rarity: 'rare',
    description: 'Llamarada intensa para intimidar a tus rivales.',
    icon: '🔥',
    accentColor: 'var(--candy-orange)',
    previewData: { animation: 'flame' }
  },
  {
    id: 'emote_sad_cry',
    name: 'Lágrimas (Sad Cry)',
    category: 'emote',
    priceSC: 200,
    rarity: 'rare',
    description: 'Cascada de lágrimas cómica cuando te capturan una ficha.',
    icon: '😭',
    accentColor: 'var(--candy-cyan)',
    previewData: { animation: 'tears' }
  },
  {
    id: 'emote_sugar_love',
    name: 'Sugar Love (Corazón)',
    category: 'emote',
    priceSC: 300,
    rarity: 'epic',
    description: 'Corazones dulces que flotan y se multiplican en pantalla.',
    icon: '💖',
    accentColor: 'var(--candy-magenta)',
    previewData: { animation: 'heartbeat' }
  },
  {
    id: 'emote_trophy_gg',
    name: 'Copa GG (Victoria Épica)',
    category: 'emote',
    priceSC: 350,
    rarity: 'legendary',
    description: 'Trofeo dorado brillante con fuegos artificiales.',
    icon: '🏆',
    accentColor: 'var(--candy-gold)',
    previewData: { animation: 'shine' }
  }
]

export const BOOSTER_ITEMS: StoreItem[] = [
  {
    id: 'booster_xp_2x_24h',
    name: 'XP Booster 2X (24 Horas)',
    category: 'booster',
    priceSC: 150,
    rarity: 'rare',
    description: 'Duplica toda la experiencia ganada en partidas durante 24 horas.',
    icon: '⚡',
    accentColor: 'var(--candy-cyan)',
    previewData: { multiplier: 2, durationHours: 24 }
  },
  {
    id: 'booster_xp_2x_3d',
    name: 'XP Booster 2X (3 Días)',
    category: 'booster',
    priceSC: 350,
    rarity: 'epic',
    description: 'Duplica la experiencia en todas las partidas durante 72 horas continuas.',
    icon: '⚡⚡',
    accentColor: 'var(--candy-orange)',
    previewData: { multiplier: 2, durationHours: 72 }
  },
  {
    id: 'booster_xp_3x_24h',
    name: 'XP Booster 3X Ultra (24 Horas)',
    category: 'booster',
    priceSC: 300,
    rarity: 'legendary',
    description: '¡Multiplica tu experiencia por 3 en cada victoria por 24 horas!',
    icon: '🚀',
    accentColor: 'var(--candy-gold)',
    previewData: { multiplier: 3, durationHours: 24 }
  }
]

// -----------------------------------------------------------------------------
// LOCAL / FIRESTORE INVENTORY PERSISTENCE HELPERS
// -----------------------------------------------------------------------------

const DEFAULT_INVENTORY: UserInventory = {
  ownedItems: ['board_default', 'token_default', 'dice_default'],
  equipped: {
    board: 'board_default',
    token: 'token_default',
    dice: 'dice_default'
  },
  activeBoosters: []
}

export async function fetchUserInventory(userId?: string): Promise<UserInventory> {
  if (!userId || userId.startsWith('dev_')) {
    const saved = localStorage.getItem('sugar_user_inventory')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.warn('Error parsing local inventory:', e)
      }
    }
    return DEFAULT_INVENTORY
  }

  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      const data = userSnap.data()
      return {
        ownedItems: Array.isArray(data.ownedItems) && data.ownedItems.length > 0 
          ? data.ownedItems 
          : DEFAULT_INVENTORY.ownedItems,
        equipped: {
          board: data.equippedBoard || DEFAULT_INVENTORY.equipped.board,
          token: data.equippedToken || DEFAULT_INVENTORY.equipped.token,
          dice: data.equippedDice || DEFAULT_INVENTORY.equipped.dice
        },
        activeBoosters: data.activeBoosters || []
      }
    }
    return DEFAULT_INVENTORY
  } catch (error) {
    console.error('Error fetching user inventory:', error)
    return DEFAULT_INVENTORY
  }
}

export async function purchaseCoinPackage(userId: string, packageId: string): Promise<{ success: boolean; coinsAdded: number; message: string }> {
  const pkg = COIN_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return { success: false, coinsAdded: 0, message: 'Paquete no encontrado' }

  if (userId && !userId.startsWith('dev_')) {
    await recordWalletTransaction(userId, {
      type: 'deposit',
      amount: pkg.totalCoins,
      description: `Compra de Tienda: ${pkg.name} ($${pkg.usdtCost} USDT)`
    })
  } else {
    // Local / Dev Fallback
    const current = parseInt(localStorage.getItem('sugar_player_coins') || '200', 10)
    localStorage.setItem('sugar_player_coins', (current + pkg.totalCoins).toString())
  }

  return {
    success: true,
    coinsAdded: pkg.totalCoins,
    message: `¡Has adquirido ${pkg.totalCoins} Sugar Coins con éxito!`
  }
}

export async function purchaseStoreItem(
  userId: string, 
  item: StoreItem, 
  currentCoins: number, 
  deductCoinsFn?: (amount: number) => Promise<boolean>
): Promise<{ success: boolean; message: string }> {
  if (currentCoins < item.priceSC) {
    return { success: false, message: 'No tienes suficientes Sugar Coins.' }
  }

  // Deduct coins
  if (deductCoinsFn) {
    const ok = await deductCoinsFn(item.priceSC)
    if (!ok) return { success: false, message: 'Error al descontar Sugar Coins.' }
  } else if (!userId || userId.startsWith('dev_')) {
    const current = parseInt(localStorage.getItem('sugar_player_coins') || '200', 10)
    localStorage.setItem('sugar_player_coins', Math.max(0, current - item.priceSC).toString())
  }

  // Record item in inventory
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      if (item.category === 'booster') {
        const durationMs = (item.previewData?.durationHours || 24) * 3600 * 1000
        const newBooster = {
          id: item.id,
          multiplier: item.previewData?.multiplier || 2,
          expiresAt: Date.now() + durationMs
        }
        await updateDoc(userRef, {
          ownedItems: arrayUnion(item.id),
          activeBoosters: arrayUnion(newBooster)
        })
      } else {
        await updateDoc(userRef, {
          ownedItems: arrayUnion(item.id)
        })
      }
    } catch (e) {
      console.warn('Firestore update inventory error:', e)
    }
  } else {
    // LocalStorage
    const inv = await fetchUserInventory(userId)
    if (!inv.ownedItems.includes(item.id)) {
      inv.ownedItems.push(item.id)
    }
    if (item.category === 'booster') {
      const durationMs = (item.previewData?.durationHours || 24) * 3600 * 1000
      inv.activeBoosters = inv.activeBoosters || []
      inv.activeBoosters.push({
        id: item.id,
        multiplier: item.previewData?.multiplier || 2,
        expiresAt: Date.now() + durationMs
      })
    }
    localStorage.setItem('sugar_user_inventory', JSON.stringify(inv))
  }

  return { success: true, message: `¡${item.name} desbloqueado con éxito!` }
}

export async function equipStoreItem(
  userId: string, 
  category: 'board' | 'token' | 'dice', 
  itemId: string
): Promise<{ success: boolean }> {
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      const field = category === 'board' ? 'equippedBoard' : category === 'token' ? 'equippedToken' : 'equippedDice'
      await updateDoc(userRef, { [field]: itemId })
    } catch (e) {
      console.warn('Firestore equip error:', e)
    }
  } else {
    const inv = await fetchUserInventory(userId)
    inv.equipped[category] = itemId
    localStorage.setItem('sugar_user_inventory', JSON.stringify(inv))
  }

  return { success: true }
}
