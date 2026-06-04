import type { Direction, Vec2 } from './types.js';
import {
  TILE_SIZE,
  COLS,
  ROWS,
  LASER_DURATION,
  LASER_FIRE_INTERVAL,
  LASER_SPEED,
  LASER_HIT_RADIUS,
} from './constants.js';
import type { MapManager } from './map.js';
import type { GhostManager } from './ghost.js';

export interface Beam {
  active: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

const MAX_BEAMS = 32;

function dirToVec(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case 'UP':    return { dx:  0, dy: -1 };
    case 'DOWN':  return { dx:  0, dy:  1 };
    case 'LEFT':  return { dx: -1, dy:  0 };
    case 'RIGHT': return { dx:  1, dy:  0 };
    default:      return { dx:  0, dy:  0 };
  }
}

/**
 * レーザー機構。フルーツ取得で一定時間(LASER_DURATION)発動し、その間は
 * 進行方向へ一定間隔(LASER_FIRE_INTERVAL)で弾を自動連射する。弾は壁/場外で消滅し、
 * 敵にヒットすると撃破(VANISHED)する。弾は固定長プールで再利用し GC スパイクを避ける。
 */
export class LaserManager {
  private modeTimer = 0;
  private fireTimer = 0;
  private beams: Beam[] = [];

  constructor() {
    for (let i = 0; i < MAX_BEAMS; i++) {
      this.beams.push({ active: false, x: 0, y: 0, dx: 0, dy: 0 });
    }
  }

  /** レーザーモードが有効か（HUD/描画用）。 */
  get active(): boolean {
    return this.modeTimer > 0;
  }

  /** フルーツ取得時に呼ぶ。レーザーモードを発動（残時間をリフレッシュ）する。 */
  activate(): void {
    this.modeTimer = LASER_DURATION;
    this.fireTimer = 0; // 取得直後に1発撃てるようにする
  }

  /** ステージ開始・プレイヤー死亡時のリセット。 */
  reset(): void {
    this.modeTimer = 0;
    this.fireTimer = 0;
    for (const b of this.beams) b.active = false;
  }

  private spawnBeam(pos: Vec2, dir: Direction): void {
    const { dx, dy } = dirToVec(dir);
    if (dx === 0 && dy === 0) return;
    const b = this.beams.find(bm => !bm.active);
    if (!b) return;
    b.active = true;
    b.x = pos.x;
    b.y = pos.y;
    b.dx = dx;
    b.dy = dy;
  }

  /**
   * モード中は進行方向へ連射し、全ビームを前進させて壁/場外/敵ヒットを処理する。
   * 撃破で得たスコア合計を返す。
   */
  update(
    dt: number,
    playerPixelPos: Vec2,
    playerDir: Direction,
    map: MapManager,
    ghostMgr: GhostManager,
    onDefeat?: (pos: Vec2) => void,
  ): number {
    if (this.modeTimer > 0) {
      this.modeTimer -= dt;
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.spawnBeam(playerPixelPos, playerDir);
        this.fireTimer = LASER_FIRE_INTERVAL;
      }
    }

    let score = 0;
    const dist = LASER_SPEED * TILE_SIZE * dt;
    const maxX = COLS * TILE_SIZE;
    const maxY = ROWS * TILE_SIZE;

    for (const b of this.beams) {
      if (!b.active) continue;
      b.x += b.dx * dist;
      b.y += b.dy * dist;

      // 場外で消滅
      if (b.x < 0 || b.x >= maxX || b.y < 0 || b.y >= maxY) {
        b.active = false;
        continue;
      }
      // 壁で消滅
      const col = Math.floor(b.x / TILE_SIZE);
      const row = Math.floor(b.y / TILE_SIZE);
      if (map.isWall(col, row)) {
        b.active = false;
        continue;
      }
      // 敵ヒットで撃破
      const hit = ghostMgr.defeatAt(b.x, b.y, LASER_HIT_RADIUS, onDefeat);
      if (hit > 0) {
        score += hit;
        b.active = false;
      }
    }

    return score;
  }

  /** 描画用: 生存中のビーム一覧。 */
  getBeams(): Beam[] {
    return this.beams.filter(b => b.active);
  }
}
