import { describe, it, expect } from 'vitest';
import { getLevelParams } from '../../src/constants.js';

describe('getLevelParams', () => {
  it('returns correct values for level 1', () => {
    const p = getLevelParams(1);
    expect(p.playerSpeed).toBe(5.5);
    expect(p.ghostSpeed).toBe(4.5);
    expect(p.frightenedDuration).toBe(6.0);
    expect(p.ghostReleaseThresholds.INKY).toBe(30);
    expect(p.ghostReleaseThresholds.CLYDE).toBe(60);
  });

  it('returns correct values for level 2', () => {
    const p = getLevelParams(2);
    expect(p.playerSpeed).toBe(5.8);
    expect(p.ghostSpeed).toBe(5.0);
    expect(p.frightenedDuration).toBe(5.0);
  });

  it('level 6 returns the same params as level 5 (cap)', () => {
    expect(getLevelParams(6)).toEqual(getLevelParams(5));
  });

  it('caps at level 5 for level 10 and beyond', () => {
    expect(getLevelParams(10)).toEqual(getLevelParams(5));
    expect(getLevelParams(99)).toEqual(getLevelParams(5));
  });

  it('clamps level 0 to level 1 params', () => {
    expect(getLevelParams(0)).toEqual(getLevelParams(1));
  });

  it('clamps negative levels to level 1 params', () => {
    expect(getLevelParams(-5)).toEqual(getLevelParams(1));
  });

  it('ghostSpeed increases with each level', () => {
    for (let lvl = 1; lvl < 5; lvl++) {
      expect(getLevelParams(lvl + 1).ghostSpeed).toBeGreaterThan(getLevelParams(lvl).ghostSpeed);
    }
  });

  it('frightenedDuration decreases with each level', () => {
    for (let lvl = 1; lvl < 5; lvl++) {
      expect(getLevelParams(lvl + 1).frightenedDuration).toBeLessThan(getLevelParams(lvl).frightenedDuration);
    }
  });

  it('playerSpeed always exceeds ghostSpeed', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const p = getLevelParams(lvl);
      expect(p.playerSpeed).toBeGreaterThan(p.ghostSpeed);
    }
  });

  it('BLINKY and PINKY release threshold is always 0', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const p = getLevelParams(lvl);
      expect(p.ghostReleaseThresholds.BLINKY).toBe(0);
      expect(p.ghostReleaseThresholds.PINKY).toBe(0);
    }
  });
});
