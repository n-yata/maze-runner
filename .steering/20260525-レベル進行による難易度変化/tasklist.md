# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: 型定義とパラメータテーブル（constants.ts）

- [x] `LevelParams` インターフェースを追加
  - [x] `playerSpeed: number`
  - [x] `ghostSpeed: number`
  - [x] `frightenedSpeed: number`
  - [x] `frightenedDuration: number`
  - [x] `ghostReleaseThresholds: Record<GhostName, number>`
  - [x] `modeSchedule: number[]`

- [x] `getLevelParams(level: number): LevelParams` 関数を追加
  - [x] Level 1〜5 のパラメータ配列を定義
  - [x] Level 5 以上は上限キャップ（`Math.min(level, 5) - 1` でインデックス）
  - [x] Level 1 の値が既存定数（PLAYER_SPEED=5.5, GHOST_SPEED=4.5）と一致すること確認

## フェーズ2: GhostManager のレベル対応（ghost.ts）

- [x] インスタンスフィールドの追加
  - [x] `private ghostSpeed: number` (デフォルト: `GHOST_SPEED`)
  - [x] `private frightenedSpd: number` (デフォルト: `FRIGHTENED_SPEED`)
  - [x] `private frightenedDur: number` (デフォルト: `FRIGHTENED_DURATION`)
  - [x] `private releaseThresholds: Record<GhostName, number>`
  - [x] `private modeSchedule: number[]`

- [x] `reset(params?: LevelParams)` シグネチャ変更
  - [x] params が渡された場合、フィールドを更新する
  - [x] params が渡されない場合（後方互換）、デフォルト定数を使用する

- [x] `triggerFrightened()` の `FRIGHTENED_DURATION` を `this.frightenedDur` に変更

- [x] `update()` の定数参照をインスタンス変数に変更
  - [x] `GHOST_RELEASE_DOT_THRESHOLDS` → `this.releaseThresholds`
  - [x] `MODE_SCHEDULE` → `this.modeSchedule`

- [x] `moveGhost()` の `GHOST_SPEED` / `FRIGHTENED_SPEED` を `this.ghostSpeed` / `this.frightenedSpd` に変更

## フェーズ3: PlayerManager のレベル対応（player.ts）

- [x] インスタンスフィールドの追加
  - [x] `private speed: number` (デフォルト: `PLAYER_SPEED`)

- [x] `reset(speed?: number)` シグネチャ変更
  - [x] speed が渡された場合、`this.speed` を更新する
  - [x] speed が渡されない場合、`PLAYER_SPEED` を使用する

- [x] `update()` 内の `PLAYER_SPEED` を `this.speed` に変更

## フェーズ4: GameLoop のパラメータ注入（gameLoop.ts）

- [x] `getLevelParams` のインポートを追加

- [x] `startNewGame()` でパラメータ適用
  - [x] `getLevelParams(1)` を呼び出し
  - [x] `ghostMgr.reset(params)` に変更
  - [x] `player.reset(params.playerSpeed)` に変更

- [x] `startNextLevel()` でパラメータ適用
  - [x] `getLevelParams(state.level)` を呼び出し（level++ 後）
  - [x] `ghostMgr.reset(params)` に変更
  - [x] `player.reset(params.playerSpeed)` に変更

- [x] `respawnPlayer()` でパラメータ適用
  - [x] `getLevelParams(this.state.level)` を呼び出し
  - [x] `ghostMgr.reset(params)` に変更
  - [x] `player.reset(params.playerSpeed)` に変更

## フェーズ5: ユニットテスト追加

- [x] `getLevelParams` のテストを既存テストファイルに追加（または新規作成）
  - [x] `getLevelParams(1)` が Level 1 の正しい値を返す
  - [x] `getLevelParams(5)` と `getLevelParams(10)` が同じ値を返す（上限キャップ確認）
  - [x] ghostSpeed が Level 1 < Level 2 < Level 3 < Level 4 < Level 5 であること
  - [x] frightenedDuration が Level 1 > Level 2 > Level 3 > Level 4 > Level 5 であること

## フェーズ6: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `npm test` (79/79 passed ※検証指摘の修正後)
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck` (エラーなし)
- [x] ビルドが成功することを確認
  - [x] `npm run build` (成功)

### 検証指摘による追加修正（implementation-validator）

- [x] `getLevelParams` の境界値クランプを `Math.max(1, ...)` で修正（level=0/-1 に Level1 を返すよう）
- [x] テスト `'caps at level 5 for level 5'` の恒等式バグを修正（`getLevelParams(6)` vs `getLevelParams(5)` の比較に）
- [x] 境界値テスト追加（level=0, level=-5 が Level1 params を返すこと確認）
- [x] GAME_OVER ブランチの引数なし `reset()` 呼び出しを除去（startNewGame() が正しく処理）
- [x] `ghost.test.ts` に `reset(params)` 検証テスト2件追加

## フェーズ7: ドキュメント更新

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-05-25

### 計画と実績の差分

**計画と異なった点**:
- `constants.ts` の `getLevelParams` 初期実装は `??` フォールバックで境界値を処理していたが、`Math.max(1, ...)` クランプ方式に変更。より意図が明確で level=0/-1 に対する挙動も正しくなった。
- GAME_OVER ブランチの引数なし `reset()` 呼び出しを除去した。元々は redundant だったが、今後の変更でバグになるリスクがあったため削除。

**新たに必要になったタスク**:
- `getLevelParams(0)` / `getLevelParams(-1)` の境界値テスト（implementation-validator の指摘により追加）
- `ghost.test.ts` への `reset(params)` 直接検証テスト2件（同上）

### 学んだこと

**技術的な学び**:
- 速度等の「定数」をインスタンス変数に昇格させる際、コンストラクタでデフォルト値を設定しておくことで後方互換性が保てる（params省略時の reset() が既存テストを壊さない）。
- `??` フォールバックは「存在しない場合に代替を返す」用途には適切だが、「不正入力を正しい範囲にクランプする」用途には `Math.max/min` の方が意図を明確に伝えられる。

**プロセス上の改善点**:
- implementation-validator による検証ループで、設計時に気づかなかったテストの恒等式バグを発見できた。フェーズ5のテスト作成段階で「このテストは何を検証しているか」を自問する習慣が重要。

### 次回への改善提案
- 境界値（level=0, 負値）のテストケースは計画段階のtasklistに最初から含めておくべき。
- パラメータが「プレイヤー速度 > ゴースト速度」などのゲームバランス不変条件を満たすことをテストで保証するパターンは他のパラメータセットにも適用できる。
