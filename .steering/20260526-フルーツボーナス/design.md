# 設計: フルーツボーナス

## アーキテクチャ方針

既存の Manager パターンに倣い、`FruitManager` クラスを新規作成する。
他のManagerと同様、`main.ts` でインスタンス化し `GameLoop` コンストラクタに注入。

## 出現位置

`FRUIT_SPAWN_POS = { x: 13, y: 17 }` — ゴーストハウス下部通路
- col 9 or col 18 の縦通路からアクセス可能（プレイヤーが通れる）
- ゴーストが多いエリアなのでリスク/リワードの緊張感がある
- 内部ピクセル: x=216, y=280

## 新規ファイル

### `src/fruit.ts` — FruitManager

```typescript
export interface FruitState {
  col: number; row: number; timer: number; level: number;
}

export class FruitManager {
  private state: FruitState | null = null;
  private readonly spawnedThresholds = new Set<number>();

  checkSpawn(dotsEaten: number, level: number): void
    // state が null の時のみ。thresholds を順に確認、未スポーン & 達成済みなら spawn。

  update(dt: number, playerPixelPos: Vec2): number
    // timer を減らす。0 以下なら state=null。プレイヤーとの距離 < TILE_SIZE なら食べる。
    // 食べた場合: state=null, getFruitDef(level).score を返す。

  getState(): FruitState | null
  reset(): void  // state=null, spawnedThresholds クリア
}
```

## 定数追加 (constants.ts)

```typescript
export const FRUIT_SPAWN_THRESHOLDS = [70, 170] as const;
export const FRUIT_DURATION = 10.0;
export const FRUIT_SPAWN_POS: Vec2 = { x: 13, y: 17 };

export interface FruitDef { color: string; score: number; }

export function getFruitDef(level: number): FruitDef
  // level 1-5+ を 0-4 にクランプしてテーブルから取得
```

## 変更ファイル

### `src/types.ts`
- `SoundKey` に `'EAT_FRUIT'` を追加

### `src/audio.ts`
- `SOUND_DEFS` に `EAT_FRUIT: { frequency: 660, type: 'triangle', duration: 0.4, gainPeak: 0.3 }` を追加

### `src/renderer.ts`
- `render()` シグネチャに `fruitMgr: FruitManager` を追加
- `drawFruit(fruitMgr)` プライベートメソッドを追加
  - 残り3秒で点滅 (`floor(timer/0.25) % 2` で判定)
  - 通常時: 色付き円 + 白ハイライト

### `src/gameLoop.ts`
- コンストラクタに `private fruitMgr: FruitManager` を追加
- `startNewGame()`, `startNextLevel()` で `fruitMgr.reset()` を呼ぶ
- `updatePlaying()` で:
  1. `fruitMgr.checkSpawn(dotsEaten, level)`
  2. `fruitScore = fruitMgr.update(dt, player.getPixelPos())`
  3. `if (fruitScore > 0) { score += fruitScore; audio.play('EAT_FRUIT'); }`
- `renderer.render(...)` に `this.fruitMgr` を追加

### `src/main.ts`
- `FruitManager` をインスタンス化して `GameLoop` に渡す

## テスト計画 (fruit.test.ts)

1. 初期状態: getState() === null
2. 69ドット時点: スポーンしない
3. 70ドット時点: スポーンする
4. スポーン中に2つ目の閾値を超えても2つ目はスポーンしない
5. 1つ目を食べた後に170ドット → 2つ目スポーン
6. 10秒後: 自動消滅
7. 食べる: スコアを返して state=null
8. reset 後: 再スポーン可能
9. レベルごとにスコアが増加すること (getFruitDef)
