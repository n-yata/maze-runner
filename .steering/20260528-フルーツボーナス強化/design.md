# 設計: フルーツボーナス強化

## アーキテクチャ方針

既存のゲームループパターンを維持しつつ、FruitManagerを「単一フルーツ」から「複数フルーツ（最大2個）」を管理できるように拡張する。

## 変更内容

### 1. `constants.ts`
```typescript
// Before
export const FRUIT_SPAWN_THRESHOLDS = [70, 170] as const;
export const FRUIT_DURATION = 10.0;
export const FRUIT_SPAWN_POS: Vec2 = { x: 13, y: 17 };

// After
export const FRUIT_SPAWN_THRESHOLDS = [47, 113] as const;
export const FRUIT_DURATION = 15.0;
export const FRUIT_MAX_ACTIVE = 2;
// FRUIT_SPAWN_POS は削除（ランダム化のため不要）
```

### 2. `map.ts` - `getValidFruitPositions()` 追加
```typescript
getValidFruitPositions(): Vec2[] {
  const positions: Vec2[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (this.tileAt(col, row) === 2) { // DOTタイルのみ（プレイフィールドの通路）
        positions.push({ x: col, y: row });
      }
    }
  }
  return positions;
}
```
- DOTタイル（type=2）のみ使用
- ゴーストハウス内部はtype=0なので自動的に除外される
- トンネル（type=4）、壁（type=1）、EMPTY（type=0）は除外

### 3. `fruit.ts` - 複数フルーツ対応

#### APIの変更
| 変更前 | 変更後 |
|--------|--------|
| `private state: FruitState \| null` | `private states: FruitState[]` |
| `checkSpawn(dotsEaten, level): void` | `checkSpawn(dotsEaten, level, validPositions: Vec2[]): void` |
| `getState(): FruitState \| null` | `getStates(): FruitState[]` |
| `update(dt, playerPixelPos): number` | 内部実装のみ変更（シグネチャ同一） |

#### ランダム位置選択ロジック
```typescript
private pickRandomPos(validPositions: Vec2[]): Vec2 | null {
  // 現在アクティブなフルーツの位置を除外
  const occupied = new Set(this.states.map(s => `${s.col},${s.row}`));
  const candidates = validPositions.filter(p => !occupied.has(`${p.x},${p.y}`));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}
```

#### checkSpawnロジック
```typescript
checkSpawn(dotsEaten: number, level: number, validPositions: Vec2[]): void {
  for (const thresh of FRUIT_SPAWN_THRESHOLDS) {
    if (dotsEaten >= thresh && !this.spawnedThresholds.has(thresh)) {
      this.spawnedThresholds.add(thresh);
      if (this.states.length < FRUIT_MAX_ACTIVE) {
        const pos = this.pickRandomPos(validPositions);
        if (pos) {
          this.states.push({ col: pos.x, row: pos.y, timer: FRUIT_DURATION, level });
        }
      }
    }
  }
}
```

#### updateロジック
```typescript
update(dt: number, playerPixelPos: Vec2): number {
  let totalScore = 0;
  this.states = this.states.filter(state => {
    state.timer -= dt;
    if (state.timer <= 0) return false;
    
    const fruitX = state.col * TILE_SIZE + TILE_SIZE / 2;
    const fruitY = state.row * TILE_SIZE + TILE_SIZE / 2;
    const dx = playerPixelPos.x - fruitX;
    const dy = playerPixelPos.y - fruitY;
    if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE) {
      totalScore += getFruitDef(state.level).score;
      return false; // 食べたのでフィルタで除去
    }
    return true;
  });
  return totalScore;
}
```

### 4. `renderer.ts` - 複数フルーツ描画
```typescript
private drawFruit(fruitMgr: FruitManager): void {
  for (const state of fruitMgr.getStates()) {
    // 既存の単一フルーツ描画ロジックをループ内で実行
  }
}
```

### 5. `gameLoop.ts` - checkSpawn更新
```typescript
// Before
this.fruitMgr.checkSpawn(this.state.dotsEaten, this.state.level);

// After
this.fruitMgr.checkSpawn(this.state.dotsEaten, this.state.level, this.map.getValidFruitPositions());
```

## テスト方針

### 更新が必要な既存テスト
- `getState()` → `getStates()` への書き換え
- 閾値: 70 → 47、170 → 113
- `FRUIT_SPAWN_POS` 参照を削除
- スポーン位置チェックの変更（固定座標ではなくtype=2タイルかどうか）

### 新規テスト
- 2つのフルーツが同時にアクティブになれること
- ランダム位置がDOTタイル上にあること（MapManager stubを使用）
- 2つのフルーツがそれぞれ取れること（スコアが加算されること）
- 既にアクティブなフルーツの位置と重複しないこと

## リスク・注意点
- `FRUIT_SPAWN_POS` を `fruit.test.ts` がimportしているため削除時に対応が必要
- `getState()` から `getStates()` への名称変更で全参照箇所を更新すること
- `Math.random()` を使うため、テストでは固定の`validPositions`を渡してランダム性を制御すること
