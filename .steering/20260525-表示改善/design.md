# 設計: 表示改善

## 現状分析

- Canvas 内部サイズ: 448×560px（COLS=28, ROWS=35, TILE_SIZE=16）
- iPhone 390px 幅での CSS スケール: `min(390/448, h/560)` = 0.87
- CSS タイルサイズ: 390/28 = **13.9px**（小さい）

## 根本制約

CSS タイルサイズ = 画面幅 / タイル列数。
画面幅を固定すれば、表示列数を減らすしかタイルを大きくする方法がない。

## 採用アプローチ: 外壁1列クリップ

マップの外周（col 0, col 27）は純粋な WALL タイル（例外: row 14 のみ TUNNEL）。
これらをスクロール外に出して canvas をはみ出し表示し、`overflow: hidden` でクリップする。

```
スケール = 390 / (448 × 26/28) = 390 / 416 = 0.9375
CSS タイルサイズ = 16 × 0.9375 = 15px (+7.7%)
CSS canvas 幅 = 448 × 0.9375 = 420px → 左右 15px ずつはみ出し → クリップ
```

col 1 以降にはドット・ゴースト経路があるため、**クリップは 1 列のみ（最大安全値）**。

## 実装変更箇所

### 1. `src/main.ts` — fitToViewport

タッチデバイスのみ、26 列分のスケールを使用:

```typescript
import { COLS } from './constants.js';

function fitToViewport(canvas: HTMLCanvasElement): void {
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const scaleY = window.innerHeight / canvas.height;
  let scaleX: number;

  if (isTouchDevice) {
    // col 0 & col 27（外壁）をクリップして 7.7% 大きく表示
    scaleX = window.innerWidth / (canvas.width * (COLS - 2) / COLS);
  } else {
    scaleX = window.innerWidth / canvas.width;
  }

  const scale = Math.min(scaleX, scaleY);
  canvas.style.width  = `${Math.round(canvas.width  * scale)}px`;
  canvas.style.height = `${Math.round(canvas.height * scale)}px`;
}
```

### 2. `index.html` — canvas ラッパー

canvas を `#game-wrapper` div で包み、`overflow: hidden` を適用してはみ出しをクリップ:

```html
<div id="game-wrapper">
  <canvas id="gameCanvas"></canvas>
</div>
```

```css
#game-wrapper {
  overflow: hidden;
  width: 100%;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}
```

### 3. `src/renderer.ts` — UI 要素の余白修正

クリップ量 = TILE_SIZE (16px) 内部ピクセル。
UI 要素を可視領域内 (x ≥ 16, x ≤ 432) に収める。

| 要素 | 現在 | 変更後 |
|------|------|--------|
| SCORE テキスト x | 4 | 20 (=TILE_SIZE+4) |
| HI テキスト x | CANVAS_WIDTH-4 | CANVAS_WIDTH-20 |
| Lives 最初の円 x | 8 | 24 (=TILE_SIZE+8) |
| LV テキスト x | CANVAS_WIDTH-6*TILE_SIZE | 変更不要 (352、安全) |

## デスクトップ影響

`window.matchMedia('(pointer: coarse)')` で判定するためデスクトップは変更なし。
