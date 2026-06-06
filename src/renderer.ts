import type { GameState, GhostState, Direction } from './types.js';
import {
  TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT, MAP_OFFSET_Y,
  COLORS, GHOST_COLORS, getFruitDef, TOTAL_PARTS,
  ENDING_WALK_START, ENDING_RAMP_TIME, ENDING_BOARD_TIME, ENDING_LIFTOFF_TIME,
  ENDING_WARP_TIME, ENDING_EARTH_TIME, ENDING_DURATION,
  ENDING_ROCKET_CX, ENDING_ROCKET_CY, ENDING_SHAKE_MAG, ENDING_WARP_FACTOR,
} from './constants.js';
import type { MapManager } from './map.js';
import type { PlayerManager } from './player.js';
import type { GhostManager } from './ghost.js';
import type { FruitManager } from './fruit.js';
import { Starfield } from './background.js';
import type { ParticleSystem } from './particles.js';
import type { LaserManager } from './laser.js';

export class Renderer {
  // エンディングの大型シャトル胴体の半幅(px)。drawShuttle と shuttleRamp で共有。
  private static readonly SHUTTLE_BODY_HALF = 34;

  // 青い地球(drawEarth)の陸地パッチ配置 [dx, dy, 半径比]。毎フレーム生成を避けて定数化。
  private static readonly EARTH_PATCHES: ReadonlyArray<readonly [number, number, number]> = [
    [-0.3, -0.1, 0.28], [0.25, 0.15, 0.22], [0.05, -0.4, 0.16], [-0.15, 0.4, 0.2],
  ];
  // 地球の雲 [基準dx, dy, 半径比]。approach でドリフトさせる。
  private static readonly EARTH_CLOUDS: ReadonlyArray<readonly [number, number, number]> = [
    [-0.5, -0.25, 0.3], [0.1, 0.05, 0.26], [0.45, -0.35, 0.2], [-0.2, 0.45, 0.24],
  ];
  // 地球の夜側の都市光 [dx, dy]（右下=夜側に集める）。
  private static readonly EARTH_CITY_LIGHTS: ReadonlyArray<readonly [number, number]> = [
    [0.4, 0.45], [0.55, 0.25], [0.3, 0.6], [0.6, 0.5], [0.45, 0.65], [0.25, 0.4],
  ];

  private ctx: CanvasRenderingContext2D;
  private bgCtx: CanvasRenderingContext2D | null = null;
  private starfield = new Starfield();
  private lastBgTime: number | null = null; // 背景スクロールのフレーム差分算出用（初回は null）

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
      const now = performance.now();
      const dtMs = this.lastBgTime !== null ? Math.min(now - this.lastBgTime, 100) : 16.7;
      this.lastBgTime = now;
      // エンディングのワープ段階だけ星を加速させ「ワープ感」を出す
      const warping = state.phase === 'ALL_CLEAR'
        && state.phaseTimer >= ENDING_WARP_TIME && state.phaseTimer < ENDING_EARTH_TIME;
      this.starfield.setWarp(warping ? ENDING_WARP_FACTOR : 1);
      this.starfield.draw(this.bgCtx, dtMs);
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
        // エンディング: 帰還シーン（盤面マップは出さず、背景の星空のみを舞台にする）
        this.drawEnding(state.phaseTimer);
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

    // サブタイトル下を横切る細い光のライン（スタイリッシュなアクセント）
    // サブタイトル「ステラー・ラン」(baseline cy+6) と重ならないよう、その下に配置する。
    const lineAlpha = 0.25 + 0.2 * Math.sin(t * 1.6);
    this.glowText('━━━━━━━━', cx, cy + 30, `${TILE_SIZE}px monospace`, '#7DF0FF', 10, 'center', lineAlpha);

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

    // 開始導線（最終行「故郷へ還るんだ」が baseline cy+98 にあるため、その下へ離して配置）
    this.glowText('Press SPACE / Tap', cx, cy + 120, `${TILE_SIZE - 3}px monospace`, '#FFFFFF', 8, 'center', this.pulseAlpha() * fade);
  }

  /**
   * エンディング(帰還シーン): 着陸 → タラップで乗船 → 点火 → 発進・上昇 → ワープ → 青い地球へ帰還の7段階。
   * timer(秒)だけを入力に決定論的に組み立てる。盤面マップは描かず、背景の星空のみを舞台にする。
   * 主役の大型シャトルは drawShuttle で専用に描き起こす（旧 drawRocket の簡易図形は廃止）。
   * 段階境界は constants の ENDING_* と共有（gameLoop の音/パーティクル発火と一致）。
   */
  private drawEnding(timer: number): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;

    // シーンのレイアウト基準（constants と一致）。
    const groundY = ENDING_ROCKET_CY;          // エンジン噴射口＝地表ライン
    const shipX = ENDING_ROCKET_CX;            // 機体の中心X
    const astroR = TILE_SIZE * 0.72;           // 飛行士の描画半径（視認性のためやや大きめ）
    const walkStartX = CANVAS_WIDTH * 0.12;    // 歩き出しX（左端）
    // タラップ（ハッチの扉が倒れて出来る）の地上端とハッチ枢軸（drawShuttle と同じ式で算出）。
    const ramp = this.shuttleRamp(shipX, groundY);
    const groundStandY = groundY - astroR * 0.92; // 平地で足が地表に着く中心Y

    // 点火(D)・発進(E)段階は画面を揺らす。timer 駆動で決定論的に増減する。
    ctx.save();
    let shake = 0;
    if (timer >= ENDING_BOARD_TIME && timer < ENDING_LIFTOFF_TIME) {
      shake = ENDING_SHAKE_MAG * ((timer - ENDING_BOARD_TIME) / (ENDING_LIFTOFF_TIME - ENDING_BOARD_TIME)); // 0→最大
    } else if (timer >= ENDING_LIFTOFF_TIME && timer < ENDING_WARP_TIME) {
      shake = ENDING_SHAKE_MAG * (1 - (timer - ENDING_LIFTOFF_TIME) / (ENDING_WARP_TIME - ENDING_LIFTOFF_TIME)); // 最大→0
    }
    if (shake > 0) ctx.translate(Math.sin(timer * 53) * shake, Math.cos(timer * 61) * shake);

    // 段階A(0〜ENDING_WALK_START): 着陸 — 地表＋着陸したシャトル＋飛行士をフェードイン
    if (timer < ENDING_WALK_START) {
      const fade = Math.min(1, timer / 0.6);
      ctx.globalAlpha = fade;
      this.drawSurface(1);
      this.drawShuttle(shipX, groundY, { t: timer, thrust: 0, open: 0, grounded: true });
      this.drawAstronautAt(walkStartX, groundStandY, astroR, 'RIGHT', timer * 0.5, 1);
      ctx.restore();
      return;
    }

    // 段階B(ENDING_WALK_START〜ENDING_RAMP_TIME): 飛行士がタラップ下まで地上を歩く
    if (timer < ENDING_RAMP_TIME) {
      const p = (timer - ENDING_WALK_START) / (ENDING_RAMP_TIME - ENDING_WALK_START); // 0→1
      const ease = p * p * (3 - 2 * p);
      const x = walkStartX + (ramp.groundX - walkStartX) * ease;
      this.drawSurface(1);
      this.drawShuttle(shipX, groundY, { t: timer, thrust: 0, open: 0, grounded: true });
      this.drawAstronautAt(x, groundStandY, astroR, 'RIGHT', timer * 3.2, 1);
      ctx.restore();
      return;
    }

    // 段階C(ENDING_RAMP_TIME〜ENDING_BOARD_TIME): ハッチが開きタラップを上り乗船 → ハッチ閉
    if (timer < ENDING_BOARD_TIME) {
      const cP = (timer - ENDING_RAMP_TIME) / (ENDING_BOARD_TIME - ENDING_RAMP_TIME); // 0→1
      const open = cP < 0.8 ? Math.min(1, cP / 0.2) : Math.max(0, 1 - (cP - 0.8) / 0.2); // 開く→上る→閉じる
      const ascend = Math.max(0, Math.min(1, (cP - 0.2) / 0.55)); // タラップ上昇 0→1
      const fade = ascend > 0.85 ? Math.max(0, 1 - (ascend - 0.85) / 0.15) : 1; // ハッチへ吸い込まれる
      const ax = ramp.groundX + (ramp.hingeX - ramp.groundX) * ascend;
      const ay = ramp.groundY + (ramp.hingeY - ramp.groundY) * ascend - astroR * 0.5;
      this.drawSurface(1);
      this.drawShuttle(shipX, groundY, { t: timer, thrust: 0, open, grounded: true });
      if (fade > 0) this.drawAstronautAt(ax, ay, astroR, 'RIGHT', timer * 3.2, fade);
      ctx.restore();
      return;
    }

    // 段階D(ENDING_BOARD_TIME〜ENDING_LIFTOFF_TIME): 点火 — 炎が立ち上がり地面が照り返す
    if (timer < ENDING_LIFTOFF_TIME) {
      const ignite = (timer - ENDING_BOARD_TIME) / (ENDING_LIFTOFF_TIME - ENDING_BOARD_TIME); // 0→1
      this.drawSurface(1);
      this.drawGroundGlow(shipX, groundY, ignite);
      this.drawShuttle(shipX, groundY, { t: timer, thrust: ignite * 0.7, open: 0, grounded: true });
      ctx.restore();
      return;
    }

    // 段階E(ENDING_LIFTOFF_TIME〜ENDING_WARP_TIME): 発進 — 加速しながら上昇し画面外へ。地表は退く
    if (timer < ENDING_WARP_TIME) {
      const p = (timer - ENDING_LIFTOFF_TIME) / (ENDING_WARP_TIME - ENDING_LIFTOFF_TIME); // 0→1
      const lift = p * p; // 加速度的な上昇
      this.drawSurface(1 - p);
      this.drawGroundGlow(shipX, groundY, (1 - p) * 0.8);
      const baseY = groundY - lift * (groundY + 260); // 上方へ上昇し画面外へ
      this.drawShuttle(shipX, baseY, { t: timer, thrust: 1, open: 0, grounded: false });
      ctx.restore();
      return;
    }

    ctx.restore(); // 以降の段階はシェイクなし

    // 段階F(ENDING_WARP_TIME〜ENDING_EARTH_TIME): ワープ — ストリーク加速→終盤で減速
    if (timer < ENDING_EARTH_TIME) {
      const p = (timer - ENDING_WARP_TIME) / (ENDING_EARTH_TIME - ENDING_WARP_TIME); // 0→1
      const intensity = p < 0.7 ? p / 0.7 : Math.max(0, 1 - (p - 0.7) / 0.3); // 立ち上がり→減速
      this.drawWarpLines(intensity);
      return; // ctx.restore() は上で実行済み（冒頭 save の解放は1回のみ）
    }

    // 段階G(ENDING_EARTH_TIME〜ENDING_DURATION): 帰還 — 青い地球が出現して接近。導線のみ表示
    const local = (timer - ENDING_EARTH_TIME) / (ENDING_DURATION - ENDING_EARTH_TIME); // 0→1
    const earthCy = CANVAS_HEIGHT * 0.40;
    const earthR = TILE_SIZE * (1.6 + local * 5.4); // 接近で拡大
    const earthAlpha = Math.min(1, local / 0.3);    // 出現フェードイン
    this.drawEarth(cx, earthCy, earthR, earthAlpha, local);
    this.glowText('Press SPACE / Tap', cx, CANVAS_HEIGHT * 0.88,
      `${TILE_SIZE - 3}px monospace`, '#FFFFFF', 8, 'center', this.pulseAlpha() * earthAlpha);
  }

  /** 指定座標に飛行士を描く（歩行/乗船演出用）。anim は歩行アニメ位相、alpha は表示濃度。 */
  private drawAstronautAt(x: number, y: number, r: number, dir: Direction, anim: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    this.drawAstronautBody(r, dir, anim);
    ctx.restore();
  }

  /** タラップ（ハッチの扉が倒れて出来る）の地上端とハッチ枢軸（canvas座標）。drawShuttle と式を共有。 */
  private shuttleRamp(cx: number, baseY: number): { groundX: number; groundY: number; hingeX: number; hingeY: number } {
    const bh = Renderer.SHUTTLE_BODY_HALF;
    return {
      groundX: cx - bh - 64, // 地上端（左下）
      groundY: baseY,
      hingeX: cx - bh + 2,   // ハッチ枢軸（機体左の乗降口）
      hingeY: baseY - 52,
    };
  }

  /**
   * 大型シャトルを専用に描き起こす。原点(cx, baseY)＝エンジン噴射口（接地時は地表ライン）。
   * 上方向(負のy)へ機体を積み上げる。opts: t=時刻(炎のゆらぎ), thrust=噴射(0..1),
   * open=ハッチ/タラップ展開(0..1), grounded=着陸脚とタラップを描くか。
   */
  private drawShuttle(cx: number, baseY: number, o: { t: number; thrust: number; open: number; grounded: boolean }): void {
    const ctx = this.ctx;
    const bh = Renderer.SHUTTLE_BODY_HALF; // 胴体の半幅
    const bodyTop = baseY - 150;           // 胴体上端
    const noseTip = baseY - 206;           // ノーズ先端

    // --- スラスター炎（メイン＋ブースター）。最背面に加算合成で ---
    if (o.thrust > 0) {
      this.drawThrusterFlame(cx, baseY, o.thrust, 18, o.t);
      for (const s of [-1, 1]) this.drawThrusterFlame(cx + s * (bh + 12), baseY - 2, o.thrust * 0.7, 10, o.t);
    }

    // --- 着陸脚（接地時のみ。胴体より後ろに先に描く） ---
    if (o.grounded) {
      ctx.save();
      ctx.strokeStyle = '#6E7C99';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * (bh - 8), baseY - 26);
        ctx.lineTo(cx + s * (bh + 24), baseY + 1);
        ctx.stroke();
        ctx.fillStyle = '#8893AE';
        ctx.beginPath();
        ctx.ellipse(cx + s * (bh + 24), baseY + 2, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- サイドブースター（左右） ---
    for (const s of [-1, 1]) {
      const bx = cx + s * (bh + 12);
      const g = ctx.createLinearGradient(bx - 12, 0, bx + 12, 0);
      g.addColorStop(0, '#2A3650'); g.addColorStop(0.5, '#7C8BB0'); g.addColorStop(1, '#2A3650');
      ctx.fillStyle = g;
      this.roundRectPath(bx - 11, baseY - 122, 22, 118, 9);
      ctx.fill();
      ctx.fillStyle = '#C24A3A'; // ブースター・ノーズ
      ctx.beginPath();
      ctx.moveTo(bx - 11, baseY - 122);
      ctx.quadraticCurveTo(bx, baseY - 146, bx + 11, baseY - 122);
      ctx.closePath();
      ctx.fill();
    }

    // --- エンジンベル ---
    ctx.fillStyle = '#39435C';
    ctx.beginPath();
    ctx.moveTo(cx - 20, baseY - 16);
    ctx.lineTo(cx + 20, baseY - 16);
    ctx.lineTo(cx + 28, baseY + 2);
    ctx.lineTo(cx - 28, baseY + 2);
    ctx.closePath();
    ctx.fill();

    // --- 胴体（金属シリンダーの陰影：左明・右暗） ---
    const body = ctx.createLinearGradient(cx - bh, 0, cx + bh, 0);
    body.addColorStop(0, '#7E8CAC');
    body.addColorStop(0.35, '#EAF1FF');
    body.addColorStop(0.6, '#AEBBD6');
    body.addColorStop(1, '#4A567A');
    ctx.fillStyle = body;
    this.roundRectPath(cx - bh, bodyTop, bh * 2, baseY - 8 - bodyTop, 10);
    ctx.fill();

    // パネルライン（横方向の継ぎ目）
    ctx.strokeStyle = 'rgba(40,54,84,0.5)';
    ctx.lineWidth = 1;
    for (const yy of [bodyTop + 34, bodyTop + 78, bodyTop + 118]) {
      ctx.beginPath();
      ctx.moveTo(cx - bh + 3, yy);
      ctx.lineTo(cx + bh - 3, yy);
      ctx.stroke();
    }
    // 機体ストライプ（アクセント）
    ctx.fillStyle = '#E0563E';
    ctx.fillRect(cx - bh, bodyTop + 44, bh * 2, 8);

    // --- ノーズコーン ---
    const nose = ctx.createLinearGradient(cx - bh, bodyTop, cx + bh, bodyTop);
    nose.addColorStop(0, '#E0563E'); nose.addColorStop(0.5, '#FF8A5A'); nose.addColorStop(1, '#B23A2C');
    ctx.fillStyle = nose;
    ctx.beginPath();
    ctx.moveTo(cx - bh, bodyTop + 2);
    ctx.quadraticCurveTo(cx - bh * 0.6, noseTip + 10, cx, noseTip);
    ctx.quadraticCurveTo(cx + bh * 0.6, noseTip + 10, cx + bh, bodyTop + 2);
    ctx.closePath();
    ctx.fill();
    // ノーズ基部の白帯
    ctx.fillStyle = '#F4F8FF';
    ctx.fillRect(cx - bh, bodyTop - 2, bh * 2, 5);

    // --- コックピット窓（発光）＋舷窓 ---
    ctx.save();
    ctx.shadowColor = COLORS.SHIP_COCKPIT;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.SHIP_COCKPIT;
    ctx.beginPath();
    ctx.arc(cx, bodyTop + 22, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 6;
    for (const yy of [bodyTop + 70, bodyTop + 98]) {
      ctx.beginPath();
      ctx.arc(cx + bh * 0.42, yy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // 窓ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(cx - 3, bodyTop + 19, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // --- ハッチ／タラップ（接地時。open で扉が倒れてタラップになる） ---
    if (o.grounded) {
      const r = this.shuttleRamp(cx, baseY);
      const sillX = cx - bh + 1, sillTop = baseY - 78, sillBot = baseY - 40;
      if (o.open > 0) {
        // 開口部（暗い船内）
        ctx.fillStyle = '#0B1020';
        this.roundRectPath(sillX, sillTop, 13, sillBot - sillTop, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(125,240,255,0.25)'; // 内側のほの光
        ctx.fillRect(sillX + 2, sillTop + 3, 4, sillBot - sillTop - 6);
        // タラップ（枢軸から地上端へ。open で倒れていく）
        const ex = r.hingeX + (r.groundX - r.hingeX) * o.open;
        const ey = r.hingeY + (r.groundY - r.hingeY) * o.open;
        ctx.strokeStyle = '#9AA6C2';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r.hingeX, r.hingeY);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (o.open > 0.6) { // タラップの踏み板
          ctx.strokeStyle = 'rgba(40,54,84,0.7)';
          ctx.lineWidth = 1;
          for (let k = 1; k < 5; k++) {
            const tx = r.hingeX + (ex - r.hingeX) * (k / 5);
            const ty = r.hingeY + (ey - r.hingeY) * (k / 5);
            ctx.beginPath();
            ctx.moveTo(tx - 3, ty - 3);
            ctx.lineTo(tx + 3, ty + 3);
            ctx.stroke();
          }
        }
      } else {
        // 閉じたハッチ（少し凹んだパネル＋輪郭）
        ctx.fillStyle = '#9CA9C6';
        this.roundRectPath(sillX, sillTop, 13, sillBot - sillTop, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,54,84,0.7)';
        ctx.lineWidth = 1;
        this.roundRectPath(sillX, sillTop, 13, sillBot - sillTop, 3);
        ctx.stroke();
      }
    }
  }

  /** ロケット噴射の炎（加算合成）。baseY から下方向へ len 伸ばす。t で微小に揺らぐ。 */
  private drawThrusterFlame(x: number, baseY: number, intensity: number, halfW: number, t: number): void {
    if (intensity <= 0) return;
    const ctx = this.ctx;
    const flick = 0.9 + 0.1 * Math.sin(t * 40 + x);
    const len = (28 + intensity * 150) * flick;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 外炎（オレンジ）
    const g = ctx.createLinearGradient(0, baseY, 0, baseY + len);
    g.addColorStop(0, 'rgba(255,236,170,0.95)');
    g.addColorStop(0.3, COLORS.SHIP_THRUSTER);
    g.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - halfW, baseY);
    ctx.lineTo(x + halfW, baseY);
    ctx.lineTo(x + halfW * 0.3, baseY + len);
    ctx.lineTo(x - halfW * 0.3, baseY + len);
    ctx.closePath();
    ctx.fill();
    // 内炎（白熱コア）
    const g2 = ctx.createLinearGradient(0, baseY, 0, baseY + len * 0.55);
    g2.addColorStop(0, 'rgba(255,255,255,0.95)');
    g2.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(x - halfW * 0.45, baseY);
    ctx.lineTo(x + halfW * 0.45, baseY);
    ctx.lineTo(x, baseY + len * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 噴射が地面を照らす照り返し（点火・発進時）。intensity(0..1)。 */
  private drawGroundGlow(x: number, y: number, intensity: number): void {
    if (intensity <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = 40 + intensity * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,180,90,${0.5 * intensity})`);
    g.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 惑星の地表（画面下部のホライズン＋地面グラデ＋遠景の稜線）。alpha で出現/退場を制御。 */
  private drawSurface(alpha: number): void {
    if (alpha <= 0) return;
    const ctx = this.ctx;
    const groundY = ENDING_ROCKET_CY;
    ctx.save();
    ctx.globalAlpha = alpha;

    // 地面（ホライズンから下へ向かう暗い惑星表面）
    const grad = ctx.createLinearGradient(0, groundY, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#243A52');
    grad.addColorStop(1, '#0A1526');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, CANVAS_WIDTH, CANVAS_HEIGHT - groundY);

    // 遠景の稜線（決定論的な低い起伏）
    ctx.fillStyle = 'rgba(20,40,62,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let i = 0; i <= 8; i++) {
      const rx = (i / 8) * CANVAS_WIDTH;
      const ry = groundY - 6 - Math.abs(Math.sin(i * 1.7)) * 14;
      ctx.lineTo(rx, ry);
    }
    ctx.lineTo(CANVAS_WIDTH, groundY);
    ctx.closePath();
    ctx.fill();

    // ホライズンの発光ライン
    ctx.strokeStyle = COLORS.PLAYER;
    ctx.shadowColor = COLORS.PLAYER;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(CANVAS_WIDTH, groundY);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 青い地球。大気グロー＋海陸＋雲＋昼夜境界（夜側の灯り）。
   * alpha で出現フェードイン、approach(0..1) で夜側の食い込み・雲の流れを進める。
   */
  private drawEarth(cx: number, cy: number, r: number, alpha: number, approach: number): void {
    if (alpha <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;

    // 大気グロー（加算合成でにじむ縁）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.4);
    halo.addColorStop(0, 'rgba(120,200,255,0.5)');
    halo.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 以降は地球の円でクリップ（陸・雲・夜が球からはみ出さない）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // 本体（左上から光が当たる海洋ブルー）
    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    body.addColorStop(0, '#AFE0FF');
    body.addColorStop(0.5, '#2E7CC4');
    body.addColorStop(1, '#0B2A4A');
    ctx.fillStyle = body;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // 陸地
    ctx.fillStyle = 'rgba(70,176,120,0.65)';
    for (const [dx, dy, pr] of Renderer.EARTH_PATCHES) {
      ctx.beginPath();
      ctx.ellipse(cx + dx * r, cy + dy * r, pr * r, pr * r * 0.7, dx, 0, Math.PI * 2);
      ctx.fill();
    }

    // 雲（白い半透明の渦。approach でゆっくり流れる）
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const [dx, dy, pr] of Renderer.EARTH_CLOUDS) {
      const ox = ((dx + approach * 0.3 + 1.5) % 1.5) - 0.75; // 横へドリフト
      ctx.beginPath();
      ctx.ellipse(cx + ox * r, cy + dy * r, pr * r, pr * r * 0.45, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 昼夜境界（右下を影に）＋夜側の都市光
    const night = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.5, cx + r * 0.6, cy + r * 0.6, r * 1.3);
    night.addColorStop(0, 'rgba(0,0,0,0)');
    night.addColorStop(0.6, 'rgba(0,0,0,0)');
    night.addColorStop(1, 'rgba(2,6,16,0.85)');
    ctx.fillStyle = night;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255,221,150,0.9)'; // 夜側の灯り
    for (const [dx, dy] of Renderer.EARTH_CITY_LIGHTS) {
      ctx.beginPath();
      ctx.arc(cx + dx * r, cy + dy * r, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore(); // クリップ解除

    // 縁の大気リム（左上が明るい三日月状）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(180,225,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /** 発進段階のワープ演出。上方向へ流れる白ストリークを加算合成で重ねる。progress(0..1)で伸長。 */
  private drawWarpLines(progress: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const count = 24;
    const len = 24 + progress * 120;
    for (let i = 0; i < count; i++) {
      // 決定論的な疑似ランダム（GLSL風ハッシュ）で水平位置と初期位相を決める
      const hx = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      const hp = Math.abs(Math.sin(i * 78.233) * 43758.5453) % 1;
      const x = hx * CANVAS_WIDTH;
      const phase = (hp + progress * 2) % 1;     // 上方向へ流れる
      const y = (1 - phase) * CANVAS_HEIGHT;
      ctx.strokeStyle = `rgba(180,224,255,${0.2 + 0.5 * progress})`;
      ctx.lineWidth = 1 + hx;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
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
