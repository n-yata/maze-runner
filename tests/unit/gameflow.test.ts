import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameLoop } from '../../src/gameLoop.js';
import { MapManager } from '../../src/map.js';
import { PlayerManager } from '../../src/player.js';
import { GhostManager } from '../../src/ghost.js';
import { FruitManager } from '../../src/fruit.js';
import { InputManager } from '../../src/input.js';
import { AudioManager } from '../../src/audio.js';
import { StorageManager } from '../../src/storage.js';
import { COLS, ROWS } from '../../src/constants.js';

// Minimal Renderer stub that satisfies the type without touching Canvas
class StubRenderer {
  render = vi.fn();
}

function makeGameLoop() {
  const map = new MapManager();
  const player = new PlayerManager();
  const ghosts = new GhostManager();
  const renderer = new StubRenderer() as unknown as import('../../src/renderer.js').Renderer;
  const input = new InputManager();
  const audio = {
    resume: vi.fn(), play: vi.fn(), setMuted: vi.fn(), isMuted: vi.fn(),
  } as unknown as AudioManager;
  const storage = new StorageManager();
  const fruitMgr = new FruitManager();

  const loop = new GameLoop(map, player, ghosts, renderer, input, audio, storage, fruitMgr);
  return { loop, map, player, ghosts, input, audio, storage };
}

// Access private state for testing via type assertion
function state(loop: GameLoop): import('../../src/types.js').GameState {
  return (loop as unknown as { state: import('../../src/types.js').GameState }).state;
}

// Manually trigger the update loop for N seconds
function tickFor(loop: GameLoop, seconds: number, dt = 1 / 60): void {
  const steps = Math.ceil(seconds / dt);
  const update = (loop as unknown as { update: (dt: number) => void }).update.bind(loop);
  for (let i = 0; i < steps; i++) {
    update(dt);
  }
}

describe('GameLoop – phase transitions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts in TITLE phase', () => {
    const { loop } = makeGameLoop();
    expect(state(loop).phase).toBe('TITLE');
  });

  it('transitions TITLE → INTRO on start input (opening before stage 1)', () => {
    const { loop, audio } = makeGameLoop();
    audio.resume = vi.fn();
    // Simulate onStart callback
    const onStart = (loop as unknown as { handleStart: () => void }).handleStart.bind(loop);
    onStart();
    expect(state(loop).phase).toBe('INTRO');
  });

  it('INTRO → READY automatically after INTRO_DURATION (7s)', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'INTRO';
    state(loop).phaseTimer = 0;
    tickFor(loop, 7.1);
    expect(state(loop).phase).toBe('READY');
  });

  it('stays in INTRO before INTRO_DURATION', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'INTRO';
    state(loop).phaseTimer = 0;
    tickFor(loop, 5.0);
    expect(state(loop).phase).toBe('INTRO');
  });

  it('INTRO → READY immediately on input (skip opening)', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'INTRO';
    const onStart = (loop as unknown as { handleStart: () => void }).handleStart.bind(loop);
    onStart();
    expect(state(loop).phase).toBe('READY');
  });

  it('transitions READY → PLAYING after 3 seconds', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'READY';
    state(loop).phaseTimer = 0;
    tickFor(loop, 3.1);
    expect(state(loop).phase).toBe('PLAYING');
  });

  it('stays in READY before 3 seconds', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'READY';
    state(loop).phaseTimer = 0;
    tickFor(loop, 2.0);
    expect(state(loop).phase).toBe('READY');
  });

  it('transitions PLAYING → PAUSED on ESC', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'PLAYING';
    const onPause = (loop as unknown as { handlePause: () => void }).handlePause.bind(loop);
    onPause();
    expect(state(loop).phase).toBe('PAUSED');
  });

  it('transitions PAUSED → PLAYING on ESC again', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'PAUSED';
    const onPause = (loop as unknown as { handlePause: () => void }).handlePause.bind(loop);
    onPause();
    expect(state(loop).phase).toBe('PLAYING');
  });

  it('transitions PLAYING → PLAYER_DEAD when player dies', () => {
    const { loop, player } = makeGameLoop();
    state(loop).phase = 'PLAYING';
    player.die();
    tickFor(loop, 1 / 60); // one frame
    expect(state(loop).phase).toBe('PLAYER_DEAD');
  });

  it('transitions PLAYER_DEAD → READY after 1.5s when lives remain', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'PLAYER_DEAD';
    state(loop).phaseTimer = 0;
    state(loop).lives = 2;
    tickFor(loop, 1.6);
    expect(state(loop).phase).toBe('READY');
    expect(state(loop).lives).toBe(1);
  });

  it('transitions PLAYER_DEAD → GAME_OVER after 1.5s when no lives remain', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'PLAYER_DEAD';
    state(loop).phaseTimer = 0;
    state(loop).lives = 1;
    tickFor(loop, 1.6);
    expect(state(loop).phase).toBe('GAME_OVER');
    expect(state(loop).lives).toBe(0);
  });

  it('GAME_OVER: gameoverCanInput is false initially', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'GAME_OVER';
    state(loop).phaseTimer = 0;
    state(loop).gameoverCanInput = false;
    tickFor(loop, 1.0);
    expect(state(loop).gameoverCanInput).toBe(false);
  });

  it('GAME_OVER: gameoverCanInput becomes true after 3 seconds', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'GAME_OVER';
    state(loop).phaseTimer = 0;
    state(loop).gameoverCanInput = false;
    tickFor(loop, 3.1);
    expect(state(loop).gameoverCanInput).toBe(true);
  });

  it('transitions GAME_OVER → TITLE on input after delay', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'GAME_OVER';
    state(loop).gameoverCanInput = true;
    const onStart = (loop as unknown as { handleStart: () => void }).handleStart.bind(loop);
    onStart();
    expect(state(loop).phase).toBe('TITLE');
  });

  it('stays in GAME_OVER on input before delay expires', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'GAME_OVER';
    state(loop).gameoverCanInput = false;
    const onStart = (loop as unknown as { handleStart: () => void }).handleStart.bind(loop);
    onStart();
    expect(state(loop).phase).toBe('GAME_OVER');
  });

  it('transitions STAGE_CLEAR → READY (next level) after 2 seconds', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'STAGE_CLEAR';
    state(loop).phaseTimer = 0;
    state(loop).level = 1;
    tickFor(loop, 2.1);
    expect(state(loop).phase).toBe('READY');
    expect(state(loop).level).toBe(2);
  });

  it('paused phase does not advance phaseTimer', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'PAUSED';
    state(loop).phaseTimer = 0;
    tickFor(loop, 5.0);
    expect(state(loop).phaseTimer).toBe(0);
  });

  it('transitions PLAYING → STAGE_CLEAR when all enemies are defeated', () => {
    const { loop, ghosts } = makeGameLoop();
    state(loop).phase = 'PLAYING';

    // Defeat every enemy
    for (const g of ghosts.ghosts) g.mode = 'VANISHED';

    tickFor(loop, 1 / 60); // one frame triggers the check
    expect(state(loop).phase).toBe('STAGE_CLEAR');
  });

  it('does NOT clear the stage merely by eating all dots (enemies still alive)', () => {
    const { loop, map } = makeGameLoop();
    state(loop).phase = 'PLAYING';

    // Eat all dots — clear condition is enemy defeat, not dot collection
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        map.eatDot(col, row);
      }
    }

    tickFor(loop, 1 / 60);
    expect(state(loop).phase).toBe('PLAYING');
  });

  it('STAGE_CLEAR → READY increments level (within MAX_LEVEL)', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'STAGE_CLEAR';
    state(loop).phaseTimer = 0;
    state(loop).level = 1;
    tickFor(loop, 2.1);
    expect(state(loop).phase).toBe('READY');
    expect(state(loop).level).toBe(2);
  });

  it('STAGE_CLEAR → ALL_CLEAR when final level cleared', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'STAGE_CLEAR';
    state(loop).phaseTimer = 0;
    state(loop).level = 3;
    tickFor(loop, 2.1);
    expect(state(loop).phase).toBe('ALL_CLEAR');
    expect(state(loop).level).toBe(3);
  });

  it('ALL_CLEAR → TITLE after 5 seconds', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'ALL_CLEAR';
    state(loop).phaseTimer = 0;
    tickFor(loop, 5.1);
    expect(state(loop).phase).toBe('TITLE');
  });
});

describe('GameLoop – story parts collection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts a new game with 0 parts collected', () => {
    const { loop } = makeGameLoop();
    expect(state(loop).partsCollected).toBe(0);
  });

  it('collects 1 part when a stage is cleared (all enemies defeated)', () => {
    const { loop, ghosts } = makeGameLoop();
    state(loop).phase = 'PLAYING';
    state(loop).partsCollected = 0;

    for (const g of ghosts.ghosts) g.mode = 'VANISHED';
    tickFor(loop, 1 / 60); // one frame triggers the clear check

    expect(state(loop).phase).toBe('STAGE_CLEAR');
    expect(state(loop).partsCollected).toBe(1);
  });

  it('collects all parts after clearing every stage', () => {
    const { loop, ghosts } = makeGameLoop();

    // Clear stage 1, 2, 3 in sequence
    for (let level = 1; level <= 3; level++) {
      state(loop).phase = 'PLAYING';
      state(loop).level = level;
      for (const g of ghosts.ghosts) g.mode = 'VANISHED';
      tickFor(loop, 1 / 60); // PLAYING → STAGE_CLEAR (+1 part)
      expect(state(loop).partsCollected).toBe(level);
      tickFor(loop, 2.1); // STAGE_CLEAR → next level / ALL_CLEAR
    }

    expect(state(loop).partsCollected).toBe(3);
    expect(state(loop).phase).toBe('ALL_CLEAR');
  });

  it('resets parts to 0 when returning to TITLE after the ending', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'ALL_CLEAR';
    state(loop).phaseTimer = 0;
    state(loop).partsCollected = 3;
    tickFor(loop, 5.1); // ALL_CLEAR → TITLE (createInitialState)
    expect(state(loop).phase).toBe('TITLE');
    expect(state(loop).partsCollected).toBe(0);
  });

  it('resets parts to 0 when restarting after GAME_OVER', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'GAME_OVER';
    state(loop).gameoverCanInput = true;
    state(loop).partsCollected = 2;
    const onStart = (loop as unknown as { handleStart: () => void }).handleStart.bind(loop);
    onStart(); // GAME_OVER → TITLE (createInitialState)
    expect(state(loop).partsCollected).toBe(0);
  });

  it('starts the opening with 0 parts after restarting from GAME_OVER then starting again', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'GAME_OVER';
    state(loop).gameoverCanInput = true;
    state(loop).partsCollected = 3;
    const onStart = (loop as unknown as { handleStart: () => void }).handleStart.bind(loop);
    onStart(); // → TITLE
    onStart(); // TITLE → INTRO
    expect(state(loop).phase).toBe('INTRO');
    expect(state(loop).partsCollected).toBe(0);
  });
});
