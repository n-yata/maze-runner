import type { GameState } from './types.js';
import {
  INITIAL_LIVES, MAX_LEVEL, getLevelParams, COLORS, getFruitDef,
  ENDING_DURATION, ENDING_FADEOUT_DURATION, ENDING_RAMP_TIME, ENDING_BOARD_TIME, ENDING_LIFTOFF_TIME, ENDING_EARTH_TIME,
  ENDING_ROCKET_CX, ENDING_ROCKET_CY, MAP_OFFSET_Y,
} from './constants.js';
import { ParticleSystem } from './particles.js';
import { LaserManager } from './laser.js';
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

const INTRO_DURATION       = 7.0;
const READY_DURATION       = 3.0;
const DEAD_DURATION        = 1.5;
const CLEAR_DURATION       = 2.0;
// 帰還シーン(ENDING_DURATION)＋暗転(ENDING_FADEOUT_DURATION)を終えてからタイトルへ戻る。
// renderer の drawEnding と段階境界を共有する。
const ALL_CLEAR_DURATION   = ENDING_DURATION + ENDING_FADEOUT_DURATION;
const GAMEOVER_INPUT_DELAY = 3.0;

export class GameLoop {
  private state: GameState;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private lastPowerDotCount = -1;
  private particles = new ParticleSystem();
  private laser = new LaserManager();
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
      partsCollected: 0,
      dotsEaten: 0,
      modeTimer: 0,
      modeIndex: 0,
      phaseTimer: 0,
      gameoverCanInput: false,
    };
  }

  private handleStart(): void {
    this.audio.resume();
    switch (this.state.phase) {
      case 'TITLE':
        this.startIntro();
        break;
      case 'INTRO':
        // オープニングは入力でスキップしてステージ1へ
        this.startNewGame();
        break;
      case 'ALL_CLEAR':
        this.state = this.createInitialState();
        break;
      case 'GAME_OVER':
        if (this.state.gameoverCanInput) {
          this.state = this.createInitialState();
          this.map.reset(1);
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

  private startIntro(): void {
    // 遭難の導入演出。スコア・残機を初期化し、フェーズだけ INTRO に差し替える（盤面は出さない）
    this.state = { ...this.createInitialState(), phase: 'INTRO' };
  }

  private startNewGame(): void {
    this.state = this.createInitialState();
    this.state.phase = 'READY';
    this.state.phaseTimer = 0;
    this.map.reset(1);
    const params = getLevelParams(1);
    this.player.reset(params.playerSpeed);
    this.player.resetScore();
    this.ghostMgr.reset(params);
    this.fruitMgr.reset();
    this.laser.reset();
    this.lastPowerDotCount = -1;
    this.audio.play('GAME_START');
  }

  private startNextLevel(): void {
    if (this.state.level >= MAX_LEVEL) {
      this.state.phase = 'ALL_CLEAR';
      this.state.phaseTimer = 0;
      this.state.dotsEaten = 0;
      return;
    }
    this.state.level++;
    this.state.phase = 'READY';
    this.state.dotsEaten = 0;
    this.state.phaseTimer = 0;
    this.map.reset(this.state.level);
    const params = getLevelParams(this.state.level);
    this.player.reset(params.playerSpeed);
    this.ghostMgr.reset(params);
    this.fruitMgr.reset();
    this.laser.reset();
    this.lastPowerDotCount = -1;
  }

  private respawnPlayer(): void {
    this.state.phase = 'READY';
    this.state.phaseTimer = 0;
    const params = getLevelParams(this.state.level);
    this.player.reset(params.playerSpeed);
    this.ghostMgr.reset(params);
    this.fruitMgr.reset();
    this.laser.reset();
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

    this.renderer.render(this.state, this.map, this.player, this.ghostMgr, this.fruitMgr, this.particles, this.laser);
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  private update(dt: number): void {
    this.particles.update(dt); // パーティクルは全フェーズで進行（スパークの余韻）

    switch (this.state.phase) {
      case 'TITLE':
        this.state.phaseTimer += dt; // タイトル演出（ロゴ登場・飛行士浮遊）の駆動
        break;

      case 'INTRO':
        this.state.phaseTimer += dt;
        if (this.state.phaseTimer >= INTRO_DURATION) {
          this.startNewGame();
        }
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

      case 'ALL_CLEAR': {
        const before = this.state.phaseTimer;
        this.state.phaseTimer += dt;
        this.fireEndingCues(before, this.state.phaseTimer);
        if (this.state.phaseTimer >= ALL_CLEAR_DURATION) {
          this.state = this.createInitialState();
        }
        break;
      }

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

    const remainingBefore = this.map.getRemainingDots();
    const powerBefore = this.map.getPowerDotCount();

    this.player.update(dt, this.map, this.audio);
    this.state.score += this.player.score;
    this.player.resetScore();

    // 取得スパーク（パワーエサ＞通常ドット）
    const ppos = this.player.getPixelPos();
    if (this.map.getPowerDotCount() < powerBefore) {
      this.particles.spawnBurst(ppos.x, ppos.y, COLORS.POWER_DOT, 14, 90);
    } else if (this.map.getRemainingDots() < remainingBefore) {
      this.particles.spawnBurst(ppos.x, ppos.y, COLORS.DOT, 5, 45);
    }

    this.state.dotsEaten = this.map.getTotalDots() - this.map.getRemainingDots();

    if (this.didEatPowerDot()) {
      // パワーエサ取得でプレイヤーに電磁バリアを付与（再取得でタイマー上書き延長）
      this.player.activateBarrier(getLevelParams(this.state.level).barrierDuration);
    }

    const ghostScore = this.ghostMgr.update(
      dt, this.map, this.player, this.audio, this.state.dotsEaten,
      (pos) => this.particles.spawnBurst(pos.x, pos.y, '#FFFFFF', 18, 110), // 撃破スパークは敵の位置で
    );
    this.state.score += ghostScore;

    // フルーツ＝レーザー発動アイテム。敵が残る限り繰り返し出現させる（詰み防止）。
    // getValidFruitPositions() はマップ固定のキャッシュ参照（O(1)）
    const enemiesRemain = !this.ghostMgr.allDefeated();
    this.fruitMgr.updateSpawning(dt, enemiesRemain, this.state.level, this.map.getValidFruitPositions());
    const fruitsEaten = this.fruitMgr.update(dt, this.player.getPixelPos());
    if (fruitsEaten > 0) {
      this.laser.activate();
      this.audio.play('EAT_FRUIT');
      this.particles.spawnBurst(ppos.x, ppos.y, getFruitDef(this.state.level).color, 16, 100);
    }

    // レーザー（進行方向へ自動連射）。敵ヒットで撃破＝スコア加算。
    const laserScore = this.laser.update(
      dt, this.player.getPixelPos(), this.player.state.dir, this.map, this.ghostMgr,
      (pos) => this.particles.spawnBurst(pos.x, pos.y, '#FF4D5E', 18, 110), // レーザー撃破スパークは敵の位置で
    );
    if (laserScore > 0) {
      this.state.score += laserScore;
      this.audio.play('EAT_GHOST');
    }

    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }

    if (this.player.state.isDead) {
      this.state.phase = 'PLAYER_DEAD';
      this.state.phaseTimer = 0;
      return;
    }

    // クリア条件: 敵を全滅させる（通常エサの取得状況は問わない）
    if (this.ghostMgr.allDefeated()) {
      // ステージクリアで宇宙船の部品を1個回収（PLAYING→STAGE_CLEAR遷移時の1回のみ発火）
      this.state.partsCollected++;
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

  /** 区間 [before, after) が境界 t をまたいだか（半開区間で同一境界の二重発火を防ぐ）。 */
  private crossed(before: number, after: number, t: number): boolean {
    return before < t && after >= t;
  }

  /**
   * エンディングの段階境界をまたいだ瞬間に、音とパーティクルを1回ずつ発火する。
   * パーティクルは盤面ローカル座標系（描画側で MAP_OFFSET_Y を加算）なので、
   * canvas 座標の噴射原点から MAP_OFFSET_Y を引いて渡す。
   */
  private fireEndingCues(before: number, after: number): void {
    const px = ENDING_ROCKET_CX;
    const py = ENDING_ROCKET_CY - MAP_OFFSET_Y;

    if (this.crossed(before, after, ENDING_RAMP_TIME)) {
      // 段階B→C ハッチ開放: 機械的な開閉音（乗船開始の合図）
      this.audio.play('HATCH');
    }
    if (this.crossed(before, after, ENDING_BOARD_TIME)) {
      // 段階C→D 乗船完了: 搭乗確定音＋機体まわりの青緑スパーク
      this.audio.play('REPAIR_DONE');
      this.particles.spawnBurst(px, py - 60, COLORS.PLAYER, 16, 70);
    }
    if (this.crossed(before, after, ENDING_LIFTOFF_TIME)) {
      // 段階D→E 発進: 轟音＋噴射口からのオレンジ大量バースト（噴煙）
      this.audio.play('LIFTOFF');
      this.particles.spawnBurst(px, py, COLORS.SHIP_THRUSTER, 48, 170);
    }
    if (this.crossed(before, after, ENDING_EARTH_TIME)) {
      // 段階F→G 帰還: 青い地球が見えてくるファンファーレ
      this.audio.play('FANFARE');
    }
  }
}
