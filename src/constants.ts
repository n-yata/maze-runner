import type { GhostName, GhostMode, Vec2 } from './types.js';

export const COLS = 15;
export const ROWS = 25;
export const TILE_SIZE = 24;

export const CANVAS_WIDTH = COLS * TILE_SIZE;
export const CANVAS_HEIGHT = (ROWS + 4) * TILE_SIZE; // extra rows for score UI

// スコアUIの高さと盤面の縦オフセット。renderer の描画と gameLoop の座標換算で共有する。
export const UI_HEIGHT = 4 * TILE_SIZE;
export const MAP_OFFSET_Y = UI_HEIGHT;

export const PLAYER_SPEED = 5.5; // tiles per second
export const GHOST_SPEED = 4.5;  // プレイヤー(5.5)より少し遅く

// 電磁バリアの残量がこの秒数を下回ると点滅警告する
export const BARRIER_BLINK_THRESHOLD = 2.0; // seconds

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
  BARRIER:     '#5FE6FF',         // 電磁バリア（電磁シアン）
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

// 宇宙船の部品総数。各ステージのクリアで1個ずつ回収し、全部揃うと修理して脱出する
export const TOTAL_PARTS = MAX_LEVEL;

// エンディング(ALL_CLEAR)演出の段階境界(秒)。gameLoop のフェーズ継続時間と
// renderer の描画段階で共有し、両者がズレて演出が途中で切れるのを防ぐ。
// 絵コンテ: 着陸した大型シャトルへ飛行士が歩み寄り、ハッチが開いてタラップを上り乗船 →
//          点火 → 発進・上昇 → ワープ → 青い地球へ帰還。各段階を timer 駆動で連続再生する。
export const ENDING_WALK_START   = 1.5;  // 段階A(着陸・登場フェードイン)の終了＝地上歩行開始
export const ENDING_RAMP_TIME    = 3.5;  // 段階B(タラップ下まで歩行)の終了＝ハッチ開放・乗船開始
export const ENDING_BOARD_TIME   = 5.5;  // 段階C(タラップを上り乗船)の終了＝乗船完了・ハッチ閉
export const ENDING_LIFTOFF_TIME = 7.0;  // 段階D(点火)の終了＝発進開始
export const ENDING_WARP_TIME    = 9.0;  // 段階E(発進・上昇)の終了＝ワープ突入
export const ENDING_EARTH_TIME   = 11.0; // 段階F(ワープ)の終了＝青い地球の出現
export const ENDING_DURATION     = 17.0; // 段階G(帰還＋GAME CLEARナレーション)の終了＝帰還シーンの長さ
export const ENDING_FADEOUT_DURATION = 2.0; // 段階H(暗転)の長さ。完了後にタイトルへ戻る(ALL_CLEAR継続時間 = ENDING_DURATION + これ)

// エンディング演出パラメータ。drawEnding(renderer) と fireEndingCues(gameLoop) で共有。
// (CX, CY) は着陸したシャトルのエンジン噴射口位置(canvas座標)。renderer の機体・地表レイアウトの基準でもある。
export const ENDING_ROCKET_CX  = CANVAS_WIDTH * 0.60;     // 停泊位置X(canvas座標, 中央やや右)
export const ENDING_ROCKET_CY  = CANVAS_HEIGHT * 0.70;    // 噴射口Y=地表ライン(canvas座標, 機体の足元)
export const ENDING_SHAKE_MAG  = 7;                       // 発進時の画面シェイク最大振幅(px)
export const ENDING_WARP_FACTOR = 9;                      // 発進中の星のスクロール倍率(ワープ感)

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
  barrierDuration: number; // 電磁バリアの持続時間(秒)。レベルで短縮
  ghostReleaseThresholds: Record<GhostName, number>;
  modeSchedule: number[];
}

const LEVEL_PARAMS: LevelParams[] = [
  // Level 1
  {
    playerSpeed: 5.5,
    ghostSpeed: 4.5,
    barrierDuration: 6.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 30, CLYDE: 60 },
    modeSchedule: [7, 20, 7, 20, 5, 20, 5],
  },
  // Level 2
  {
    playerSpeed: 5.8,
    ghostSpeed: 5.0,
    barrierDuration: 5.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 20, CLYDE: 40 },
    modeSchedule: [7, 20, 7, 20, 5, 20, 5],
  },
  // Level 3
  {
    playerSpeed: 6.0,
    ghostSpeed: 5.5,
    barrierDuration: 4.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 15, CLYDE: 30 },
    modeSchedule: [7, 20, 7, 20, 5, 20, 5],
  },
  // Level 4
  {
    playerSpeed: 6.2,
    ghostSpeed: 5.8,
    barrierDuration: 3.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 10, CLYDE: 20 },
    modeSchedule: [7, 20, 5, 20, 5, 20, 5],
  },
  // Level 5+
  {
    playerSpeed: 6.5,
    ghostSpeed: 6.2,
    barrierDuration: 2.0,
    ghostReleaseThresholds: { BLINKY: 0, PINKY: 0, INKY: 5, CLYDE: 10 },
    modeSchedule: [5, 20, 5, 20, 5, 20, 5],
  },
];

export function getLevelParams(level: number): LevelParams {
  const clamped = Math.max(1, Math.min(level, LEVEL_PARAMS.length));
  return LEVEL_PARAMS[clamped - 1]!;
}

// =============================================================
// ボスステージ（ステージ3クリア後の最終関門）
// =============================================================
// 全3面クリア後、帰還エンディング(ALL_CLEAR)へ直行せず、HP制の巨大ボスと
// 一騎打ちする。ボスは盤面上部に陣取り弾幕を放ち、プレイヤーはレーザーで反撃し
// 電磁バリアで被弾を防ぐ。撃破でALL_CLEARへ接続する。
// MAX_LEVEL / TOTAL_PARTS は変更しない（level は3のまま・部品は3個のまま）。

// フェーズ継続時間（gameLoop のフェーズ駆動と共有）
export const BOSS_READY_DURATION    = 2.5; // WARNING導入の表示時間(秒)
export const BOSS_DEFEATED_DURATION = 2.5; // 撃破演出→ALL_CLEAR への猶予(秒)

// プレイヤー体力（シューティング風: 被弾でリトライせずハートを消費し、0でゲームオーバー）
export const BOSS_PLAYER_HEARTS = 3;   // ボス戦のハート数
export const BOSS_HIT_INVULN    = 1.2; // 被弾後の無敵時間(秒)。連続被弾防止＋点滅表示

// HP・ダメージ
export const BOSS_MAX_HP      = 60;            // 初期HP
export const BOSS_HIT_DAMAGE  = 2;             // レーザー1ヒットの与ダメ（強すぎ調整: 1→2 で体力を早く削れる）
export const BOSS_BODY_RADIUS = TILE_SIZE * 1.6; // 本体の被弾円半径(px)。大きめで上方の的に当てやすく

// 本体の挙動（盤面上部で左右往復）
export const BOSS_CENTER_Y   = TILE_SIZE * 3.2;  // 本体中心Y(盤面ローカルpx)。盤面上部
export const BOSS_SWAY_SPEED = 1.1;              // 左右往復の角速度(rad/秒)
export const BOSS_SWAY_RANGE = TILE_SIZE * 4;    // 往復の片振幅(px)

// 弾幕（2系統を別タイマーで合成・乱数なしの決定論）
export const BOSS_BULLET_SPEED   = 6.0;          // 弾速(tiles/秒)。プレイヤー速度と同等で回避可能
export const BOSS_BULLET_RADIUS  = TILE_SIZE * 0.34; // 弾の被弾半径(px)
export const BOSS_FIRE_INTERVAL  = 0.9;          // ばら撒き(扇)ウェーブの発射間隔(秒)
export const BOSS_SPREAD_COUNT   = 5;            // 1ウェーブの扇状弾数
export const BOSS_SPREAD_ARC     = Math.PI * 0.5; // 扇の開き角(rad)。下方向中心
export const BOSS_AIMED_INTERVAL = 1.8;          // 狙い撃ち弾の発射間隔(秒)
export const BOSS_MAX_BULLETS    = 48;           // 弾プール上限(固定長)

// ボス闘技場の配色（既存 STAGE_WALL_COLORS は変更しない。最終決戦の赤系）
export const BOSS_ARENA_COLORS = { wall: '#C8273A', inner: '#300A12', glow: '#FF5C6E' } as const;
