import type { GameState, GhostState, Direction } from './types.js';
import {
  TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT,
  COLORS, GHOST_COLORS, getFruitDef,
} from './constants.js';
import type { MapManager } from './map.js';
import type { PlayerManager } from './player.js';
import type { GhostManager } from './ghost.js';
import type { FruitManager } from './fruit.js';
import { Starfield } from './background.js';
import type { ParticleSystem } from './particles.js';

const UI_HEIGHT = 4 * TILE_SIZE;
const MAP_OFFSET_Y = UI_HEIGHT;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bgCtx: CanvasRenderingContext2D | null = null;
  private starfield = new Starfield();

  constructor(canvas: HTMLCanvasElement, bgCanvas?: HTMLCanvasElement) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas 2D context');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    if (bgCanvas) {
      this.bgCtx = bgCanvas.getContext('2d');
    }
  }

  /** 全画面背景キャンバスのサイズ変更（盤面外の余白も星空で埋める）。 */
  resizeBackground(width: number, height: number): void {
    if (!this.bgCtx) return;
    this.bgCtx.canvas.width = Math.max(1, Math.round(width));
    this.bgCtx.canvas.height = Math.max(1, Math.round(height));
    this.starfield.resize(this.bgCtx.canvas.width, this.bgCtx.canvas.height);
  }

  render(
    state: GameState,
    map: MapManager,
    player: PlayerManager,
    ghostMgr: GhostManager,
    fruitMgr: FruitManager,
    particles?: ParticleSystem,
  ): void {
    const ctx = this.ctx;

    // 全画面背景（星空・星雲・視差）。別キャンバスに描画して余白を埋める。
    if (this.bgCtx) {
      this.starfield.draw(this.bgCtx, performance.now());
    }

    // 盤面キャンバスは透明クリア（背後の星空が通路の隙間から透ける）
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.drawUI(state);

    switch (state.phase) {
      case 'TITLE':
        map.drawTo(ctx, MAP_OFFSET_Y);
        this.drawTitle(state.phaseTimer);
        break;

      case 'READY':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawFruit(fruitMgr);
        this.drawGhosts(ghostMgr, false);
        this.drawPlayer(player);
        this.drawReady(state.phaseTimer);
        break;

      case 'PLAYING':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawFruit(fruitMgr);
        this.drawGhosts(ghostMgr, ghostMgr.getFrightenedEndWarning());
        this.drawPlayer(player);
        break;

      case 'PAUSED':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawFruit(fruitMgr);
        this.drawGhosts(ghostMgr, false);
        this.drawPlayer(player);
        this.drawPaused();
        break;

      case 'PLAYER_DEAD':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawDeadPlayer(player, state.phaseTimer);
        break;

      case 'STAGE_CLEAR':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawStageClear(state.phaseTimer);
        break;

      case 'ALL_CLEAR':
        map.drawTo(ctx, MAP_OFFSET_Y);
        this.drawAllClear();
        break;

      case 'GAME_OVER':
        map.drawTo(ctx, MAP_OFFSET_Y);
        this.drawGameOver(state.gameoverCanInput);
        break;
    }

    // パーティクル（取得・撃破のスパーク）を最前面に
    if (particles) {
      particles.draw(ctx, MAP_OFFSET_Y);
    }
  }

  private drawUI(state: GameState): void {
    const scoreFont = `${TILE_SIZE - 3}px monospace`;
    this.glowText(`SCORE ${state.score}`, TILE_SIZE - 2, TILE_SIZE, scoreFont, COLORS.DOT, 6, 'left');
    this.glowText(`HI ${state.highScore}`, CANVAS_WIDTH - TILE_SIZE + 2, TILE_SIZE, scoreFont, COLORS.POWER_DOT, 6, 'right');

    this.glowText(`LV.${state.level}`, CANVAS_WIDTH - TILE_SIZE + 2, TILE_SIZE * 3, `${TILE_SIZE - 4}px monospace`, '#9FD0FF', 5, 'right');

    // Lives display（残機 = 宇宙飛行士アイコン）
    const ctx = this.ctx;
    for (let i = 0; i < state.lives; i++) {
      const lx = TILE_SIZE + 8 + i * (TILE_SIZE + 4);
      const ly = TILE_SIZE * 3 - 2;
      ctx.save();
      ctx.translate(lx, ly);
      this.drawAstronautBody(TILE_SIZE / 2 - 1, 'DOWN', 0);
      ctx.restore();
    }
  }

  /** グロー付きテキスト描画ヘルパー。 */
  private glowText(
    text: string, x: number, y: number, font: string, color: string,
    glow: number, align: CanvasTextAlign = 'center', alpha = 1,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = glow * 0.5;
    ctx.fillText(text, x, y); // 二度描きで発光を強調
    ctx.restore();
  }

  /** 角丸矩形パスを現在のパスに追加する（roundRect 非対応環境向けの手動実装）。 */
  private roundRectPath(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
  }

  /**
   * 宇宙飛行士を中心(0,0)・直立で描く。進行方向で向き(バイザー反射・上半身の傾き)を表現し、
   * anim(0..1) で手足を歩行/浮遊アニメさせる。回転はしない（人型は直立のまま）。
   */
  private drawAstronautBody(r: number, dir: Direction, anim: number): void {
    const ctx = this.ctx;
    const swing = Math.sin(anim * Math.PI * 2) * r * 0.32;     // 手足の振り
    const bob = Math.sin(anim * Math.PI * 2) * r * 0.06;       // 上下の浮遊
    const faceX = dir === 'LEFT' ? -1 : dir === 'RIGHT' ? 1 : 0;
    const faceUp = dir === 'UP';
    const lean = faceX * r * 0.12;                              // 進行方向への傾き

    ctx.save();
    ctx.translate(0, bob);

    // バックパック（推進ユニット）
    ctx.fillStyle = '#5E76A8';
    ctx.beginPath();
    this.roundRectPath(-r * 0.5, -r * 0.15, r, r * 0.85, r * 0.2);
    ctx.fill();
    // バックパックの発光ノズル
    ctx.fillStyle = COLORS.SHIP_THRUSTER;
    ctx.globalAlpha = 0.7 + 0.3 * Math.abs(Math.sin(anim * Math.PI));
    ctx.beginPath();
    ctx.arc(0, r * 0.72, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 脚（2本・交互に振る）
    ctx.fillStyle = COLORS.PLAYER;
    for (const side of [-1, 1]) {
      const sx = side * r * 0.28 + lean;
      const off = side > 0 ? swing : -swing;
      ctx.beginPath();
      this.roundRectPath(sx - r * 0.16, r * 0.45, r * 0.32, r * 0.5 + Math.abs(off) * 0.4, r * 0.12);
      ctx.fill();
    }

    // 腕（2本・脚と逆位相）
    for (const side of [-1, 1]) {
      const ax = side * r * 0.55 + lean;
      const off = side > 0 ? -swing : swing;
      ctx.fillStyle = COLORS.PLAYER;
      ctx.beginPath();
      this.roundRectPath(ax - r * 0.14, -r * 0.05 + off, r * 0.28, r * 0.55, r * 0.12);
      ctx.fill();
    }

    // 胴体（スーツ・縦グラデで陰影）
    const torsoGrad = ctx.createLinearGradient(0, -r * 0.1, 0, r * 0.6);
    torsoGrad.addColorStop(0, '#CFE6FF');
    torsoGrad.addColorStop(1, COLORS.PLAYER);
    ctx.fillStyle = torsoGrad;
    ctx.beginPath();
    this.roundRectPath(-r * 0.42 + lean, -r * 0.1, r * 0.84, r * 0.7, r * 0.22);
    ctx.fill();
    // 胸部コントロールパネル
    ctx.fillStyle = '#2BE0A8';
    ctx.fillRect(-r * 0.12 + lean, r * 0.12, r * 0.24, r * 0.12);

    // ヘルメット（球体）
    const hx = lean;
    const hy = -r * 0.45;
    const hr = r * 0.5;
    ctx.fillStyle = '#E8F2FF';
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    // バイザー（暗いガラス・進行方向へオフセット）
    ctx.fillStyle = COLORS.SHIP_COCKPIT;
    ctx.beginPath();
    ctx.ellipse(hx + faceX * hr * 0.18, hy + (faceUp ? -hr * 0.15 : hr * 0.05),
      hr * 0.66, hr * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    // バイザー反射（ハイライト）
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(hx + faceX * hr * 0.1 - hr * 0.18, hy - hr * 0.12,
      hr * 0.2, hr * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawPlayer(player: PlayerManager): void {
    if (player.state.isDead) return;
    const ctx = this.ctx;
    const px = player.state.pixelPos.x;
    const py = player.state.pixelPos.y + MAP_OFFSET_Y;
    const radius = TILE_SIZE / 2 + 1;

    ctx.save();
    ctx.translate(px, py);
    this.drawAstronautBody(radius, player.state.dir, player.state.animFrame);
    ctx.restore();
  }

  private drawDeadPlayer(player: PlayerManager, timer: number): void {
    const ctx = this.ctx;
    const px = player.state.pixelPos.x;
    const py = player.state.pixelPos.y + MAP_OFFSET_Y;
    const radius = TILE_SIZE / 2 + 1;

    // 0-0.3s: フリーズ（被弾した飛行士を表示）
    if (timer < 0.3) {
      ctx.save();
      ctx.translate(px, py);
      this.drawAstronautBody(radius, player.state.dir, 0);
      ctx.restore();
      return;
    }

    // 0.3-0.9s: 制御を失った飛行士が宇宙空間で回転（2回転・縮小）
    if (timer < 0.9) {
      const spinProgress = (timer - 0.3) / 0.6;
      const angle = spinProgress * Math.PI * 4;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      const scale = 1 - spinProgress * 0.4;
      ctx.scale(scale, scale);
      this.drawAstronautBody(radius, player.state.dir, spinProgress * 4);
      ctx.restore();
      return;
    }

    // 0.9-1.5s: 爆散（破片が放射状に飛び縮小）
    const boomProgress = Math.min((timer - 0.9) / 0.6, 1.0);
    if (boomProgress >= 1.0) return;

    const shards = 6;
    const spread = radius * (0.4 + boomProgress * 1.6);
    const shardR = radius * 0.45 * (1 - boomProgress);
    if (shardR < 0.5) return;
    ctx.fillStyle = COLORS.SHIP_THRUSTER;
    for (let i = 0; i < shards; i++) {
      const a = (i / shards) * Math.PI * 2;
      const sx = px + Math.cos(a) * spread;
      const sy = py + Math.sin(a) * spread;
      ctx.beginPath();
      ctx.arc(sx, sy, shardR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGhosts(ghostMgr: GhostManager, frightenedEnding: boolean): void {
    for (const g of ghostMgr.ghosts) {
      this.drawGhost(g, frightenedEnding);
    }
  }

  private drawGhost(g: GhostState, frightenedEnding: boolean): void {
    const ctx = this.ctx;
    const px = g.pixelPos.x;
    const py = g.pixelPos.y + MAP_OFFSET_Y;
    const r = TILE_SIZE / 2 - 1;

    if (g.mode === 'VANISHED') return; // 消滅した敵は描画しない

    const frightened = g.mode === 'FRIGHTENED';
    let bodyColor: string;
    if (frightened) {
      const flash = frightenedEnding && (Math.floor(Date.now() / 250) % 2 === 0);
      bodyColor = flash ? COLORS.GHOST_FRIGHTENED_END : COLORS.GHOST_FRIGHTENED;
    } else {
      bodyColor = GHOST_COLORS[g.name];
    }

    // 触角（2本、先端に発光球）— stroke 設定を後続描画に漏らさないよう save/restore で閉じ込める
    ctx.save();
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.5;
    for (const sx of [-r * 0.4, r * 0.4]) {
      ctx.beginPath();
      ctx.moveTo(px + sx * 0.6, py - r * 0.5);
      ctx.lineTo(px + sx, py - r * 1.15);
      ctx.stroke();
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(px + sx, py - r * 1.25, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 頭（ドーム）＋波打つ下端（触手）
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(px, py, r, Math.PI, 0);
    const bottom = py + r;
    const segments = 4;
    const segW = (r * 2) / segments;
    for (let i = 0; i <= segments; i++) {
      const bx = px - r + i * segW;
      const by = i % 2 === 0 ? bottom : bottom - r * 0.45;
      ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();

    if (!frightened) {
      // 大きなエイリアンの目（1つ）＋瞳
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px, py - r * 0.05, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0A0A1A';
      ctx.beginPath();
      ctx.arc(px, py - r * 0.05, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // イジケ顔
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px - r * 0.3, py - r * 0.1, 2, 0, Math.PI * 2);
      ctx.arc(px + r * 0.3, py - r * 0.1, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFruit(fruitMgr: FruitManager): void {
    const ctx = this.ctx;
    for (const state of fruitMgr.getStates()) {
      // Flash in last 3 seconds (0.25s on/off cycle)
      if (state.timer < 3.0 && Math.floor(state.timer / 0.25) % 2 === 0) continue;

      const cx = state.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = state.row * TILE_SIZE + TILE_SIZE / 2 + MAP_OFFSET_Y;
      const r = TILE_SIZE / 2 - 1;

      const def = getFruitDef(state.level);

      // グロー
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 宇宙鉱石（クリスタル＝六角の菱形）
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.5, cy + r);
      ctx.lineTo(cx - r * 0.5, cy + r);
      ctx.lineTo(cx - r * 0.7, cy - r * 0.25);
      ctx.closePath();
      ctx.fill();

      // ハイライト（カット面）
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.25);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** 明滅するプロンプト用アルファ。 */
  private pulseAlpha(): number {
    return 0.55 + 0.45 * Math.sin(performance.now() / 320);
  }

  private drawPanel(cy: number, half: number): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, cy - half, 0, cy + half);
    g.addColorStop(0, 'rgba(8,10,26,0.0)');
    g.addColorStop(0.5, 'rgba(8,10,26,0.82)');
    g.addColorStop(1, 'rgba(8,10,26,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - half, CANVAS_WIDTH, half * 2);
  }

  private drawTitle(timer: number): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const t = performance.now() / 1000;

    this.drawPanel(cy, 130);

    // 宇宙飛行士の浮遊（ロゴ上空を左右へゆっくり往復しつつ歩行アニメ）
    const driftX = Math.sin(t * 0.6) * (CANVAS_WIDTH * 0.26);
    const facing: Direction = Math.cos(t * 0.6) >= 0 ? 'RIGHT' : 'LEFT';
    const floatY = cy - 96 + Math.sin(t * 1.3) * 6;
    ctx.save();
    ctx.translate(cx + driftX, floatY);
    this.drawAstronautBody(TILE_SIZE * 0.8, facing, t * 0.8);
    ctx.restore();

    // ロゴ登場（最初の約0.6秒でフェードイン＋ポップイン: drawReady と同系の ease-out）
    const k = Math.min(1, timer / 0.6);
    const scale = 0.5 + 0.5 * k * (2 - k);
    ctx.save();
    ctx.translate(cx, cy - 30);
    ctx.scale(scale, scale);
    this.glowText('STELLAR RUN', 0, 0, `bold ${TILE_SIZE * 2}px monospace`, '#7DF0FF', 16, 'center', k);
    this.glowText('ステラー・ラン', 0, 28, `${TILE_SIZE}px monospace`, '#9FD0FF', 8, 'center', k);
    ctx.restore();

    // 開始導線（既存どおり維持）
    this.glowText('Press SPACE / Tap', cx, cy + 36, `${TILE_SIZE}px monospace`, '#FFFFFF', 8, 'center', this.pulseAlpha());
    this.glowText('Arrows / WASD / Swipe', cx, cy + 60, `${TILE_SIZE - 3}px monospace`, '#8FB8E0', 4);
  }

  private drawReady(timer: number): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const k = Math.min(1, timer / 0.35);
    const scale = 0.5 + 0.5 * k * (2 - k); // ease-out のポップイン
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    this.glowText('READY!', 0, 0, `bold ${TILE_SIZE * 2}px monospace`, '#7DF0FF', 18);
    ctx.restore();
  }

  private drawPaused(): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    this.drawPanel(cy, 55);
    this.glowText('PAUSED', cx, cy + 4, `bold ${TILE_SIZE * 2}px monospace`, '#FFFFFF', 12);
    this.glowText('ESC to resume', cx, cy + 32, `${TILE_SIZE}px monospace`, '#9FD0FF', 6);
  }

  private drawAllClear(): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    this.drawPanel(cy, 100);
    this.glowText('ALL CLEAR!', cx, cy - 20, `bold ${TILE_SIZE * 2}px monospace`, '#7DF0FF', 18);
    this.glowText('おめでとう！', cx, cy + 14, `${TILE_SIZE}px monospace`, '#FFE66D', 8);
    this.glowText('Press SPACE / Tap', cx, cy + 42, `${TILE_SIZE}px monospace`, '#FFFFFF', 8, 'center', this.pulseAlpha());
  }

  private drawStageClear(timer: number): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const k = Math.min(1, timer / 0.4);
    const scale = 0.5 + 0.5 * k * (2 - k);
    this.drawPanel(cy, 55);
    ctx.save();
    ctx.translate(cx, cy + 6);
    ctx.scale(scale, scale);
    this.glowText('STAGE CLEAR!', 0, 0, `bold ${TILE_SIZE * 2}px monospace`, '#46F0D8', 18);
    ctx.restore();
  }

  private drawGameOver(canInput: boolean): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    this.drawPanel(cy, 70);
    this.glowText('GAME OVER', cx, cy + 2, `bold ${TILE_SIZE * 2}px monospace`, '#FF4D5E', 16);
    if (canInput) {
      this.glowText('Press SPACE / Tap', cx, cy + 36, `${TILE_SIZE}px monospace`, '#FFFFFF', 8, 'center', this.pulseAlpha());
    }
  }
}
