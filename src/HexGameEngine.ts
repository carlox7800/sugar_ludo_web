import {
  HexPlayerColor,
  HexPlayer,
  HexToken,
  HEX_COLOR_INFO,
  STAR_CELLS,
  HEX_COLORS_ORDER,
  TOKENS_PER_PLAYER,
} from './HexBoardConstants';

export interface HexLog {
  id: string;
  message: string;
  timestamp: string;
  type: 'system' | 'move' | 'roll' | 'capture' | 'win';
  color?: HexPlayerColor;
}

export interface HexGameState {
  players: HexPlayer[];
  tokens: HexToken[];
  currentTurnIndex: number;
  diceValue: number | null;
  hasRolled: boolean;
  isRolling: boolean;
  isAnimating: boolean;
  winner: HexPlayer | null;
  logs: HexLog[];
  playerCount: 5 | 6;
  humanColor: HexPlayerColor;
  botDifficulty: 'easy' | 'medium' | 'hard';
}

export function createInitialHexState(
  playerCount: 5 | 6,
  humanColor: HexPlayerColor,
  botDifficulty: 'easy' | 'medium' | 'hard'
): HexGameState {
  const activeColors = HEX_COLORS_ORDER.slice(0, playerCount);
  const players: HexPlayer[] = activeColors.map((color, idx) => {
    const isHuman = color === humanColor;
    return {
      id: idx,
      color,
      name: isHuman ? 'Tú' : `Bot ${HEX_COLOR_INFO[color].name}`,
      type: isHuman ? 'human' : 'bot',
      isActive: true,
      score: 0,
    };
  });

  const tokens: HexToken[] = [];
  players.forEach((player) => {
    for (let tId = 0; tId < TOKENS_PER_PLAYER; tId++) {
      tokens.push({
        id: tId,
        playerId: player.id,
        color: player.color,
        step: 0, // 0 = base
      });
    }
  });

  const humanIdx = players.findIndex((p) => p.color === humanColor);
  const startTurnIdx = humanIdx >= 0 ? humanIdx : 0;

  const logs: HexLog[] = [
    {
      id: '1',
      message: `¡Partida Hexagonal iniciada (${playerCount} Jugadores, 3 fichas por casa)!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'system',
    },
    {
      id: '2',
      message: `Turno inicial para ${players[startTurnIdx].name} (${HEX_COLOR_INFO[players[startTurnIdx].color].name}).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'system',
      color: players[startTurnIdx].color,
    },
  ];

  return {
    players,
    tokens,
    currentTurnIndex: startTurnIdx,
    diceValue: null,
    hasRolled: false,
    isRolling: false,
    isAnimating: false,
    winner: null,
    logs,
    playerCount,
    humanColor,
    botDifficulty,
  };
}

export function getCellIndexForToken(color: HexPlayerColor, step: number): number | string {
  if (step === 0) return 'BASE';
  const startCell = HEX_COLOR_INFO[color].startCell;

  // Main board loop: steps 1 to 78 cover one full 78-cell perimeter
  if (step >= 1 && step <= 78) {
    return (startCell + (step - 1)) % 78;
  }
  
  // Steps 79 to 83: Home corridor H1 to H5
  if (step >= 79 && step <= 83) {
    return `H${step - 78}`;
  }

  return 'GOAL';
}

