import type { GhostState, GhostName, GhostMode, Direction, Vec2 } from './types.js';
import {
  TILE_SIZE,
  GHOST_STARTS,
  GHOST_SCATTER_TARGETS,
  GHOST_HOUSE_CENTER,
  GHOST_HOUSE_DOOR,
  GHOST_RELEASE_DOT_THRESHOLDS,
  GHOST_SPEED,
  FRIGHTENED_SPEED,
  EATEN_SPEED,
  FRIGHTENED_DURATION,
  MODE_SCHEDULE,
  GHOST_EAT_SCORES,
  type LevelParams,
} from './constants.js';
import type { MapManager } from './map.js';
import type { PlayerManager } from './player.js';
import type { AudioManager } from './audio.js';

const GHOST_NAMES: GhostName[] = ['BLINKY', 'PINKY', 'INKY', 'CLYDE'];

type DirVec = { dir: Direction; dx: number; dy: number };
// Priority order when distances are equal: UP > LEFT > DOWN > RIGHT (original PAC-MAN behavior)
const DIRS: DirVec[] = [
  { dir: 'UP',    dx:  0, dy: -1 },
  { dir: 'LEFT',  dx: -1, dy:  0 },
  { dir: 'DOWN',  dx:  0, dy:  1 },
  { dir: 'RIGHT', dx:  1, dy:  0 },
];

function opposite(dir: Direction): Direction {
  switch (dir) {
    case 'UP':    return 'DOWN';
    case 'DOWN':  return 'UP';
    case 'LEFT':  return 'RIGHT';
    case 'RIGHT': return 'LEFT';
    default:      return 'NONE';
  }
}

function dist2(a: Vec2, b: Vec2): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function tileOf(px: number): number {
  return Math.floor(px / TILE_SIZE);
}

function centerPx(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

function dirToVec(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case 'UP':    return { dx:  0, dy: -1 };
    case 'DOWN':  return { dx:  0, dy:  1 };
    case 'LEFT':  return { dx: -1, dy:  0 };
    case 'RIGHT': return { dx:  1, dy:  0 };
    default:      return { dx:  0, dy:  0 };
  }
}

export class GhostManager {
  ghosts: GhostState[];
  private modeTimer = 0;
  private modeIndex = 0;
  private released: Set<GhostName>;
  private inHouse: Set<GhostName>;
  private ghostSpeed = GHOST_SPEED;
  private frightenedSpd = FRIGHTENED_SPEED;
  private frightenedDur = FRIGHTENED_DURATION;
  private releaseThresholds: Record<GhostName, number> = { ...GHOST_RELEASE_DOT_THRESHOLDS };
  private modeSchedule: number[] = [...MODE_SCHEDULE];

  constructor() {
    this.ghosts = GHOST_NAMES.map(name => this.createGhost(name));
    this.released = new Set(['BLINKY', 'PINKY']);
    this.inHouse = new Set(['INKY', 'CLYDE']);
  }

  private createGhost(name: GhostName): GhostState {
    const pos = GHOST_STARTS[name];
    return {
      name,
      pos: { ...pos },
      pixelPos: { x: centerPx(pos.x), y: centerPx(pos.y) },
      dir: 'LEFT',
      mode: 'SCATTER',
      prevMode: 'SCATTER',
      frightenedTimer: 0,
      eatenScore: 0,
      lastTurnTile: { x: -1, y: -1 },
    };
  }

  reset(params?: LevelParams): void {
    if (params) {
      this.ghostSpeed = params.ghostSpeed;
      this.frightenedSpd = params.frightenedSpeed;
      this.frightenedDur = params.frightenedDuration;
      this.releaseThresholds = { ...params.ghostReleaseThresholds };
      this.modeSchedule = [...params.modeSchedule];
    }
    this.ghosts = GHOST_NAMES.map(name => this.createGhost(name));
    this.modeTimer = 0;
    this.modeIndex = 0;
    this.released = new Set(['BLINKY', 'PINKY']);
    this.inHouse = new Set(['INKY', 'CLYDE']);
  }

  triggerFrightened(): void {
    for (const g of this.ghosts) {
      if (g.mode !== 'EATEN') {
        g.prevMode = g.mode;
        g.mode = 'FRIGHTENED';
        g.frightenedTimer = this.frightenedDur;
      }
    }
  }

  update(
    dt: number,
    map: MapManager,
    player: PlayerManager,
    audio: AudioManager,
    dotsEaten: number,
  ): number {
    let scoreGained = 0;

    // Release ghosts based on dots eaten
    if (!this.released.has('INKY') && dotsEaten >= this.releaseThresholds['INKY']) {
      this.released.add('INKY');
      this.inHouse.delete('INKY');
    }
    if (!this.released.has('CLYDE') && dotsEaten >= this.releaseThresholds['CLYDE']) {
      this.released.add('CLYDE');
      this.inHouse.delete('CLYDE');
    }

    // Global mode timer (only affects non-FRIGHTENED, non-EATEN)
    this.modeTimer += dt;
    if (this.modeIndex < this.modeSchedule.length) {
      if (this.modeTimer >= (this.modeSchedule[this.modeIndex] ?? Infinity)) {
        this.modeTimer = 0;
        this.modeIndex++;
        const newMode: GhostMode = this.modeIndex % 2 === 0 ? 'SCATTER' : 'CHASE';
        for (const g of this.ghosts) {
          if (g.mode === 'SCATTER' || g.mode === 'CHASE') {
            g.mode = newMode;
          }
        }
      }
    }

    const blinky = this.ghosts.find(g => g.name === 'BLINKY')!;

    for (const g of this.ghosts) {
      // Update frightened timer
      if (g.mode === 'FRIGHTENED') {
        g.frightenedTimer -= dt;
        if (g.frightenedTimer <= 0) {
          g.mode = g.prevMode;
        }
      }

      // Check collision with player
      if (g.mode !== 'EATEN') {
        const playerTile = player.getTilePos();
        const ghostTile = g.pos;
        if (playerTile.x === ghostTile.x && playerTile.y === ghostTile.y) {
          if (g.mode === 'FRIGHTENED') {
            // Ghost eaten
            const eatIdx = Math.min(g.eatenScore, GHOST_EAT_SCORES.length - 1);
            scoreGained += GHOST_EAT_SCORES[eatIdx] ?? 200;
            g.eatenScore++;
            g.mode = 'EATEN';
            audio.play('EAT_GHOST');
          } else {
            // Player dies
            player.die();
            audio.play('DEATH');
          }
        }
      }

      this.moveGhost(g, dt, map, player, blinky);
    }

    return scoreGained;
  }

  private moveGhost(
    g: GhostState,
    dt: number,
    map: MapManager,
    player: PlayerManager,
    blinky: GhostState,
  ): void {
    const speed = g.mode === 'FRIGHTENED' ? this.frightenedSpd
                : g.mode === 'EATEN'      ? EATEN_SPEED
                : this.ghostSpeed;
    const dist = speed * TILE_SIZE * dt;

    const col = tileOf(g.pixelPos.x);
    const row = tileOf(g.pixelPos.y);
    const cx = centerPx(col);
    const cy = centerPx(row);
    const nearCenter = Math.abs(g.pixelPos.x - cx) < 2 && Math.abs(g.pixelPos.y - cy) < 2;
    // Only choose a new direction when arriving at a DIFFERENT tile center.
    // Without this check, the ghost re-snaps to center every frame while still
    // within 2px of its departure tile, causing it to never leave.
    const isNewTile = g.lastTurnTile.x !== col || g.lastTurnTile.y !== row;

    if (nearCenter && isNewTile) {
      // Snap to center, then choose next direction
      g.pixelPos = { x: cx, y: cy };
      const nextDir = this.chooseDirection(g, col, row, map, player, blinky);
      g.dir = nextDir;
      g.lastTurnTile = { x: col, y: row };
    }

    const { dx, dy } = dirToVec(g.dir);
    let newX = g.pixelPos.x + dx * dist;
    let newY = g.pixelPos.y + dy * dist;

    // Tunnel warp
    const totalWidth = 28 * TILE_SIZE;
    if (newX < 0) newX += totalWidth;
    if (newX >= totalWidth) newX -= totalWidth;

    g.pixelPos = { x: newX, y: newY };
    g.pos = { x: tileOf(g.pixelPos.x), y: tileOf(g.pixelPos.y) };
  }

  private chooseDirection(
    g: GhostState,
    col: number,
    row: number,
    map: MapManager,
    player: PlayerManager,
    blinky: GhostState,
  ): Direction {
    const target = this.getTarget(g, map, player, blinky);
    const opp = opposite(g.dir);

    if (g.mode === 'FRIGHTENED') {
      // Random direction, no reversals
      const valid = DIRS.filter(({ dir, dx, dy }) =>
        dir !== opp && !map.isWall(col + dx, row + dy)
      );
      if (valid.length === 0) return opp;
      return valid[Math.floor(Math.random() * valid.length)]!.dir;
    }

    // Choose direction minimizing distance to target (no reversals)
    let bestDir: Direction = g.dir;
    let bestDist = Infinity;

    for (const { dir, dx, dy } of DIRS) {
      if (dir === opp) continue;
      const nc = col + dx;
      const nr = row + dy;
      if (map.isWall(nc, nr)) continue;
      // Restrict ghosts from entering ghost house unless EATEN
      if (nr === GHOST_HOUSE_CENTER.y && nc >= 11 && nc <= 16 && g.mode !== 'EATEN') continue;

      const d = dist2({ x: nc, y: nr }, target);
      if (d < bestDist) {
        bestDist = d;
        bestDir = dir;
      }
    }

    return bestDir;
  }

  private getTarget(
    g: GhostState,
    _map: MapManager,
    player: PlayerManager,
    blinky: GhostState,
  ): Vec2 {
    if (g.mode === 'EATEN') {
      return GHOST_HOUSE_DOOR;
    }
    if (g.mode === 'SCATTER') {
      return GHOST_SCATTER_TARGETS[g.name];
    }

    const playerPos = player.getTilePos();
    const playerDir = player.state.dir;

    switch (g.name) {
      case 'BLINKY':
        return playerPos;

      case 'PINKY': {
        // 4 tiles ahead of player; UP direction has the original PAC-MAN bug (offset UP+LEFT)
        const { dx, dy } = dirToVec(playerDir);
        if (playerDir === 'UP') {
          return { x: playerPos.x - 4, y: playerPos.y - 4 };
        }
        return { x: playerPos.x + dx * 4, y: playerPos.y + dy * 4 };
      }

      case 'INKY': {
        // 2 tiles ahead of player
        const { dx, dy } = dirToVec(playerDir);
        let pivotX = playerPos.x + dx * 2;
        let pivotY = playerPos.y + dy * 2;
        if (playerDir === 'UP') { pivotX -= 2; }

        // Double the vector from Blinky to pivot
        const bx = blinky.pos.x;
        const by = blinky.pos.y;
        return {
          x: pivotX + (pivotX - bx),
          y: pivotY + (pivotY - by),
        };
      }

      case 'CLYDE': {
        // Chase if far, scatter if close (<8 tiles)
        const d2 = dist2(g.pos, playerPos);
        if (d2 > 64) {
          return playerPos;
        }
        return GHOST_SCATTER_TARGETS['CLYDE'];
      }
    }
  }

  getFrightenedEndWarning(): boolean {
    return this.ghosts.some(g => g.mode === 'FRIGHTENED' && g.frightenedTimer < 2);
  }
}
