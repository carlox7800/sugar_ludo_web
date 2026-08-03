export type PlayerColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'orange';
export type PlayerType = 'human' | 'bot';

export interface Player {
  id: number; // 0, 1, 2, 3, 4, 5
  color: PlayerColor;
  name: string;
  type: PlayerType;
  isActive: boolean; // active in current game
  hasFinished?: boolean;
  rank?: number;
}

export interface Token {
  id: number; // 0, 1, 2, 3
  playerId: number;
  color: PlayerColor;
  step: number; // 0 (Base), 1..51 (Perimeter), 52..56 (Home Run), 57 (Goal)
}

export interface CellCoord {
  row: number;
  col: number;
}

export interface GameLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'roll' | 'move' | 'capture' | 'goal' | 'system' | 'warning';
  playerColor?: PlayerColor;
}

export interface GameConfig {
  playerCount: 2 | 3 | 4 | 5 | 6;
  humanColor: PlayerColor;
  botDifficulty: 'easy' | 'medium' | 'hard';
}

export type AppTheme = 'classic' | 'sugar';

export interface UserProfile {
  level: number;
  xp: number;
  xpNeeded: number;
  coins: number;
  gems: number;
}
