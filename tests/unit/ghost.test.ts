import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GhostManager } from '../../src/ghost.js';
import { MapManager } from '../../src/map.js';
import { PlayerManager } from '../../src/player.js';
import { AudioManager } from '../../src/audio.js';
import { GHOST_STARTS, GHOST_SCATTER_TARGETS, getLevelParams, TILE_SIZE, COLS, ROWS } from '../../src/constants.js';

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

  it('reset restores all ghosts to initial state', () => {
    const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
    blinky.mode = 'CHASE';
    mgr.reset();
    for (const ghost of mgr.ghosts) {
      expect(ghost.mode).toBe('SCATTER');
      const expected = GHOST_STARTS[ghost.name];
      expect(ghost.pos.x).toBe(expected.x);
      expect(ghost.pos.y).toBe(expected.y);
    }
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

  it('Blinky scatter target is top-right area', () => {
    const target = GHOST_SCATTER_TARGETS['BLINKY'];
    expect(target.x).toBeGreaterThan(COLS / 2);
    expect(target.y).toBe(0);
  });

  it('Clyde scatter target is bottom-left area', () => {
    const target = GHOST_SCATTER_TARGETS['CLYDE'];
    expect(target.x).toBe(0);
    expect(target.y).toBeGreaterThan(ROWS / 2);
  });

  it('Pinky scatter target is top-left area', () => {
    const target = GHOST_SCATTER_TARGETS['PINKY'];
    expect(target.x).toBeLessThan(COLS / 2);
    expect(target.y).toBe(0);
  });

  it('Inky scatter target is bottom-right area', () => {
    const target = GHOST_SCATTER_TARGETS['INKY'];
    expect(target.x).toBeGreaterThan(COLS / 2);
    expect(target.y).toBeGreaterThan(ROWS / 2);
  });

  describe('update()', () => {
    it('returns 0 ghost score when no ghosts are eaten by player', () => {
      const { map, player, audio } = makeDeps();
      const score = mgr.update(1 / 60, map, player, audio, 0);
      expect(score).toBe(0);
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

    it('ghost is defeated when player has a barrier and overlaps within 12px', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 5, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 5) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'CHASE';
      player.activateBarrier(5.0);

      const score = mgr.update(1 / 60, map, player, audio, 0);

      expect(blinky.mode).toBe('VANISHED');
      expect(score).toBeGreaterThan(0);
      expect(player.state.isDead).toBe(false);
    });

    it('player WITHOUT a barrier dies on contact (no defeat)', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 5, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 5) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'CHASE'; // no barrier active

      const score = mgr.update(1 / 60, map, player, audio, 0);

      expect(player.state.isDead).toBe(true);
      expect(blinky.mode).not.toBe('VANISHED');
      expect(score).toBe(0);
    });

    it('defeating with a barrier never kills the player (pre+post move re-hit)', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      // Overlap the player so both the pre-move and post-move collision checks fire
      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 2, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 2) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'CHASE';
      player.activateBarrier(5.0);

      mgr.update(1 / 60, map, player, audio, 0);

      // Ghost is defeated (VANISHED) and the player must survive — the now-VANISHED
      // ghost on the same tile must NOT trigger a death on the post-move check.
      expect(blinky.mode).toBe('VANISHED');
      expect(player.state.isDead).toBe(false);
    });

    it('barrier defeat is counted only once per update even with pre+post move checks', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 5, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 5) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'CHASE';
      player.activateBarrier(5.0);

      const score = mgr.update(1 / 60, map, player, audio, 0);

      // Should score exactly 200 (first defeat), not 400 (double-counted by pre+post check)
      expect(score).toBe(200);
      // Only one kill registered in the barrier session
      expect(player.state.barrierKillCount).toBe(1);
    });

    it('barrier defeats escalate the consecutive score (200/400/800/1600) within one session', () => {
      const { map, player, audio } = makeDeps();
      player.activateBarrier(10.0);

      const playerPx = player.getPixelPos();
      const order = ['BLINKY', 'PINKY', 'INKY', 'CLYDE'] as const;
      const expected = [200, 400, 800, 1600];

      order.forEach((name, i) => {
        // Move every other ghost far away so only the targeted one collides this frame
        for (const g of mgr.ghosts) {
          if (g.name !== name) {
            (g as any).pixelPos = { x: -1000, y: -1000 };
          }
        }
        const target = mgr.ghosts.find(g => g.name === name)!;
        (target as any).pixelPos = { x: playerPx.x, y: playerPx.y };
        (target as any).pos = { x: Math.floor(playerPx.x / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
        target.mode = 'CHASE';

        const score = mgr.update(1 / 60, map, player, audio, 0);
        expect(score).toBe(expected[i]);
        expect(player.state.isDead).toBe(false);
      });
    });

    it('re-activating the barrier resets the consecutive score back to 200', () => {
      const { map, player, audio } = makeDeps();
      const playerPx = player.getPixelPos();

      const defeatOne = (name: 'BLINKY' | 'PINKY'): number => {
        for (const g of mgr.ghosts) {
          if (g.name !== name) (g as any).pixelPos = { x: -1000, y: -1000 };
        }
        const target = mgr.ghosts.find(g => g.name === name)!;
        (target as any).pixelPos = { x: playerPx.x, y: playerPx.y };
        (target as any).pos = { x: Math.floor(playerPx.x / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
        target.mode = 'CHASE';
        return mgr.update(1 / 60, map, player, audio, 0);
      };

      player.activateBarrier(10.0);
      expect(defeatOne('BLINKY')).toBe(200);
      // Second defeat in the same session escalates to 400
      expect(defeatOne('PINKY')).toBe(400);

      // Re-eating a power dot starts a fresh session → back to 200
      player.activateBarrier(10.0);
      expect(defeatOne('INKY')).toBe(200);
    });

    it('VANISHED ghost does not trigger collision when overlapping player', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 2, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 2) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'VANISHED';

      mgr.update(1 / 60, map, player, audio, 0);

      expect(player.state.isDead).toBe(false);
    });
  });

  describe('vanish behavior (defeated ghosts)', () => {
    it('defeating a ghost with a barrier sets it to VANISHED with consecutive score', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;

      const playerPx = player.getPixelPos();
      (blinky as any).pixelPos = { x: playerPx.x + 5, y: playerPx.y };
      (blinky as any).pos = { x: Math.floor((playerPx.x + 5) / TILE_SIZE), y: Math.floor(playerPx.y / TILE_SIZE) };
      blinky.mode = 'CHASE';
      player.activateBarrier(5.0);

      const score = mgr.update(1 / 60, map, player, audio, 0);

      expect(blinky.mode).toBe('VANISHED');
      expect(score).toBe(200);
    });

    it('a VANISHED ghost does not move on subsequent updates', () => {
      const { map, player, audio } = makeDeps();
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
      blinky.mode = 'VANISHED';
      const before = { x: blinky.pixelPos.x, y: blinky.pixelPos.y };

      for (let i = 0; i < 60; i++) {
        mgr.update(1 / 60, map, player, audio, 0);
      }

      expect(blinky.pixelPos.x).toBe(before.x);
      expect(blinky.pixelPos.y).toBe(before.y);
    });

    it('reset revives a VANISHED ghost back to SCATTER at its start tile', () => {
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
      blinky.mode = 'VANISHED';

      mgr.reset();

      const revived = mgr.ghosts.find(g => g.name === 'BLINKY')!;
      expect(revived.mode).toBe('SCATTER');
      expect(revived.pos.x).toBe(GHOST_STARTS['BLINKY'].x);
      expect(revived.pos.y).toBe(GHOST_STARTS['BLINKY'].y);
    });
  });

  describe('defeatAt() (laser kill)', () => {
    it('defeats a ghost within radius and returns consecutive score', () => {
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
      const { x, y } = blinky.pixelPos;

      const score = mgr.defeatAt(x + 2, y, TILE_SIZE * 0.6);

      expect(blinky.mode).toBe('VANISHED');
      expect(score).toBe(200);
      expect(blinky.eatenScore).toBe(1);
    });

    it('defeats ghosts regardless of mode (weapon, not power-dot)', () => {
      const pinky = mgr.ghosts.find(g => g.name === 'PINKY')!;
      pinky.mode = 'CHASE';
      const { x, y } = pinky.pixelPos;

      const score = mgr.defeatAt(x, y, TILE_SIZE * 0.6);

      expect(pinky.mode).toBe('VANISHED');
      expect(score).toBeGreaterThan(0);
    });

    it('returns 0 and defeats nothing when no ghost is within radius', () => {
      const score = mgr.defeatAt(-500, -500, TILE_SIZE * 0.6);
      expect(score).toBe(0);
      expect(mgr.ghosts.every(g => g.mode !== 'VANISHED')).toBe(true);
    });

    it('does not re-defeat an already VANISHED ghost', () => {
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
      blinky.mode = 'VANISHED';
      const { x, y } = blinky.pixelPos;

      const score = mgr.defeatAt(x, y, TILE_SIZE * 0.6);
      expect(score).toBe(0);
    });

    it('defeats at most one ghost per call', () => {
      // Stack two ghosts at the same pixel position
      const blinky = mgr.ghosts.find(g => g.name === 'BLINKY')!;
      const pinky = mgr.ghosts.find(g => g.name === 'PINKY')!;
      pinky.pixelPos = { ...blinky.pixelPos };

      mgr.defeatAt(blinky.pixelPos.x, blinky.pixelPos.y, TILE_SIZE * 0.6);

      const vanished = mgr.ghosts.filter(g => g.mode === 'VANISHED');
      expect(vanished).toHaveLength(1);
    });
  });

  describe('allDefeated()', () => {
    it('returns false when at least one ghost remains', () => {
      expect(mgr.allDefeated()).toBe(false);
    });

    it('returns true only when every ghost is VANISHED', () => {
      for (const g of mgr.ghosts) g.mode = 'VANISHED';
      expect(mgr.allDefeated()).toBe(true);
    });

    it('returns false when one ghost is still alive', () => {
      for (const g of mgr.ghosts) g.mode = 'VANISHED';
      mgr.ghosts[0]!.mode = 'CHASE';
      expect(mgr.allDefeated()).toBe(false);
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
