import type { GameState, GhostState, Direction } from './types.js';
import {
  TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT,
  COLORS, GHOST_COLORS, getFruitDef, TOTAL_PARTS,
  ENDING_REPAIR_DONE_TIME, ENDING_LIFTOFF_TIME, ENDING_DURATION,
} from './constants.js';
import type { MapManager } from './map.js';
import type { PlayerManager } from './player.js';
import type { GhostManager } from './ghost.js';
import type { FruitManager } from './fruit.js';
import { Starfield } from './background.js';
import type { ParticleSystem } from './particles.js';
import type { LaserManager } from './laser.js';

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
    laser?: LaserManager,
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
        // マップは表示せず、背景の星空＋ロゴ＋光のみで魅せる
        this.drawTitle(state.phaseTimer);
        break;

      case 'INTRO':
        // 遭難の導入。盤面は出さず星空＋物語テキストで魅せる
        this.drawIntro(state.phaseTimer);
        break;

      case 'READY':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawFruit(fruitMgr);
        this.drawGhosts(ghostMgr);
        this.drawPlayer(player);
        this.drawReady(state.phaseTimer);
        break;

      case 'PLAYING':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawFruit(fruitMgr);
        this.drawGhosts(ghostMgr);
        this.drawPlayer(player);
        if (laser) this.drawLaser(laser);
        break;

      case 'PAUSED':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawFruit(fruitMgr);
        this.drawGhosts(ghostMgr);
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
        this.drawStageClear(state.phaseTimer, state.partsCollected);
        break;

      case 'ALL_CLEAR':
        // エンディング: 修理→発進の演出（盤面は背景的に残す）
        map.drawTo(ctx, MAP_OFFSET_Y);
        this.drawEnding(state.phaseTimer, state.partsCollected);
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

    // 部品回収の進捗（宇宙船修理の達成度）。HUD中央に配置
    this.glowText(`部品 ${state.partsCollected}/${TOTAL_PARTS}`, CANVAS_WIDTH / 2, TILE_SIZE * 3, `${TILE_SIZE - 5}px monospace`, COLORS.POWER_DOT, 6, 'center');

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

    // 電磁バリア（パワーエサ取得中）。終了間際はリングを点滅させて残量を知らせる。
    if (player.hasBarrier()) {
      const hidden = player.isBarrierBlinking() && (Math.floor(Date.now() / 120) % 2 === 0);
      if (!hidden) {
        this.drawBarrierRing(px, py, TILE_SIZE * 0.85);
      }
    }

    ctx.save();
    ctx.translate(px, py);
    this.drawAstronautBody(radius, player.state.dir, player.state.animFrame);
    ctx.restore();
  }

  /** 電磁バリアのグローリングを描く。 */
  private drawBarrierRing(cx: number, cy: number, radius: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = COLORS.BARRIER;
    ctx.shadowColor = COLORS.BARRIER;
    ctx.shadowBlur = 12;
    // 外周リング（やや太め）
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    // 内側のソフトな発光リング
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
    ctx.stroke();
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

  private drawGhosts(ghostMgr: GhostManager): void {
    for (const g of ghostMgr.ghosts) {
      this.drawGhost(g);
    }
  }

  private drawGhost(g: GhostState): void {
    const ctx = this.ctx;
    const px = g.pixelPos.x;
    const py = g.pixelPos.y + MAP_OFFSET_Y;
    const r = TILE_SIZE / 2 - 1;

    if (g.mode === 'VANISHED') return; // 消滅した敵は描画しない

    const bodyColor = GHOST_COLORS[g.name];

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

    // 大きなエイリアンの目（1つ）＋瞳
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(px, py - r * 0.05, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0A0A1A';
    ctx.beginPath();
    ctx.arc(px, py - r * 0.05, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
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

  /** レーザービーム（発光する短い軌跡）を加算合成で描く。座標は盤面ローカル。 */
  private drawLaser(laser: LaserManager): void {
    const beams = laser.getBeams();
    if (beams.length === 0) return;
    const ctx = this.ctx;
    const len = TILE_SIZE * 0.8; // 軌跡の長さ
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of beams) {
      const x = b.x;
      const y = b.y + MAP_OFFSET_Y;
      const tailX = x - b.dx * len;
      const tailY = y - b.dy * len;
      // 外側のグロー（太く淡い赤）
      ctx.strokeStyle = 'rgba(255,77,94,0.5)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(x, y);
      ctx.stroke();
      // 芯（細く明るい白）
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
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

    // ロゴ背後の放射状グロー（ゆっくり脈動するソフトな光）
    const pulse = 0.85 + 0.15 * Math.sin(t * 1.2);
    const glowR = CANVAS_WIDTH * 0.62 * pulse;
    const glow = ctx.createRadialGradient(cx, cy - 24, 0, cx, cy - 24, glowR);
    glow.addColorStop(0, 'rgba(125,240,255,0.28)');
    glow.addColorStop(0.5, 'rgba(92,140,255,0.10)');
    glow.addColorStop(1, 'rgba(5,6,15,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    // ロゴ下を横切る細い光のライン（スタイリッシュなアクセント）
    const lineAlpha = 0.25 + 0.2 * Math.sin(t * 1.6);
    this.glowText('━━━━━━━━', cx, cy + 6, `${TILE_SIZE}px monospace`, '#7DF0FF', 10, 'center', lineAlpha);

    // ロゴ登場（最初の約0.6秒でフェードイン＋ポップイン: drawReady と同系の ease-out）
    const k = Math.min(1, timer / 0.6);
    const scale = 0.5 + 0.5 * k * (2 - k);
    ctx.save();
    ctx.translate(cx, cy - 24);
    ctx.scale(scale, scale);
    this.glowText('STELLAR RUN', 0, 0, `bold ${TILE_SIZE * 2}px monospace`, '#7DF0FF', 18, 'center', k);
    this.glowText('ステラー・ラン', 0, 30, `${TILE_SIZE}px monospace`, '#9FD0FF', 8, 'center', k);
    ctx.restore();

    // 開始導線
    this.glowText('Press SPACE / Tap', cx, cy + 52, `${TILE_SIZE}px monospace`, '#FFFFFF', 8, 'center', this.pulseAlpha());
    this.glowText('Arrows / WASD / Swipe', cx, cy + 76, `${TILE_SIZE - 3}px monospace`, '#8FB8E0', 4);
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

  /** オープニング: 宇宙船の故障で遭難した導入を物語テキストで見せる。 */
  private drawIntro(timer: number): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const fade = Math.min(1, timer / 0.6); // 全体のフェードイン

    this.drawPanel(cy, 130);

    // 警告ヘッダ（点滅で緊急感）
    const warnAlpha = (0.5 + 0.5 * Math.sin(performance.now() / 220)) * fade;
    this.glowText('⚠ 警告: 機体 大破', cx, cy - 92, `bold ${TILE_SIZE - 4}px monospace`, '#FF4D5E', 10, 'center', warnAlpha);

    // 物語本文（1行ずつ少し遅れて現れる）
    const lines = [
      'エンジンが故障し',
      'きみは深宇宙に取り残された',
      '',
      'エイリアンを退け',
      '散らばった部品を集めろ',
      '',
      `${TOTAL_PARTS}つの部品で機体を直し`,
      '故郷へ還るんだ',
    ];
    const lineH = TILE_SIZE - 2;
    const startY = cy - 56;
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      if (!text) continue;
      const reveal = Math.min(1, Math.max(0, (timer - 0.4 - i * 0.25) / 0.4));
      this.glowText(text, cx, startY + i * lineH, `${TILE_SIZE - 6}px monospace`, '#CFE6FF', 5, 'center', reveal);
    }

    // 開始導線
    this.glowText('Press SPACE / Tap', cx, cy + 96, `${TILE_SIZE - 3}px monospace`, '#FFFFFF', 8, 'center', this.pulseAlpha() * fade);
  }

  /** エンディング: 全部品回収 → 修理 → 発進の演出。timer(秒)で段階的に進む。 */
  private drawEnding(timer: number, parts: number): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    this.drawPanel(cy, 120);

    // 段階A(0〜ENDING_REPAIR_DONE_TIME): 回収完了 → 修理開始
    if (timer < ENDING_REPAIR_DONE_TIME) {
      const k = Math.min(1, timer / 0.4);
      this.glowText('全部品 回収完了', cx, cy - 40, `bold ${TILE_SIZE + 4}px monospace`, '#7DF0FF', 14, 'center', k);
      this.glowText(`◇ ${parts}/${TOTAL_PARTS} ◇`, cx, cy - 6, `${TILE_SIZE}px monospace`, COLORS.POWER_DOT, 8, 'center', k);
      this.glowText('宇宙船を 修理中...', cx, cy + 34, `${TILE_SIZE - 4}px monospace`, '#9FD0FF', 6, 'center', this.pulseAlpha());
      return;
    }

    // 段階B(ENDING_REPAIR_DONE_TIME〜ENDING_LIFTOFF_TIME): システム復旧（グロー脈動）
    if (timer < ENDING_LIFTOFF_TIME) {
      const pulse = 0.6 + 0.4 * Math.sin((timer - ENDING_REPAIR_DONE_TIME) * 6);
      this.glowText('修理 完了', cx, cy - 34, `bold ${TILE_SIZE + 4}px monospace`, '#46F0D8', 16, 'center', 1);
      this.glowText('システム オールグリーン', cx, cy + 6, `${TILE_SIZE - 5}px monospace`, '#2BE0A8', 8, 'center', pulse);
      this.drawRocket(cx, cy + 56, 0); // 発進前の機体
      return;
    }

    // 段階C(ENDING_LIFTOFF_TIME〜ENDING_DURATION): 発進
    const lift = (timer - ENDING_LIFTOFF_TIME) / (ENDING_DURATION - ENDING_LIFTOFF_TIME); // 0→1
    const rocketY = cy + 56 - lift * (cy + 120); // 画面上方へ上昇
    this.drawRocket(cx, rocketY, lift);
    this.glowText('発進！', cx, cy - 30, `bold ${TILE_SIZE * 2}px monospace`, '#7DF0FF', 18, 'center', Math.min(1, lift * 2));
    this.glowText('RESCUE COMPLETE', cx, cy + 4, `${TILE_SIZE - 4}px monospace`, '#FFE66D', 8, 'center', Math.min(1, lift * 2));
    this.glowText('Press SPACE / Tap', cx, cy + 40, `${TILE_SIZE - 3}px monospace`, '#FFFFFF', 8, 'center', this.pulseAlpha());
  }

  /** 簡易ロケット。lift(0..1) でスラスター炎を伸ばし上昇感を出す。 */
  private drawRocket(cx: number, cy: number, lift: number): void {
    const ctx = this.ctx;
    const r = TILE_SIZE * 0.6;
    ctx.save();
    ctx.translate(cx, cy);

    // スラスター炎（上昇中ほど長く明るく）
    const flame = r * (0.6 + lift * 1.8);
    const flameGrad = ctx.createLinearGradient(0, r * 0.7, 0, r * 0.7 + flame);
    flameGrad.addColorStop(0, COLORS.SHIP_THRUSTER);
    flameGrad.addColorStop(1, 'rgba(255,138,60,0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, r * 0.7);
    ctx.lineTo(r * 0.4, r * 0.7);
    ctx.lineTo(0, r * 0.7 + flame);
    ctx.closePath();
    ctx.fill();

    // 機体（ハル）
    ctx.fillStyle = COLORS.PLAYER;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.2, r * 0.5, r * 0.7);
    ctx.lineTo(-r * 0.5, r * 0.7);
    ctx.quadraticCurveTo(-r * 0.7, -r * 0.2, 0, -r);
    ctx.closePath();
    ctx.fill();

    // フィン
    ctx.fillStyle = COLORS.SHIP_THRUSTER;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.5, r * 0.3);
      ctx.lineTo(side * r * 0.85, r * 0.75);
      ctx.lineTo(side * r * 0.5, r * 0.75);
      ctx.closePath();
      ctx.fill();
    }

    // コックピット
    ctx.fillStyle = COLORS.SHIP_COCKPIT;
    ctx.beginPath();
    ctx.arc(0, -r * 0.15, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawStageClear(timer: number, partsCollected: number): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const k = Math.min(1, timer / 0.4);
    const scale = 0.5 + 0.5 * k * (2 - k);
    this.drawPanel(cy, 70);
    ctx.save();
    ctx.translate(cx, cy - 6);
    ctx.scale(scale, scale);
    this.glowText('STAGE CLEAR!', 0, 0, `bold ${TILE_SIZE * 2}px monospace`, '#46F0D8', 18);
    ctx.restore();
    // 部品回収を明示（HUDの常時表示に加えクリア時の達成感を演出）
    this.glowText(`部品 ${partsCollected}/${TOTAL_PARTS} 回収`, cx, cy + 36, `${TILE_SIZE - 4}px monospace`, COLORS.POWER_DOT, 8, 'center', k);
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
