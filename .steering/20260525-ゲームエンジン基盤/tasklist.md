# タスクリスト: ゲームエンジン基盤

## フェーズ1: プロジェクトスキャフォールディング

- [x] package.json を作成（name, scripts: build/test/lint/typecheck, devDependencies: typescript/vitest）
- [x] tsconfig.json を作成（target: ES2022, module: ESNext, outDir: dist, strict: true）
- [x] .gitignore を作成（node_modules/, dist/）
- [x] index.html を作成（Canvas要素、`<script type="module" src="dist/main.js">`）
- [x] npm install を実行して依存関係をインストール

## フェーズ2: 型定義・定数

- [x] src/types.ts を作成（Vec2, TileType, Direction, GhostMode, GhostName, GamePhase, SoundKey, PlayerState, GhostState, GameState, HighScore）
- [x] src/constants.ts を作成（COLS, ROWS, TILE_SIZE, 初期位置, モード切替スケジュール, 色テーブル, スコア定数, ゴースト解放タイマー）

## フェーズ3: マップシステム

- [x] src/map.ts を作成（MapManagerクラス、28×31マップデータ定義）
- [x] isWall(), isDot(), isPowerDot(), isTunnel() の実装
- [x] ドット収集状態管理（dotState配列）とgetRemainingDots()の実装
- [x] OffscreenCanvasによる静的マップキャッシュの実装

## フェーズ4: ストレージ

- [x] src/storage.ts を作成（StorageManagerクラス）
- [x] getHighScore(), setHighScore() の実装（localStorage: 'mazerun_highscore'）

## フェーズ5: 入力システム

- [x] src/input.ts を作成（InputManagerクラス）
- [x] キーボード入力（Arrow/WASD → Direction）の実装
- [x] タッチスワイプ（touchstart/touchend, 30px閾値）の実装
- [x] 入力バッファリング（1つ先の方向を保持）の実装

## フェーズ6: 音声システム

- [x] src/audio.ts を作成（AudioManagerクラス）
- [x] Web Audio API AudioContextの初期化（ユーザーインタラクション後にresume）
- [x] 各SoundKeyに対応する効果音生成（OscillatorNode + GainNode）
- [x] play(key: SoundKey): void の実装

## フェーズ7: プレイヤーシステム

- [x] src/player.ts を作成（PlayerManagerクラス）
- [x] 移動計算（タイルアライン、方向転換）の実装
- [x] トンネルワープ処理の実装
- [x] ドット収集判定 → スコア加算の実装
- [x] FRIGHTENED中のゴーストとの衝突判定の実装

## フェーズ8: ゴーストAI

- [x] src/ghost.ts を作成（GhostManagerクラス）
- [x] モード切替スケジュール管理（SCATTER→CHASE→...の交互）の実装
- [x] BFS/最短経路による次タイル決定（逆方向禁止）の実装
- [x] Blinkyターゲット計算（プレイヤー現在位置）の実装
- [x] Pinkyターゲット計算（プレイヤー前方4タイル、UPバグ再現）の実装
- [x] Inkyターゲット計算（Blinky+プレイヤー前方2タイルのベクトル）の実装
- [x] Clydeターゲット計算（距離>8タイルならChase、近ければScatter）の実装
- [x] FRIGHTENED時のランダム移動の実装
- [x] EATEN時のゴーストハウスへの帰還処理の実装
- [x] ゴースト解放タイマー（Blinky即時、Pinky0秒、Inky30個、Clyde60個）の実装

## フェーズ9: レンダラー

- [x] src/renderer.ts を作成（Rendererクラス）
- [x] 静的マップのdrawImage描画（OffscreenCanvasから）の実装
- [x] プレイヤー描画（口開閉アニメーション）の実装
- [x] ゴースト描画（通常/びびり/目玉の状態別）の実装
- [x] スコア・ライフ・ハイスコアのUI描画の実装
- [x] タイトル・ゲームオーバー・クリア画面の描画の実装

## フェーズ10: ゲームループ・メインエントリ

- [x] src/gameLoop.ts を作成（GameLoopクラス）
- [x] requestAnimationFrame + 固定1/60sタイムステップの実装
- [x] update(dt): ゲーム状態更新の実装（フェーズ別処理）
- [x] render(): 描画呼び出しの実装
- [x] 衝突検出（プレイヤー↔ゴースト）の実装
- [x] フェーズ遷移（PLAYING→GAMEOVER/CLEAR）の実装
- [x] src/main.ts を作成（DOMContentLoaded、初期化、ループ開始）

## フェーズ11: PWAファイル

- [x] manifest.json を作成（name, short_name, start_url, display, icons）
- [x] service-worker.js を作成（Cache First戦略、静的アセットをキャッシュ）
- [x] index.htmlにservice-workerの登録コードを追加（index.html作成時に含めた）

## フェーズ12: ユニットテスト

- [x] tests/unit/map.test.ts を作成（isWall, isDot, isPowerDot, getRemainingDots）
- [x] tests/unit/player.test.ts を作成（移動計算、タイルアライン、トンネルワープ）
- [x] tests/unit/ghost.test.ts を作成（Blinky/Pinky/Inky/Clydeターゲット計算、BFS）
- [x] tests/unit/storage.test.ts を作成（getHighScore, setHighScore）

## フェーズ13: 品質チェック

- [x] npm test（全テストパス確認: 50テスト全パス）
- [x] npm run typecheck（TypeScriptエラーなし確認）
- [x] npm run build（ビルド成功確認）


## 実装後の振り返り

- **実装完了日**: 2026-05-25
- **テスト結果**: 50テスト全パス (map: 18, ghost: 18, player: 8, storage: 6)

### 計画との差分

- `vitest.config.ts` の追加が必要（計画外）: jsdom v27がESM互換性問題を持つため happy-dom に切り替え
- `MapManager.getPowerDotCount()` の追加: gameLoop.ts から毎フレーム全タイルスキャンを避けるため設計変更
- バリデーション指摘による修正: InputManager.destroy()のbindキャッシュ、DIRS配列順序（UP>LEFT>DOWN>RIGHT）、RAFループ内bind()キャッシュ

### 学んだこと

- ゲームループ内での `bind()` 呼び出しは毎フレームGCプレッシャーになるため、コンストラクタでキャッシュする必要がある
- jsdom v27はESM関連の互換性問題があり、vitestではhappy-domの方が安定
- PAC-MANゴーストの同距離時方向優先順序（UP > LEFT > DOWN > RIGHT）は原作再現性に直結する重要な仕様

### 次回への改善提案

- `GhostMode` 型に `HOUSE` / `LEAVING` を追加し、ゴーストハウス内状態を型で表現する
- localStorage キーをスペック（`maze-runner:highscore`）に統一する（現在 `mazerun_highscore`）
- Clydeの解放閾値をスペック（90ドット）に合わせる（現在60ドット）
- ESLintを `npm run lint` に追加してコードスタイル自動検証を整備する
- `player.ts` / `ghost.ts` で重複するユーティリティ関数（tileOf, centerPx, dirToVec）を共通モジュールに抽出する
