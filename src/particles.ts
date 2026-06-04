// 軽量パーティクルシステム。取得・撃破時のスパーク演出に使う。
// 固定サイズプールで再利用し GC スパイクを避ける。座標は盤面ローカル（描画側で MAP_OFFSET_Y を加算）。

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;     // 残り寿命(秒)
  maxLife: number;
  size: number;
  color: string;
}

const MAX_PARTICLES = 160;
const FRICTION = 2.2; // 減速係数(/秒)

export class ParticleSystem {
  private pool: Particle[] = [];

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 1, color: '#FFFFFF',
      });
    }
  }

  /** (x,y) を中心にスパークを放射状に生成する。 */
  spawnBurst(x: number, y: number, color: string, count = 8, speed = 60): void {
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= count) break;
      if (p.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const sp = speed * (0.5 + Math.random() * 0.8);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * sp;
      p.vy = Math.sin(angle) * sp;
      p.maxLife = 0.4 + Math.random() * 0.4;
      p.life = p.maxLife;
      p.size = 1 + Math.random() * 2;
      p.color = color;
      spawned++;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const decay = Math.max(0, 1 - FRICTION * dt);
      p.vx *= decay;
      p.vy *= decay;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, offsetY: number): void {
    // 発光は shadowBlur ではなく加算合成('lighter')で表現する。
    // shadowBlur 付き fill はモバイル Canvas で極めて重く、エサ連続取得で
    // スパークが常時十数個描画されるとフレーム落ちの主因になるため使わない。
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool) {
      if (!p.active) continue;
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y + offsetY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore(); // globalAlpha/合成モードはここで元に戻る
  }

  /** テスト/リセット用: 全パーティクルを停止。 */
  clear(): void {
    for (const p of this.pool) p.active = false;
  }

  activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }
}
