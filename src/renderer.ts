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

    // Lives display
    ctx.fillStyle = COLORS.LIFE_COLOR;
    for (let i = 0; i < state.lives; i++) {
      const lx = TILE_SIZE + 8 + i * (TILE_SIZE + 2);
      const ly = TILE_SIZE * 3;
      ctx.beginPath();
      ctx.arc(lx, ly, TILE_SIZE / 2 - 1, 0.25 * Math.PI, 1.75 * Math.PI);
      ctx.lineTo(lx, ly);
      ctx.fill();
    }
  }

  private drawPlayer(player: PlayerManager): void {
    if (player.state.isDead) return;
    const ctx = this.ctx;
    const px = player.state.pixelPos.x;
    const py = player.state.pixelPos.y + MAP_OFFSET_Y;
    const radius = TILE_SIZE / 2 - 1;

    const mouthOpenness = Math.abs(Math.sin(player.state.animFrame * Math.PI));
    const mouthAngle = mouthOpenness * 0.25 * Math.PI;

    const dir = player.state.dir;
    let startAngle: number;
    switch (dir) {
      case 'RIGHT': startAngle = 0; break;
      case 'DOWN':  startAngle = Math.PI / 2; break;
      case 'LEFT':  startAngle = Math.PI; break;
      case 'UP':    startAngle = -Math.PI / 2; break;
      default:      startAngle = 0;
    }

    ctx.fillStyle = COLORS.PLAYER;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, radius, startAngle + mouthAngle, startAngle + Math.PI * 2 - mouthAngle);
    ctx.closePath();
    ctx.fill();
  }

  private drawDeadPlayer(player: PlayerManager, timer: number): void {
    const ctx = this.ctx;
    const px = player.state.pixelPos.x;
    const py = player.state.pixelPos.y + MAP_OFFSET_Y;
    const radius = TILE_SIZE / 2 - 1;

    // 0-0.3s: フリーズ（通常表示）
    if (timer < 0.3) {
      ctx.fillStyle = COLORS.PLAYER;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0.25 * Math.PI, 1.75 * Math.PI);
      ctx.lineTo(px, py);
      ctx.fill();
      return;
    }

    // 0.3-1.5s: 口が全開から閉じ、最後は点に縮む
    const progress = Math.min((timer - 0.3) / 1.2, 1.0);
    const currentRadius = radius * (1 - progress * 0.8);
    const mouthOpen = (1 - progress) * Math.PI; // π → 0

    if (currentRadius < 1) return;

    ctx.fillStyle = COLORS.PLAYER;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, currentRadius, mouthOpen / 2, Math.PI * 2 - mouthOpen / 2);
    ctx.closePath();
    ctx.fill();
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

    if (g.mode === 'FRIGHTENED') {
      const flash = frightenedEnding && (Math.floor(Date.now() / 250) % 2 === 0);
      ctx.fillStyle = flash ? COLORS.GHOST_FRIGHTENED_END : COLORS.GHOST_FRIGHTENED;
    } else {
      ctx.fillStyle = GHOST_COLORS[g.name];
    }

    ctx.beginPath();
    ctx.arc(px, py, r, Math.PI, 0);
    const bottom = py + r;
    const segments = 3;
    const segW = (r * 2) / segments;
    for (let i = 0; i <= segments; i++) {
      const bx = px - r + i * segW;
      const by = i % 2 === 0 ? bottom : bottom - r * 0.4;
      ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();

    if (g.mode !== 'FRIGHTENED') {
      this.drawEyes(px, py, r);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px - r * 0.3, py - r * 0.1, 2, 0, Math.PI * 2);
      ctx.arc(px + r * 0.3, py - r * 0.1, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFruit(fruitMgr: FruitManager): void {
    const state = fruitMgr.getState();
    if (!state) return;

    // Flash in last 3 seconds (0.25s on/off cycle)
    if (state.timer < 3.0 && Math.floor(state.timer / 0.25) % 2 === 0) return;

    const ctx = this.ctx;
    const cx = state.col * TILE_SIZE + TILE_SIZE / 2;
    const cy = state.row * TILE_SIZE + TILE_SIZE / 2 + MAP_OFFSET_Y;
    const r = TILE_SIZE / 2 - 1;

    const def = getFruitDef(state.level);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
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

    ctx.fillStyle = '#0000FF';
    ctx.beginPath();
    ctx.arc(cx - eyeOffX, cy + eyeOffY, eyeR * 0.5, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffX, cy + eyeOffY, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTitle(): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, cy - 80, CANVAS_WIDTH, 160);

    ctx.fillStyle = '#FFE000';
    ctx.font = `bold ${TILE_SIZE * 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('迷宮ラン', cx, cy - 30);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${TILE_SIZE}px monospace`;
    ctx.fillText('Press SPACE or Tap to Start', cx, cy + 10);
    ctx.fillText('Arrow Keys / WASD / Swipe', cx, cy + 35);
  }

  private drawReady(): void {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.fillStyle = '#FFE000';
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
