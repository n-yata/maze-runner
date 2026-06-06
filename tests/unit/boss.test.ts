import { describe, it, expect } from 'vitest';
import { BossManager } from '../../src/boss.js';
import type { Beam } from '../../src/laser.js';
import {
  BOSS_MAX_HP, BOSS_BODY_RADIUS, BOSS_MAX_BULLETS, BOSS_HIT_DAMAGE,
  COLS, ROWS, TILE_SIZE,
} from '../../src/constants.js';

/** 本体中心に当たるダミービームを n 本作る。 */
function beamsAt(x: number, y: number, n: number): Beam[] {
  const beams: Beam[] = [];
  for (let i = 0; i < n; i++) {
    beams.push({ active: true, x, y, dx: 0, dy: -1 });
  }
  return beams;
}

/** 弾を発生させるため update を一定時間回す（決定論なので毎回同じ結果）。 */
function spin(boss: BossManager, playerPos = { x: TILE_SIZE * 7, y: TILE_SIZE * 20 }, seconds = 3, dt = 1 / 60): void {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) boss.update(dt, playerPos);
}

describe('BossManager', () => {
  it('reset() restores full HP, no bullets, not defeated', () => {
    const boss = new BossManager();
    spin(boss); // 状態を汚す
    boss.reset();
    expect(boss.hp).toBe(BOSS_MAX_HP);
    expect(boss.maxHp).toBe(BOSS_MAX_HP);
    expect(boss.isDefeated).toBe(false);
    expect(boss.getBullets().length).toBe(0);
    expect(boss.getHpRatio()).toBe(1);
  });

  it('hitByBeams reduces HP only for beams inside the body circle', () => {
    const boss = new BossManager();
    boss.reset();
    const c = boss.centerPixel;

    // 本体円の外（半径の3倍離す）→ ダメージなし
    const outside = beamsAt(c.x + BOSS_BODY_RADIUS * 3, c.y, 4);
    expect(boss.hitByBeams(outside)).toBe(0);
    expect(boss.hp).toBe(BOSS_MAX_HP);

    // 本体中心 → ダメージあり
    const inside = beamsAt(c.x, c.y, 3);
    const dmg = boss.hitByBeams(inside);
    expect(dmg).toBe(3 * BOSS_HIT_DAMAGE);
    expect(boss.hp).toBe(BOSS_MAX_HP - 3 * BOSS_HIT_DAMAGE);
  });

  it('consumes hitting beams (no double damage from same beam)', () => {
    const boss = new BossManager();
    boss.reset();
    const c = boss.centerPixel;
    const beams = beamsAt(c.x, c.y, 1);

    const first = boss.hitByBeams(beams);
    expect(first).toBe(BOSS_HIT_DAMAGE);
    expect(beams[0]!.active).toBe(false); // 命中ビームは消費される

    // 同じ（消費済み）ビームを再投入してもダメージは入らない
    const second = boss.hitByBeams(beams);
    expect(second).toBe(0);
  });

  it('clamps HP at 0 and reports defeated', () => {
    const boss = new BossManager();
    boss.reset();
    const c = boss.centerPixel;
    // HP を超える数のビームを当てる
    boss.hitByBeams(beamsAt(c.x, c.y, BOSS_MAX_HP + 20));
    expect(boss.hp).toBe(0);
    expect(boss.hp).toBeGreaterThanOrEqual(0);
    expect(boss.isDefeated).toBe(true);
    expect(boss.getHpRatio()).toBe(0);
  });

  it('hitByBeams deals no damage once the boss is already defeated', () => {
    const boss = new BossManager();
    boss.reset();
    const c = boss.centerPixel;
    boss.hitByBeams(beamsAt(c.x, c.y, BOSS_MAX_HP)); // HPを0に
    expect(boss.isDefeated).toBe(true);
    // 撃破後のビームはダメージにならない（早期 return）
    expect(boss.hitByBeams(beamsAt(c.x, c.y, 5))).toBe(0);
    expect(boss.hp).toBe(0);
  });

  it('checkPlayerHit returns true (miss) when a bullet hits and no barrier; consumes the bullet', () => {
    const boss = new BossManager();
    boss.reset();
    spin(boss); // 弾を発生させる
    const bullets = boss.getBullets();
    expect(bullets.length).toBeGreaterThan(0);

    const target = bullets[0]!;
    const playerPos = { x: target.x, y: target.y };
    const before = boss.getBullets().length;

    expect(boss.checkPlayerHit(playerPos, false)).toBe(true);
    expect(boss.getBullets().length).toBe(before - 1); // 当たった弾は消える
  });

  it('checkPlayerHit returns false when barrier is up (shield blocks the bullet)', () => {
    const boss = new BossManager();
    boss.reset();
    spin(boss);
    const bullets = boss.getBullets();
    const target = bullets[0]!;
    const playerPos = { x: target.x, y: target.y };

    // バリアあり → ミスにならない（が弾は弾かれて消える）
    expect(boss.checkPlayerHit(playerPos, true)).toBe(false);
  });

  it('never exceeds the fixed bullet pool size', () => {
    const boss = new BossManager();
    boss.reset();
    // 長時間回しても固定長プールを超えない
    spin(boss, { x: TILE_SIZE * 7, y: TILE_SIZE * 20 }, 20);
    expect(boss.getBullets().length).toBeLessThanOrEqual(BOSS_MAX_BULLETS);
  });

  it('bullets despawn off-board (no active bullet stays outside the arena)', () => {
    const boss = new BossManager();
    boss.reset();
    spin(boss, { x: TILE_SIZE * 7, y: TILE_SIZE * 20 }, 10);
    const maxX = COLS * TILE_SIZE;
    const maxY = ROWS * TILE_SIZE;
    for (const b of boss.getBullets()) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(maxX);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(maxY);
    }
  });

  it('is deterministic: same dt sequence and player position yield the same bullet layout', () => {
    const a = new BossManager();
    const b = new BossManager();
    a.reset();
    b.reset();
    const pp = { x: TILE_SIZE * 6, y: TILE_SIZE * 21 };
    spin(a, pp, 4);
    spin(b, pp, 4);

    const ba = a.getBullets();
    const bb = b.getBullets();
    expect(ba.length).toBe(bb.length);
    for (let i = 0; i < ba.length; i++) {
      expect(ba[i]!.x).toBeCloseTo(bb[i]!.x, 6);
      expect(ba[i]!.y).toBeCloseTo(bb[i]!.y, 6);
    }
  });
});
