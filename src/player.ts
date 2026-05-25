import type { PlayerState, Direction, Vec2 } from './types.js';
import { TILE_SIZE, PLAYER_START, PLAYER_SPEED, COLS, SCORE } from './constants.js';
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

  update(dt: number, map: MapManager, audio: AudioManager): void {
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
