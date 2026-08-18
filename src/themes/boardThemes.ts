// -----------------------------------------------------------------------------
// Sugar Ludo - Board Themes Configuration (4P & 6P)
// Purely visual properties: backgrounds, strokes, fills, and star accents.
// Mathematics, cell indices and paths are NEVER altered.
// -----------------------------------------------------------------------------

export interface BoardThemeConfig {
  id: string
  name: string
  containerBg: string
  containerBorder: string
  svgBg: string
  gridStroke: string
  cellFillNormal: string
  cellFillSafe: string
  cellTextColor: string
  cellTextOpacity: number
  starSafeColor: string
  starSafeStroke: string
  starStartStroke: string
  homeRunStroke: string
  centerBg: string
  centerBorder: string
  colorHexMap: {
    red: string
    green: string
    yellow: string
    blue: string
    purple?: string
    orange?: string
    cyan?: string
    magenta?: string
  }
}

export const BOARD_THEMES: Record<string, BoardThemeConfig> = {
  board_default: {
    id: 'board_default',
    name: 'Clásico Cyber',
    containerBg: 'bg-white',
    containerBorder: 'border-[#cbd5e1]',
    svgBg: '#ffffff',
    gridStroke: '#94a3b8',
    cellFillNormal: '#e2e8f0',
    cellFillSafe: '#f59e0b',
    cellTextColor: '#94a3b8',
    cellTextOpacity: 0.6,
    starSafeColor: '#f59e0b',
    starSafeStroke: '#b45309',
    starStartStroke: '#dc2626',
    homeRunStroke: '#ffffff',
    centerBg: '#ffffff',
    centerBorder: '#94a3b8',
    colorHexMap: {
      red: '#ff0055',
      green: '#00cc66',
      yellow: '#ffcc00',
      blue: '#00ddff',
      purple: '#a855f7',
      orange: '#f97316',
      cyan: '#06b6d4',
      magenta: '#f43f5e'
    }
  },

  board_candy_pop: {
    id: 'board_candy_pop',
    name: 'Sugar Candy Pop',
    containerBg: 'bg-[#fff5f8]',
    containerBorder: 'border-[#fbcfe8]',
    svgBg: '#fff5f8',
    gridStroke: '#f472b6',
    cellFillNormal: '#fce7f3',
    cellFillSafe: '#fde047',
    cellTextColor: '#db2777',
    cellTextOpacity: 0.75,
    starSafeColor: '#fde047',
    starSafeStroke: '#ca8a04',
    starStartStroke: '#f43f5e',
    homeRunStroke: '#ffffff',
    centerBg: '#ffe4e6',
    centerBorder: '#ec4899',
    colorHexMap: {
      red: '#f43f5e',
      green: '#10b981',
      yellow: '#facc15',
      blue: '#38bdf8',
      purple: '#c084fc',
      orange: '#fb923c',
      cyan: '#22d3ee',
      magenta: '#fb7185'
    }
  },

  board_neon_matrix: {
    id: 'board_neon_matrix',
    name: 'Neon Cyber Matrix',
    containerBg: 'bg-[#0b0f19]',
    containerBorder: 'border-[#0284c7]',
    svgBg: '#0f172a',
    gridStroke: '#0369a1',
    cellFillNormal: '#1e293b',
    cellFillSafe: '#00f2ff',
    cellTextColor: '#38bdf8',
    cellTextOpacity: 0.85,
    starSafeColor: '#00f2ff',
    starSafeStroke: '#0284c7',
    starStartStroke: '#38bdf8',
    homeRunStroke: '#00f2ff',
    centerBg: '#082f49',
    centerBorder: '#00f2ff',
    colorHexMap: {
      red: '#ff0055',
      green: '#00ff88',
      yellow: '#ffcc00',
      blue: '#00ddff',
      purple: '#d946ef',
      orange: '#ff7700',
      cyan: '#00f2ff',
      magenta: '#ff0077'
    }
  },

  board_royal_gold: {
    id: 'board_royal_gold',
    name: 'Royal Imperial Gold',
    containerBg: 'bg-[#181124]',
    containerBorder: 'border-[#eab308]',
    svgBg: '#1f162e',
    gridStroke: '#ca8a04',
    cellFillNormal: '#2c1e42',
    cellFillSafe: '#ffd700',
    cellTextColor: '#fef08a',
    cellTextOpacity: 0.85,
    starSafeColor: '#ffd700',
    starSafeStroke: '#854d0e',
    starStartStroke: '#ffd700',
    homeRunStroke: '#ffd700',
    centerBg: '#2a163d',
    centerBorder: '#ffd700',
    colorHexMap: {
      red: '#e11d48',
      green: '#059669',
      yellow: '#eab308',
      blue: '#0284c7',
      purple: '#9333ea',
      orange: '#ea580c',
      cyan: '#0891b2',
      magenta: '#e11d48'
    }
  }
}

export function getBoardTheme(themeId?: string): BoardThemeConfig {
  if (themeId && BOARD_THEMES[themeId]) {
    return BOARD_THEMES[themeId]
  }
  return BOARD_THEMES.board_default
}
