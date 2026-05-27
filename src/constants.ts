import type { GhostName, GhostMode, Vec2 } from './types.js';

export const COLS = 28;
export const ROWS = 31;
export const TILE_SIZE = 16;

export const CANVAS_WIDTH = COLS * TILE_SIZE;
export const CANVAS_HEIGHT = (ROWS + 4) * TILE_SIZE; // extra rows for score UI

export const PLAYER_SPEED = 5.5; // tiles per second
export const GHOST_SPEED = 4.5;  // プレイヤー(5.5)より少し遅く
export const FRIGHTENED_SPEED = 3.0;
export const EATEN_SPEED = 12.0;

export const FRIGHTENED_DURATION = 6.0; // seconds

export const PLAYER_START: Vec2 = { x: 13, y: 23 };

export const GHOST_HOUSE_CENTER: Vec2 = { x: 13, y: 14 };
export const GHOST_HOUSE_DOOR: Vec2 = { x: 13, y: 11 };

export const GHOST_STARTS: Record<GhostName, Vec2> = {
  BLINKY: { x: 13, y: 11 },
  PINKY:  { x: 13, y: 14 },
  INKY:   { x: 11, y: 14 },
  CLYDE:  { x: 15, y: 14 },
};

export const GHOST_SCATTER_TARGETS: Record<GhostName, Vec2> = {
  BLINKY: { x: 25, y: 0 },
  PINKY:  { x: 2,  y: 0 },
  INKY:   { x: 27, y: 30 },
  CLYDE:  { x: 0,  y: 30 },
};

// Mode schedule: alternating SCATTER/CHASE durations in seconds
// Index 0,2,4... = SCATTER, Index 1,3,5... = CHASE
export const MODE_SCHEDULE: number[] = [7, 20, 7, 20, 5, 20, 5];
// After index 6, permanent CHASE

export const GHOST_RELEASE_DOT_THRESHOLDS: Record<GhostName, number> = {
  BLINKY: 0,
  PINKY:  0,
  INKY:   30,
  CLYDE:  60,
};

export const GHOST_COLORS: Record<GhostName, string> = {
  BLINKY: '#FF0000',
  PINKY:  '#FFB8FF',
  INKY:   '#00FFFF',
  CLYDE:  '#FFB852',
};

export const COLORS = {
  BACKGROUND: '#000000',
  WALL:        '#0000FF',
  WALL_INNER:  '#000088',
  DOT:         '#FFB8AE',
  POWER_DOT:   '#FFB8AE',
  PLAYER:      '#FFE000',
  GHOST_FRIGHTENED:     '#0000FF',
  GHOST_FRIGHTENED_END: '#FFFFFF',
  GHOST_EATEN_EYES:     '#FFFFFF',
  SCORE_TEXT:  '#FFFFFF',
  LIFE_COLOR:  '#FFE000',
} as const;

export const STAGE_WALL_COLORS = [
  { wall: '#0000FF', inner: '#000088' }, // Stage 1: Blue
  { wall: '#007700', inner: '#004400' }, // Stage 2: Green
  { wall: '#AA0000', inner: '#660000' }, // Stage 3: Red
] as const;

export function getStageColors(level: number): { wall: string; inner: string } {
  const idx = Math.max(0, Math.min(level - 1, STAGE_WALL_COLORS.length - 1));
  return STAGE_WALL_COLORS[idx]!;
}

export const SCORE = {
  DOT:         10,
  POWER_DOT:   50,
  GHOST_BASE:  200,
  FRUIT:       100,
} as const;

// Ghost consecutive eat scores: 200, 400, 800, 1600
export const GHOST_EAT_SCORES = [200, 400, 800, 1600] as const;

export const INITIAL_LIVES = 3;
export const MAX_LEVEL = 3;

export const TUNNEL_COLS = [0, 27]; // x-column indices that are tunnels

export type { GhostMode };

export interface FruitDef {
  color: string;
  score: number;
}

const FRUIT_TABLE: FruitDef[] = [
  { color: '#FF2222', score: 100  }, // Level 1: Cherry
  { color: '#FF44AA', score: 300  }, // Level 2: Strawberry
  { color: '#FF8800', score: 500  }, // Level 3: Orange
  { color: '#CC1100', score: 700  }, // Level 4: Apple
  { color: '#22BB44', score: 1000 }, // Level 5+: Melon
];

export const FRUIT_SPAWN_THRESHOLDS = [47, 113] as const;
export const FRUIT_DURATION = 15.0;
export const FRUIT_MAX_ACTIVE = 2;

export function getFruitDef(level: number): FruitDef {
  const idx = Math.max(0, Math.min(level - 1, FRUIT_TABLE.length - 1));
  return FRUIT_TABLE[idx]!;
}

export interface LevelParams {
  playerSpeed: number;
  ghostSpeed: number;
  frightenedSpeed: number;
  frightenedDuration: number;
  ghostReleaseThresholds: Record<GhostName, number>;
  modeSchedule: number[];
}

const LEVEL_PARAMS: LevelParams[] = [
  // Level 1
  {
    playerSpeed: 5.5,
    ghostSpeed: 4.5,
    frightenedSpeed: 3.0,
    frightenedDuration: 6.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 30, CLYDE: 60 },
    modeSchedule: [7, 20, 7, 20, 5, 20, 5],
  },
  // Level 2
  {
    playerSpeed: 5.8,
    ghostSpeed: 5.0,
    frightenedSpeed: 3.0,
    frightenedDuration: 5.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 20, CLYDE: 40 },
    modeSchedule: [7, 20, 7, 20, 5, 20, 5],
  },
  // Level 3
  {
    playerSpeed: 6.0,
    ghostSpeed: 5.5,
    frightenedSpeed: 3.0,
    frightenedDuration: 4.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 15, CLYDE: 30 },
    modeSchedule: [7, 20, 7, 20, 5, 20, 5],
  },
  // Level 4
  {
    playerSpeed: 6.2,
    ghostSpeed: 5.8,
    frightenedSpeed: 3.0,
    frightenedDuration: 3.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 10, CLYDE: 20 },
    modeSchedule: [7, 20, 5, 20, 5, 20, 5],
  },
  // Level 5+
  {
    playerSpeed: 6.5,
    ghostSpeed: 6.2,
    frightenedSpeed: 3.0,
    frightenedDuration: 2.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 5, CLYDE: 10 },
    modeSchedule: [5, 20, 5, 20, 5, 20, 5],
  },
];

export function getLevelParams(level: number): LevelParams {
  const clamped = Math.max(1, Math.min(level, LEVEL_PARAMS.length));
  return LEVEL_PARAMS[clamped - 1]!;
}
