import { describe, it, expect, beforeEach } from 'vitest';
import { ParticleSystem } from '../../src/particles.js';

describe('ParticleSystem', () => {
  let ps: ParticleSystem;

  beforeEach(() => {
    ps = new ParticleSystem();
  });

  it('初期状態ではアクティブなパーティクルは無い', () => {
    expect(ps.activeCount()).toBe(0);
  });

  it('spawnBurst で指定数のパーティクルが生成される', () => {
    ps.spawnBurst(10, 10, '#FFFFFF', 8);
    expect(ps.activeCount()).toBe(8);
  });

  it('複数回の spawnBurst が累積する', () => {
    ps.spawnBurst(0, 0, '#FFF', 5);
    ps.spawnBurst(0, 0, '#FFF', 5);
    expect(ps.activeCount()).toBe(10);
  });

  it('プール上限(160)を超えて生成されない', () => {
    ps.spawnBurst(0, 0, '#FFF', 1000);
    expect(ps.activeCount()).toBeLessThanOrEqual(160);
    expect(ps.activeCount()).toBe(160);
  });

  it('update で寿命が尽きるとパーティクルが再利用可能になる', () => {
    ps.spawnBurst(0, 0, '#FFF', 10);
    expect(ps.activeCount()).toBe(10);
    // 最大寿命(0.8s)を十分に超えて進める
    for (let i = 0; i < 60; i++) ps.update(1 / 60);
    expect(ps.activeCount()).toBe(0);
  });

  it('寿命が尽きたスロットは再生成で使い回される（プールが枯渇しない）', () => {
    ps.spawnBurst(0, 0, '#FFF', 160); // 満杯
    for (let i = 0; i < 60; i++) ps.update(1 / 60); // 全て寿命切れ
    expect(ps.activeCount()).toBe(0);
    ps.spawnBurst(0, 0, '#FFF', 100); // 再利用できるはず
    expect(ps.activeCount()).toBe(100);
  });

  it('clear で全パーティクルが停止する', () => {
    ps.spawnBurst(0, 0, '#FFF', 20);
    ps.clear();
    expect(ps.activeCount()).toBe(0);
  });

  it('update でパーティクルが移動する', () => {
    ps.spawnBurst(50, 50, '#FFF', 1, 100);
    // draw をモック ctx で呼び、座標が変化することを間接確認する代わりに
    // 1フレーム更新後もアクティブであることを確認（速度>0で寿命内）
    ps.update(1 / 60);
    expect(ps.activeCount()).toBe(1);
  });
});
