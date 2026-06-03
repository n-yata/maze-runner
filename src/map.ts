import type { Vec2, TileType } from './types.js';
import { COLS, ROWS, TILE_SIZE, COLORS, getStageColors } from './constants.js';

// 0=EMPTY, 1=WALL, 2=DOT, 3=POWER_DOT, 4=TUNNEL
//
// 縦長(21×37)マップはコード生成する。構造的に連結性を保証する設計:
//  - 外周1マス内側のコリドーリング(row1 / row ROWS-2 / col1 / col COLS-2)を常に通路にする
//  - 中央縦コリドー(col=doorCol=10)を常に通路にする（上下を貫く幹線）
//  - 壁は「孤立したブロック」としてのみ内部に置く（リング・中央線・ゴーストハウス・トンネル行を避ける）
//  - 左右対称: COLS=21(奇数)・中心列10。壁条件は列パリティ(c%2)依存で、mirror(20-c)もパリティ不変
// この構造は tests/unit/map.test.ts の flood-fill 連結性テストで検証する。

const TUNNEL_ROW = 18;
const HOUSE: { top: number; bottom: number; left: number; right: number; doorCol: number } =
  { top: 16, bottom: 20, left: 8, right: 12, doorCol: 10 };

function inHouseBox(r: number, c: number): boolean {
  // ハウス本体＋外周1マス（壁ブロックを置かない安全マージン）
  return (
    r >= HOUSE.top - 1 && r <= HOUSE.bottom + 1 &&
    c >= HOUSE.left - 1 && c <= HOUSE.right + 1
  );
}

/** 内部の壁ブロック判定（孤立ブロックのみ）。ステージごとに密度・形状を変える。 */
function isPillar(level: number, r: number, c: number): boolean {
  // コリドーリングより内側のみ
  if (r < 2 || r > ROWS - 3 || c < 2 || c > COLS - 3) return false;
  if (r === TUNNEL_ROW) return false;       // トンネル行は開けておく
  if (c === HOUSE.doorCol) return false;     // 中央縦コリドー（幹線）は常に開ける
  if (inHouseBox(r, c)) return false;        // ゴーストハウス周辺は開ける

  const grid = r % 2 === 0 && c % 2 === 0;   // 偶数×偶数の格子点
  if (!grid) return false;

  if (level === 1) {
    // Stage1: 開放的（格子点を1行おきに間引く）
    return r % 4 === 2;
  }
  if (level === 2) {
    // Stage2: 標準的な格子
    return true;
  }
  // Stage3: 格子＋縦バー延長（迷路感）。延長部も格子点に隣接する孤立形状を保つ
  if (r % 2 === 0 && c % 2 === 0) return true;
  return false;
}

function buildTiles(level: number): TileType[] {
  const t: number[] = new Array(COLS * ROWS).fill(2); // まず全面ドット
  const idx = (c: number, r: number) => r * COLS + c;

  // 外周ボーダー
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        t[idx(c, r)] = 1;
      }
    }
  }

  // 内部の壁ブロック
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (isPillar(level, r, c)) t[idx(c, r)] = 1;
    }
  }

  // Stage3 は縦バーを足して迷路感を強める（孤立を保つよう格子点の1つ下のみ）
  if (level >= 3) {
    for (let r = 2; r < ROWS - 3; r++) {
      for (let c = 2; c < COLS - 2; c++) {
        if (r % 4 === 0 && c % 2 === 0 && c !== HOUSE.doorCol &&
            r !== TUNNEL_ROW && !inHouseBox(r, c) && !inHouseBox(r + 1, c)) {
          t[idx(c, r + 1)] = 1; // 既存格子点(r,c)の真下を壁にして 1×2 縦バー化
        }
      }
    }
  }

  // ゴーストハウス
  for (let c = HOUSE.left; c <= HOUSE.right; c++) {
    t[idx(c, HOUSE.top)] = c === HOUSE.doorCol ? 0 : 1; // 上壁＋ドアの隙間
    t[idx(c, HOUSE.bottom)] = 1;                         // 下壁
  }
  for (let r = HOUSE.top + 1; r < HOUSE.bottom; r++) {
    t[idx(HOUSE.left, r)] = 1;   // 左壁
    t[idx(HOUSE.right, r)] = 1;  // 右壁
    for (let c = HOUSE.left + 1; c < HOUSE.right; c++) {
      t[idx(c, r)] = 0;          // 内部は空
    }
  }
  // ドア前のアプローチ（BLINKY 初期位置・出口）
  t[idx(HOUSE.doorCol, HOUSE.top - 1)] = 0; // (10,15)

  // トンネル
  t[idx(0, TUNNEL_ROW)] = 4;
  t[idx(COLS - 1, TUNNEL_ROW)] = 4;

  // パワーエサ（4隅付近、リング上）。左側のみ指定し右はパリティ対称で自動的に対応
  const power: Vec2[] = [
    { x: 1, y: 3 }, { x: COLS - 2, y: 3 },
    { x: 1, y: ROWS - 4 }, { x: COLS - 2, y: ROWS - 4 },
  ];
  for (const p of power) {
    if (t[idx(p.x, p.y)] === 2) t[idx(p.x, p.y)] = 3;
  }

  return t.map(v => v as TileType);
}

export class MapManager {
  private tiles: TileType[];
  private dotState: boolean[]; // true = dot/power still present
  private totalDots: number;
  private offscreen: OffscreenCanvas | null = null;
  private wallColor: string = getStageColors(1).wall;
  private wallInnerColor: string = getStageColors(1).inner;
  private wallGlowColor: string = getStageColors(1).glow;

  constructor() {
    this.tiles = buildTiles(1);
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
    ctx.clearRect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.tileAt(col, row) !== 1) continue;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        this.drawWallTile(ctx, x, y);
      }
    }
  }

  /** ネオン通路風の壁タイル（グラデ＋グロー＋角丸）。Offscreen にキャッシュされる。 */
  private drawWallTile(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    const pad = 1.5;
    const r = 4; // 角丸半径
    const w = TILE_SIZE - pad * 2;
    const h = TILE_SIZE - pad * 2;

    ctx.save();
    // グロー
    ctx.shadowColor = this.wallGlowColor;
    ctx.shadowBlur = 6;

    // 角丸矩形パス
    const rx = x + pad;
    const ry = y + pad;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + w - r, ry);
    ctx.arcTo(rx + w, ry, rx + w, ry + r, r);
    ctx.lineTo(rx + w, ry + h - r);
    ctx.arcTo(rx + w, ry + h, rx + w - r, ry + h, r);
    ctx.lineTo(rx + r, ry + h);
    ctx.arcTo(rx, ry + h, rx, ry + h - r, r);
    ctx.lineTo(rx, ry + r);
    ctx.arcTo(rx, ry, rx + r, ry, r);
    ctx.closePath();

    // 縦グラデ（明→暗）
    const grad = ctx.createLinearGradient(rx, ry, rx, ry + h);
    grad.addColorStop(0, this.wallColor);
    grad.addColorStop(1, this.wallInnerColor);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  drawTo(ctx: CanvasRenderingContext2D, offsetY: number): void {
    if (this.offscreen) {
      ctx.drawImage(this.offscreen, 0, offsetY);
    } else {
      ctx.save();
      ctx.translate(0, offsetY);
      this.drawStaticMap(ctx);
      ctx.restore();
    }
  }

  drawDots(ctx: CanvasRenderingContext2D, offsetY: number): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!this.hasDot(col, row)) continue;
        const tile = this.tileAt(col, row);
        const cx = col * TILE_SIZE + TILE_SIZE / 2;
        const cy = row * TILE_SIZE + TILE_SIZE / 2 + offsetY;

        if (tile === 3) {
          // パワーエサ = 発光するコア
          const r = TILE_SIZE / 3;
          ctx.save();
          ctx.shadowColor = COLORS.POWER_DOT;
          ctx.shadowBlur = 10;
          ctx.fillStyle = COLORS.POWER_DOT_GLOW; // グロー
          ctx.beginPath();
          ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.POWER_DOT;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 通常ドット = エネルギー結晶（菱形）＋淡い発光
          const s = 3;
          ctx.save();
          ctx.shadowColor = COLORS.DOT;
          ctx.shadowBlur = 4;
          ctx.fillStyle = COLORS.DOT;
          ctx.beginPath();
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx + s, cy);
          ctx.lineTo(cx, cy + s);
          ctx.lineTo(cx - s, cy);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
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
    const i = row * COLS + col;
    if (this.dotState[i]) {
      this.dotState[i] = false;
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
    this.tiles = buildTiles(level);
    this.dotState = this.tiles.map(t => t === 2 || t === 3);
    this.totalDots = this.dotState.filter(Boolean).length;
    const colors = getStageColors(level);
    this.wallColor = colors.wall;
    this.wallInnerColor = colors.inner;
    this.wallGlowColor = colors.glow;
    this.buildOffscreenCanvas();
  }

  isPassable(col: number, row: number): boolean {
    return this.tileAt(col, row) !== 1;
  }

  // フルーツは通路(type=2)上にスポーンする（dotState に依存しない）
  getValidFruitPositions(): Vec2[] {
    const positions: Vec2[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.tileAt(col, row) === 2) {
          positions.push({ x: col, y: row });
        }
      }
    }
    return positions;
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
