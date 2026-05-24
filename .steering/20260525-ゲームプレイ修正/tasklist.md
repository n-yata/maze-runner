# タスクリスト: ゲームプレイ修正

## フェーズ1: モバイル表示修正

- [x] index.html の `min-height: 100vh` を `height: 100svh` に変更（モバイルURL非表示時の空白対策）
- [x] src/main.ts に fitToViewport() を追加（canvasをビューポートに合わせてCSSスケール）

## フェーズ2: プレイヤー速度調整

- [x] src/constants.ts の PLAYER_SPEED を 7.5 → 5.5 に変更

## フェーズ3: トンネルワープ修正

- [x] src/player.ts の壁判定に tunnel exit 例外を追加（col=0でLEFT・col=27でRIGHTの場合はwall判定をスキップ）

## フェーズ4: ゴースト移動バグ修正

- [x] src/types.ts の GhostState に lastTurnTile: Vec2 フィールドを追加
- [x] src/ghost.ts の createGhost() に lastTurnTile: { x: -1, y: -1 } を追加
- [x] src/ghost.ts の moveGhost() に isNewTile チェックを追加（同タイル中心での連続再決定を防ぐ）

## フェーズ5: テスト・ビルド確認

- [x] npm run typecheck（TypeScriptエラーなし確認）
- [x] npm test（全テストパス確認: 67/67）
- [x] npm run build（ビルド成功確認）

## 実装後の振り返り

- **実装完了日**: 2026-05-25

### 修正内容と根本原因

1. **モバイル空白**: `100vh` はモバイルブラウザのURL表示時に可視領域外まで含む。`100svh`（small viewport height）に変更し、fitToViewport() でcanvasのCSSサイズをビューポートに合わせてスケール。
2. **速度**: `PLAYER_SPEED 7.5 → 5.5 tiles/s`。1フレームあたり120px/s → 88px/sに減速。
3. **トンネルワープ**: `map.isWall()` が境界外を壁判定するため、col=0/27でLEFT/RIGHT移動時に出口でブロックされていた。トンネルタイル上での出口方向は壁判定をスキップする処理を追加。
4. **ゴースト不動**: `1/60s`のdt時の移動量（≈1.73px）が `nearCenter` 閾値（2px）より小さいため、毎フレーム前タイル中心に引き戻されていた。`lastTurnTile` フィールドで「新しいタイルに到達した時のみ方向決定」に変更。
