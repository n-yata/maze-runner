# 設計

`requirements.md`（/plan-feature で合意済み）を入力とし、実装アプローチを定義する。未決事項は妥当な既定値を採用し、本書で確定する。

## 全体方針

既存の管理クラス分割（Map / Player / Ghost / Fruit / Laser / Particle）を踏襲する。今回の本質は **「敵を弱体化する効果（FRIGHTENED）の撤去」と「プレイヤーへの電磁バリア付与」への置き換え**。状態はプレイヤー側に閉じ、敵は常に通常 AI のまま。撃破手段（フルーツ＝レーザー）は不変。

## 1. プレイヤーのバリア状態（`src/player.ts` / `src/types.ts`）

- `PlayerState` に `barrierTimer: number` を追加（0 = 非展開）。`createInitialState()` で 0 に初期化（reset で自動的にバリア解除）。
- `PlayerManager` に API を追加:
  - `activateBarrier(duration: number): void` — `barrierTimer = duration`（再取得で上書き延長）。
  - `hasBarrier(): boolean` — `barrierTimer > 0`。
  - `isBarrierBlinking(): boolean` — `barrierTimer > 0 && barrierTimer < BARRIER_BLINK_THRESHOLD`。
- `update(dt, map, audio)` の先頭（`isDead` early-return の手前）で `if (this.barrierTimer > 0) this.barrierTimer = Math.max(0, this.barrierTimer - dt);` を実行。
- `barrierTimer` は `PlayerState` に持たせ、`hasBarrier()`/`isBarrierBlinking()` 経由で公開（Renderer は state を直接読まずメソッドで判定）。

## 2. パワーエサ → バリア付与（`src/gameLoop.ts`）

- `updatePlaying()` 内の `if (this.didEatPowerDot()) this.ghostMgr.triggerFrightened();` を
  `if (this.didEatPowerDot()) this.player.activateBarrier(getLevelParams(this.state.level).barrierDuration);` に置換。
- `getLevelParams` は既に import 済み。バリア持続時間はレベル別（旧 frightenedDuration と同値）。
- 取得スパーク（既存のパワーエサ取得時 `spawnBurst`）は維持。

## 3. バリア接触による敵撃破（`src/ghost.ts`）

- `update()` の `handleCollision()` を、`g.mode === 'FRIGHTENED'` 判定から **`player.hasBarrier()` 判定**へ変更:
  - `g.mode === 'VANISHED'` は無害（既存ガード維持）。
  - `player.hasBarrier()` が true なら撃破: `GHOST_EAT_SCORES`（連続加点、既存 `eatenScore` 流用）でスコア加算 → `g.mode = 'VANISHED'` → `onDefeat?.(...)` → `audio.play('EAT_GHOST')`。
  - false なら従来どおり `player.die()` + `audio.play('DEATH')`。
- 移動前・移動後の二段衝突チェック（同フレームすり抜け対策）は構造維持。
- `triggerFrightened()`・`getFrightenedEndWarning()` を削除。
- `moveGhost()` の速度を常に `this.ghostSpeed`（FRIGHTENED 分岐削除）。
- `chooseDirection()` の FRIGHTENED ランダム分岐を削除（常にターゲット最短）。
- FRIGHTENED タイマー減算ブロック（update 内）を削除。
- 不要 import（`FRIGHTENED_SPEED`, `FRIGHTENED_DURATION`）とフィールド（`frightenedSpd`, `frightenedDur`）を削除。`reset()` の該当代入も削除。

## 4. 型・定数の整理（`src/types.ts` / `src/constants.ts`）

- `GhostMode` から `'FRIGHTENED'` を除去（`'SCATTER' | 'CHASE' | 'VANISHED'`）。
- `GhostState` から `prevMode` と `frightenedTimer` を削除（FRIGHTENED 専用だったため）。`createGhost()` の該当初期化も削除。
- `LevelParams.frightenedSpeed` を削除、`frightenedDuration` を **`barrierDuration` にリネーム**（値は据え置き: L1=6.0 → L5=2.0）。`LEVEL_PARAMS` 各エントリを更新。
- トップレベル定数 `FRIGHTENED_SPEED` / `FRIGHTENED_DURATION` を削除（参照元が消えるため）。
- 追加: `BARRIER_BLINK_THRESHOLD = 2.0`（残量がこれ未満で点滅）。
- `COLORS` に `BARRIER`（電磁バリアのリング色, 例 `#5FE6FF`）を追加。`GHOST_FRIGHTENED` / `GHOST_FRIGHTENED_END` は未使用化のため削除。

## 5. 描画（`src/renderer.ts`）

- `drawGhosts(ghostMgr, frightenedEnding)` / `drawGhost(g, frightenedEnding)` の `frightenedEnding` 引数を撤去。呼び出し側（READY/PLAYING/PAUSED）を `drawGhosts(ghostMgr)` に統一。
- `drawGhost()` の FRIGHTENED 分岐（青色・点滅・イジケ顔）を削除し、常に `GHOST_COLORS[g.name]` ＋通常の目で描画。
- `drawPlayer(player)` に **電磁バリアのリング描画**を追加:
  - `player.hasBarrier()` が true のとき、飛行士の周囲にグロー付きリング（半径 `TILE_SIZE * 0.85` 前後）を描く。`COLORS.BARRIER` を使用し、`shadowBlur` で発光。
  - `player.isBarrierBlinking()` が true のときは、`Math.floor(Date.now() / 120) % 2 === 0` でリングの描画/非描画を切り替えて点滅させる（既存のフルーツ/敵の点滅手法に倣う）。
- 未使用化する `COLORS.GHOST_FRIGHTENED*` 参照を除去。

## 6. テスト方針

- `tests/unit/player.test.ts`: バリアの付与・自然減衰・再取得で延長・しきい値での点滅判定を追加検証。
  - activateBarrier 後 `hasBarrier()===true`、update で減衰、duration 経過で false。
  - `barrierTimer < BARRIER_BLINK_THRESHOLD` で `isBarrierBlinking()===true`、それ以上で false。
- `tests/unit/ghost.test.ts`: FRIGHTENED 依存テストを新仕様へ書き換え。
  - `triggerFrightened` / `getFrightenedEndWarning` / frightened 復帰のテストを削除。
  - 「バリアあり接触で敵が VANISHED＋加点」「バリアなし接触で player.die」「VANISHED は無害」を `player.activateBarrier()` を使って検証。
  - 既存の `defeatAt()` / `allDefeated()` / 解放・経路テストは維持。
- `tests/unit/constants.test.ts`: `frightenedDuration` 参照を `barrierDuration` に更新。
- `tests/unit/gameflow.test.ts`: FRIGHTENED 参照があれば確認のうえ更新（敵全滅クリアは不変）。

## 影響範囲（変更ファイル）

- 変更: `src/types.ts`, `src/constants.ts`, `src/player.ts`, `src/ghost.ts`, `src/gameLoop.ts`, `src/renderer.ts`
- テスト: `tests/unit/player.test.ts`, `tests/unit/ghost.test.ts`, `tests/unit/constants.test.ts`（必要なら `gameflow.test.ts`）

## 確定した既定値（未決事項の解決）

- バリア持続: レベル別 `barrierDuration`（旧 frightenedDuration と同値, L1=6.0s〜L5=2.0s）。再取得でタイマー上書きリセット。
- 点滅しきい値: `BARRIER_BLINK_THRESHOLD = 2.0s`（旧 FRIGHTENED 終了警告の 2 秒に合わせる）。
- 撃破スコア: `GHOST_EAT_SCORES`（200→400→800→1600）を既存 `eatenScore` で踏襲。撃破敵は VANISHED（復活なし）、全滅で STAGE_CLEAR（既存ロジック流用）。
- バリアの見た目: `COLORS.BARRIER`（電磁シアン）のグローリング。点滅は `Date.now()` ベースの 120ms トグル。
