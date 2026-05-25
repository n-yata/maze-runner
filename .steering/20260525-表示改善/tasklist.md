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

（実装完了後に記入）
