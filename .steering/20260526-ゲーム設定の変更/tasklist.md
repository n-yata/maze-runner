# タスクリスト

## 🚨 タスク完全完了の原則
**このファイルの全タスクが完了するまで作業を継続すること**

---

## フェーズ1: 型定義・定数追加

- [x] `src/types.ts` — GamePhase に `'ALL_CLEAR'` を追加
- [x] `src/constants.ts` — `MAX_LEVEL = 3` を追加

## フェーズ2: マップデータ追加 (src/map.ts)

- [x] MAP_DATA_2 (ステージ2用 28×31 マップ) を追加
- [x] MAP_DATA_3 (ステージ3用 28×31 マップ) を追加
- [x] `getMapData(level: number): number[]` ヘルパー関数を追加
- [x] `reset(level?: number)` シグネチャ変更 — level に応じてマップデータを切り替え
- [x] `buildOffscreenCanvas` を `reset()` 内で再呼び出しするよう修正

## フェーズ3: GameLoop 修正 (src/gameLoop.ts)

- [x] `ALL_CLEAR` フェーズ定数 `ALL_CLEAR_DURATION = 5.0` を追加
- [x] `startNextLevel()` — `level >= MAX_LEVEL` の場合 ALL_CLEAR フェーズへ
- [x] `startNextLevel()` — `map.reset(this.state.level)` に level を渡すよう修正
- [x] `respawnPlayer()` でも map.reset を呼ばないよう確認（map.reset はステージ移行時のみ）
- [x] `update()` switch に `case 'ALL_CLEAR':` を追加（タイマー後タイトルへ）
- [x] `handleStart()` で ALL_CLEAR フェーズ中に SPACE/タップ → タイトルへ

## フェーズ4: Renderer 修正 (src/renderer.ts)

- [x] `render()` switch に `case 'ALL_CLEAR':` を追加
- [x] `drawAllClear()` プライベートメソッドを実装

## フェーズ5: 品質チェック

- [x] `npm run typecheck` でエラーなし
- [x] `npm run build` で成功
- [x] `npm test` で全テスト通過

---

## 実装後の振り返り

**実装完了日**: 2026-05-26

**計画と実績の差分**:
- バルベルデ（implementation-validator）の指摘で `startNextLevel` のレベルインクリメント順序を「チェック先行」に変更。ALL_CLEAR 中も level=3 のまま維持し、UI 表示と状態の一貫性を確保した。
- dotsEaten のリセットを ALL_CLEAR 分岐にも追加。

**学んだこと**:
- `level++` → MAX_LEVEL チェック より `MAX_LEVEL チェック` → `level++` の順序が意味的に明確で副作用がない。早期リターンの前に状態をクリーンにする原則を徹底。
- MapManager.reset(level) のデフォルト引数で後方互換性を維持できるため、既存テストの変更なしにシグネチャ変更ができた。

**次回への改善提案**:
- MAP_DATA_2/3 のマップ構造をテストで検証する回帰テストを追加すると、将来のマップ編集時の誤りを検出できる（バルベルデ提案）。
- マップ4・5など将来の拡張時は `getMapData` に switch 文を使うか、配列でインデックス管理すると可読性が上がる。
