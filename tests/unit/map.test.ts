import { describe, it, expect, beforeEach } from 'vitest';
import { MapManager } from '../../src/map.js';

describe('MapManager', () => {
  let map: MapManager;

  beforeEach(() => {
    map = new MapManager();
  });

  describe('isWall', () => {
    it('detects wall tiles at border', () => {
      // Top-left corner is a wall
      expect(map.isWall(0, 0)).toBe(true);
    });

    it('returns true for out-of-bounds coordinates', () => {
      expect(map.isWall(-1, 0)).toBe(true);
      expect(map.isWall(0, -1)).toBe(true);
      expect(map.isWall(28, 0)).toBe(true);
      expect(map.isWall(0, 31)).toBe(true);
    });

    it('returns false for passable tile', () => {
      // Row 1, col 1 should be a dot (passable)
      expect(map.isWall(1, 1)).toBe(false);
    });
  });

  describe('isDot', () => {
    it('returns true for initial dot tiles', () => {
      // Row 1, col 1 has a dot initially
      expect(map.isDot(1, 1)).toBe(true);
    });

    it('returns false after dot is eaten', () => {
      map.eatDot(1, 1);
      expect(map.isDot(1, 1)).toBe(false);
    });

    it('returns false for wall tile', () => {
      expect(map.isDot(0, 0)).toBe(false);
    });
  });

  describe('isPowerDot', () => {
    it('returns true at power dot positions', () => {
      // Row 3, col 1 has a power dot (value 3)
      expect(map.isPowerDot(1, 3)).toBe(true);
    });

    it('returns false after power dot is eaten', () => {
      map.eatDot(1, 3);
      expect(map.isPowerDot(1, 3)).toBe(false);
    });
  });

  describe('getRemainingDots', () => {
    it('starts with a positive dot count', () => {
      expect(map.getRemainingDots()).toBeGreaterThan(0);
    });

    it('decreases when a dot is eaten', () => {
      const before = map.getRemainingDots();
      map.eatDot(1, 1);
      expect(map.getRemainingDots()).toBe(before - 1);
    });

    it('does not decrease if no dot at position', () => {
      const before = map.getRemainingDots();
      map.eatDot(0, 0); // wall tile — no dot
      expect(map.getRemainingDots()).toBe(before);
    });
  });

  describe('reset', () => {
    it('restores eaten dots', () => {
      const total = map.getTotalDots();
      map.eatDot(1, 1);
      map.eatDot(1, 3);
      map.reset();
      expect(map.getRemainingDots()).toBe(total);
    });
  });

  describe('getPowerDotCount', () => {
    it('returns positive count initially', () => {
      expect(map.getPowerDotCount()).toBeGreaterThan(0);
    });

    it('decreases when a power dot is eaten', () => {
      const before = map.getPowerDotCount();
      map.eatDot(1, 3); // power dot position
      expect(map.getPowerDotCount()).toBe(before - 1);
    });

    it('returns 0 after all power dots are eaten', () => {
      // Eat all 4 power dot positions
      map.eatDot(1, 3);
      map.eatDot(26, 3);
      map.eatDot(1, 23);
      map.eatDot(26, 23);
      expect(map.getPowerDotCount()).toBe(0);
    });
  });

  describe('wrapCol', () => {
    it('wraps negative column to right side', () => {
      expect(map.wrapCol(-1)).toBe(27);
    });

    it('wraps column beyond max to 0', () => {
      expect(map.wrapCol(28)).toBe(0);
    });

    it('returns same column for valid range', () => {
      expect(map.wrapCol(14)).toBe(14);
    });
  });

  describe('getValidFruitPositions', () => {
    it('returns a non-empty list for the default stage', () => {
      const positions = map.getValidFruitPositions();
      expect(positions.length).toBeGreaterThan(0);
    });

    it('all returned positions are DOT tiles (not wall, not empty, not tunnel)', () => {
      const positions = map.getValidFruitPositions();
      for (const pos of positions) {
        expect(map.isWall(pos.x, pos.y)).toBe(false);
        expect(map.isTunnel(pos.x, pos.y)).toBe(false);
      }
    });

    it('does not include any wall positions', () => {
      const positions = map.getValidFruitPositions();
      const wallFound = positions.some(p => map.isWall(p.x, p.y));
      expect(wallFound).toBe(false);
    });
  });
});
