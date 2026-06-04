import { describe, it, expect, beforeEach } from 'vitest';
import { LaserManager } from '../../src/laser.js';
import { MapManager } from '../../src/map.js';
import { GhostManager } from '../../src/ghost.js';
import { PlayerManager } from '../../src/player.js';
import { LASER_DURATION } from '../../src/constants.js';

const DT = 1 / 60;

describe('LaserManager', () => {
  let laser: LaserManager;
  let map: MapManager;
  let ghosts: GhostManager;
  let player: PlayerManager;

  beforeEach(() => {
    laser = new LaserManager();
    map = new MapManager();
    ghosts = new GhostManager();
    player = new PlayerManager();
  });

  it('is inactive until activated', () => {
    expect(laser.active).toBe(false);
  });

  it('activate() turns laser mode on', () => {
    laser.activate();
    expect(laser.active).toBe(true);
  });

  it('reset() turns laser mode off and clears beams', () => {
    laser.activate();
    laser.update(DT, player.getPixelPos(), 'UP', map, ghosts);
    laser.reset();
    expect(laser.active).toBe(false);
    expect(laser.getBeams()).toHaveLength(0);
  });

  it('fires a beam in the player direction while active', () => {
    laser.activate();
    laser.update(DT, player.getPixelPos(), 'UP', map, ghosts);
    expect(laser.getBeams().length).toBeGreaterThan(0);
  });

  it('activate() refreshes (overwrites) the mode timer rather than stacking', () => {
    laser.activate();
    const ppos = player.getPixelPos();
    // Consume most of the duration
    const steps = Math.ceil((LASER_DURATION - 0.5) / DT);
    for (let i = 0; i < steps; i++) {
      laser.update(DT, ppos, 'UP', map, ghosts);
    }
    expect(laser.active).toBe(true);

    // Re-activate: timer is refreshed to full duration
    laser.activate();
    // Run for longer than the remaining 0.5s but less than full duration — still active
    const partial = Math.ceil((LASER_DURATION - 1.0) / DT);
    for (let i = 0; i < partial; i++) {
      laser.update(DT, ppos, 'UP', map, ghosts);
    }
    expect(laser.active).toBe(true);
  });

  it('does not fire when player direction is NONE', () => {
    laser.activate();
    laser.update(DT, player.getPixelPos(), 'NONE', map, ghosts);
    expect(laser.getBeams()).toHaveLength(0);
  });

  it('beam defeats a ghost in its path and returns its score', () => {
    laser.activate();
    const ppos = player.getPixelPos();

    // Place a ghost just above the player along the central corridor (col 7)
    const blinky = ghosts.ghosts.find(g => g.name === 'BLINKY')!;
    blinky.mode = 'CHASE';
    blinky.pixelPos = { x: ppos.x, y: ppos.y - 6 };
    blinky.pos = { x: Math.floor(ppos.x / 24), y: Math.floor((ppos.y - 6) / 24) };

    const score = laser.update(DT, ppos, 'UP', map, ghosts);

    expect(blinky.mode).toBe('VANISHED');
    expect(score).toBeGreaterThan(0);
  });

  it('becomes inactive and stops firing after LASER_DURATION', () => {
    laser.activate();
    const ppos = player.getPixelPos();

    // Advance beyond the laser duration
    const steps = Math.ceil((LASER_DURATION + 1) / DT);
    for (let i = 0; i < steps; i++) {
      laser.update(DT, ppos, 'UP', map, ghosts);
    }
    expect(laser.active).toBe(false);

    // No new beams once inactive: run a few more frames and expect none alive
    for (let i = 0; i < 60; i++) {
      laser.update(DT, ppos, 'UP', map, ghosts);
    }
    expect(laser.getBeams()).toHaveLength(0);
  });

  it('beam disappears when it hits a wall (outer border)', () => {
    laser.activate();
    // Fire upward from a tile just below the top border so the beam quickly hits row 0 wall
    const startX = 7 * 24 + 12;
    const startY = 1 * 24 + 12; // row 1 (row 0 is the border wall)
    laser.update(DT, { x: startX, y: startY }, 'UP', map, ghosts);
    expect(laser.getBeams().length).toBeGreaterThan(0);

    // Advance until the beam reaches the wall and is removed (dir NONE = no new beams)
    for (let i = 0; i < 30; i++) {
      laser.update(DT, { x: startX, y: startY }, 'NONE', map, ghosts);
    }
    // With dir NONE no new beams spawn; the original beam should have hit the wall
    expect(laser.getBeams()).toHaveLength(0);
  });
});
