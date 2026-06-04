import type { GhostName, GhostMode, Vec2 } from './types.js';

export const COLS = 15;
export const ROWS = 25;
export const TILE_SIZE = 24;

export const CANVAS_WIDTH = COLS * TILE_SIZE;
export const CANVAS_HEIGHT = (ROWS + 4) * TILE_SIZE; // extra rows for score UI

export const PLAYER_SPEED = 5.5; // tiles per second
export const GHOST_SPEED = 4.5;  // プレイヤー(5.5)より少し遅く
export const FRIGHTENED_SPEED = 3.0;

export const FRIGHTENED_DURATION = 6.0; // seconds

export const PLAYER_START: Vec2 = { x: 7, y: 19 };

export const GHOST_HOUSE_CENTER: Vec2 = { x: 7, y: 12 };
export const GHOST_HOUSE_DOOR: Vec2 = { x: 7, y: 9 };

// Column range of the ghost house interior+door (used to restrict ghosts from re-entering)
export const GHOST_HOUSE_COLS: [number, number] = [5, 9];

export const GHOST_STARTS: Record<GhostName, Vec2> = {
  BLINKY: { x: 7, y: 9 },
  PINKY:  { x: 7, y: 12 },
  INKY:   { x: 6, y: 12 },
  CLYDE:  { x: 8, y: 12 },
};

export const GHOST_SCATTER_TARGETS: Record<GhostName, Vec2> = {
  BLINKY: { x: COLS - 3, y: 0 },
  PINKY:  { x: 2,  y: 0 },
  INKY:   { x: COLS - 1, y: ROWS - 1 },
  CLYDE:  { x: 0,  y: ROWS - 1 },
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

// エイリアン4体。内部キー(BLINKY/PINKY/INKY/CLYDE)は不変、配色のみ宇宙テーマへ
export const GHOST_COLORS: Record<GhostName, string> = {
  BLINKY: '#FF4D5E', // 赤エイリアン
  PINKY:  '#FF8AD8', // ピンクエイリアン
  INKY:   '#4DE0FF', // シアンエイリアン
  CLYDE:  '#FFC24D', // アンバーエイリアン
};

export const COLORS = {
  BACKGROUND: '#05060F',          // 深宇宙
  WALL:        '#2747C8',         // コロニー通路（基準色）
  WALL_INNER:  '#0A1230',
  DOT:         '#7DF0FF',         // エネルギー結晶
  POWER_DOT:   '#FFE66D',         // コア
  POWER_DOT_GLOW: 'rgba(255, 230, 109, 0.30)', // コアのグロー（POWER_DOTと同系）
  PLAYER:      '#9FD0FF',         // 宇宙船ハル
  GHOST_FRIGHTENED:     '#2A2AE0',
  GHOST_FRIGHTENED_END: '#FFFFFF',
  SCORE_TEXT:  '#FFFFFF',
  LIFE_COLOR:  '#9FD0FF',
  SHIP_THRUSTER: '#FF8A3C',       // 推進炎
  SHIP_COCKPIT:  '#06324A',       // コックピット
} as const;

export const STAGE_WALL_COLORS = [
  { wall: '#2747C8', inner: '#0A1230', glow: '#5C8CFF' }, // Stage 1: 青コロニー
  { wall: '#7A2BD0', inner: '#1E0A38', glow: '#C25CFF' }, // Stage 2: 紫星雲
  { wall: '#1FA89A', inner: '#06322D', glow: '#46F0D8' }, // Stage 3: エイリアンの巣
] as const;

export function getStageColors(level: number): { wall: string; inner: string; glow: string } {
  const idx = Math.max(0, Math.min(level - 1, STAGE_WALL_COLORS.length - 1));
  return STAGE_WALL_COLORS[idx]!;
}

export const SCORE = {
  DOT:         10,
  POWER_DOT:   50,
  GHOST_BASE:  200,
  // フルーツはレーザー発動アイテムに転換したためスコアは付与しない（SCORE.FRUIT は廃止）
} as const;

// Ghost consecutive eat scores: 200, 400, 800, 1600
export const GHOST_EAT_SCORES = [200, 400, 800, 1600] as const;

export const INITIAL_LIVES = 3;
export const MAX_LEVEL = 3;

export const TUNNEL_COLS = [0, COLS - 1]; // x-column indices that are tunnels

export type { GhostMode };

export interface FruitDef {
  color: string;
  score: number;
}

// 宇宙アイテム（鉱石/コア）。スコアは不変、color のみ宇宙テーマへ
const FRUIT_TABLE: FruitDef[] = [
  { color: '#7DF9FF', score: 100  }, // Level 1: クリスタル鉱石
  { color: '#FF6EC7', score: 300  }, // Level 2: プラズマ核
  { color: '#FFB347', score: 500  }, // Level 3: アンバー鉱石
  { color: '#A56BFF', score: 700  }, // Level 4: 反物質コア
  { color: '#5FFF8F', score: 1000 }, // Level 5+: バイオコア
];

// フルーツ（レーザー発動アイテム）は敵が残る限り繰り返し出現する（詰み防止）
export const FRUIT_DURATION = 15.0;       // 盤面に滞在する時間（取得されなければ消滅）
export const FRUIT_FIRST_DELAY = 4.0;     // ステージ開始から初回出現までの遅延
export const FRUIT_RESPAWN_INTERVAL = 6.0; // 盤面からフルーツが消えてから次に出るまでの間隔

// レーザー（フルーツ取得で一定時間、進行方向へ自動連射）
export const LASER_DURATION = 6.0;        // レーザーモードの継続時間(秒)
export const LASER_FIRE_INTERVAL = 0.18;  // 連射間隔(秒)
export const LASER_SPEED = 16;            // ビーム速度(tiles/秒)
export const LASER_HIT_RADIUS = TILE_SIZE * 0.6; // 敵への命中判定半径(px)

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
