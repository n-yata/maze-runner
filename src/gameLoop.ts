import type { GameState } from './types.js';
import {
  INITIAL_LIVES, MAX_LEVEL, getLevelParams, COLORS, getFruitDef,
  ENDING_DURATION, ENDING_FADEOUT_DURATION, ENDING_RAMP_TIME, ENDING_BOARD_TIME, ENDING_LIFTOFF_TIME, ENDING_EARTH_TIME,
  ENDING_ROCKET_CX, ENDING_ROCKET_CY, MAP_OFFSET_Y,
  BOSS_READY_DURATION, BOSS_DEFEATED_DURATION, BOSS_PLAYER_HEARTS, BOSS_HIT_INVULN,
} from './constants.js';
import { ParticleSystem } from './particles.js';
import { LaserManager } from './laser.js';
import { BossManager } from './boss.js';
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
  private boss = new BossManager();
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
    // ボスのHP/弾は BossManager のメモリで完結させる。新規ゲーム/タイトル復帰のたびに
    // ここで初期化し、削ったHPを次プレイへ持ち越さない。ハート等は GameState 側で初期化する。
    this.boss.reset();
    return {
      phase: 'TITLE',
      score: 0,
      highScore: this.storage.getHighScore(),
      lives: INITIAL_LIVES,
      level: 1,
      partsCollected: 0,
      bossHearts: 0,
      bossInvuln: 0,
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
      // 全ステージクリア後は帰還エンディングへ直行せず、最終関門のボス戦へ。
      this.startBossStage();
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

  /** 最終関門のボス戦を開始する（BOSS_READY 導入へ）。level は3のまま、部品も3個のまま。 */
  private startBossStage(): void {
    this.state.phase = 'BOSS_READY';
    this.state.phaseTimer = 0;
    this.state.dotsEaten = 0;
    this.state.bossHearts = BOSS_PLAYER_HEARTS; // シューティング風のハート制体力
    this.state.bossInvuln = 0;
    this.map.resetBossArena();
    const params = getLevelParams(this.state.level);
    this.player.reset(params.playerSpeed);
    this.fruitMgr.reset();
    this.laser.reset();
    this.boss.reset();
    // ステージ3クリアで全敵 VANISHED 済みだが、ボス盤面でレーザーが空振りするよう明示的に不活性化する。
    for (const g of this.ghostMgr.ghosts) g.mode = 'VANISHED';
    this.lastPowerDotCount = -1;
    this.audio.play('GAME_START');
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

    this.renderer.render(this.state, this.map, this.player, this.ghostMgr, this.fruitMgr, this.particles, this.laser, this.boss);
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

      case 'BOSS_READY':
        this.state.phaseTimer += dt;
        if (this.state.phaseTimer >= BOSS_READY_DURATION) {
          this.state.phase = 'BOSS';
          this.state.phaseTimer = 0;
        }
        break;

      case 'BOSS':
        this.updateBoss(dt);
        break;

      case 'BOSS_DEFEATED':
        // 撃破演出の猶予。終了したら既存の帰還エンディング(ALL_CLEAR)へ接続する。
        this.state.phaseTimer += dt;
        if (this.state.phaseTimer >= BOSS_DEFEATED_DURATION) {
          this.state.phase = 'ALL_CLEAR';
          this.state.phaseTimer = 0;
          this.state.dotsEaten = 0;
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

  /**
   * ボス戦1フレーム（縦シューティング）。
   *  操作: 左右移動のみ（上下入力は無視）。攻撃: レーザーを常に上方向へ自動連射（フルーツ供給）。
   *  体力: ハート制（被弾でハート-1＋無敵時間。0でゲームオーバー）。リスポーンはしない。
   */
  private updateBoss(dt: number): void {
    // 左右入力のみ受け付ける（上下は無視＝シューティング風の横移動限定）
    const dir = this.input.consumeDirection();
    if (dir === 'LEFT' || dir === 'RIGHT') {
      this.player.setNextDir(dir);
    }

    this.player.update(dt, this.map, this.audio);
    this.state.score += this.player.score;
    this.player.resetScore();

    const ppos = this.player.getPixelPos();

    // フルーツ供給（ボス生存中は出し続けてレーザーが枯れないようにする＝詰み防止）
    const enemiesRemain = !this.boss.isDefeated;
    this.fruitMgr.updateSpawning(dt, enemiesRemain, this.state.level, this.map.getValidFruitPositions());
    const fruitsEaten = this.fruitMgr.update(dt, ppos);
    if (fruitsEaten > 0) {
      this.laser.activate();
      this.audio.play('EAT_FRUIT');
      this.particles.spawnBurst(ppos.x, ppos.y, getFruitDef(this.state.level).color, 16, 100);
    }

    // レーザーは常に上方向へ発射（横移動しながら上のボスを撃つ）。
    // 敵は全員 VANISHED なので defeatAt は空振り。ボスへのダメージは hitByBeams で別途処理。
    this.laser.update(dt, ppos, 'UP', this.map, this.ghostMgr);
    const dmg = this.boss.hitByBeams(this.laser.getBeams());
    if (dmg > 0) {
      const c = this.boss.centerPixel;
      this.particles.spawnBurst(c.x, c.y, '#FFFFFF', 6, 90);
      this.audio.play('EAT_GHOST');
    }

    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }

    // ボス本体の往復＋弾幕を進める
    this.boss.update(dt, ppos);

    // 被弾判定（ハート制）。無敵中は被弾しない。
    if (this.state.bossInvuln > 0) {
      this.state.bossInvuln = Math.max(0, this.state.bossInvuln - dt);
    }
    if (this.state.bossInvuln <= 0 && this.boss.checkPlayerHit(ppos, false)) {
      this.state.bossHearts--;
      this.state.bossInvuln = BOSS_HIT_INVULN;
      this.audio.play('DEATH');
      this.particles.spawnBurst(ppos.x, ppos.y, COLORS.SHIP_THRUSTER, 18, 110);
      if (this.state.bossHearts <= 0) {
        // ハートを使い切ったらゲームオーバー（リスポーンせず終了）
        this.storage.setHighScore(this.state.score);
        this.state.highScore = this.storage.getHighScore();
        this.state.phase = 'GAME_OVER';
        this.state.phaseTimer = 0;
        this.state.gameoverCanInput = false;
        return;
      }
    }

    // 撃破: HP0 で BOSS_DEFEATED へ。撃破スパーク＋ファンファーレ、ハイスコア確定。
    if (this.boss.isDefeated) {
      const c = this.boss.centerPixel;
      this.particles.spawnBurst(c.x, c.y, COLORS.SHIP_THRUSTER, 40, 170);
      this.boss.clearBullets();
      this.storage.setHighScore(this.state.score);
      this.state.highScore = this.storage.getHighScore();
      this.audio.play('FANFARE');
      this.state.phase = 'BOSS_DEFEATED';
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
