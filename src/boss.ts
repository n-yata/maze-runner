import type { Vec2 } from './types.js';
import type { Beam } from './laser.js';
import {
  TILE_SIZE, COLS, ROWS,
  BOSS_MAX_HP, BOSS_HIT_DAMAGE, BOSS_BODY_RADIUS,
  BOSS_CENTER_Y, BOSS_SWAY_SPEED, BOSS_SWAY_RANGE,
  BOSS_BULLET_SPEED, BOSS_BULLET_RADIUS,
  BOSS_FIRE_INTERVAL, BOSS_SPREAD_COUNT, BOSS_SPREAD_ARC,
  BOSS_AIMED_INTERVAL, BOSS_MAX_BULLETS,
} from './constants.js';

export interface BossBullet {
  active: boolean;
  x: number;  // 盤面ローカル座標(px)。laser/particle と同じ系（描画側で MAP_OFFSET_Y を加算）
  y: number;
  vx: number; // px/秒（update で dt を乗算）
  vy: number;
}

// 本体往復の中心X（盤面中央）。
const BOSS_CENTER_X = (COLS * TILE_SIZE) / 2;
// プレイヤーの被弾半径（弾との当たり判定に使う近似）。
const PLAYER_HIT_RADIUS = TILE_SIZE / 2;

/**
 * ボス戦の統括クラス。HP・弾幕（固定長プール）・被弾判定を1クラスに凝集する。
 * 既存 `LaserManager` のプール思想に倣い、毎フレームの new を避けて GC スパイクを防ぐ。
 * 弾幕は乱数を使わず、タイマー駆動の決定論で生成する（テスト容易・フレーム変動に強い）。
 * 座標系は盤面ローカル（px）に統一し、描画側で `MAP_OFFSET_Y` を加算する。
 */
export class BossManager {
  readonly maxHp = BOSS_MAX_HP;
  private _hp = BOSS_MAX_HP;
  private swayPhase = 0;
  private fireTimer = BOSS_FIRE_INTERVAL;
  private aimedTimer = BOSS_AIMED_INTERVAL;
  private bullets: BossBullet[] = [];

  constructor() {
    for (let i = 0; i < BOSS_MAX_BULLETS; i++) {
      this.bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
    }
    this.reset();
  }

  get hp(): number {
    return this._hp;
  }

  get isDefeated(): boolean {
    return this._hp <= 0;
  }

  /** 本体中心（盤面ローカル, px）。被弾原点・HP UI・描画位置の基準。 */
  get centerPixel(): Vec2 {
    return {
      x: BOSS_CENTER_X + Math.sin(this.swayPhase) * BOSS_SWAY_RANGE,
      y: BOSS_CENTER_Y,
    };
  }

  /** HP残量比 0..1（HPバー描画用）。 */
  getHpRatio(): number {
    return Math.max(0, this._hp) / this.maxHp;
  }

  /** ステージ突入時のフルリセット（HP満タン・弾全消去・往復/発射タイマー初期化）。 */
  reset(): void {
    this._hp = BOSS_MAX_HP;
    this.swayPhase = 0;
    this.fireTimer = BOSS_FIRE_INTERVAL;
    this.aimedTimer = BOSS_AIMED_INTERVAL;
    this.clearBullets();
  }

  /** 盤面上の弾だけを一掃する（リスポーン直後の即死を防ぐ。HPは保持）。 */
  clearBullets(): void {
    for (const b of this.bullets) b.active = false;
  }

  /** 描画用: 生存中の弾一覧。 */
  getBullets(): BossBullet[] {
    return this.bullets.filter(b => b.active);
  }

  private spawnBullet(x: number, y: number, angle: number): void {
    const b = this.bullets.find(bm => !bm.active);
    if (!b) return; // プール枯渇時は発射スキップ（throw しない）
    const speed = BOSS_BULLET_SPEED * TILE_SIZE;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
  }

  /** 下方向中心の扇状ばら撒き（位置取りで避ける基本攻撃）。 */
  private fireSpread(): void {
    const c = this.centerPixel;
    const base = Math.PI / 2; // 真下（+y）
    const start = base - BOSS_SPREAD_ARC / 2;
    const step = BOSS_SPREAD_COUNT > 1 ? BOSS_SPREAD_ARC / (BOSS_SPREAD_COUNT - 1) : 0;
    for (let i = 0; i < BOSS_SPREAD_COUNT; i++) {
      this.spawnBullet(c.x, c.y, start + step * i);
    }
  }

  /** プレイヤー方向への狙い撃ち（棒立ちを許さない圧）。 */
  private fireAimed(playerPixelPos: Vec2): void {
    const c = this.centerPixel;
    const angle = Math.atan2(playerPixelPos.y - c.y, playerPixelPos.x - c.x);
    this.spawnBullet(c.x, c.y, angle);
  }

  /**
   * ボス戦1フレーム: 本体の左右往復、ばら撒き＋狙い撃ちの2系統発射、全弾前進、場外消滅。
   * 撃破後は発射を止めるが、既存の弾は前進を続ける。
   */
  update(dt: number, playerPixelPos: Vec2): void {
    this.swayPhase += BOSS_SWAY_SPEED * dt;

    if (!this.isDefeated) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireSpread();
        this.fireTimer += BOSS_FIRE_INTERVAL;
      }
      this.aimedTimer -= dt;
      if (this.aimedTimer <= 0) {
        this.fireAimed(playerPixelPos);
        this.aimedTimer += BOSS_AIMED_INTERVAL;
      }
    }

    const maxX = COLS * TILE_SIZE;
    const maxY = ROWS * TILE_SIZE;
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 0 || b.x > maxX || b.y < 0 || b.y > maxY) {
        b.active = false;
      }
    }
  }

  /**
   * レーザービームのうち本体円内に当たったものでHPを減算する。
   * 命中ビームは消費（active=false）して貫通＝二重ダメージを防ぐ（1ビーム1ヒット）。
   * HPは0未満にクランプする。実際に与えたダメージ合計を返す。
   */
  hitByBeams(beams: Beam[]): number {
    if (this._hp <= 0) return 0;
    const c = this.centerPixel;
    const r2 = BOSS_BODY_RADIUS * BOSS_BODY_RADIUS;
    let damage = 0;
    for (const b of beams) {
      if (!b.active) continue;
      if (this._hp <= 0) break;
      const dx = b.x - c.x;
      const dy = b.y - c.y;
      if (dx * dx + dy * dy <= r2) {
        b.active = false;
        const applied = Math.min(BOSS_HIT_DAMAGE, this._hp);
        this._hp -= applied;
        damage += applied;
      }
    }
    return damage;
  }

  /**
   * ボス弾とプレイヤーの当たり判定。当たった弾は消費する。
   * バリア展開中は被弾しても弾くだけでミスにしない（盾）。
   * バリアなしで命中したら true（=ミス）を返す。
   */
  checkPlayerHit(playerPixelPos: Vec2, hasBarrier: boolean): boolean {
    const rr = BOSS_BULLET_RADIUS + PLAYER_HIT_RADIUS;
    const rr2 = rr * rr;
    for (const b of this.bullets) {
      if (!b.active) continue;
      const dx = b.x - playerPixelPos.x;
      const dy = b.y - playerPixelPos.y;
      if (dx * dx + dy * dy <= rr2) {
        b.active = false; // 命中弾は消費（バリアで弾いた場合も盾で弾いて消す）
        // バリアなしで命中＝ミス確定。同フレームに複数弾が重なっても1ミスで打ち切る
        // （残弾は被弾リスポーン時の clearBullets() で清算され、盤面に残らない）。
        if (!hasBarrier) return true;
      }
    }
    return false;
  }
}
