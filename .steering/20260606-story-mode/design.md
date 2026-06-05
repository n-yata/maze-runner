# 設計書: ストーリーモード（宇宙船修理エンディング）

## アーキテクチャ概要

既存のフェーズ駆動ゲームループ（`GameLoop.update()` の `switch(phase)`）に**最小限のフェーズ拡張**を
加えてストーリーを乗せる。新しいマネージャークラスは追加せず、既存の `GameState` / `Renderer` /
`constants` の拡張で完結させる（ゼロ依存・即プレイの方針を維持）。

- **オープニング**: 新フェーズ `INTRO` を1つだけ追加。TITLE で開始入力 → `INTRO` → ステージ1（READY）。
- **部品収集**: `GameState.partsCollected` を追加。ステージクリア（敵全滅→STAGE_CLEAR遷移）時に +1。
- **エンディング**: 既存 `ALL_CLEAR` フェーズを**拡張**し、修理→発進の物語演出に作り替える（新フェーズ不要）。
- **リセット**: 永続化しないため、`createInitialState()` が `partsCollected: 0` を返すことで
  ゲームオーバー／タイトル復帰時に自動初期化される。

```
TITLE --(開始入力)--> INTRO --(入力 or INTRO_DURATION)--> READY(stage1) --> PLAYING
   PLAYING --(敵全滅: partsCollected++)--> STAGE_CLEAR --> 次レベル or ALL_CLEAR(=エンディング)
   ALL_CLEAR --(5秒 or 入力)--> TITLE  ※ createInitialState で partsCollected=0 に戻る
```

## コンポーネント設計

### 1. types.ts（型拡張）

**責務**: ストーリー状態の型を定義する。

**実装の要点**:
- `GamePhase` に `'INTRO'` を追加する。
- `GameState` に `partsCollected: number`（0〜MAX_LEVEL）を追加する。

### 2. constants.ts（定数）

**責務**: 部品総数とオープニングの演出時間を一元管理する。

**実装の要点**:
- `TOTAL_PARTS = MAX_LEVEL`（部品総数 = ステージ数）を追加。HUD / エンディングが参照する。
- 演出時間はゲームループ側の既存パターン（`READY_DURATION` 等が gameLoop.ts 内 const）に合わせ、
  `INTRO_DURATION` は `gameLoop.ts` に置く。

### 3. gameLoop.ts（フェーズ遷移と部品加算）

**責務**: オープニング遷移、部品加算、エンディング到達のロジック。

**実装の要点**:
- `INTRO_DURATION`（例: 7.0秒）を追加。
- `createInitialState()` に `partsCollected: 0` を追加。
- `handleStart()`:
  - `TITLE` ケース → `startNewGame()` を直接呼ばず、`INTRO` フェーズへ遷移する（`startIntro()`）。
  - `INTRO` ケースを追加 → 入力で `startNewGame()`（オープニングのスキップ）。
- `update()` に `INTRO` ケースを追加 → `phaseTimer >= INTRO_DURATION` で `startNewGame()`。
- `updatePlaying()` の敵全滅クリア判定ブロックで、`STAGE_CLEAR` 遷移時に `partsCollected++`。
  - フェーズが PLAYING → STAGE_CLEAR に切り替わるため、加算は1ステージ1回のみ発火する。

### 4. renderer.ts（描画）

**責務**: HUDの部品進捗、オープニング、エンディング演出の描画。

**実装の要点**:
- `drawUI()` に `部品 n/TOTAL_PARTS` を追加（既存 `glowText` を再利用）。HUD領域（上部4タイル）内に配置。
- `render()` の `switch` に `INTRO` ケースを追加し `drawIntro(phaseTimer)` を呼ぶ（マップは描かず星空＋テキスト、TITLE と同系）。
- 既存 `drawAllClear()` を `drawEnding(timer, parts)` に作り替え、`ALL_CLEAR` ケースから時間引数付きで呼ぶ:
  - 0〜2.0s: 「全部品 回収完了 / 宇宙船を修理中...」＋部品 3/3
  - 2.0〜3.5s: 修理グロー演出（pulse）
  - 3.5〜5.0s: 宇宙船が発進する簡易アニメ（上昇＋スラスター発光）＋「発進！ / RESCUE COMPLETE」
  - 末尾に `Press SPACE / Tap`（`pulseAlpha`）で TITLE へ戻れる導線を維持。
- 新規画像アセットは使わず、既存の `glowText` / `drawPanel` / 図形描画で表現する。

## データフロー

### オープニング
```
1. TITLE で SPACE/Tap → handleStart() TITLE: startIntro() で phase=INTRO, phaseTimer=0
2. update() INTRO: phaseTimer += dt
3. 入力 → handleStart() INTRO: startNewGame()（スキップ）
   または phaseTimer >= INTRO_DURATION → startNewGame()
4. startNewGame() で phase=READY, ステージ1セットアップ
```

### 部品収集 → エンディング
```
1. updatePlaying() で ghostMgr.allDefeated() == true
2. partsCollected++ し、phase=STAGE_CLEAR（ハイスコア確定は既存どおり）
3. STAGE_CLEAR 経過 → startNextLevel()
4. level >= MAX_LEVEL なら phase=ALL_CLEAR（このとき partsCollected == 3）
5. drawEnding(phaseTimer, partsCollected) が修理→発進を描画
6. 5秒経過 or 入力 → createInitialState()（partsCollected=0）→ TITLE
```

## エラーハンドリング戦略

- ゲームループ内で例外を投げない方針を踏襲（ガイドライン準拠）。
- 新規の localStorage アクセスは行わない（永続化なし）ため、追加のフォールバックは不要。

## テスト戦略

### ユニットテスト（tests/unit/gameflow.test.ts に追加）
- TITLE → INTRO（開始入力で INTRO に入る。※既存の TITLE→READY 期待を INTRO に更新）
- INTRO → READY（INTRO_DURATION 経過で startNewGame により READY へ）
- INTRO → READY（入力でスキップ）
- `partsCollected` 初期値が 0
- ステージクリア（PLAYING→STAGE_CLEAR）で `partsCollected` が +1
- 3ステージ連続クリアで `partsCollected === 3` かつ ALL_CLEAR 到達
- ALL_CLEAR → TITLE 後に `partsCollected` が 0 にリセットされる

### 手動テスト
- 通しプレイで オープニング → 部品 1/3→2/3→3/3 → エンディング → タイトル の流れを確認。
- 60fps が維持されること（演出は軽量描画のみ）。

## 依存ライブラリ

追加なし（Vanilla TypeScript + Canvas のまま）。

## ディレクトリ構造

```
src/
├── types.ts       # GamePhase に INTRO 追加、GameState に partsCollected 追加
├── constants.ts   # TOTAL_PARTS 追加
├── gameLoop.ts    # INTRO 遷移、部品加算、INTRO_DURATION
└── renderer.ts    # HUD部品表示、drawIntro、drawEnding（drawAllClear を拡張）
tests/unit/
└── gameflow.test.ts  # INTRO / 部品 / エンディングのテスト追加・更新
```

## 実装の順序

1. types.ts に `INTRO` と `partsCollected` を追加
2. constants.ts に `TOTAL_PARTS` を追加
3. gameLoop.ts に INTRO 遷移・部品加算・INTRO_DURATION を実装
4. renderer.ts に HUD部品表示・drawIntro・drawEnding を実装
5. gameflow.test.ts のテスト更新・追加
6. test / lint / typecheck / build で検証

## セキュリティ考慮事項

- 外部通信・新規 localStorage アクセスなし。攻撃面の増加なし。
- ユーザー入力を DOM に描画せず Canvas のみに渡す既存方針を維持（XSSリスクなし）。

## パフォーマンス考慮事項

- 追加描画はテキスト＋単純図形のみで、毎フレームの重い計算は行わない（60fps維持）。
- 部品加算はフェーズ遷移時の1回のみ。

## 将来の拡張性

- ステージ間ナレーションや永続化を後から足す場合も、`partsCollected` と INTRO/エンディングの
  枠組みを土台にできる（今回はスコープ外）。
