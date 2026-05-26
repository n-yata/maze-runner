import type { Vec2, TileType } from './types.js';
import { COLS, ROWS, TILE_SIZE, COLORS, getStageColors } from './constants.js';

// 0=EMPTY, 1=WALL, 2=DOT, 3=POWER_DOT, 4=TUNNEL
// prettier-ignore
const MAP_DATA_1: number[] = [
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1,
  1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1,
  1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1,
  1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1,
  1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1,
  1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,1,1,0,0,1,1,1,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1,
  4,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,4,
  1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1,
  1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1,
  1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1,
  1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1,
  1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1,
  1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1,
  1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,
  1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
];

// Stage 2: 縦通路を追加し、左右ブロックを細分化したレイアウト
// prettier-ignore
const MAP_DATA_2: number[] = [
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  1,2,2,2,2,2,1,2,2,2,2,2,2,1,1,2,2,2,2,2,2,1,2,2,2,2,2,1,
  1,2,1,1,1,2,1,2,1,1,1,1,2,1,1,2,1,1,1,1,2,1,2,1,1,1,2,1,
  1,3,1,1,1,2,1,2,1,1,1,1,2,1,1,2,1,1,1,1,2,1,2,1,1,1,3,1,
  1,2,1,1,1,2,1,2,1,1,1,1,2,1,1,2,1,1,1,1,2,1,2,1,1,1,2,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,2,1,1,1,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,2,1,1,1,2,1,
  1,2,1,1,1,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,2,1,1,1,2,1,
  1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1,
  1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,1,1,0,0,1,1,1,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1,
  4,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,4,
  1,1,1,1,1,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,
  1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,2,1,1,1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,2,1,
  1,2,1,1,1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,2,1,
  1,3,2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2,2,2,3,1,
  1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,
  1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,
  1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1,
  1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,
  1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
];

// Stage 3: T字・十字路の多い迷路、より複雑なレイアウト
// prettier-ignore
const MAP_DATA_3: number[] = [
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1,
  1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1,
  1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,2,1,1,2,1,2,1,2,1,1,1,1,1,1,1,1,1,2,1,1,2,1,2,1,1,2,1,
  1,2,1,1,2,1,2,1,2,1,1,1,1,1,1,1,1,1,2,1,1,2,1,2,1,1,2,1,
  1,2,2,2,2,1,2,1,2,2,2,2,2,1,1,2,2,2,2,1,2,2,1,2,2,2,2,1,
  1,1,1,1,2,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,2,1,1,2,1,1,1,1,
  1,1,1,1,2,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,2,1,1,2,1,1,1,1,
  1,1,1,1,2,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,2,1,1,2,1,1,1,1,
  1,1,1,1,2,1,2,1,1,0,1,1,1,0,0,1,1,1,0,1,2,1,1,2,1,1,1,1,
  1,1,1,1,2,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,2,1,1,2,1,1,1,1,
  4,0,0,0,2,0,2,0,0,0,1,0,0,0,0,0,0,1,0,0,2,0,0,2,0,0,0,4,
  1,1,1,1,2,1,2,1,1,0,1,0,0,0,0,0,0,1,0,1,2,1,1,2,1,1,1,1,
  1,1,1,1,2,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,2,1,1,2,1,1,1,1,
  1,1,1,1,2,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,2,1,1,2,1,1,1,1,
  1,1,1,1,2,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,2,1,1,2,1,1,1,1,
  1,1,1,1,2,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,2,1,1,2,1,1,1,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,2,1,1,2,1,1,2,1,1,1,1,2,1,1,2,1,1,1,1,2,1,1,2,1,1,2,1,
  1,2,1,1,2,1,1,2,1,1,1,1,2,1,1,2,1,1,1,1,2,1,1,2,1,1,2,1,
  1,3,2,2,2,1,1,2,2,2,2,2,2,0,0,2,2,2,2,2,2,1,1,2,2,2,3,1,
  1,1,1,2,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1,1,
  1,1,1,2,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1,1,
  1,2,2,2,2,2,2,2,1,1,2,2,2,1,1,2,2,2,1,1,2,2,2,2,2,2,2,1,
  1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,
  1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,
  1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
];

function getMapData(level: number): number[] {
  if (level === 2) return MAP_DATA_2;
  if (level >= 3) return MAP_DATA_3;
  return MAP_DATA_1;
}

export class MapManager {
  private tiles: TileType[];
  private dotState: boolean[]; // true = dot/power still present
  private totalDots: number;
  private offscreen: OffscreenCanvas | null = null;
  private wallColor: string = getStageColors(1).wall;
  private wallInnerColor: string = getStageColors(1).inner;

  constructor() {
    this.tiles = MAP_DATA_1.map(v => v as TileType);
    this.dotState = this.tiles.map(t => t === 2 || t === 3);
    this.totalDots = this.dotState.filter(Boolean).length;
    this.buildOffscreenCanvas();
  }

  private buildOffscreenCanvas(): void {
    if (typeof OffscreenCanvas === 'undefined') return;
    this.offscreen = new OffscreenCanvas(COLS * TILE_SIZE, ROWS * TILE_SIZE);
    const ctx = this.offscreen.getContext('2d');
    if (!ctx) return;
    this.drawStaticMap(ctx);
  }

  private drawStaticMap(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tile = this.tileAt(col, row);
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;

        if (tile === 1) {
          ctx.fillStyle = this.wallColor;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = this.wallInnerColor;
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
      }
    }
  }

  drawTo(ctx: CanvasRenderingContext2D, offsetY: number): void {
    if (this.offscreen) {
      ctx.drawImage(this.offscreen, 0, offsetY);
    } else {
      this.drawStaticMap(ctx);
    }
  }

  drawDots(ctx: CanvasRenderingContext2D, offsetY: number): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!this.hasDot(col, row)) continue;
        const tile = this.tileAt(col, row);
        const cx = col * TILE_SIZE + TILE_SIZE / 2;
        const cy = row * TILE_SIZE + TILE_SIZE / 2 + offsetY;

        ctx.fillStyle = COLORS.DOT;
        if (tile === 3) {
          ctx.beginPath();
          ctx.arc(cx, cy, TILE_SIZE / 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  tileAt(col: number, row: number): TileType {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 1;
    return this.tiles[row * COLS + col] as TileType;
  }

  isWall(col: number, row: number): boolean {
    return this.tileAt(col, row) === 1;
  }

  isDot(col: number, row: number): boolean {
    return this.tileAt(col, row) === 2 && this.hasDot(col, row);
  }

  isPowerDot(col: number, row: number): boolean {
    return this.tileAt(col, row) === 3 && this.hasDot(col, row);
  }

  isTunnel(col: number, row: number): boolean {
    return this.tileAt(col, row) === 4;
  }

  hasDot(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    return this.dotState[row * COLS + col] === true;
  }

  eatDot(col: number, row: number): boolean {
    const idx = row * COLS + col;
    if (this.dotState[idx]) {
      this.dotState[idx] = false;
      return true;
    }
    return false;
  }

  getRemainingDots(): number {
    return this.dotState.filter(Boolean).length;
  }

  getTotalDots(): number {
    return this.totalDots;
  }

  getPowerDotCount(): number {
    let count = 0;
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] === 3 && this.dotState[i]) count++;
    }
    return count;
  }

  reset(level: number = 1): void {
    const data = getMapData(level);
    this.tiles = data.map(v => v as TileType);
    this.dotState = this.tiles.map(t => t === 2 || t === 3);
    this.totalDots = this.dotState.filter(Boolean).length;
    const colors = getStageColors(level);
    this.wallColor = colors.wall;
    this.wallInnerColor = colors.inner;
    this.buildOffscreenCanvas();
  }

  isPassable(col: number, row: number): boolean {
    const t = this.tileAt(col, row);
    return t !== 1;
  }

  wrapCol(col: number): number {
    if (col < 0) return COLS - 1;
    if (col >= COLS) return 0;
    return col;
  }

  centerOf(col: number, row: number): Vec2 {
    return {
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
    };
  }
}
