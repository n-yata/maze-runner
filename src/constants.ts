import type { GhostName, GhostMode, Vec2 } from './types.js';

export const COLS = 28;
export const ROWS = 31;
export const TILE_SIZE = 16;

export const CANVAS_WIDTH = COLS * TILE_SIZE;
export const CANVAS_HEIGHT = (ROWS + 4) * TILE_SIZE; // extra rows for score UI

export const PLAYER_SPEED = 7.5; // tiles per second
export const GHOST_SPEED = 6.5;
export const FRIGHTENED_SPEED = 4.0;
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

export const SCORE = {
  DOT:         10,
  POWER_DOT:   50,
  GHOST_BASE:  200,
  FRUIT:       100,
} as const;

// Ghost consecutive eat scores: 200, 400, 800, 1600
export const GHOST_EAT_SCORES = [200, 400, 800, 1600] as const;

export const INITIAL_LIVES = 3;

export const TUNNEL_COLS = [0, 27]; // x-column indices that are tunnels

export type { GhostMode };
