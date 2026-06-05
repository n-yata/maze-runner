# タスクリスト: ストーリーモード（宇宙船修理エンディング）

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

- 全てのタスクを `[x]` にすること
- 未完了タスク（`[ ]`）を残したまま作業を終了しない
- スキップは技術的理由のみ（理由を明記）

---

## フェーズ1: 型と定数の拡張

- [x] types.ts に `INTRO` フェーズと `partsCollected` を追加
  - [x] `GamePhase` に `'INTRO'` を追加
  - [x] `GameState` に `partsCollected: number` を追加
- [x] constants.ts に `TOTAL_PARTS`（= MAX_LEVEL）を追加

## フェーズ2: ゲームループ（遷移と部品加算）

- [x] `INTRO_DURATION` 定数を追加
- [x] `createInitialState()` に `partsCollected: 0` を追加
- [x] `handleStart()` を更新
  - [x] TITLE → INTRO 遷移（`startIntro()`）
  - [x] INTRO ケースを追加（入力でスキップ → `startNewGame()`）
- [x] `update()` に INTRO ケースを追加（`INTRO_DURATION` 経過で `startNewGame()`）
- [x] `updatePlaying()` のクリア判定で `partsCollected++`（STAGE_CLEAR 遷移時）

## フェーズ3: 描画（HUD・オープニング・エンディング）

- [x] `drawUI()` に部品進捗 `部品 n/TOTAL_PARTS` を追加
- [x] `render()` に INTRO ケースを追加し `drawIntro(phaseTimer)` を実装
- [x] `drawAllClear()` を `drawEnding(timer, parts)` に拡張（修理→発進演出）し ALL_CLEAR ケースを更新

## フェーズ4: テスト

- [x] gameflow.test.ts: 既存 TITLE→READY 期待を TITLE→INTRO に更新
- [x] gameflow.test.ts: INTRO → READY（タイムアウト）テスト追加
- [x] gameflow.test.ts: INTRO → READY（入力スキップ）テスト追加
- [x] gameflow.test.ts: `partsCollected` 初期値 0 テスト追加
- [x] gameflow.test.ts: ステージクリアで `partsCollected` +1 テスト追加
- [x] gameflow.test.ts: 3ステージクリアで `partsCollected === 3` かつ ALL_CLEAR テスト追加
- [x] gameflow.test.ts: ALL_CLEAR → TITLE で `partsCollected` が 0 にリセットされるテスト追加

## フェーズ5: 品質チェックと修正

- [x] `npm test`（162 件全パス。うち gameflow 27 件）
- [x] `npm run lint`（tsc --noEmit, エラーなし）
- [x] `npm run typecheck`（エラーなし）
- [x] `npm run build`（成功）

## フェーズ6: ドキュメント更新

- [x] 永続ドキュメントへの影響を確認し必要なら更新（PRD にストーリー進行を追記、functional-design の GamePhase/GameState を更新）
- [x] 実装後の振り返り（このファイル下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-06

### 計画と実績の差分

**計画通りに進んだ点**:
- 新フェーズは `INTRO` のみ追加、エンディングは既存 `ALL_CLEAR` の拡張で対応（設計通り）。
- 永続化なしのため `createInitialState()` のリセットで全経路（タイトル復帰・ゲームオーバー）を自動カバー。

**計画から追加した点**:
- 検証（ギュレル）の指摘で、受け入れ条件「STAGE CLEAR 表示に『部品 n/3 回収』の文言」を満たすため
  `drawStageClear()` に `partsCollected` 引数を追加し文言を表示（当初は HUD 常時表示のみで済ませていた）。
- GAME_OVER 経路での部品リセットテストを追加（リセット経路の網羅強化）。
- `startIntro()` をスプレッド記法に整理（可読性向上）。

**技術的理由でスキップしたタスク**: なし（全タスク完了）。

### 学んだこと

**技術的な学び**:
- フェーズ駆動の `switch(phase)` 構造は、状態追加（`partsCollected`）と1フェーズ追加（`INTRO`）だけで
  物語演出を低コストに乗せられる。既存の `ALL_CLEAR`／`createInitialState` の設計が拡張に効いた。
- 描画演出（`drawIntro`/`drawEnding`/`drawRocket`）は既存の `glowText`/`drawPanel`/図形描画で完結でき、
  新規アセット追加なしの方針を守れた。

**プロセス上の改善点**:
- 受け入れ条件の「文言レベルの要件」（STAGE CLEAR の部品表示）は、HUD表示で機能的には満たせても
  条文どおりではない。実装時に受け入れ条件を1つずつ突き合わせると検証指摘を減らせる。

### 次回への改善提案
- 描画系（renderer）はユニットテスト対象外のため、文言要件は実装時チェックリストで担保する。
- `docs/functional-design.md` のフェーズ/状態定義が実コードと一部乖離しているため、別途同期作業を検討。
