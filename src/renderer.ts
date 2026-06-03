import type { GameState, GhostState } from './types.js';
import {
  TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT,
  COLORS, GHOST_COLORS, getFruitDef,
} from './constants.js';
import type { MapManager } from './map.js';
import type { PlayerManager } from './player.js';
import type { GhostManager } from './ghost.js';
import type { FruitManager } from './fruit.js';

const UI_HEIGHT = 4 * TILE_SIZE;
const MAP_OFFSET_Y = UI_HEIGHT;

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas 2D context');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  render(
    state: GameState,
    map: MapManager,
    player: PlayerManager,
    ghostMgr: GhostManager,
    fruitMgr: FruitManager,
  ): void {
    const ctx = this.ctx;

    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.drawUI(state);

    switch (state.phase) {
      case 'TITLE':
        map.drawTo(ctx, MAP_OFFSET_Y);
        this.drawTitle();
        break;

      case 'READY':
        map.drawTo(ctx, MAP_OFFSET_Y);
        map.drawDots(ctx, MAP_OFFSET_Y);
        this.drawFruit(fruitMgr);
        this.drawGhosts(ghostMgr, false);
        this.drawPlayer(player);
        this.drawReady();
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
        this.drawStageClear();
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
  }

  private drawUI(state: GameState): void {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.SCORE_TEXT;
    ctx.font = `${TILE_SIZE - 2}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${state.score}`, TILE_SIZE + 4, TILE_SIZE);
    ctx.textAlign = 'right';
    ctx.fillText(`HI: ${state.highScore}`, CANVAS_WIDTH - TILE_SIZE - 4, TILE_SIZE);

    ctx.fillStyle = COLORS.SCORE_TEXT;
    ctx.textAlign = 'left';
    ctx.font = `${TILE_SIZE - 4}px monospace`;
    ctx.fillText(`LV.${state.level}`, CANVAS_WIDTH - 6 * TILE_SIZE, TILE_SIZE * 3);

    // Lives display（残機 = 宇宙船アイコン、上向き）
    for (let i = 0; i < state.lives; i++) {
      const lx = TILE_SIZE + 8 + i * (TILE_SIZE + 2);
      const ly = TILE_SIZE * 3;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(-Math.PI / 2); // 上向き
      this.drawShipBody(TILE_SIZE / 2 - 1, 0);
      ctx.restore();
    }
  }

  /** 進行方向に対応する回転角(ラジアン)。RIGHT を 0 として時計回り。 */
  private dirAngle(dir: string): number {
    switch (dir) {
      case 'RIGHT': return 0;
      case 'DOWN':  return Math.PI / 2;
      case 'LEFT':  return Math.PI;
      case 'UP':    return -Math.PI / 2;
      default:      return 0;
    }
  }

  /** 宇宙船を中心(0,0)・右向き基準で描く。呼び出し側で translate/rotate 済み想定。 */
  private drawShipBody(r: number, thrusterScale: number): void {
    const ctx = this.ctx;

    // 推進炎（後方=左側）
    if (thrusterScale > 0) {
      ctx.fillStyle = COLORS.SHIP_THRUSTER;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.35);
      ctx.lineTo(-r * (0.9 + thrusterScale * 0.9), 0);
      ctx.lineTo(-r * 0.9, r * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    // 船体（前方=右を向く三角形）
    ctx.fillStyle = COLORS.PLAYER;
    ctx.beginPath();
    ctx.moveTo(r, 0);            // 機首
    ctx.lineTo(-r * 0.85, -r * 0.8);
    ctx.lineTo(-r * 0.5, 0);
    ctx.lineTo(-r * 0.85, r * 0.8);
    ctx.closePath();
    ctx.fill();

    // コックピット
    ctx.fillStyle = COLORS.SHIP_COCKPIT;
    ctx.beginPath();
    ctx.arc(r * 0.15, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(player: PlayerManager): void {
    if (player.state.isDead) return;
    const ctx = this.ctx;
    const px = player.state.pixelPos.x;
    const py = player.state.pixelPos.y + MAP_OFFSET_Y;
    const radius = TILE_SIZE / 2 - 1;

    // 推進炎を animFrame で明滅
    const thruster = 0.4 + 0.6 * Math.abs(Math.sin(player.state.animFrame * Math.PI));

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.dirAngle(player.state.dir));
    this.drawShipBody(radius, thruster);
    ctx.restore();
  }

  private drawDeadPlayer(player: PlayerManager, timer: number): void {
    const ctx = this.ctx;
    const px = player.state.pixelPos.x;
    const py = player.state.pixelPos.y + MAP_OFFSET_Y;
    const radius = TILE_SIZE / 2 - 1;

    // 0-0.3s: フリーズ（被弾した船を表示）
    if (timer < 0.3) {
      ctx.save();
      ctx.translate(px, py);
      this.drawShipBody(radius, 0);
      ctx.restore();
      return;
    }

    // 0.3-0.9s: 制御を失った船が高速スピン（2回転）
    if (timer < 0.9) {
      const spinProgress = (timer - 0.3) / 0.6;
      const angle = spinProgress * Math.PI * 4;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      this.drawShipBody(radius * (1 - spinProgress * 0.4), 0);
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

    if (g.mode === 'EATEN') {
      this.drawEyes(px, py, r);
      return;
    }

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

  private drawEyes(cx: number, cy: number, r: number): void {
    const ctx = this.ctx;
    const eyeOffX = r * 0.35;
    const eyeOffY = -r * 0.15;
    const eyeR = r * 0.3;

    ctx.fillStyle = COLORS.GHOST_EATEN_EYES;
    ctx.beginPath();
    ctx.arc(cx - eyeOffX, cy + eyeOffY, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffX, cy + eyeOffY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.GHOST_EATEN_PUPIL;
    ctx.beginPath();
    ctx.arc(cx - eyeOffX, cy + eyeOffY, eyeR * 0.5, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffX, cy + eyeOffY, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTitle(): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = 'rgba(5,6,15,0.8)';
    ctx.fillRect(0, cy - 90, CANVAS_WIDTH, 180);

    ctx.fillStyle = '#7DF0FF';
    ctx.font = `bold ${TILE_SIZE * 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('STELLAR RUN', cx, cy - 40);

    ctx.fillStyle = '#9FD0FF';
    ctx.font = `${TILE_SIZE}px monospace`;
    ctx.fillText('ステラー・ラン', cx, cy - 12);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${TILE_SIZE}px monospace`;
    ctx.fillText('Press SPACE or Tap to Start', cx, cy + 20);
    ctx.fillText('Arrow Keys / WASD / Swipe', cx, cy + 45);
  }

  private drawReady(): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = '#7DF0FF';
    ctx.font = `bold ${TILE_SIZE * 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('READY!', cx, cy);
  }

  private drawPaused(): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, cy - 40, CANVAS_WIDTH, 80);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${TILE_SIZE * 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', cx, cy + 8);

    ctx.font = `${TILE_SIZE}px monospace`;
    ctx.fillText('ESC to resume', cx, cy + 35);
  }

  private drawAllClear(): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, cy - 80, CANVAS_WIDTH, 160);

    ctx.fillStyle = '#7DF0FF';
    ctx.font = `bold ${TILE_SIZE * 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('ALL CLEAR!', cx, cy - 20);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${TILE_SIZE}px monospace`;
    ctx.fillText('おめでとう！', cx, cy + 15);
    ctx.fillText('Press SPACE or Tap', cx, cy + 40);
  }

  private drawStageClear(): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, cy - 50, CANVAS_WIDTH, 100);

    ctx.fillStyle = '#00FFFF';
    ctx.font = `bold ${TILE_SIZE * 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('STAGE CLEAR!', cx, cy + 8);
  }

  private drawGameOver(canInput: boolean): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, cy - 60, CANVAS_WIDTH, 120);

    ctx.fillStyle = '#FF0000';
    ctx.font = `bold ${TILE_SIZE * 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', cx, cy + 5);

    if (canInput) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${TILE_SIZE}px monospace`;
      ctx.fillText('Press SPACE or Tap', cx, cy + 38);
    }
  }
}
