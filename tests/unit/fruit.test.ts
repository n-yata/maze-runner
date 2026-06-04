import { describe, it, expect, beforeEach } from 'vitest';
import { FruitManager } from '../../src/fruit.js';
import {
  getFruitDef, TILE_SIZE, FRUIT_DURATION, FRUIT_FIRST_DELAY, FRUIT_RESPAWN_INTERVAL,
} from '../../src/constants.js';
import type { Vec2 } from '../../src/types.js';

const VALID_POSITIONS: Vec2[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 5, y: 1 },
];

function fruitPx(state: { col: number; row: number }): Vec2 {
  return { x: state.col * TILE_SIZE + TILE_SIZE / 2, y: state.row * TILE_SIZE + TILE_SIZE / 2 };
}

describe('FruitManager (laser pickup)', () => {
  let mgr: FruitManager;

  beforeEach(() => {
    mgr = new FruitManager();
  });

  it('initializes with no active fruits', () => {
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('does not spawn before FRUIT_FIRST_DELAY elapses', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY - 0.1, true, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('spawns a fruit once the first delay elapses (enemies remain)', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY, true, 1, VALID_POSITIONS);
    const states = mgr.getStates();
    expect(states).toHaveLength(1);
    expect(states[0]!.timer).toBe(FRUIT_DURATION);
    expect(states[0]!.level).toBe(1);
  });

  it('spawns at a position from validPositions', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY, true, 1, VALID_POSITIONS);
    const s = mgr.getStates()[0]!;
    expect(VALID_POSITIONS.some(p => p.x === s.col && p.y === s.row)).toBe(true);
  });

  it('does not spawn when no enemies remain (already cleared)', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY, false, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('keeps at most one fruit on the board at a time', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY, true, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(1);
    // Further time should not add a second fruit while one is active
    mgr.updateSpawning(FRUIT_RESPAWN_INTERVAL * 2, true, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(1);
  });

  it('respawns a new fruit after the previous one expires (no soft-lock)', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY, true, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(1);

    // Let the fruit expire without being eaten
    const eaten = mgr.update(FRUIT_DURATION + 0.1, { x: -1000, y: -1000 });
    expect(eaten).toBe(0);
    expect(mgr.getStates()).toHaveLength(0);

    // After the respawn interval, a new fruit appears
    mgr.updateSpawning(FRUIT_RESPAWN_INTERVAL, true, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(1);
  });

  it('update() returns the number of fruits eaten this frame', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY, true, 1, VALID_POSITIONS);
    const s = mgr.getStates()[0]!;
    const eaten = mgr.update(1 / 60, fruitPx(s));
    expect(eaten).toBe(1);
    expect(mgr.getStates()).toHaveLength(0);
  });

  it('update() returns 0 when player is far from any fruit', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY, true, 1, VALID_POSITIONS);
    const eaten = mgr.update(1 / 60, { x: -1000, y: -1000 });
    expect(eaten).toBe(0);
    expect(mgr.getStates()).toHaveLength(1);
  });

  it('update() returns 0 when no fruit is active', () => {
    expect(mgr.update(1 / 60, { x: 0, y: 0 })).toBe(0);
  });

  it('reset clears states and restores the first-spawn delay', () => {
    mgr.updateSpawning(FRUIT_FIRST_DELAY, true, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(1);

    mgr.reset();
    expect(mgr.getStates()).toHaveLength(0);

    // After reset, the first-delay must elapse again before a new fruit appears
    mgr.updateSpawning(FRUIT_FIRST_DELAY - 0.5, true, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(0);
    mgr.updateSpawning(0.6, true, 1, VALID_POSITIONS);
    expect(mgr.getStates()).toHaveLength(1);
  });

  describe('getFruitDef (color table, still used for rendering)', () => {
    it('level 1 returns a defined color', () => {
      expect(getFruitDef(1).color).toBeTruthy();
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
