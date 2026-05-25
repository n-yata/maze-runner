import { describe, it, expect, beforeEach } from 'vitest';
import { FruitManager } from '../../src/fruit.js';
import { getFruitDef, TILE_SIZE, FRUIT_SPAWN_POS } from '../../src/constants.js';

describe('FruitManager', () => {
  let mgr: FruitManager;

  beforeEach(() => {
    mgr = new FruitManager();
  });

  it('initializes with no active fruit', () => {
    expect(mgr.getState()).toBeNull();
  });

  it('does not spawn fruit below the first threshold (69 dots)', () => {
    mgr.checkSpawn(69, 1);
    expect(mgr.getState()).toBeNull();
  });

  it('spawns fruit when first threshold is reached (70 dots)', () => {
    mgr.checkSpawn(70, 1);
    expect(mgr.getState()).not.toBeNull();
    expect(mgr.getState()!.col).toBe(FRUIT_SPAWN_POS.x);
    expect(mgr.getState()!.row).toBe(FRUIT_SPAWN_POS.y);
    expect(mgr.getState()!.timer).toBe(10.0);
    expect(mgr.getState()!.level).toBe(1);
  });

  it('does not spawn second fruit while first is still active', () => {
    mgr.checkSpawn(170, 1); // both thresholds exceeded
    const timerBefore = mgr.getState()!.timer;
    mgr.checkSpawn(200, 1); // call again
    // still the same single fruit, timer unchanged
    expect(mgr.getState()!.timer).toBe(timerBefore);
  });

  it('spawns second fruit after first is eaten', () => {
    mgr.checkSpawn(70, 1);
    const state = mgr.getState()!;
    const fruitPx = { x: state.col * TILE_SIZE + TILE_SIZE / 2, y: state.row * TILE_SIZE + TILE_SIZE / 2 };
    // Eat first fruit
    mgr.update(1 / 60, fruitPx);
    expect(mgr.getState()).toBeNull();

    // Second threshold
    mgr.checkSpawn(170, 1);
    expect(mgr.getState()).not.toBeNull();
  });

  it('fruit disappears automatically after 10 seconds', () => {
    mgr.checkSpawn(70, 1);
    mgr.update(10.1, { x: -1000, y: -1000 }); // far from fruit
    expect(mgr.getState()).toBeNull();
  });

  it('eating fruit returns correct score and clears state', () => {
    mgr.checkSpawn(70, 1); // level 1 → 100 pts
    const state = mgr.getState()!;
    const fruitPx = { x: state.col * TILE_SIZE + TILE_SIZE / 2, y: state.row * TILE_SIZE + TILE_SIZE / 2 };
    const score = mgr.update(1 / 60, fruitPx);
    expect(score).toBe(100);
    expect(mgr.getState()).toBeNull();
  });

  it('eating fruit at level 3 returns 500 pts', () => {
    mgr.checkSpawn(70, 3);
    const state = mgr.getState()!;
    const fruitPx = { x: state.col * TILE_SIZE + TILE_SIZE / 2, y: state.row * TILE_SIZE + TILE_SIZE / 2 };
    const score = mgr.update(1 / 60, fruitPx);
    expect(score).toBe(500);
  });

  it('reset clears state and allows re-spawning', () => {
    mgr.checkSpawn(70, 1);
    expect(mgr.getState()).not.toBeNull();
    mgr.reset();
    expect(mgr.getState()).toBeNull();
    mgr.checkSpawn(70, 1);
    expect(mgr.getState()).not.toBeNull();
  });

  it('update returns 0 when no fruit is active', () => {
    expect(mgr.update(1 / 60, { x: 0, y: 0 })).toBe(0);
  });

  describe('getFruitDef', () => {
    it('level 1 returns score 100', () => {
      expect(getFruitDef(1).score).toBe(100);
    });

    it('score increases with each level', () => {
      for (let lvl = 1; lvl < 5; lvl++) {
        expect(getFruitDef(lvl + 1).score).toBeGreaterThan(getFruitDef(lvl).score);
      }
    });

    it('level 5 and level 99 return the same params (cap)', () => {
      expect(getFruitDef(5)).toEqual(getFruitDef(99));
    });

    it('level 0 and negative levels return level 1 params', () => {
      expect(getFruitDef(0)).toEqual(getFruitDef(1));
      expect(getFruitDef(-1)).toEqual(getFruitDef(1));
    });
  });
});
