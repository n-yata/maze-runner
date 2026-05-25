import type { GameState } from './types.js';
import { INITIAL_LIVES, getLevelParams } from './constants.js';
import type { MapManager } from './map.js';
import type { PlayerManager } from './player.js';
import type { GhostManager } from './ghost.js';
import type { FruitManager } from './fruit.js';
import type { Renderer } from './renderer.js';
import type { InputManager } from './input.js';
import type { AudioManager } from './audio.js';
import type { StorageManager } from './storage.js';

const FIXED_TIMESTEP = 1 / 60;
const MAX_ACCUMULATED = 0.2;

const READY_DURATION    = 3.0;
const DEAD_DURATION     = 1.5;
const CLEAR_DURATION    = 2.0;
const GAMEOVER_INPUT_DELAY = 3.0;

export class GameLoop {
  private state: GameState;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private lastPowerDotCount = -1;
  private readonly boundLoop: FrameRequestCallback;

  constructor(
    private map: MapManager,
    private player: PlayerManager,
    private ghostMgr: GhostManager,
    private renderer: Renderer,
    private input: InputManager,
    private audio: AudioManager,
    private storage: StorageManager,
    private fruitMgr: FruitManager,
  ) {
    this.state = this.createInitialState();
    this.input.onStart(() => this.handleStart());
    this.input.onPause(() => this.handlePause());
    this.boundLoop = this.loop.bind(this);
  }

  private createInitialState(): GameState {
    return {
      phase: 'TITLE',
      score: 0,
      highScore: this.storage.getHighScore(),
      lives: INITIAL_LIVES,
      level: 1,
      dotsEaten: 0,
      modeTimer: 0,
      modeIndex: 0,
      ghostsEatenInFrightened: 0,
      phaseTimer: 0,
      gameoverCanInput: false,
    };
  }

  private handleStart(): void {
    this.audio.resume();
    switch (this.state.phase) {
      case 'TITLE':
        this.startNewGame();
        break;
      case 'GAME_OVER':
        if (this.state.gameoverCanInput) {
          this.state = this.createInitialState();
          this.map.reset();
          // player/ghost のリセットは startNewGame() 経由で getLevelParams(1) と共に行う
        }
        break;
    }
  }

  private handlePause(): void {
    if (this.state.phase === 'PLAYING') {
      this.state.phase = 'PAUSED';
      this.state.phaseTimer = 0;
    } else if (this.state.phase === 'PAUSED') {
      this.state.phase = 'PLAYING';
    }
  }

  private startNewGame(): void {
    this.state = this.createInitialState();
    this.state.phase = 'READY';
    this.state.phaseTimer = 0;
    this.map.reset();
    const params = getLevelParams(1);
    this.player.reset(params.playerSpeed);
    this.player.resetScore();
    this.ghostMgr.reset(params);
    this.fruitMgr.reset();
    this.lastPowerDotCount = -1;
    this.audio.play('GAME_START');
  }

  private startNextLevel(): void {
    this.state.phase = 'READY';
    this.state.level++;
    this.state.dotsEaten = 0;
    this.state.phaseTimer = 0;
    this.map.reset();
    const params = getLevelParams(this.state.level);
    this.player.reset(params.playerSpeed);
    this.ghostMgr.reset(params);
    this.fruitMgr.reset();
    this.lastPowerDotCount = -1;
  }

  private respawnPlayer(): void {
    this.state.phase = 'READY';
    this.state.phaseTimer = 0;
    const params = getLevelParams(this.state.level);
    this.player.reset(params.playerSpeed);
    this.ghostMgr.reset(params);
    this.lastPowerDotCount = -1;
  }

  start(): void {
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private loop(timestamp: number): void {
    const delta = Math.min((timestamp - this.lastTime) / 1000, MAX_ACCUMULATED);
    this.lastTime = timestamp;

    this.accumulator += delta;
    while (this.accumulator >= FIXED_TIMESTEP) {
      this.update(FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.renderer.render(this.state, this.map, this.player, this.ghostMgr, this.fruitMgr);
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  private update(dt: number): void {
    switch (this.state.phase) {
      case 'TITLE':
        break;

      case 'READY':
        this.state.phaseTimer += dt;
        if (this.state.phaseTimer >= READY_DURATION) {
          this.state.phase = 'PLAYING';
          this.state.phaseTimer = 0;
        }
        break;

      case 'PLAYING':
        this.updatePlaying(dt);
        break;

      case 'PAUSED':
        break;

      case 'PLAYER_DEAD':
        this.state.phaseTimer += dt;
        if (this.state.phaseTimer >= DEAD_DURATION) {
          this.state.lives--;
          if (this.state.lives > 0) {
            this.respawnPlayer();
          } else {
            this.storage.setHighScore(this.state.score);
            this.state.highScore = this.storage.getHighScore();
            this.state.phase = 'GAME_OVER';
            this.state.phaseTimer = 0;
            this.state.gameoverCanInput = false;
          }
        }
        break;

      case 'STAGE_CLEAR':
        this.state.phaseTimer += dt;
        if (this.state.phaseTimer >= CLEAR_DURATION) {
          this.startNextLevel();
        }
        break;

      case 'GAME_OVER':
        this.state.phaseTimer += dt;
        if (!this.state.gameoverCanInput && this.state.phaseTimer >= GAMEOVER_INPUT_DELAY) {
          this.state.gameoverCanInput = true;
        }
        break;
    }
  }

  private updatePlaying(dt: number): void {
    const dir = this.input.consumeDirection();
    this.player.setNextDir(dir);

    this.player.update(dt, this.map, this.audio);
    this.state.score += this.player.score;
    this.player.resetScore();

    this.state.dotsEaten = this.map.getTotalDots() - this.map.getRemainingDots();

    if (this.didEatPowerDot()) {
      this.ghostMgr.triggerFrightened();
    }

    const ghostScore = this.ghostMgr.update(dt, this.map, this.player, this.audio, this.state.dotsEaten);
    this.state.score += ghostScore;

    this.fruitMgr.checkSpawn(this.state.dotsEaten, this.state.level);
    const fruitScore = this.fruitMgr.update(dt, this.player.getPixelPos());
    if (fruitScore > 0) {
      this.state.score += fruitScore;
      this.audio.play('EAT_FRUIT');
    }

    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }

    if (this.player.state.isDead) {
      this.state.phase = 'PLAYER_DEAD';
      this.state.phaseTimer = 0;
      return;
    }

    if (this.map.getRemainingDots() === 0) {
      this.storage.setHighScore(this.state.score);
      this.state.highScore = this.storage.getHighScore();
      this.state.phase = 'STAGE_CLEAR';
      this.state.phaseTimer = 0;
    }
  }

  private didEatPowerDot(): boolean {
    const powerCount = this.map.getPowerDotCount();
    const ate = this.lastPowerDotCount > 0 && powerCount < this.lastPowerDotCount;
    this.lastPowerDotCount = powerCount;
    return ate;
  }
}
