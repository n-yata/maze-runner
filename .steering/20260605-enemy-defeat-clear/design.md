# 設計

`requirements.md`（/plan-feature で合意済み）を入力とし、実装アプローチを定義する。未決事項は妥当な既定値を採用し、本書で確定する。

## 全体方針

既存の管理クラス分割（Map / Player / Ghost / Fruit / Laser / Particle）を踏襲し、`GameLoop` がオーケストレーションする構成を維持する。クリア条件・撃破手段の変更は **GameLoop と各 Manager のメソッド追加** で吸収し、描画は `Renderer` に閉じる。

## 1. クリア条件の転換（敵全滅クリア）

- `GhostManager` に `allDefeated(): boolean` を追加（`this.ghosts.every(g => g.mode === 'VANISHED')`）。
- `GameLoop.updatePlaying()` のクリア判定を、`map.getRemainingDots() === 0` から `this.ghostMgr.allDefeated()` に置き換える。
- 通常エサ（ドット）は従来どおり残し、`player.update()` での取得＝スコア加算のみ。`dotsEaten` は敵の解放閾値（INKY/CLYDE）に引き続き使用するため計算は維持する。
- ハイスコア保存・STAGE_CLEAR への遷移処理は既存のまま流用。

## 2. フルーツのレーザー化（撃破手段その1）

### 2-1. フルーツの役割変更（`src/fruit.ts`）
- フルーツ取得を「得点」から「レーザーモード発動トリガー」に変更。**フルーツ自体のスコアは付与しない**（未決事項の確定）。
- 出現方式を「dotsEaten 閾値で1回」から「**敵が残る限り一定間隔で繰り返し出現**」に変更（詰み防止）。
  - `updateSpawning(dt, enemiesRemain, level, validPositions)` を追加。盤面にフルーツが無く、敵が残っていれば、クールダウン経過ごとに1個出現させる。
  - `update(dt, playerPixelPos): number` は「今フレームで取得されたフルーツ数」を返すよう変更（取得＝レーザー発動、時間切れ消滅も処理）。
- 既存の `checkSpawn` / `FRUIT_SPAWN_THRESHOLDS` / `FRUIT_MAX_ACTIVE` は廃止。`FruitDef.color` と `getFruitDef` は描画に引き続き使用。
- 定数追加（`src/constants.ts`）: `FRUIT_FIRST_DELAY`（初回出現までの遅延）, `FRUIT_RESPAWN_INTERVAL`（再出現間隔）。`FRUIT_DURATION`（盤面滞在時間）は維持。

### 2-2. レーザー機構（新規 `src/laser.ts`）
- `LaserManager` を新設。`ParticleSystem` と同様に `GameLoop` 内で `new` する（外部依存なし）。
- 状態: レーザーモード残時間 `modeTimer`、発射クールダウン `fireTimer`、ビーム弾プール `beams[]`（固定長・再利用、GCスパイク回避）。
- API:
  - `get active(): boolean` — モード有効か（HUD/描画用）。
  - `activate(): void` — `modeTimer = LASER_DURATION` に設定（フルーツ取得時に呼ぶ）。
  - `reset(): void` — タイマー0・全ビーム停止（ステージ開始・死亡時）。
  - `update(dt, playerPixelPos, playerDir, map, ghostMgr): number` — モード中は `fireTimer` 経過ごとに進行方向へビームを1発生成。全ビームを前進させ、壁/場外で消滅、敵ヒットで `ghostMgr.defeatAt()` を呼び撃破。撃破で得たスコア合計を返す。
  - `getBeams()` — 描画用（生存ビームのみ）。
- 定数追加（`src/constants.ts`）: `LASER_DURATION`, `LASER_FIRE_INTERVAL`, `LASER_SPEED`（tiles/s）, `LASER_HIT_RADIUS`。
- ビームは進行方向 `player.state.dir`（`NONE` の間は発射しない）。トンネルワープはせず場外で消滅（単純・予測可能）。

### 2-3. 撃破ヘルパー（`src/ghost.ts`）
- `defeatAt(px, py, radius): number` を追加。`VANISHED` 以外の敵で、ピクセル距離が radius 未満の最初の1体を `VANISHED` にし、`GHOST_EAT_SCORES`（連続加点）に基づくスコアを返す。1ビーム＝最大1体。
- レーザーは敵のモードを問わず撃破できる（武器としての一貫性）。既存の `eatenScore` を流用して連続加点する。

### 2-4. GameLoop 統合（`src/gameLoop.ts`）
- `private laser = new LaserManager();` を追加。`startNewGame` / `startNextLevel` / `respawnPlayer` で `this.laser.reset()`（死亡でレーザー解除）。`startNextLevel` / `respawnPlayer` でも `fruitMgr.reset()` を呼ぶ（respawn 時の取りこぼし整合）。
- `updatePlaying()`:
  - 既存のパワーエサ→怯え、衝突による撃破は**変更なし**（撃破手段その2として維持）。
  - 旧 `fruitMgr.checkSpawn(...)` を撤去し、`fruitMgr.updateSpawning(dt, !allDefeated, level, validFruitPositions)` を呼ぶ。
  - `const eaten = fruitMgr.update(dt, playerPixelPos)` が >0 なら `laser.activate()` ＋取得スパーク＋`audio.play('EAT_FRUIT')`。
  - `const laserScore = laser.update(dt, playerPixelPos, player.state.dir, map, ghostMgr)`。>0 なら加点＋撃破スパーク＋`audio.play('EAT_GHOST')`。
  - クリア判定を `ghostMgr.allDefeated()` に置換。

## 3. パワーエサによる撃破（既存維持）

`triggerFrightened` → 怯え → 接触で `handleCollision()` → `VANISHED`、の既存フローは変更しない。レーザーと併用可能。

## 4. タイトル画面の刷新（`src/renderer.ts`）

- `render()` の `TITLE` ケースから `map.drawTo(...)` を除去（マップ非表示）。
- `drawTitle()` を「ロゴと光のみ」のシンプル＆スタイリッシュに作り替える:
  - 背景は既存の全画面星空キャンバス（`bgCtx`）をそのまま活かす。
  - ロゴ背後に放射状グロー（ソフトな光）を1枚加える。
  - 「STELLAR RUN」＋サブタイトルのポップイン（既存の ease-out 流用）。
  - 明滅する開始導線（`Press SPACE / Tap`）と操作ヒント。
  - 浮遊する宇宙飛行士の描画は削除（「ロゴと光のみ」の方針に合わせる）。

## 5. PWAアイコンの変更（宇宙飛行士）

- `scripts/generate-icons.js` の `generateIcon()` を、深宇宙＋星々の上に**ヘルメット姿の宇宙飛行士を中央配置**する構図へ書き換える（既存の描画プリミティブ fillCircle/fillRect/fillPoly/roundRect 等を流用）。`drawAlien` は削除し `drawAstronaut` を追加。
- `node scripts/generate-icons.js` を実行し `icons/icon-192.png` / `icon-512.png` / `apple-touch-icon.png` を再生成。
- `icons/icon.svg` も同じ宇宙飛行士構図に書き換え（manifest が参照）。
- `manifest.json` の参照は同一ファイル名のため変更不要。

## 6. テスト方針

- `tests/unit/gameflow.test.ts`: 「全ドット取得で STAGE_CLEAR」を「**敵全滅で STAGE_CLEAR**」へ変更し、「全ドット取得してもクリアにならない」検証を追加。
- `tests/unit/fruit.test.ts`: 新仕様（繰り返し出現・取得数を返す・敵全滅で出ない・時間切れ消滅）に書き換え。
- `tests/unit/ghost.test.ts`: `defeatAt()`（ヒットで VANISHED＋加点、VANISHED は対象外、範囲外は不発）と `allDefeated()` のテストを追加。
- `tests/unit/laser.test.ts`（新規）: activate で active、発射間隔でビーム生成、壁で消滅、敵ヒットで撃破＋スコア、reset で停止。
- `tests/unit/constants.test.ts`: 既存は getLevelParams のみで影響なし。
- e2e（`tests/e2e/*`）は `npm test`（vitest）対象外。アサーションは汎用（背景以外のピクセル/描画変化）のためタイトル刷新後も成立。

## 影響範囲（変更ファイル）

- 変更: `src/constants.ts`, `src/fruit.ts`, `src/ghost.ts`, `src/gameLoop.ts`, `src/renderer.ts`, `scripts/generate-icons.js`, `icons/icon.svg`, 再生成 `icons/*.png`
- 新規: `src/laser.ts`
- テスト: `tests/unit/gameflow.test.ts`, `tests/unit/fruit.test.ts`, `tests/unit/ghost.test.ts`, 新規 `tests/unit/laser.test.ts`

## 確定した既定値（未決事項の解決）

- レーザー: `LASER_DURATION=6.0s`, `LASER_FIRE_INTERVAL=0.18s`, `LASER_SPEED=16 tiles/s`, `LASER_HIT_RADIUS=TILE_SIZE*0.6`。当たり判定は弾の中心と敵中心のユークリッド距離。
- フルーツ再出現: `FRUIT_FIRST_DELAY=4.0s`, `FRUIT_RESPAWN_INTERVAL=6.0s`, 盤面は常に最大1個。フルーツのスコアは0（純粋パワーアップ）。
- レーザーは全モードの敵を撃破可。死亡（respawn）でレーザー・フルーツはリセット。
