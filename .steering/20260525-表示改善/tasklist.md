# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: index.html — canvas ラッパー追加

- [x] `<canvas id="gameCanvas">` を `<div id="game-wrapper">` で包む
- [x] `#game-wrapper` スタイルを追加
  - [x] `overflow: hidden`
  - [x] `width: 100%`
  - [x] `flex-shrink: 0`
  - [x] `display: flex; justify-content: center`

## フェーズ2: src/main.ts — fitToViewport モバイル対応

- [x] `COLS` を `./constants.js` からインポート
- [x] `fitToViewport` にタッチデバイス判定を追加
  - [x] `window.matchMedia('(pointer: coarse)').matches` でタッチ判定
  - [x] タッチ時: `scaleX = innerWidth / (canvas.width * (COLS-2) / COLS)`
  - [x] 非タッチ時: 従来通り `scaleX = innerWidth / canvas.width`
  - [x] `scale = Math.min(scaleX, scaleY)` で最終スケール決定

## フェーズ3: src/renderer.ts — UI 要素余白修正

- [x] `drawUI` の SCORE テキスト x を `4` → `TILE_SIZE + 4` に変更
- [x] `drawUI` の HI テキスト x を `CANVAS_WIDTH - 4` → `CANVAS_WIDTH - TILE_SIZE - 4` に変更
- [x] `drawUI` の Lives 最初の円の x を `8` → `TILE_SIZE + 8` に変更

## フェーズ4: 品質チェック

- [x] `npm run typecheck` でエラーなし
- [x] `npm run build` で成功
- [x] `npm test` で全テスト通過 (79/79)

---

## 実装後の振り返り

### 実装完了日
2026-05-25

### 計画と実績の差分

**計画通りに進んだ点**:
- 3ファイルのみの変更で完結（index.html, main.ts, renderer.ts）
- タッチデバイス判定に `pointer: coarse` メディアクエリを使用
- 数学的に証明: `viewport_w * (COLS-2)/COLS` のスケール式は常にぴったり1タイル（16px）をクリップする

**計画と異なった点**:
- なし

### 学んだこと

**数学的な学び**:
- クリップ量の計算: `scaleX = viewport_w / (canvas_w * (COLS-2)/COLS)` のとき、内部クリップ量 = `(viewport_w/2) / scaleX` = `viewport_w * TILE_SIZE / viewport_w` = `TILE_SIZE`（定数）。デバイス幅によらず常に1タイル分だけクリップされる美しい性質がある。

**実装の学び**:
- `overflow: hidden` を body に頼るより専用 wrapper div の方が明示的で確実。body の overflow はブラウザによって特殊扱いされる場合がある。
- implementation-validator が「タブレットで1タイル超クリップの恐れ」と指摘したが、上記の数学的証明により杞憂だった。検証エージェントの指摘は参考にしつつ自分で数値を確認する姿勢が重要。

### 次回への改善提案
- `fitToViewport` のスケール計算は独立モジュール化するとユニットテストが書きやすくなる（現状 renderer.ts/main.ts はテストカバレッジ 0%）。
- タイル拡大率の上限は「ゲームプレイコンテンツが入る最小列数」で決まる。今回は28列中2列（外壁のみ）が安全限界。将来マップを変更する場合は外壁の幅を確認すること。
