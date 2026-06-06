export type Vec2 = { readonly x: number; readonly y: number };

export type TileType =
  | 0  // EMPTY
  | 1  // WALL
  | 2  // DOT
  | 3  // POWER_DOT
  | 4; // TUNNEL

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export type GhostMode = 'SCATTER' | 'CHASE' | 'VANISHED';

export type GhostName = 'BLINKY' | 'PINKY' | 'INKY' | 'CLYDE';

export type GamePhase =
  | 'TITLE'
  | 'INTRO'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'PLAYER_DEAD'
  | 'STAGE_CLEAR'
  | 'BOSS_READY'    // ボス戦の導入(WARNING表示)
  | 'BOSS'          // ボス戦本編(弾幕・HP制バトル)
  | 'BOSS_DEFEATED' // ボス撃破演出(完了後にALL_CLEARへ)
  | 'ALL_CLEAR'
  | 'GAME_OVER';

export type SoundKey =
  | 'EAT_DOT' | 'EAT_POWER' | 'EAT_GHOST' | 'DEATH' | 'GAME_START' | 'EAT_FRUIT'
  // エンディング段階に同期する効果音
  | 'HATCH' | 'REPAIR_DONE' | 'LIFTOFF' | 'FANFARE';

export interface PlayerState {
  pos: Vec2;
  pixelPos: Vec2;
  dir: Direction;
  nextDir: Direction;
  animFrame: number;
  isDead: boolean;
  barrierTimer: number; // 電磁バリアの残り時間(秒)。0 = 非展開
  barrierKillCount: number; // 現在のバリアセッションでの撃破数(連続加点用)。展開ごとに0リセット
}

export interface GhostState {
  name: GhostName;
  pos: Vec2;
  pixelPos: Vec2;
  dir: Direction;
  mode: GhostMode;
  eatenScore: number;
  lastTurnTile: Vec2;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  highScore: number;
  lives: number;
  level: number;
  partsCollected: number; // 回収した宇宙船の部品数(0〜MAX_LEVEL)。永続化せず1プレイで完結
  dotsEaten: number;
  modeTimer: number;
  modeIndex: number;
  phaseTimer: number;
  gameoverCanInput: boolean;
}

export interface HighScore {
  score: number;
}
