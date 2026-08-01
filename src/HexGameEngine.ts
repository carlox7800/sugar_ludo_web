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
  type: 'system' | 'move' | 'roll' | 'capture' | 'win' | 'info' | 'warning';
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
  const assignedHumanColor = activeColors[Math.floor(Math.random() * activeColors.length)];

  const players: HexPlayer[] = activeColors.map((color, idx) => {
    const isHuman = color === assignedHumanColor;
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

  const humanIdx = players.findIndex((p) => p.color === assignedHumanColor);
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
  if (step <= 0) return 'BASE';
  const startCell = HEX_COLOR_INFO[color].startCell;

  // Main board loop: steps 1 to 77 cover the perimeter until home entry
  if (step >= 1 && step <= 77) {
    return (startCell + (step - 1)) % 78;
  }
  
  // Steps 78 to 82: Home corridor H1 to H5
  if (step >= 78 && step <= 82) {
    return `H${step - 77}`;
  }

  return 'GOAL';
}

export function hasBarrierAtHex(perimeterIndex: number, currentTokens: HexToken[]): boolean {
  if (perimeterIndex < 0 || perimeterIndex > 77) return false;
  
  let totalCount = 0;
  currentTokens.forEach(tk => {
    if (tk.step > 0 && tk.step <= 77) {
      const tkIdx = getCellIndexForToken(tk.color, tk.step);
      if (typeof tkIdx === 'number' && tkIdx === perimeterIndex) {
        totalCount++;
      }
    }
  });
  
  return totalCount >= 2;
}
