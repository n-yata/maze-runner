# タスクリスト

## 実装

- [x] T1: `src/constants.ts` にレーザー定数（LASER_DURATION/FIRE_INTERVAL/SPEED/HIT_RADIUS）とフルーツ再出現定数（FRUIT_FIRST_DELAY/FRUIT_RESPAWN_INTERVAL）を追加し、旧フルーツ定数（FRUIT_SPAWN_THRESHOLDS/FRUIT_MAX_ACTIVE）を撤去
- [x] T2: `src/ghost.ts` に `defeatAt(px, py, radius): number` と `allDefeated(): boolean` を追加
- [x] T3: `src/laser.ts` を新規作成（LaserManager: activate/reset/update/getBeams/active）
- [x] T4: `src/fruit.ts` を新仕様に書き換え（updateSpawning 追加、update は取得数を返す、旧 checkSpawn 撤去）
- [x] T5: `src/gameLoop.ts` を統合（laser 生成・各 reset、updatePlaying のフルーツ/レーザー処理、クリア判定を allDefeated に置換）
- [x] T6: `src/renderer.ts` にレーザー描画追加（render シグネチャに laser を渡す、PLAYING でビーム描画）
- [x] T7: `src/renderer.ts` のタイトル刷新（TITLE でマップ非表示、drawTitle をロゴ＋光のシンプル構成に）
- [x] T8: `scripts/generate-icons.js` を宇宙飛行士構図に書き換え、`icons/icon.svg` も更新、PNG を再生成

## テスト

- [x] T9: `tests/unit/ghost.test.ts` に defeatAt / allDefeated のテストを追加
- [x] T10: `tests/unit/laser.test.ts` を新規作成
- [x] T11: `tests/unit/fruit.test.ts` を新仕様に書き換え
- [x] T12: `tests/unit/gameflow.test.ts` のクリア条件テストを敵全滅ベースに更新

## 検証

- [x] T13: implementation-validator による品質検証（Critical/High ゼロ。指摘の SCORE.FRUIT 削除・コメント明確化・テスト追加を反映）
- [x] T14: `npm test` / `npm run lint` / `npm run typecheck` を通す（147 tests pass）
- [x] T15: 振り返り（申し送り事項）を tasklist.md に記載

## 振り返り（申し送り事項）

**実装完了日**: 2026-06-05

**計画と実績の差分**:
- ほぼ計画どおり完了。検証フェーズでギュレル（implementation-validator）の指摘を受け、計画外の片付けを追加実施:
  - `SCORE.FRUIT`（レーザー化で死んだ定数）を削除
  - `fruit.ts` の再出現クールダウン挙動の意図をコメントで明文化
  - `laser.test.ts` に「activate() がタイマーをリフレッシュ（スタックしない）」テストを追加
- ステップ8で永続ドキュメント（PRD/機能設計/用語集/アーキ/開発ガイドライン）のクリア条件・フルーツ記述を「敵全滅／レーザー」へ更新。

**学んだこと**:
- 既存の `VANISHED`（撃破済み・復活なし）状態が「敵全滅クリア」と好相性で、撃破手段（レーザー／パワーエサ）を1つの終端状態に集約できた。`allDefeated()` 一発でクリア判定が成立。
- フルーツの「盤面にある間はクールダウンを進めない」早期returnが、詰み防止（消滅から一定間隔で必ず再出現）をシンプルに保証。検証者が一度誤読した箇所なので、コメントで意図を固定した。
- テストの時間ステップは浮動小数点境界（例: 4.0 - 3.9 - 0.1 ≈ 8.9e-17）で不安定になりやすい。境界はぴったりではなく余裕を持たせる。

**次回への改善提案**:
- レーザーのパラメータ（持続/連射間隔/弾速/射程）は実機プレイでの手触り調整が望ましい（現状は妥当な既定値）。
- `GameState` の未使用フィールド（modeTimer/modeIndex/ghostsEatenInFrightened）は本機能の対象外だが、別途クリーンアップ余地あり。
- レーザーモード中であることを示す HUD 表示（残時間ゲージ等）があるとプレイ体験が向上する。
- 残タスク: 実機での手触り確認、コミット前のクルトワ（security-engineer）レビュー。
