# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

---

## フェーズ1: 型定義・定数追加

- [x] `src/types.ts` — `SoundKey` に `'EAT_FRUIT'` を追加
- [x] `src/constants.ts` — フルーツ関連定数・型・関数を追加
  - [x] `FruitDef` インターフェース
  - [x] `FRUIT_TABLE` (Level 1-5 の color/score)
  - [x] `FRUIT_SPAWN_THRESHOLDS = [70, 170] as const`
  - [x] `FRUIT_DURATION = 10.0`
  - [x] `FRUIT_SPAWN_POS: Vec2 = { x: 13, y: 17 }`
  - [x] `getFruitDef(level: number): FruitDef` 関数
- [x] `src/audio.ts` — `SOUND_DEFS` に `EAT_FRUIT` を追加

## フェーズ2: FruitManager 実装 (src/fruit.ts)

- [x] `FruitState` インターフェースを定義・エクスポート
- [x] `FruitManager` クラスを実装
  - [x] `private state: FruitState | null`
  - [x] `private readonly spawnedThresholds: Set<number>`
  - [x] `checkSpawn(dotsEaten: number, level: number): void`
    - [x] state が null の時のみスポーン
    - [x] 未スポーン & 閾値達成済みの最初のthreshold をスポーン
  - [x] `update(dt: number, playerPixelPos: Vec2): number`
    - [x] timer 減算、0 以下で state = null
    - [x] プレイヤーとの距離 < TILE_SIZE で「食べる」処理
    - [x] 食べた時 getFruitDef(level).score を返す
  - [x] `getState(): FruitState | null`
  - [x] `reset(): void` (state クリア + spawnedThresholds クリア)

## フェーズ3: Renderer 対応 (src/renderer.ts)

- [x] `render()` シグネチャに `fruitMgr: FruitManager` を追加
- [x] `drawFruit(fruitMgr: FruitManager)` プライベートメソッドを実装
  - [x] getState() が null なら即 return
  - [x] 残り3秒以下の場合、点滅エフェクト (0.25s 周期)
  - [x] 色付き円を描画 (getFruitDef(level).color)
  - [x] 白ハイライト小円を描画
- [x] 各ゲームフェーズの描画で `drawFruit` を呼ぶ (PLAYING, READY, PAUSED のブロック)

## フェーズ4: GameLoop 統合 (src/gameLoop.ts)

- [x] `FruitManager` をインポート
- [x] コンストラクタパラメータに `private fruitMgr: FruitManager` を追加
- [x] `startNewGame()` に `this.fruitMgr.reset()` を追加
- [x] `startNextLevel()` に `this.fruitMgr.reset()` を追加
- [x] `updatePlaying()` にフルーツ更新ロジックを追加
  - [x] `this.fruitMgr.checkSpawn(this.state.dotsEaten, this.state.level)`
  - [x] `const fruitScore = this.fruitMgr.update(dt, this.player.getPixelPos())`
  - [x] `if (fruitScore > 0) { this.state.score += fruitScore; this.audio.play('EAT_FRUIT'); }`
- [x] `this.renderer.render(...)` の呼び出しに `this.fruitMgr` を追加

## フェーズ5: main.ts 対応

- [x] `FruitManager` をインポート
- [x] `const fruitMgr = new FruitManager()` を追加
- [x] `new GameLoop(...)` に `fruitMgr` を渡す

## フェーズ6: ユニットテスト (tests/unit/fruit.test.ts)

- [x] 初期状態: `getState()` が null
- [x] 69ドット: スポーンしない
- [x] 70ドット: スポーンする (state が null でなくなる)
- [x] スポーン中に dotsEaten=170: 2個目はスポーンしない (1個のみ)
- [x] 1個目を食べた後 dotsEaten=170: 2個目がスポーン
- [x] 10.1秒後: 自動消滅 (state が null)
- [x] 食べる: 正しいスコアを返し state が null になる
- [x] `reset()` 後: 再スポーン可能
- [x] `getFruitDef` のスコアがレベル1 < 2 < 3 < 4 < 5 であること

## フェーズ7: 品質チェック

- [x] `npm run typecheck` でエラーなし
- [x] `npm run build` で成功
- [x] `npm test` で全テスト通過

---

## 実装後の振り返り

**実装完了日**: 2026-05-26

**計画と実績の差分**:
- 計画通りに全7フェーズを完了。設計変更・スキップなし。
- フルーツスポーン位置 `{x:13, y:17}` はゴーストハウス内（row 17）。col 9/col 18 の通路経由でプレイヤーがアクセス可能なリスク/リワード設計を確認。
- `gameflow.test.ts` のコンストラクタ引数が旧シグネチャのままで6テスト失敗→ FruitManager 追加で修正。

**学んだこと**:
- 既存テストファイルも新しいコンストラクタパラメータに追従が必要。マネージャーの追加時はテストのファクトリ関数も必ず確認する。
- `checkSpawn` のステート管理: `this.state !== null` の早期リターンにより同時スポーン防止をシンプルに実現。Set<number> で閾値ごとの使用済み管理が明快。

**次回への改善提案**:
- コンストラクタパラメータが増えてきたため、次回 Manager 追加時は依存注入コンテナや Options オブジェクトへのリファクタリングを検討。
- `FruitManager.getState()` は現在内部参照を直接返しているが、`Readonly<FruitState>` 型にすると外部からの改ざんをコンパイル時に防止できる（Low 指摘、必須ではない）。
