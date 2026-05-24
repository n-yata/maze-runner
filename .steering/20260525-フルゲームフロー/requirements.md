# 要求定義: フルゲームフロー

## 概要

現在のゲームエンジン基盤に欠けている「ゲームフローの完成」を実装する。
READY → PLAYING → PLAYER_DEAD → STAGE_CLEAR → GAME_OVER の全フェーズ遷移を
仕様通りに実装し、プレイアブルな状態に仕上げる。

## 背景・目的

- ゲームエンジン基盤で TITLE/PLAYING/PAUSE/GAMEOVER/CLEAR の簡易版を実装済み
- フルゲームフローとして READY カウントダウン、PLAYER_DEAD 死亡アニメーション、
  STAGE_CLEAR クリアアニメーション、PAUSED 一時停止、GAME_OVER 遅延復帰を完成させる
- これにより「プレイヤーが一通りゲームを楽しめる」状態になる

## スコープ

### In Scope

- `GamePhase` 型の拡張（READY, PLAYER_DEAD, STAGE_CLEAR, PAUSED, GAME_OVER を仕様準拠に）
- READY フェーズ: 「READY!」表示、3秒後自動で PLAYING 遷移
- PAUSED フェーズ: ESC キーで一時停止 / 解除
- PLAYER_DEAD フェーズ: 死亡アニメーション（1.5秒）→ 残機あり: READY / 残機0: GAME_OVER
- STAGE_CLEAR フェーズ: クリアアニメーション（2秒）→ 次レベルの READY 遷移
- GAME_OVER フェーズ: GAME OVER 表示、3秒後に入力受付 → TITLE 遷移
- 各フェーズのオーバーレイ描画（READY!/PAUSED/STAGE CLEAR!/GAME OVER）
- プレイヤー死亡アニメーション描画（パックマンが閉じていく円弧）

### Out of Scope

- BGM（Web Audio API での効果音は既存実装を使う）
- マルチレベルのバランス調整
- フルーツアイテム

## 受け入れ条件

- [ ] ゲーム開始時に「READY!」が3秒間表示されてからゲームが始まる
- [ ] ESC キーで一時停止、再押しで再開できる
- [ ] ゴーストに当たるとプレイヤー死亡アニメーション後に残機が減る
- [ ] 残機0でゲームオーバー画面、タップ/スペースで TITLE に戻る
- [ ] 全ドット収集でステージクリア表示、次のレベルが始まる
- [ ] 各フェーズで適切なオーバーレイテキストが表示される

## 制約

- 既存の types.ts / gameLoop.ts / renderer.ts を改修する（新規ファイル不要）
- TypeScript strict mode 維持
