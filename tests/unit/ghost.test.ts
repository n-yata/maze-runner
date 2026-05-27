import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GhostManager } from '../../src/ghost.js';
import { MapManager } from '../../src/map.js';
import { PlayerManager } from '../../src/player.js';
import { AudioManager } from '../../src/audio.js';
import { GHOST_STARTS, GHOST_SCATTER_TARGETS, getLevelParams, TILE_SIZE } from '../../src/constants.js';

function makeDeps() {
  const map = new MapManager();
  const player = new PlayerManager();
  const audio = { play: vi.fn(), resume: vi.fn(), setMuted: vi.fn(), isMuted: vi.fn() } as unknown as AudioManager;
  return { map, player, audio };
}

describe('GhostManager', () => {
  let mgr: GhostManager;

  beforeEach(() => {
    mgr = new GhostManager();
  });

  it('initializes 4 ghosts', () => {
    expect(mgr.ghosts).toHaveLength(4);
  });

  it('each ghost starts at its designated position', () => {
    for (const ghost of mgr.ghosts) {
      const expected = GHOST_STARTS[ghost.name];
      expect(ghost.pos.x).toBe(expected.x);
      expect(ghost.pos.y).toBe(expected.y);
    }
  });

  it('each ghost starts in SCATTER mode', () => {
    for (const ghost of mgr.ghosts) {
      expect(ghost.mode).toBe('SCATTER');
    }
  });

  it('triggerFrightened sets all non-EATEN ghosts to FRIGHTENED', () => {
    mgr.triggerFrightened();
    for (const ghost of mgr.ghosts) {
      expect(ghost.mode).toBe('FRIGHTENED');
    }
  });

  it('triggerFrightened does not affect EATEN ghosts', () => {
    const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
    blinky.mode = 'EATEN';
    mgr.triggerFrightened();
    expect(blinky.mode).toBe('EATEN');
  });

  it('triggerFrightened saves previous mode', () => {
    const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
    blinky.mode = 'CHASE';
    mgr.triggerFrightened();
    expect(blinky.prevMode).toBe('CHASE');
  });

  it('reset restores all ghosts to initial state', () => {
    mgr.triggerFrightened();
    mgr.reset();
    for (const ghost of mgr.ghosts) {
      expect(ghost.mode).toBe('SCATTER');
      const expected = GHOST_STARTS[ghost.name];
      expect(ghost.pos.x).toBe(expected.x);
      expect(ghost.pos.y).toBe(expected.y);
    }
  });

  it('reset with LevelParams applies frightenedDuration to triggerFrightened', () => {
    const params = getLevelParams(3); // frightenedDuration: 4.0
    mgr.reset(params);
    mgr.triggerFrightened();
    const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
    expect(blinky.frightenedTimer).toBeCloseTo(params.frightenedDuration);
  });

  it('reset with LevelParams uses updated release thresholds', () => {
    const { map, player, audio } = makeDeps();
    const params = getLevelParams(3); // INKY: 15, CLYDE: 30
    mgr.reset(params);
    const inky = mgr.ghosts.find(g => g.name === 'INKY')!;
    // 15 dots should release Inky (Level 3 threshold)
    for (let i = 0; i < 5; i++) {
      mgr.update(1 / 60, map, player, audio, 15);
    }
    expect(inky.mode).toBe('SCATTER');
  });

  it('getFrightenedEndWarning returns false when no ghosts are frightened', () => {
    expect(mgr.getFrightenedEndWarning()).toBe(false);
  });

  it('getFrightenedEndWarning returns true when a ghost has < 2s remaining', () => {
    const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
    blinky.mode = 'FRIGHTENED';
    blinky.frightenedTimer = 1.5;
    expect(mgr.getFrightenedEndWarning()).toBe(true);
  });

  it('getFrightenedEndWarning returns false when frightened timer > 2s', () => {
    const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
    blinky.mode = 'FRIGHTENED';
    blinky.frightenedTimer = 4.0;
    expect(mgr.getFrightenedEndWarning()).toBe(false);
  });

  it('Blinky scatter target is top-right area', () => {
    const target = GHOST_SCATTER_TARGETS['BLINKY'];
    expect(target.x).toBeGreaterThan(20);
    expect(target.y).toBe(0);
  });

  it('Clyde scatter target is bottom-left area', () => {
    const target = GHOST_SCATTER_TARGETS['CLYDE'];
    expect(target.x).toBe(0);
    expect(target.y).toBeGreaterThan(20);
  });

  it('Pinky scatter target is top-left area', () => {
    const target = GHOST_SCATTER_TARGETS['PINKY'];
    expect(target.x).toBeLessThan(5);
    expect(target.y).toBe(0);
  });

  it('Inky scatter target is bottom-right area', () => {
    const target = GHOST_SCATTER_TARGETS['INKY'];
    expect(target.x).toBeGreaterThan(20);
    expect(target.y).toBeGreaterThan(20);
  });

  describe('update()', () => {
    it('returns 0 ghost score when no ghosts are eaten by player', () => {
      const { map, player, audio } = makeDeps();
      const score = mgr.update(1 / 60, map, player, audio, 0);
      expect(score).toBe(0);
    });

    it('frightened ghosts revert to prev mode after timer expires', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
      blinky.mode = 'FRIGHTENED';
      blinky.prevMode = 'CHASE';
      blinky.frightenedTimer = 0.01;

      mgr.update(0.1, map, player, audio, 0); // advance past timer

      expect(blinky.mode).toBe('CHASE');
    });

    it('releases Inky after 30 dots eaten', () => {
      const { map, player, audio } = makeDeps();
      const inky = mgr.ghosts.find(g => g.name === 'INKY')!;
      expect(inky.pos.x).toBe(GHOST_STARTS['INKY'].x);

      // Pass 30 dots eaten — Inky should be released
      for (let i = 0; i < 5; i++) {
        mgr.update(1 / 60, map, player, audio, 30);
      }
      // After release, Inky should be able to move (mode stays SCATTER)
      expect(inky.mode).toBe('SCATTER');
    });

    it('releases Clyde after 60 dots eaten', () => {
      const { map, player, audio } = makeDeps();
      const clyde = mgr.ghosts.find(g => g.name === 'CLYDE')!;

      for (let i = 0; i < 5; i++) {
        mgr.update(1 / 60, map, player, audio, 60);
      }
      expect(clyde.mode).toBe('SCATTER');
    });

    it('detects collision when player and ghost pixel positions overlap within 12px', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      // Place blinky at same pixel position as player
      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 8, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 8) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'SCATTER';

      mgr.update(1 / 60, map, player, audio, 0);

      expect(player.state.isDead).toBe(true);
    });

    it('does not trigger collision when ghost is far from player (> 12px)', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      // Place blinky far from player
      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 20, y: playerPx.y };
      blinky.mode = 'SCATTER';

      mgr.update(1 / 60, map, player, audio, 0);

      expect(player.state.isDead).toBe(false);
    });

    it('frightened ghost is eaten when player overlaps within 12px', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 5, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 5) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'FRIGHTENED';
      blinky.frightenedTimer = 5.0;

      const score = mgr.update(1 / 60, map, player, audio, 0);

      expect(blinky.mode).toBe('EATEN');
      expect(score).toBeGreaterThan(0);
    });

    it('frightened ghost is counted only once per update even with pre+post move checks', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 5, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 5) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'FRIGHTENED';
      blinky.frightenedTimer = 5.0;

      const score = mgr.update(1 / 60, map, player, audio, 0);

      // Should score exactly 200 (first eat), not 400 (double-counted)
      expect(score).toBe(200);
      expect(blinky.eatenScore).toBe(1);
    });

    it('EATEN ghost does not trigger collision when overlapping player', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 2, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 2) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'EATEN';

      mgr.update(1 / 60, map, player, audio, 0);

      expect(player.state.isDead).toBe(false);
    });
  });

  describe('chooseDirection() dead-end handling', () => {
    it('ghost does not enter wall tile even in dead-end (reversal allowed)', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      // Run many frames — ghost should never land on a wall tile
      for (let i = 0; i < 300; i++) {
        mgr.update(1 / 60, map, player, audio, 0);
        const tile = map.tileAt(blinky.pos.x, blinky.pos.y);
        expect(tile).not.toBe(1);
      }
    });

    it('all ghosts stay on non-wall tiles over time', () => {
      const { map, player, audio } = makeDeps();

      for (let i = 0; i < 300; i++) {
        mgr.update(1 / 60, map, player, audio, 0);
      }

      for (const ghost of mgr.ghosts) {
        const tile = map.tileAt(ghost.pos.x, ghost.pos.y);
        expect(tile).not.toBe(1);
      }
    });
  });
});
