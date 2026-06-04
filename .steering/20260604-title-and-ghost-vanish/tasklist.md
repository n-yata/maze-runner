# タスクリスト

## フェーズ1: 倒した敵の即消滅（復活なし）

- [ ] types.ts: `GhostMode` の `'EATEN'` を `'VANISHED'` に置き換える
- [ ] ghost.ts: 撃破挙動とロジックを VANISHED 仕様へ
  - [ ] `handleCollision` で FRIGHTENED 接触時 `g.mode = 'VANISHED'`（スコア・効果音は維持）
  - [ ] `update` のゴーストループ冒頭に `if (g.mode === 'VANISHED') continue;`
  - [ ] `triggerFrightened` のガードを `!== 'VANISHED'` に変更
  - [ ] `moveGhost` の EATEN speed 分岐を削除
  - [ ] `chooseDirection` の EATEN 用ハウス再進入許可分岐を削除
  - [ ] `getTarget` の EATEN 用分岐を削除
  - [ ] `checkCollision` の EATEN 早期 return を削除
- [ ] constants.ts: `EATEN_SPEED` / `GHOST_EATEN_EYES` / `GHOST_EATEN_PUPIL` を削除
- [ ] renderer.ts: `drawGhost` で VANISHED を非描画、未使用の `drawEyes` を削除

## フェーズ2: タイトル画面の作り込み

- [ ] gameLoop.ts: `update` の `case 'TITLE'` で `phaseTimer += dt`
- [ ] renderer.ts: TITLE 分岐を `drawTitle(state.phaseTimer)` に変更
- [ ] renderer.ts: `drawTitle(timer)` 拡張
  - [ ] ロゴ「STELLAR RUN」の登場アニメ（フェードイン＋ポップイン、既存 ease-out 式踏襲）
  - [ ] 宇宙飛行士の浮遊アニメ（`drawAstronautBody` 流用、左右往復＋bob＋歩行、端で向き反転）
  - [ ] 「Press SPACE / Tap」「Arrows / WASD / Swipe」の既存導線を維持

## フェーズ3: テスト

- [ ] 既存テストが `'EATEN'` を参照していないか確認し、必要なら VANISHED 仕様へ更新
- [ ] ghost のユニットテスト追加（撃破で VANISHED 化／VANISHED は移動しない／reset で復活／撃破スコア）

## フェーズ4: 品質チェックと修正

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`

## フェーズ5: 仕上げ

- [x] セキュリティレビュー（クルトワ）実施 — 指摘なし
- [x] 実装後の振り返り（このファイル下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-04（npm test 133 passed / typecheck / build すべて成功、セキュリティレビュー指摘なし）

### 計画と実績の差分

### 学んだこと

### 次回への改善提案
