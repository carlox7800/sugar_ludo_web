export type HexPlayerColor = 'purple' | 'green' | 'blue' | 'orange' | 'yellow' | 'red';

export interface HexPlayerConfig {
  color: HexPlayerColor;
  name: string;
  hexCode: string;
  lightHex: string;
  darkHex: string;
  deepHex?: string;
  startCell: number;      // Main path cell where player starts (Star cell)
  homeEntryCell: number;  // Main path cell right before H1
  starCell: number;       // Star cell index
  sectorIndex: number;    // 0 to 5
}

export const HEX_COLORS_ORDER: HexPlayerColor[] = [
  'purple',
  'red',
  'yellow',
  'orange',
  'blue',
  'green',
];

export const HEX_COLOR_INFO: Record<HexPlayerColor, HexPlayerConfig> = {
  purple: {
    color: 'purple',
    name: 'Morado',
    hexCode: '#9333ea',
    lightHex: '#f3e8ff',
    darkHex: '#7e22ce',
    deepHex: '#6b21a8',
    startCell: 8,
    homeEntryCell: 6,
    starCell: 8,
    sectorIndex: 0, // Top
  },
  green: {
    color: 'green',
    name: 'Verde',
    hexCode: '#059669',
    lightHex: '#dcfce7',
    darkHex: '#047857',
    deepHex: '#065f46',
    startCell: 73,
    homeEntryCell: 71,
    starCell: 73,
    sectorIndex: 1, // Top-Right
  },
  blue: {
    color: 'blue',
    name: 'Azul',
    hexCode: '#0284c7',
    lightHex: '#e0f2fe',
    darkHex: '#0369a1',
    deepHex: '#075985',
    startCell: 60,
    homeEntryCell: 58,
    starCell: 60,
    sectorIndex: 2, // Bottom-Right
  },
  orange: {
    color: 'orange',
    name: 'Naranja',
    hexCode: '#ea580c',
    lightHex: '#ffedd5',
    darkHex: '#c2410c',
    deepHex: '#9a3412',
    startCell: 47,
    homeEntryCell: 45,
    starCell: 47,
    sectorIndex: 3, // Bottom
  },
  yellow: {
    color: 'yellow',
    name: 'Amarillo',
    hexCode: '#ca8a04',
    lightHex: '#fef9c3',
    darkHex: '#a16207',
    deepHex: '#854d0e',
    startCell: 34,
    homeEntryCell: 32,
    starCell: 34,
    sectorIndex: 4, // Bottom-Left
  },
  red: {
    color: 'red',
    name: 'Rojo',
    hexCode: '#ff0055',
    lightHex: '#fee2e2',
    darkHex: '#e11d48',
    deepHex: '#be123c',
    startCell: 21,
    homeEntryCell: 19,
    starCell: 21,
    sectorIndex: 5, // Top-Left
  },
};

export const STAR_CELLS = [2, 8, 15, 21, 28, 34, 41, 47, 54, 60, 67, 73];
export const TOTAL_MAIN_CELLS = 78;
export const TOKENS_PER_PLAYER = 3;

export interface HexToken {
  id: number;           // 0, 1, 2
  playerId: number;     // 0..5
  color: HexPlayerColor;
  step: number;         // 0: base, 1..78: main path, 79..83: H1..H5, 84: goal
}

export interface HexPlayer {
  id: number;
  color: HexPlayerColor;
  name: string;
  type: 'human' | 'bot';
  isActive: boolean;
  score: number;
  hasFinished?: boolean;
  rank?: number;
}
