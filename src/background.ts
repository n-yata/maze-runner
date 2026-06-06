// 深宇宙の動く背景（星空・星雲・視差スクロール）。
// ゲームロジックから独立した純粋な視覚モジュール。GameState には一切触れない。
// 全ビューポートを覆う背景キャンバスに描画し、盤面外の余白（スマホの上下・PC の左右）も埋める。

interface Star {
  x: number;        // 0..1 正規化座標
  y: number;        // 0..1 正規化座標
  r: number;        // 半径(px)
  alpha: number;    // 基準アルファ
  twPhase: number;  // 明滅位相
  twFreq: number;   // 明滅周波数
}

interface Nebula {
  x: number; y: number; r: number; color: string;
}

type Ctx = CanvasRenderingContext2D;

// レイヤごとの星の密度（面積あたり）と視差スクロール速度（正規化/秒）
const LAYERS: Array<{ density: number; speed: number; rMin: number; rMax: number; cap: number }> = [
  { density: 1 / 11000, speed: 0.006, rMin: 0.4, rMax: 0.9, cap: 220 }, // 遠（多・小・遅）
  { density: 1 / 20000, speed: 0.018, rMin: 0.7, rMax: 1.4, cap: 130 }, // 中
  { density: 1 / 42000, speed: 0.040, rMin: 1.0, rMax: 2.0, cap: 60 },  // 近（少・大・速）
];

const NEBULA_COLORS = ['#3A1E6E', '#10406B', '#5E1E55', '#143A52'];

export class Starfield {
  private w = 0;
  private h = 0;
  private layers: Star[][] = [];
  private nebulae: Nebula[] = [];
  // 内部経過時間(ms)とスクロール倍率。倍率を変えても位置が連続するよう、
  // 絶対時刻ではなくフレーム差分を倍率付きで積算する（エンディングのワープ加速用）。
  private elapsedMs = 0;
  private warp = 1;

  /** スクロール倍率を設定する。発進演出中だけ >1 にして星を加速させる。 */
  setWarp(factor: number): void {
    this.warp = factor;
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.generate();
  }

  private rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private generate(): void {
    const area = this.w * this.h;
    this.layers = LAYERS.map(cfg => {
      const count = Math.min(cfg.cap, Math.max(8, Math.round(area * cfg.density)));
      const stars: Star[] = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: this.rand(cfg.rMin, cfg.rMax),
          alpha: this.rand(0.35, 0.9),
          twPhase: Math.random() * Math.PI * 2,
          twFreq: this.rand(0.5, 2.0),
        });
      }
      return stars;
    });

    // 星雲（数枚の半透明グラデ円）
    const nebCount = Math.min(5, Math.max(2, Math.round(area / 350000)));
    this.nebulae = [];
    for (let i = 0; i < nebCount; i++) {
      this.nebulae.push({
        x: Math.random(),
        y: Math.random(),
        r: this.rand(0.18, 0.4),
        color: NEBULA_COLORS[i % NEBULA_COLORS.length]!,
      });
    }
  }

  /** フレーム差分 dtMs を倍率付きで積算して描画する。warp>1 でワープ加速。 */
  draw(ctx: Ctx, dtMs: number): void {
    this.elapsedMs += dtMs * this.warp;
    const { w, h } = this;
    const t = this.elapsedMs / 1000;

    // 深宇宙のベースグラデ
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070A1A');
    bg.addColorStop(0.5, '#05060F');
    bg.addColorStop(1, '#03040A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 星雲（ゆっくりドリフト）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.nebulae.length; i++) {
      const n = this.nebulae[i]!;
      const drift = ((n.y + t * 0.004) % 1.2) - 0.1;
      const cx = n.x * w;
      const cy = drift * h;
      const rad = n.r * Math.min(w, h);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, this.hexToRgba(n.color, 0.22));
      g.addColorStop(1, this.hexToRgba(n.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 星（レイヤごとに視差スクロール＋明滅）
    for (let li = 0; li < this.layers.length; li++) {
      const speed = LAYERS[li]!.speed;
      const stars = this.layers[li]!;
      for (const s of stars) {
        const y = ((s.y + t * speed) % 1) * h;
        const x = s.x * w;
        const tw = 0.6 + 0.4 * Math.sin(t * s.twFreq + s.twPhase);
        ctx.globalAlpha = Math.min(1, s.alpha * tw);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
