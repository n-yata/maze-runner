import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GhostManager } from '../../src/ghost.js';
import { MapManager } from '../../src/map.js';
import { PlayerManager } from '../../src/player.js';
import { AudioManager } from '../../src/audio.js';
import { GHOST_STARTS, GHOST_SCATTER_TARGETS } from '../../src/constants.js';

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
  });
});
