// -----------------------------------------------------------------------------
// Sugar Ludo - Dice Themes Configuration
// Controls in-game dice visual styles: classic, neon, fire, gold
// -----------------------------------------------------------------------------

export interface DiceThemeConfig {
  id: string
  name: string
  bgClass: string
  borderClass: string
  dotColor: string
  glowClass: string
  isDarkDots?: boolean
  hasFlame?: boolean
  hasCrown?: boolean
}

export const DICE_THEMES: Record<string, DiceThemeConfig> = {
  dice_default: {
    id: 'dice_default',
    name: 'Dado Clásico',
    bgClass: '', // Uses player's color by default
    borderClass: 'border-border',
    dotColor: 'bg-white',
    glowClass: ''
  },
  dice_neon_cyan: {
    id: 'dice_neon_cyan',
    name: 'Dado Neón Cyan',
    bgClass: 'bg-[linear-gradient(145deg,#0e7490,#082f49)]',
    borderClass: 'border-[#00f2ff]',
    dotColor: 'bg-[#00f2ff] shadow-[0_0_8px_#00f2ff]',
    glowClass: 'shadow-[0_0_20px_rgba(0,242,255,0.6)]'
  },
  dice_crimson_fire: {
    id: 'dice_crimson_fire',
    name: 'Dado Fuego Carmesí',
    bgClass: 'bg-[linear-gradient(145deg,#ff2277,#881337)]',
    borderClass: 'border-[#f43f5e]',
    dotColor: 'bg-[#fef08a] shadow-[0_0_6px_#f97316]',
    glowClass: 'shadow-[0_0_20px_rgba(255,34,119,0.7)]',
    hasFlame: true
  },
  dice_24k_gold: {
    id: 'dice_24k_gold',
    name: 'Dado Golden Crown',
    bgClass: 'bg-[linear-gradient(145deg,#fde047,#a16207)]',
    borderClass: 'border-[#fef08a]',
    dotColor: 'bg-[#ffffff] shadow-[0_0_6px_#ca8a04]',
    glowClass: 'shadow-[0_0_20px_rgba(234,179,8,0.7)]',
    hasCrown: true
  }
}

export function getDiceTheme(diceId?: string): DiceThemeConfig {
  if (diceId && DICE_THEMES[diceId]) {
    return DICE_THEMES[diceId]
  }
  return DICE_THEMES.dice_default
}
