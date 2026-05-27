# タスクリスト: フルーツボーナス強化

## フェーズ1: 定数の更新 (`constants.ts`)

- [x] `FRUIT_SPAWN_THRESHOLDS` を `[47, 113]` に変更（1.5倍頻度）
- [x] `FRUIT_DURATION` を `15.0` に変更（1.5倍時間）
- [x] `FRUIT_SPAWN_POS` を削除、`FRUIT_MAX_ACTIVE = 2` を追加

## フェーズ2: MapManager 拡張 (`map.ts`)

- [x] `getValidFruitPositions(): Vec2[]` メソッドを追加（DOTタイル位置一覧）

## フェーズ3: FruitManager リファクタリング (`fruit.ts`)

- [x] `FruitState[]` 配列に変更（`state: FruitState | null` → `states: FruitState[]`）
- [x] `pickRandomPos(validPositions: Vec2[]): Vec2 | null` プライベートメソッドを追加
- [x] `checkSpawn` シグネチャに `validPositions: Vec2[]` を追加し複数出現対応
- [x] `update()` を複数フルーツ対応に更新（filter + スコア合算）
- [x] `getState()` を `getStates(): FruitState[]` に変更
- [x] `reset()` を配列クリア対応に更新

## フェーズ4: 依存コードの更新

- [x] `renderer.ts`: `drawFruit` を `getStates()` でループ対応に更新
- [x] `gameLoop.ts`: `checkSpawn` 呼び出しに `this.map.getValidFruitPositions()` を追加

## フェーズ5: テスト更新 (`tests/unit/fruit.test.ts`)

- [x] `FRUIT_SPAWN_POS` インポートを削除
- [x] `getState()` → `getStates()` に全箇所書き換え
- [x] 閾値テストを新しい値（47, 113）に更新
- [x] タイマーのハードコード値 `10.0` を `FRUIT_DURATION` 定数に更新
- [x] スポーン位置チェックを「passedなvalidPositions内の座標であること」に変更
- [x] 2つのフルーツが同時にアクティブになるテストを追加
- [x] 2つのフルーツをそれぞれ食べてスコアが2倍になるテストを追加

---

## 実装後の振り返り

### 実装完了日
2026-05-28

### 計画と実績の差分
- 計画通り全タスクを完了。特に大きな変更はなし。
- `getState()` を `getStates()` にリネームしたため、renderer.ts・fruit.test.ts の全参照を更新。
- `FRUIT_SPAWN_POS` の削除により、fruit.test.ts のインポートも修正が必要だった。
- `checkSpawn` に `validPositions` パラメータを追加したことで、gameLoop.ts の呼び出し箇所も更新。

### 学んだこと
- DOTタイル（type=2）のみを対象にすることで、ゴーストハウス内部（type=0）を自然に除外でき、シンプルな実装になった。
- `filter` + `return false` パターンでフルーツの削除とスコア合算を同時に処理できた。
- テストで `Math.random()` の影響を排除するために固定の `VALID_POSITIONS` を渡す設計が有効。

### 次回への改善提案
- フルーツ出現時に効果音を追加するとより気づきやすくなる。
- バルベルデの品質検証に基づき、以下を追加修正した:
  - `gameLoop.ts`: `getValidFruitPositions()` をドット数変化時のみ再計算するキャッシュを追加（毎フレームの全タイルスキャンを回避）
  - `fruit.ts`: `spawnedThresholds` の登録タイミングを修正（スポーン成功時のみ登録、validPositions空の場合は次フレームで再試行可能に）
  - `map.ts`: `getValidFruitPositions()` にdotState非依存の意図を示すコメント追加
  - `map.test.ts`: `getValidFruitPositions()` のテスト3件を追加
