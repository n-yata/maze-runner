import type { PlayerState, Direction, Vec2 } from './types.js';
import { TILE_SIZE, PLAYER_START, PLAYER_SPEED, COLS, SCORE, BARRIER_BLINK_THRESHOLD } from './constants.js';
import type { MapManager } from './map.js';
import type { AudioManager } from './audio.js';

const ALIGN_THRESHOLD = 2; // pixels — how close to center before allowing turns

function dirToVec(dir: Direction): Vec2 {
  switch (dir) {
    case 'UP':    return { x:  0, y: -1 };
    case 'DOWN':  return { x:  0, y:  1 };
    case 'LEFT':  return { x: -1, y:  0 };
    case 'RIGHT': return { x:  1, y:  0 };
    default:      return { x:  0, y:  0 };
  }
}

function tileOf(px: number): number {
  return Math.floor(px / TILE_SIZE);
}

function centerPx(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

export class PlayerManager {
  state: PlayerState;
  score: number = 0;
  private speed = PLAYER_SPEED;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): PlayerState {
    return {
      pos: { ...PLAYER_START },
      pixelPos: {
        x: centerPx(PLAYER_START.x),
        y: centerPx(PLAYER_START.y),
      },
      dir: 'LEFT',
      nextDir: 'LEFT',
      animFrame: 0,
      isDead: false,
      barrierTimer: 0,
      barrierKillCount: 0,
    };
  }

  reset(speed?: number): void {
    if (speed !== undefined) {
      this.speed = speed;
    }
    this.state = this.createInitialState();
  }

  resetScore(): void {
    this.score = 0;
  }

  setNextDir(dir: Direction): void {
    if (dir !== 'NONE') {
      this.state.nextDir = dir;
    }
  }

  /**
   * 電磁バリアを付与する（パワーエサ取得時）。再取得でタイマーを上書き延長し、
   * 連続加点用の撃破カウントを新セッションとして 0 にリセットする。
   */
  activateBarrier(duration: number): void {
    this.state.barrierTimer = duration;
    this.state.barrierKillCount = 0;
  }

  /** 電磁バリアが展開中か。 */
  hasBarrier(): boolean {
    return this.state.barrierTimer > 0;
  }

  /**
   * バリア撃破を1件登録し、その撃破が現セッションで何体目か（0始まりのインデックス）を返す。
   * 呼び出し側はこのインデックスで連続加点テーブル(GHOST_EAT_SCORES)を引く。
   */
  registerBarrierKill(): number {
    return this.state.barrierKillCount++;
  }

  /** バリア残量が点滅しきい値を下回っているか（終了間際の点滅表示用）。 */
  isBarrierBlinking(): boolean {
    return this.state.barrierTimer > 0 && this.state.barrierTimer < BARRIER_BLINK_THRESHOLD;
  }

  update(dt: number, map: MapManager, audio: AudioManager): void {
    // バリア残量は isDead 判定より前に減衰させる（移動停止中も時間は進む）。
    // リスポーン時は reset() が barrierTimer=0 にするため整合は保たれる。
    if (this.state.barrierTimer > 0) {
      this.state.barrierTimer = Math.max(0, this.state.barrierTimer - dt);
    }

    if (this.state.isDead) return;

    const speed = this.speed * TILE_SIZE; // px/s
    const dist = speed * dt;

    this.state.animFrame = (this.state.animFrame + dt * 8) % 1;

    const col = tileOf(this.state.pixelPos.x);
    const row = tileOf(this.state.pixelPos.y);
    const cx = centerPx(col);
    const cy = centerPx(row);

    const nearCenterX = Math.abs(this.state.pixelPos.x - cx) < ALIGN_THRESHOLD;
    const nearCenterY = Math.abs(this.state.pixelPos.y - cy) < ALIGN_THRESHOLD;
    const atCenter = nearCenterX && nearCenterY;

    // Try to turn to nextDir when near tile center
    if (atCenter && this.state.nextDir !== this.state.dir) {
      const nv = dirToVec(this.state.nextDir);
      const nc = col + nv.x;
      const nr = row + nv.y;
      if (!map.isWall(nc, nr)) {
        this.state.dir = this.state.nextDir;
        // Snap to center
        this.state.pixelPos = { x: cx, y: cy };
      }
    }

    // Move in current direction
    const v = dirToVec(this.state.dir);
    if (v.x !== 0 || v.y !== 0) {
      const newX = this.state.pixelPos.x + v.x * dist;
      const newY = this.state.pixelPos.y + v.y * dist;

      const nextCol = tileOf(newX + v.x * (TILE_SIZE / 2 - 1));
      const nextRow = tileOf(newY + v.y * (TILE_SIZE / 2 - 1));

      // Allow passing through tunnel exits at the left/right boundary
      const exitingTunnel =
        (v.x < 0 && col === 0 && map.isTunnel(0, row)) ||
        (v.x > 0 && col === COLS - 1 && map.isTunnel(COLS - 1, row));

      if (!exitingTunnel && map.isWall(nextCol, nextRow)) {
        // Snap to center of current tile when hitting wall
        this.state.pixelPos = { x: cx, y: cy };
      } else {
        this.state.pixelPos = { x: newX, y: newY };
      }
    }

    // Tunnel warp
    this.state.pixelPos = this.applyTunnelWarp(this.state.pixelPos);
    this.state.pos = {
      x: tileOf(this.state.pixelPos.x),
      y: tileOf(this.state.pixelPos.y),
    };

    // Eat dot
    const eatCol = tileOf(this.state.pixelPos.x);
    const eatRow = tileOf(this.state.pixelPos.y);
    if (map.eatDot(eatCol, eatRow)) {
      const isPower = map.tileAt(eatCol, eatRow) === 3;
      if (isPower) {
        this.score += SCORE.POWER_DOT;
        audio.play('EAT_POWER');
      } else {
        this.score += SCORE.DOT;
        audio.play('EAT_DOT');
      }
    }
  }

  /**
   * ボス戦のシューティング操作。押されている間だけ左右に動き、入力がなければ停止する。
   * 縦位置は固定（下部の高さを維持）。外周壁の手前で止まる。dot 取得や方向予約は行わない。
   */
  moveHorizontal(dt: number, dir: Direction, map: MapManager): void {
    this.state.animFrame = (this.state.animFrame + dt * 8) % 1;

    if (dir !== 'LEFT' && dir !== 'RIGHT') {
      return; // 入力なし＝その場で停止（勝手に動かない）
    }
    this.state.dir = dir;

    const sign = dir === 'LEFT' ? -1 : 1;
    const dist = this.speed * TILE_SIZE * dt;
    const cy = this.state.pixelPos.y;
    let newX = this.state.pixelPos.x + sign * dist;

    // 進行方向の先端タイルが壁なら、現在タイル中心へスナップして止める（外周で停止）
    const leadCol = tileOf(newX + sign * (TILE_SIZE / 2 - 1));
    const row = tileOf(cy);
    if (map.isWall(leadCol, row)) {
      newX = centerPx(tileOf(this.state.pixelPos.x));
    }

    this.state.pixelPos = { x: newX, y: cy };
    this.state.pos = { x: tileOf(newX), y: row };
  }

  private applyTunnelWarp(ppos: Vec2): Vec2 {
    const totalWidth = COLS * TILE_SIZE;
    let x = ppos.x;
    if (x < 0) x += totalWidth;
    if (x >= totalWidth) x -= totalWidth;
    return { x, y: ppos.y };
  }

  die(): void {
    this.state.isDead = true;
  }

  getTilePos(): Vec2 {
    return this.state.pos;
  }

  getPixelPos(): Vec2 {
    return this.state.pixelPos;
  }
}
