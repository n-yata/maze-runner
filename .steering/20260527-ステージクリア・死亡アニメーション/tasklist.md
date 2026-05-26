# タスクリスト

- [x] map.ts: drawToFlash() メソッドを MapManager に追加
- [x] renderer.ts: drawDeadPlayer() をスピン+縮小の3フェーズに改修
- [x] renderer.ts: STAGE_CLEAR ケースで drawToFlash() を使った壁フラッシュを追加

## 申し送り事項

- 実装完了日: 2026-05-27
- 計画と実績: 差分なし。全タスクをスムーズに完了。
- 学んだこと:
  - `ctx.save()/restore()` の対称性はスピン等の座標変換で必須。translate 後は原点(0,0)基準で描画するため、元の px/py を保持しつつ回転できる。
  - switch-case で `const` を使う場合は `{ }` ブロックが必須（TypeScript/ESLint のスコープ要件）。
  - `drawToFlash` は offscreen キャッシュなしの毎フレーム描画だが、STAGE_CLEAR 期間（2秒×60fps=120回）なら性能上問題ない意図的な選択。
- 次回への改善提案:
  - フラッシュ用に白色 OffscreenCanvas を別途キャッシュすれば drawToFlash の描画コストをほぼゼロにできる（今は 28×31=868ループ/フレーム）。
  - Canvas API のアニメーションテストは `jsdom` のモックが必要で難易度が高い。timer 境界値（0.3, 0.9, 1.5s）のロジックを純粋関数に切り出せばテスト可能になる。
