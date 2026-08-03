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

// --- CONSTANTES DE HOMOLOGACIÓN HEXAGONAL ---
export const HEX_BONUS_CAPTURE = 25;
export const HEX_BONUS_GOAL = 15;
export const MAX_CONSECUTIVE_DOUBLES = 3;

/**
 * Calcula el bono de pasos para el tablero Hexagonal (5 y 6 jugadores)
 * +25 por captura de ficha enemiga
 * +15 por llegada a la meta (casilla 83)
 */
export function calculateHexMoveBonus(finalStep: number, isGoal: boolean, capturedAny: boolean): number {
  let bonus = 0;
  if (capturedAny) {
    bonus += HEX_BONUS_CAPTURE;
  }
  if (isGoal && finalStep === 83) {
    bonus += HEX_BONUS_GOAL;
  }
  return bonus;
}

/**
 * Procesa la penalización por 3 dobles consecutivos en el tablero Hexagonal.
 * Retorna las fichas actualizadas enviando la última ficha movida a la base (step = 0).
 */
export function processHexThreeDoublesPenalty(
  tokens: HexToken[],
  playerId: number,
  lastMovedTokenId: number | null
): { updatedTokens: HexToken[]; penalizedToken: HexToken | null } {
  if (lastMovedTokenId === null) {
    return { updatedTokens: tokens, penalizedToken: null };
  }

  let penalizedToken: HexToken | null = null;
  const updatedTokens = tokens.map((t) => {
    if (t.playerId === playerId && t.id === lastMovedTokenId && t.step > 0 && t.step < 83) {
      penalizedToken = t;
      return { ...t, step: 0 };
    }
    return t;
  });

  return { updatedTokens, penalizedToken };
}

/**
 * Valida la mecánica de expulsión y capturas en la casilla de salida ocupada del tablero Hexagonal.
 * Retorna si la acción resulta en expulsión directa (+0 bono) o en captura (+25 bono).
 */
export function checkHexStartCellExpulsion(
  startCellIndex: number,
  currentTokens: HexToken[],
  movingTokenColor: HexPlayerColor
): { isExpulsion: boolean; capturedTokens: HexToken[] } {
  const enemyTokensOnStart = currentTokens.filter((tk) => {
    if (tk.color === movingTokenColor || tk.step <= 0 || tk.step >= 83) return false;
    const tkIdx = getCellIndexForToken(tk.color, tk.step);
    return typeof tkIdx === 'number' && tkIdx === startCellIndex;
  });

  // Si hay exactamente 1 ficha enemiga en la casilla de salida, es una expulsión directa (regreso a casa con +0 bono)
  // Si hay 2 o más fichas enemigas o en otras casillas normales, se trata de captura normal (+25 bono)
  const isExpulsion = enemyTokensOnStart.length === 1;
  return {
    isExpulsion,
    capturedTokens: enemyTokensOnStart,
  };
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


