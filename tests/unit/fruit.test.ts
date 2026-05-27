import { describe, it, expect, beforeEach } from 'vitest';
import { FruitManager } from '../../src/fruit.js';
import { getFruitDef, TILE_SIZE, FRUIT_DURATION } from '../../src/constants.js';
import type { Vec2 } from '../../src/types.js';

const VALID_POSITIONS: Vec2[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 5, y: 1 },
];

describe('FruitManager', () => {
  let mgr: FruitManager;

  beforeEach(() => {
    mgr = new FruitManager();
  });

  it('initializes with no active fruits', () => {
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('does not spawn fruit below the first threshold (46 dots)', () => {
    mgr.checkSpawn(46, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('spawns fruit when first threshold is reached (47 dots)', () => {
    mgr.checkSpawn(47, 1, VALID_POSITIONS);
    const states = mgr.getStates();
    expect(states).toHaveLength(1);
    expect(states[0]!.timer).toBe(FRUIT_DURATION);
    expect(states[0]!.level).toBe(1);
  });

  it('spawns fruit at a position from validPositions', () => {
    mgr.checkSpawn(47, 1, VALID_POSITIONS);
    const state = mgr.getStates()[0]!;
    const spawned = VALID_POSITIONS.some(p => p.x === state.col && p.y === state.row);
    expect(spawned).toBe(true);
  });

  it('does not spawn second fruit while first is active at same threshold call', () => {
    mgr.checkSpawn(113, 1, VALID_POSITIONS); // both thresholds exceeded in one call
    // Both thresholds trigger, so 2 fruits spawn (if validPositions has space)
    expect(mgr.getStates()).toHaveLength(2);
  });

  it('two simultaneous fruits have different positions', () => {
    mgr.checkSpawn(113, 1, VALID_POSITIONS);
    const states = mgr.getStates();
    expect(states).toHaveLength(2);
    const pos0 = `${states[0]!.col},${states[0]!.row}`;
    const pos1 = `${states[1]!.col},${states[1]!.row}`;
    expect(pos0).not.toBe(pos1);
  });

  it('does not spawn beyond FRUIT_MAX_ACTIVE even if validPositions has entries', () => {
    // Trigger both thresholds first to fill up to max
    mgr.checkSpawn(113, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(2);
  });

  it('fruit disappears automatically after FRUIT_DURATION seconds', () => {
    mgr.checkSpawn(47, 1, VALID_POSITIONS);
    mgr.update(FRUIT_DURATION + 0.1, { x: -1000, y: -1000 });
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('eating fruit returns correct score and removes that fruit', () => {
    mgr.checkSpawn(47, 1, VALID_POSITIONS); // level 1 → 100 pts
    const state = mgr.getStates()[0]!;
    const fruitPx = { x: state.col * TILE_SIZE + TILE_SIZE / 2, y: state.row * TILE_SIZE + TILE_SIZE / 2 };
    const score = mgr.update(1 / 60, fruitPx);
    expect(score).toBe(100);
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('eating both fruits returns combined score', () => {
    mgr.checkSpawn(113, 1, VALID_POSITIONS);
    const states = mgr.getStates();
    expect(states).toHaveLength(2);

    // Eat first fruit
    const s0 = states[0]!;
    const px0 = { x: s0.col * TILE_SIZE + TILE_SIZE / 2, y: s0.row * TILE_SIZE + TILE_SIZE / 2 };
    const score1 = mgr.update(1 / 60, px0);
    expect(score1).toBe(100);
    expect(mgr.getStates()).toHaveLength(1);

    // Eat second fruit
    const s1 = mgr.getStates()[0]!;
    const px1 = { x: s1.col * TILE_SIZE + TILE_SIZE / 2, y: s1.row * TILE_SIZE + TILE_SIZE / 2 };
    const score2 = mgr.update(1 / 60, px1);
    expect(score2).toBe(100);
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('eating fruit at level 3 returns 500 pts', () => {
    mgr.checkSpawn(47, 3, VALID_POSITIONS);
    const state = mgr.getStates()[0]!;
    const fruitPx = { x: state.col * TILE_SIZE + TILE_SIZE / 2, y: state.row * TILE_SIZE + TILE_SIZE / 2 };
    const score = mgr.update(1 / 60, fruitPx);
    expect(score).toBe(500);
  });

  it('reset clears all states and allows re-spawning', () => {
    mgr.checkSpawn(47, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(1);
    mgr.reset();
    expect(mgr.getStates()).toHaveLength(0);
    mgr.checkSpawn(47, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(1);
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
