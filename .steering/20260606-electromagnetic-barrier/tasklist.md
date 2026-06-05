# タスクリスト

`design.md` に基づく実装タスク。上から順に消化する。

## 実装

- [x] T1: `src/types.ts` — `GhostMode` から `'FRIGHTENED'` を除去。`GhostState` から `prevMode` / `frightenedTimer` を削除。`PlayerState` に `barrierTimer: number` を追加。
- [x] T2: `src/constants.ts` — `LevelParams.frightenedSpeed` 削除・`frightenedDuration` → `barrierDuration` リネーム（値据え置き）。`LEVEL_PARAMS` 更新。トップレベル `FRIGHTENED_SPEED` / `FRIGHTENED_DURATION` 削除。`BARRIER_BLINK_THRESHOLD = 2.0` 追加。`COLORS` に `BARRIER` 追加・`GHOST_FRIGHTENED*` 削除。
- [x] T3: `src/player.ts` — `barrierTimer` 初期化、`update()` でのタイマー減衰、`activateBarrier()` / `hasBarrier()` / `isBarrierBlinking()` を実装。
- [x] T4: `src/ghost.ts` — `handleCollision()` を `player.hasBarrier()` 判定へ変更。FRIGHTENED 関連（`triggerFrightened`・`getFrightenedEndWarning`・タイマー減算・速度/経路分岐・フィールド・import）を撤去。
- [x] T5: `src/gameLoop.ts` — パワーエサ取得時に `triggerFrightened()` ではなく `player.activateBarrier(getLevelParams(level).barrierDuration)` を呼ぶ。
- [x] T6: `src/renderer.ts` — `drawGhost(s)` の `frightenedEnding` 引数撤去と FRIGHTENED 描画分岐削除。`drawPlayer()` にバリアリング描画（点滅対応）を追加。`GHOST_FRIGHTENED*` 参照除去。

## テスト

- [x] T7: `tests/unit/player.test.ts` — バリア付与・減衰・再取得延長・点滅しきい値のテストを追加。
- [x] T8: `tests/unit/ghost.test.ts` — FRIGHTENED 依存テストをバリア接触仕様（`activateBarrier` 使用）へ書き換え。
- [x] T9: `tests/unit/constants.test.ts` — `frightenedDuration` → `barrierDuration` に更新。
- [x] T10: `tests/unit/gameflow.test.ts` ほか — FRIGHTENED 参照は全 `.ts` で 0 件を確認（追加変更不要）。 FRIGHTENED 参照の有無を確認し、あれば新仕様へ更新。

## 検証

- [x] T11: `npm test`(150 passed) / `npm run typecheck` / `npm run lint` 全てパス。

## 申し送り事項

**実装完了日**: 2026-06-06

**計画と実績の差分**:
- 計画どおり T1〜T11 を完遂。FRIGHTENED モードをコードから完全撤去し、プレイヤー側の電磁バリアへ置き換え。
- 追加対応1: implementation-validator（ギュレル）の Medium 指摘により、死に変数 `GameState.ghostsEatenInFrightened` を削除（FRIGHTENED 撤去の完成）。
- 追加対応2: 永続ドキュメント（`docs/product-requirements.md` / `docs/glossary.md` / `docs/functional-design.md`）の旧パワーエサ＝イジケ仕様を電磁バリア仕様へ更新。glossary の GhostMode 表も実コード（SCATTER/CHASE/VANISHED）へ整合。

**学んだこと / 注意点**:
- 連続加点 `GHOST_EAT_SCORES`（200/400/800/1600）は **per-ghost の `eatenScore`** をキーに参照している。各敵は撃破で即 VANISHED し復活しないため、実際には **各敵=200 固定**で 400/800/1600 には到達しない（旧 FRIGHTENED 実装からの既知挙動を「踏襲」）。受け入れ条件の文面上は連続加点だが、観測上の挙動は要シャビ確認。
- `docs/functional-design.md` は reskin 前の原設計（旧パレット・EATEN/HOUSE/LEAVING モード・frame ベースのタイマー定義）が広範に残存。本機能で直接矛盾する箇所のみ更新し、深い型/シーケンス節の整理は本タスク範囲外として残置。

**次回への改善提案**:
- 真の連続加点（撃破ごとに 200→400→800→1600 へエスカレート）を望む場合は、バリアセッション単位の撃破カウンタを導入する（旧 `ghostsEatenInFrightened` の役割を `barrier` 文脈で復活させる形）。
- `docs/functional-design.md` の原設計乖離を別タスクで一括リコンサイルする。
- `GameState.modeTimer` / `modeIndex` も未使用フィールド（GhostManager 内で別管理）。別タスクでクリーンアップ余地あり。
