# 設計

## マップ差別化設計

### 壁色の変更
`src/constants.ts` に `STAGE_WALL_COLORS` を追加:
```ts
export const STAGE_WALL_COLORS = [
  { wall: '#0000FF', inner: '#000088' }, // Stage 1: Blue (既存)
  { wall: '#007700', inner: '#004400' }, // Stage 2: Green
  { wall: '#AA0000', inner: '#660000' }, // Stage 3: Red
] as const;

export function getStageColors(level: number) {
  const idx = Math.max(0, Math.min(level - 1, STAGE_WALL_COLORS.length - 1));
  return STAGE_WALL_COLORS[idx]!;
}
```

### MapManager の変更
- `wallColor` / `wallInnerColor` プロパティを追加
- `reset(level)` で `getStageColors(level)` を呼び出し色を更新
- `drawStaticMap` で `COLORS.WALL` の代わりに `this.wallColor` を使用

## PWA 修正設計

`service-worker.js` の PRECACHE_ASSETS に追加:
```js
'./dist/fruit.js',
```

CACHE_NAME を `mazerun-v1` → `mazerun-v2` に更新（旧キャッシュ自動削除）
