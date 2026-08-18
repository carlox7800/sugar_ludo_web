// -----------------------------------------------------------------------------
// Sugar Ludo - Token Themes Configuration
// Controls token visual styles: classic, gem, candy, gold
// -----------------------------------------------------------------------------

export interface TokenThemeConfig {
  id: string
  name: string
  style: 'classic' | 'gem' | 'candy' | 'gold'
  showRing: boolean
  hasSparkle: boolean
  crownEmblem: boolean
}

export const TOKEN_THEMES: Record<string, TokenThemeConfig> = {
  token_default: {
    id: 'token_default',
    name: 'Fichas Estándar',
    style: 'classic',
    showRing: true,
    hasSparkle: false,
    crownEmblem: false
  },
  token_crystal_gems: {
    id: 'token_crystal_gems',
    name: 'Gemas de Cristal',
    style: 'gem',
    showRing: false,
    hasSparkle: true,
    crownEmblem: false
  },
  token_glazed_candy: {
    id: 'token_glazed_candy',
    name: 'Caramelos Glaseados',
    style: 'candy',
    showRing: true,
    hasSparkle: false,
    crownEmblem: false
  },
  token_pure_gold: {
    id: 'token_pure_gold',
    name: 'Fichas Oro Puro 24K',
    style: 'gold',
    showRing: true,
    hasSparkle: true,
    crownEmblem: true
  }
}

export function getTokenTheme(tokenId?: string): TokenThemeConfig {
  if (tokenId && TOKEN_THEMES[tokenId]) {
    return TOKEN_THEMES[tokenId]
  }
  return TOKEN_THEMES.token_default
}
