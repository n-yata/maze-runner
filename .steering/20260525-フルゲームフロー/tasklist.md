# タスクリスト: フルゲームフロー

## フェーズ1: 型定義の更新

- [x] src/types.ts の GamePhase を仕様準拠に更新（READY, PLAYER_DEAD, STAGE_CLEAR, PAUSED, GAME_OVER 追加、PAUSE/GAMEOVER/CLEAR を削除）
- [x] src/types.ts の GameState に phaseTimer と gameoverCanInput フィールドを追加

## フェーズ2: 入力システムの拡張

- [x] src/input.ts に ESC キーによる onPause コールバックを追加

## フェーズ3: ゲームループの完成

- [x] src/gameLoop.ts の createInitialState を新フィールド対応に更新
- [x] src/gameLoop.ts の handleStart を GAME_OVER→TITLE 遷移に対応
- [x] src/gameLoop.ts に READY フェーズ処理（3秒後に PLAYING）を実装
- [x] src/gameLoop.ts に PAUSED フェーズ処理（ESC で再開）を実装
- [x] src/gameLoop.ts に PLAYER_DEAD フェーズ処理（1.5秒後に残機減少・READY/GAME_OVER 分岐）を実装
- [x] src/gameLoop.ts に STAGE_CLEAR フェーズ処理（2秒後に次レベル READY）を実装
- [x] src/gameLoop.ts の PLAYING→PLAYER_DEAD 遷移を更新（旧 GAMEOVER 直接遷移を削除）
- [x] src/gameLoop.ts の PLAYING→STAGE_CLEAR 遷移を更新
- [x] src/gameLoop.ts の startGame() を TITLE→READY 遷移に変更

## フェーズ4: レンダラーの完成

- [x] src/renderer.ts に drawReady() オーバーレイを実装（「READY!」黄色）
- [x] src/renderer.ts に drawPaused() オーバーレイを実装（「PAUSED」白）
- [x] src/renderer.ts に drawDeadPlayer() アニメーション描画を実装（口が閉じる）
- [x] src/renderer.ts の render() メソッドを全フェーズ対応に更新
- [x] src/renderer.ts の drawGameOver/drawStageClear オーバーレイを更新（新フェーズ名に対応）

## フェーズ5: テスト更新

- [x] tests/unit/ の既存テストを更新（GamePhase 型の変更に対応）
- [x] tests/unit/gameflow.test.ts を新規作成（フェーズ遷移ロジックのテスト）

## フェーズ6: 品質チェック

- [x] npm run typecheck（TypeScriptエラーなし確認）
- [x] npm test（全テストパス確認: 65テスト全パス）
- [x] npm run build（ビルド成功確認）


## 実装後の振り返り

- **実装完了日**: 2026-05-25
- **テスト結果**: 67/67 パス（gameflow.test.ts 17件追加）

### 計画との差分

- バリデーター指摘でSTAGE_CLEARレンダラーへのdrawDots追加（計画外の修正）
- GAME_OVER→TITLE遷移でmap/player/ghostリセットを追加（計画外の修正）
- functional-design.mdの更新を追加（計画外）

### 学んだこと

- フェーズ遷移テストには `private` メソッドへの型アサーションアクセスが有効（`update` を直接呼び出すことで、RAF依存なしにロジックをテストできる）
- `GAME_OVER → TITLE` のようなリセット遷移では、StateだけでなくManagerクラス全体のリセットが必要

### 次回への改善提案

- `GhostMode` に `HOUSE` / `LEAVING` を追加してゴーストハウス脱出アニメーションを実装
- プレイヤー死亡アニメーション中の残機UI表示タイミングを原作に合わせる（死亡直後に1減らす）
- レベルが上がるごとにゴーストとプレイヤーの速度を調整するバランス実装
