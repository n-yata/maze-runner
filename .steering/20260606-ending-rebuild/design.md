# 設計書

## アーキテクチャ概要

エンディング演出は既存の描画アーキテクチャ（`GameLoop` がフェーズ駆動、`Renderer` が状態を描画、
`Starfield` が独立背景、`AudioManager`/`ParticleSystem` が演出効果）をそのまま踏襲する。
ロジックは持たず、`ALL_CLEAR` フェーズの `phaseTimer`（秒）だけを入力に**決定論的**に絵を組み立てる。
段階境界の秒値を `constants.ts` に集約し、`renderer`（描画）と `gameLoop`（音/パーティクル発火）が共有する
現行方式を維持する。

```
GameLoop(ALL_CLEAR, phaseTimer)
  ├─ fireEndingCues(before, after)  … 段階境界で audio.play / particles.spawnBurst を1回ずつ
  └─ state を Renderer へ
Renderer.render()
  ├─ Starfield.draw()    … 背景（ワープ期間のみ setWarp で加速）
  ├─ ctx.clearRect()     … 盤面キャンバスは透明クリア（map.drawTo は呼ばない）
  └─ drawEnding(phaseTimer)
        beat A 着陸 / B 歩行・乗船 / C 点火 / D 発進 / E ワープ / F 帰還
constants.ts: ENDING_* 段階境界（renderer と gameLoop が共有）
```

## コンポーネント設計

### 1. `constants.ts` — 段階境界・パラメータ

**責務**:
- エンディング6段階の境界秒を一元管理し、描画と発火のズレを防ぐ。

**実装の要点**:
- 現行 `ENDING_REPAIR_DONE_TIME` / `ENDING_EPILOGUE_TIME` を廃止し、新6段階の境界へ置換。
  - `ENDING_WALK_START = 1.5`（A→B）
  - `ENDING_BOARD_TIME = 4.5`（B→C, 乗船完了）
  - `ENDING_LIFTOFF_TIME = 6.0`（C→D, 発進。名称維持・値変更）
  - `ENDING_WARP_TIME = 7.5`（D→E, ワープ突入）
  - `ENDING_EARTH_TIME = 10.0`（E→F, 地球出現）
  - `ENDING_DURATION = 13.5`（全体尺。名称維持・値変更）
- `ENDING_SHAKE_MAG` / `ENDING_WARP_FACTOR` は維持。`ENDING_ROCKET_CX/CY` は停泊位置に合わせ見直し。
- `gameLoop` のパーティクル座標は盤面ローカル系（`-MAP_OFFSET_Y`）の現行慣習を維持。

### 2. `renderer.ts` — `drawEnding` の再構築

**責務**:
- `phaseTimer` から6段階を分岐し、星空のみを背景に帰還シーンを描く。盤面マップは描かない。

**実装の要点**:
- `ALL_CLEAR` ケースから `map.drawTo(...)` を削除（背景は `bgCtx` の星空のみ）。
- ワープ加速の判定期間を `ENDING_WARP_TIME 〜 ENDING_EARTH_TIME` に変更。
- 既存ヘルパーを流用: `drawAstronautBody(r,'RIGHT',anim)`（歩行）, `drawRocket(cx,cy,lift)`（停泊/発進）,
  `drawWarpLines(progress)`（ワープ）, `glowText` / `pulseAlpha`。
- 新規ヘルパーを追加:
  - `drawSurface(progress)`: 画面下部に惑星地表（ホライズン＋簡素な地面グラデ）。フェードイン対応。
  - `drawEarth(cx, cy, r, approach)`: 青い地球（放射グラデ＋大気グロー、`approach`(0→1) で半径拡大）。
- 各段階の描画:
  - **A 着陸 (0〜1.5)**: `drawSurface` フェードイン、停泊船 `drawRocket(shipX, groundY, 0)`、飛行士を左端に立たせる。全体 alpha フェードイン。
  - **B 歩行 (1.5〜4.5)**: 飛行士 x を左端→船ハッチへ線形補間。`anim` を timer で進め歩行。終盤で飛行士 alpha を落としハッチへ「消える」。
  - **C 点火 (4.5〜6.0)**: 飛行士非表示。`drawRocket(shipX, groundY, ignite)` で炎を立ち上げ。シェイク開始（`ENDING_SHAKE_MAG`）。地表は残す。
  - **D 発進 (6.0〜7.5)**: 機体 y を地上→画面外へ上昇（`lift` 連動で炎最大）。シェイク減衰。地表は下へフェードアウト。
  - **E ワープ (7.5〜10.0)**: 機体は画面外。`drawWarpLines(progress)`。終盤(進捗0.8〜)で減速感（line 長を縮める）。
  - **F 帰還 (10.0〜13.5)**: `drawEarth` を出現→接近。`approach` を段階内進捗で 0→1。最後に `glowText('Press SPACE / Tap')` を導線として出す（`pulseAlpha`）。物語テキストは一切出さない。
- `drawEndingEpilogue`（物語テキスト）は削除し、F の導線描画に置換。

### 3. `gameLoop.ts` — `fireEndingCues` の再マップ

**責務**:
- 新6段階の境界に同期して効果音・パーティクルを1回ずつ発火。

**実装の要点**:
- `ENDING_BOARD_TIME`: 乗船確定（`audio.play('REPAIR_DONE')`、機体まわりに小バースト）。
- `ENDING_LIFTOFF_TIME`: 発進（`audio.play('LIFTOFF')` ＋噴射口からオレンジ大量バースト）。
- `ENDING_EARTH_TIME`: 帰還ファンファーレ（`audio.play('FANFARE')`）。
- import を新境界定数名へ更新。`ALL_CLEAR_DURATION = ENDING_DURATION` は維持。

## データフロー

### ALL_CLEAR エンディング再生
```
1. 最終ステージクリアで GameLoop が phase=ALL_CLEAR, phaseTimer=0 に遷移
2. 毎フレーム phaseTimer += dt し、fireEndingCues(before, after) が境界跨ぎを検出して音/粒子を発火
3. Renderer が星空を描画（ワープ期間は setWarp）、盤面は透明クリア
4. drawEnding(phaseTimer) が6段階を決定論的に描画
5. phaseTimer >= ENDING_DURATION(13.5) で createInitialState → TITLE へ遷移
```

## エラーハンドリング戦略

- 純粋な Canvas 描画・状態読み取りのみで外部 I/O が無く、例外経路は無い。
- timer がどの境界値でも未定義領域に落ちないよう、各 beat を `timer < 境界` の早期 return で連鎖させ、
  最後（F）を既定分岐にして全 timer 値を必ずいずれかの beat が処理する。

## テスト戦略

### ユニットテスト（`tests/unit/gameflow.test.ts`）
- `ALL_CLEAR → TITLE after ENDING_DURATION`: 尺13.5でも遷移すること（既存テストが `ENDING_DURATION` 参照のため値変更に追従）。
- エンディング効果音テスト: 新境界（BOARD/LIFTOFF/EARTH）で `REPAIR_DONE`/`LIFTOFF`/`FANFARE` が各1回発火し、境界手前では未発火・跨ぎフレームで発火・二度撃ちしないこと。
- import する境界定数名を新名称へ更新。

### 目視確認（手動）
- 盤面マップ非表示・歩行乗船・発進・ワープ・地球接近・導線のみ、を実機で確認。

## 依存ライブラリ

新規追加なし（Canvas 手続き描画と既存 SFX のみ）。

## ディレクトリ構造

```
src/constants.ts        # ENDING_* 段階境界の再定義
src/renderer.ts         # drawEnding 再構築 + drawSurface/drawEarth 追加, drawEndingEpilogue 削除, ALL_CLEAR から map 除去
src/gameLoop.ts         # fireEndingCues 再マップ + import 更新
tests/unit/gameflow.test.ts  # 境界定数名・発火検証の更新
```

## 実装の順序

1. `constants.ts` の段階境界を新6段階へ置換。
2. `gameLoop.ts` の import と `fireEndingCues` を新境界へ再マップ。
3. `renderer.ts`: ALL_CLEAR から map 除去・ワープ期間更新・`drawSurface`/`drawEarth` 追加・`drawEnding` 再構築・`drawEndingEpilogue` 置換。
4. `tests/unit/gameflow.test.ts` を新境界へ更新。
5. test / lint / typecheck / build を緑化。
6. クルトワ（security-engineer）レビュー → 振り返り。

## セキュリティ考慮事項

- 外部入力・I/O・シークレットを扱わない描画変更。ハードコーディング懸念（URL/キー/アカウント）は対象外だが、規定によりコミット前にクルトワレビューを実施。

## パフォーマンス考慮事項

- ワープライン・パーティクルは既存実装の範囲。地球グローは放射グラデ1〜2枚に留め、毎フレーム生成コストを抑える。
- 描画は1フレーム内で完結し、追加のタイマー/状態を持たない（`phaseTimer` 純関数）。

## 将来の拡張性

- 段階境界を定数集約しているため、尺やテンポの調整は `constants.ts` のみで可能。
- `drawEarth` / `drawSurface` を独立ヘルパー化することで、他シーン（オープニング等）への再利用余地を残す。
