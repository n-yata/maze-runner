# タスクリスト

## 🚨 タスク完全完了の原則
**このファイルの全タスクが完了するまで作業を継続すること**

---

## フェーズ1: マップ差別化（壁の色変更）

- [x] `src/constants.ts` — `STAGE_WALL_COLORS` 配列と `getStageColors(level)` 関数を追加
- [x] `src/map.ts` — `wallColor` / `wallInnerColor` プロパティを追加
- [x] `src/map.ts` — `reset(level)` で `getStageColors` を呼んでプロパティを更新
- [x] `src/map.ts` — `drawStaticMap` で `this.wallColor` / `this.wallInnerColor` を使用

## フェーズ2: PWA 修正

- [x] `service-worker.js` — CACHE_NAME を `mazerun-v2` に更新
- [x] `service-worker.js` — PRECACHE_ASSETS に `./dist/fruit.js` を追加

## フェーズ3: 品質チェック

- [x] `npm run typecheck` でエラーなし
- [x] `npm run build` で成功
- [x] `npm test` で全テスト通過

---

## 実装後の振り返り

**実装完了日**: 2026-05-26

**計画と実績の差分**:
- バルベルデ指摘を受け、コンストラクタの初期壁色を `COLORS.WALL` 直参照から `getStageColors(1)` 経由に変更。色定義の一元化を達成。
- `as const` の型制約により `string` 型アノテーションが必要になった（型エラー1件→即修正）。

**学んだこと**:
- マップ構造の変更だけでは視覚的差別化が不十分。**壁の色変更**が最もコスト対効果の高い手段。
- Service Worker のキャッシュリストは新ファイル追加時に必ず更新が必要。今後 src/ にファイル追加時は service-worker.js も併せて更新する。
- `as const` オブジェクトから値を取り出して可変プロパティに代入する場合はリテラル型 vs `string` の型ミスマッチに注意。

**次回への改善提案**:
- `PRECACHE_ASSETS` の手動管理は漏れリスクがある。ビルド時に `dist/*.js` を自動列挙するスクリプトを検討する。
- `getStageColors` や `getMapData` のテストカバレッジが不足。境界値テストを `constants.test.ts` / `map.test.ts` に追加する価値あり。
