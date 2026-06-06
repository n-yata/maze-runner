import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerManager } from '../../src/player.js';
import { MapManager } from '../../src/map.js';
import { AudioManager } from '../../src/audio.js';
import { TILE_SIZE, PLAYER_START, BARRIER_BLINK_THRESHOLD } from '../../src/constants.js';

function makeMocks() {
  const map = new MapManager();
  const audio = { play: vi.fn(), resume: vi.fn(), setMuted: vi.fn(), isMuted: vi.fn() } as unknown as AudioManager;
  return { map, audio };
}

describe('PlayerManager', () => {
  let player: PlayerManager;

  beforeEach(() => {
    player = new PlayerManager();
  });

  it('initializes at PLAYER_START position', () => {
    expect(player.state.pos.x).toBe(PLAYER_START.x);
    expect(player.state.pos.y).toBe(PLAYER_START.y);
  });

  it('initializes pixel pos at tile center', () => {
    const expectedX = PLAYER_START.x * TILE_SIZE + TILE_SIZE / 2;
    const expectedY = PLAYER_START.y * TILE_SIZE + TILE_SIZE / 2;
    expect(player.state.pixelPos.x).toBe(expectedX);
    expect(player.state.pixelPos.y).toBe(expectedY);
  });

  it('resets to initial state', () => {
    player.state.isDead = true;
    player.state.pos = { x: 5, y: 5 };
    player.reset();
    expect(player.state.pos.x).toBe(PLAYER_START.x);
    expect(player.state.isDead).toBe(false);
  });

  it('setNextDir stores the direction', () => {
    player.setNextDir('UP');
    expect(player.state.nextDir).toBe('UP');
  });

  it('does not update when dead', () => {
    const { map, audio } = makeMocks();
    player.state.isDead = true;
    const startX = player.state.pixelPos.x;
    player.update(1 / 60, map, audio);
    expect(player.state.pixelPos.x).toBe(startX);
  });

  it('die() sets isDead to true', () => {
    player.die();
    expect(player.state.isDead).toBe(true);
  });

  it('resetScore resets accumulated score', () => {
    player.score = 500;
    player.resetScore();
    expect(player.score).toBe(0);
  });

  it('getTilePos returns current tile position', () => {
    const tp = player.getTilePos();
    expect(tp.x).toBe(PLAYER_START.x);
    expect(tp.y).toBe(PLAYER_START.y);
  });

  describe('electromagnetic barrier', () => {
    it('has no barrier initially', () => {
      expect(player.hasBarrier()).toBe(false);
      expect(player.state.barrierTimer).toBe(0);
    });

    it('activateBarrier grants a barrier for the given duration', () => {
      player.activateBarrier(6.0);
      expect(player.hasBarrier()).toBe(true);
      expect(player.state.barrierTimer).toBeCloseTo(6.0);
    });

    it('barrier decays over time during update and expires', () => {
      const { map, audio } = makeMocks();
      player.activateBarrier(0.5);

      // Advance ~0.6s worth of fixed steps
      for (let i = 0; i < 36; i++) {
        player.update(1 / 60, map, audio);
      }

      expect(player.hasBarrier()).toBe(false);
      expect(player.state.barrierTimer).toBe(0);
    });

    it('re-activating refreshes (overwrites) the remaining duration', () => {
      const { map, audio } = makeMocks();
      player.activateBarrier(6.0);
      // Drain a little
      for (let i = 0; i < 60; i++) {
        player.update(1 / 60, map, audio);
      }
      expect(player.state.barrierTimer).toBeLessThan(6.0);

      player.activateBarrier(6.0); // re-eat power dot
      expect(player.state.barrierTimer).toBeCloseTo(6.0);
    });

    it('isBarrierBlinking is false while plenty of time remains', () => {
      player.activateBarrier(BARRIER_BLINK_THRESHOLD + 1.0);
      expect(player.isBarrierBlinking()).toBe(false);
    });

    it('isBarrierBlinking becomes true once remaining time drops below threshold', () => {
      player.activateBarrier(BARRIER_BLINK_THRESHOLD - 0.5);
      expect(player.hasBarrier()).toBe(true);
      expect(player.isBarrierBlinking()).toBe(true);
    });

    it('isBarrierBlinking is false when no barrier is active', () => {
      expect(player.isBarrierBlinking()).toBe(false);
    });

    it('reset clears the barrier', () => {
      player.activateBarrier(6.0);
      player.reset();
      expect(player.hasBarrier()).toBe(false);
      expect(player.state.barrierTimer).toBe(0);
    });

    it('registerBarrierKill returns a 0-based incrementing index', () => {
      player.activateBarrier(6.0);
      expect(player.registerBarrierKill()).toBe(0);
      expect(player.registerBarrierKill()).toBe(1);
      expect(player.registerBarrierKill()).toBe(2);
      expect(player.state.barrierKillCount).toBe(3);
    });

    it('activateBarrier resets the kill count for a fresh session', () => {
      player.activateBarrier(6.0);
      player.registerBarrierKill();
      player.registerBarrierKill();
      expect(player.state.barrierKillCount).toBe(2);

      player.activateBarrier(6.0); // re-eat power dot → new session
      expect(player.state.barrierKillCount).toBe(0);
      expect(player.registerBarrierKill()).toBe(0);
    });

    it('reset clears the kill count', () => {
      player.activateBarrier(6.0);
      player.registerBarrierKill();
      player.reset();
      expect(player.state.barrierKillCount).toBe(0);
    });
  });

  describe('moveHorizontal (boss shooting controls)', () => {
    let bossMap: MapManager;
    beforeEach(() => {
      bossMap = new MapManager();
      bossMap.resetBossArena();
    });

    it('moves right while RIGHT is held', () => {
      const x0 = player.state.pixelPos.x;
      player.moveHorizontal(0.1, 'RIGHT', bossMap);
      expect(player.state.pixelPos.x).toBeGreaterThan(x0);
    });

    it('moves left while LEFT is held', () => {
      const x0 = player.state.pixelPos.x;
      player.moveHorizontal(0.1, 'LEFT', bossMap);
      expect(player.state.pixelPos.x).toBeLessThan(x0);
    });

    it('does not move when no direction is held (stops in place)', () => {
      const x0 = player.state.pixelPos.x;
      player.moveHorizontal(0.1, 'NONE', bossMap);
      expect(player.state.pixelPos.x).toBe(x0);
    });

    it('ignores vertical input and keeps a fixed row', () => {
      const y0 = player.state.pixelPos.y;
      player.moveHorizontal(0.1, 'UP', bossMap);   // 縦入力では動かない
      player.moveHorizontal(0.1, 'RIGHT', bossMap); // 横移動してもYは固定
      expect(player.state.pixelPos.y).toBe(y0);
    });

    it('stops at the arena wall instead of passing through', () => {
      for (let i = 0; i < 200; i++) player.moveHorizontal(1 / 60, 'LEFT', bossMap);
      expect(bossMap.isWall(player.state.pos.x, player.state.pos.y)).toBe(false);
      expect(player.state.pos.x).toBeGreaterThanOrEqual(1); // 外周壁(col0)に入らない
    });
  });
});
