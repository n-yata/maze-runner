import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameLoop } from '../../src/gameLoop.js';
import { MapManager } from '../../src/map.js';
import { PlayerManager } from '../../src/player.js';
import { GhostManager } from '../../src/ghost.js';
import { FruitManager } from '../../src/fruit.js';
import { InputManager } from '../../src/input.js';
import { AudioManager } from '../../src/audio.js';
import { StorageManager } from '../../src/storage.js';

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

  it('transitions TITLE → READY on start input', () => {
    const { loop, audio } = makeGameLoop();
    audio.resume = vi.fn();
    // Simulate onStart callback
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

  it('transitions PLAYING → STAGE_CLEAR when all dots eaten', () => {
    const { loop, map } = makeGameLoop();
    state(loop).phase = 'PLAYING';

    // Eat all dots
    for (let col = 0; col < 28; col++) {
      for (let row = 0; row < 31; row++) {
        map.eatDot(col, row);
      }
    }

    tickFor(loop, 1 / 60); // one frame triggers the check
    expect(state(loop).phase).toBe('STAGE_CLEAR');
  });

  it('STAGE_CLEAR → READY increments level', () => {
    const { loop } = makeGameLoop();
    state(loop).phase = 'STAGE_CLEAR';
    state(loop).phaseTimer = 0;
    state(loop).level = 3;
    tickFor(loop, 2.1);
    expect(state(loop).phase).toBe('READY');
    expect(state(loop).level).toBe(4);
  });
});
