export type Vec2 = { readonly x: number; readonly y: number };

export type TileType =
  | 0  // EMPTY
  | 1  // WALL
  | 2  // DOT
  | 3  // POWER_DOT
  | 4; // TUNNEL

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export type GhostMode = 'SCATTER' | 'CHASE' | 'FRIGHTENED' | 'EATEN';

export type GhostName = 'BLINKY' | 'PINKY' | 'INKY' | 'CLYDE';

export type GamePhase =
  | 'TITLE'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'PLAYER_DEAD'
  | 'STAGE_CLEAR'
  | 'GAME_OVER';

export type SoundKey = 'EAT_DOT' | 'EAT_POWER' | 'EAT_GHOST' | 'DEATH' | 'GAME_START';

export interface PlayerState {
  pos: Vec2;
  pixelPos: Vec2;
  dir: Direction;
  nextDir: Direction;
  animFrame: number;
  isDead: boolean;
}

export interface GhostState {
  name: GhostName;
  pos: Vec2;
  pixelPos: Vec2;
  dir: Direction;
  mode: GhostMode;
  prevMode: GhostMode;
  frightenedTimer: number;
  eatenScore: number;
  lastTurnTile: Vec2;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  highScore: number;
  lives: number;
  level: number;
  dotsEaten: number;
  modeTimer: number;
  modeIndex: number;
  ghostsEatenInFrightened: number;
  phaseTimer: number;
  gameoverCanInput: boolean;
}

export interface HighScore {
  score: number;
}
