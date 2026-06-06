# タスクリスト: エンディング演出のリッチ化

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

- 全てのタスクを `[x]` にする
- 未完了タスク（`[ ]`）を残したまま終了しない
- スキップは技術的理由がある場合のみ（理由を明記）

---

## フェーズ1: 定数の集約・拡張（constants.ts）

- [x] 段階境界・総尺の変更／追加
  - [x] `ENDING_LIFTOFF_TIME` を 3.5 → 4.0 に変更
  - [x] `ENDING_EPILOGUE_TIME = 6.5` を追加（C終了＝エピローグ開始）
  - [x] `ENDING_DURATION` を 5.0 → 9.0 に変更
- [x] 盤面オフセットを constants へ移設
  - [x] `UI_HEIGHT = 4 * TILE_SIZE` / `MAP_OFFSET_Y = UI_HEIGHT` を export
- [x] エンディング演出パラメータを追加
  - [x] `ENDING_ROCKET_CX` / `ENDING_ROCKET_CY`（噴射原点, canvas座標）
  - [x] `ENDING_SHAKE_MAG`（画面シェイク強度）
  - [x] `ENDING_WARP_FACTOR`（星のワープ倍率）

## フェーズ2: サウンド追加（types.ts / audio.ts）

- [x] `SoundKey` に `REPAIR_DONE` / `LIFTOFF` / `FANFARE` を追加
- [x] `SOUND_DEFS` に3音の定義を追加（オシレータ合成、音源ファイルは追加しない）
  - [x] `REPAIR_DONE`（復旧音: triangle 中高音）
  - [x] `LIFTOFF`（発進音: sawtooth 低音・gainやや大）
  - [x] `FANFARE`（帰還音: triangle 高音）

## フェーズ3: 背景のワープ対応（background.ts）

- [x] `Starfield` に `elapsedMs` / `warp` フィールドを追加
- [x] `setWarp(factor: number)` を追加
- [x] `draw` を `draw(ctx, dtMs)` に変更し、`elapsedMs += dtMs * warp` で内部時刻駆動にする
  - [x] 星・星雲の位置計算を `elapsedMs` ベースへ（倍率変更時も連続）

## フェーズ4: 段階キューの発火（gameLoop.ts）

- [x] `crossed(before, after, t)` ヘルパー（境界またぎ判定）を追加
- [x] `fireEndingCues(before, after)` を追加
  - [x] `ENDING_REPAIR_DONE_TIME` またぎ: `audio.play('REPAIR_DONE')` ＋ 青緑スパーク
  - [x] `ENDING_LIFTOFF_TIME` またぎ: `audio.play('LIFTOFF')` ＋ 噴射バースト
  - [x] `ENDING_EPILOGUE_TIME` またぎ: `audio.play('FANFARE')`
  - [x] パーティクル座標を `MAP_OFFSET_Y` で盤面ローカルへ換算
- [x] `update` の `ALL_CLEAR` ケースで before/after を取り `fireEndingCues` を呼ぶ

## フェーズ5: 多段階描画・シェイク・ワープ（renderer.ts）

- [x] `MAP_OFFSET_Y` をローカル定義から constants の import へ置換
- [x] `drawEnding` を4段階（A回収完了 / B修理完了 / C発進 / Dエピローグ）に拡張
  - [x] 段階Cで画面シェイク（`ENDING_SHAKE_MAG`・`phaseTimer` 駆動で減衰）
  - [x] 段階Cでワープライン（上方向の白ストリーク）を重ねる
  - [x] 段階Dで帰還メッセージを1行ずつ reveal ＋ `Press SPACE / Tap`
- [x] `render` の `ALL_CLEAR` 分岐で `starfield.setWarp`（発進段階のみ加速、他は1）
- [x] `starfield.draw` をフレーム差分 dt 供給に変更（前回時刻を保持）

## フェーズ6: テスト

- [x] 既存テストの尺マジックナンバーを `ENDING_DURATION` import に置換
  - [x] 「ALL_CLEAR → TITLE」テスト
  - [x] 「resets parts to 0 … after the ending」テスト
- [x] エンディングキューのテストを追加
  - [x] `ALL_CLEAR` を総尺まで進め、`REPAIR_DONE`/`LIFTOFF`/`FANFARE` が各1回発火
  - [x] 境界の直前では未発火、またいだ最初のフレームで発火（二重発火なし）

## フェーズ7: 品質チェックと修正

- [x] `npm test` が通る（168件 緑）
- [x] `npm run lint` がエラーなし
- [x] `npm run typecheck` がエラーなし
- [x] `npm run build` が成功する

## フェーズ8: ドキュメント更新

- [x] 必要に応じて `docs/` の関連ドキュメントを更新（`functional-design.md` の ALL_CLEAR 説明を4段階に更新）
- [x] 実装後の振り返り（このファイル下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-06

### 計画と実績の差分

**計画どおり進んだ点**:
- 段階A〜Dの4段階化、総尺 5.0→9.0秒、共有定数（`ENDING_*`）による gameLoop/renderer の同期は設計どおり。
- 既存資産（`spawnBurst` / `glowText` / `drawPanel` / `drawRocket` / `AudioManager`）を再利用し、新規ヘルパーは `drawWarpLines` / `drawEndingEpilogue` の2つのみに抑えた。

**計画から微調整した点**:
- 星のワープは `Starfield.draw(timeMs)`（絶対時刻）のままだと倍率変更で位置がジャンプするため、
  内部経過時間 `elapsedMs` ＋ `warp` 倍率方式（`draw(ctx, dtMs)`）に変更。連続性を保ちつつ加速を実現した。
- `MAP_OFFSET_Y` を renderer ローカル定義から constants へ移設し、gameLoop のパーティクル座標換算と共有
  （マジックナンバー重複の回避）。
- 実装中に発見した未使用 import（renderer の `ENDING_DURATION`）を除去。

**レビュー反映（implementation-validator）**:
- `lastBgTime` を `number | null` 初期化に変更し、初回フレームのフォールバック判定を型安全化。

### 学んだこと

**技術的な学び**:
- 段階境界キューの「1回だけ発火」は、半開区間判定 `before < t && after >= t` で固定タイムステップでも
  二重発火を防げる。境界直前・直後・継続の3観点をテストで固定すると回帰に強い。
- パーティクルの座標系（盤面ローカル＋描画時 `MAP_OFFSET_Y` 加算）を意識した換算で、
  描画位置（`drawRocket`）と発火位置を一致させられる。
- 描画演出は `phaseTimer` 駆動で決定論的に算出すると state を増やさずテストも安定する（シェイク・ワープ）。

**プロセス上の改善点**:
- `/plan-feature` で固めた requirements.md をそのまま尊重して design/tasklist に展開できた。
- 尺などのマジックナンバーをテストでも定数 import に統一し、将来の尺変更へ自動追随できる形にした。

### 次回への改善提案
- `drawEnding` の `ctx.save()/restore()` は各分岐末尾に分散しているため、段階追加時は1箇所集約を検討する。
- 噴射スパークのオフセット `56` 等、機体形状由来の値は将来 constants 化すると意図が明確になる。
