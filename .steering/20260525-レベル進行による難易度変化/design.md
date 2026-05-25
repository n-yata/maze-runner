# 設計書

## アーキテクチャ概要

既存のゲームループパターンを維持しつつ、定数として固定されていた速度・持続時間パラメータをレベル別の「設定オブジェクト」として外部化する。GameLoopがパラメータの組み立てと配布の責任を持ち、GhostManager/PlayerManagerはパラメータを受け取って内部状態として保持する。

```
GameLoop.startNextLevel(level)
    │
    ├── getLevelParams(level) → LevelParams
    │
    ├── ghostMgr.reset(params)  ← ghostSpeed, frightenedSpeed,
    │                              frightenedDuration, releaseThresholds
    │
    └── player.reset(params.playerSpeed)  ← playerSpeed
```

## コンポーネント設計

### 1. LevelParams（constants.ts に追加）

**責務**:
- レベルごとのゲームパラメータを一元管理

**実装の要点**:
- `GhostName` を `constants.ts` が既にインポートしているため、そのまま利用可能
- Level 1のパラメータは既存の定数値（`PLAYER_SPEED=5.5`, `GHOST_SPEED=4.5`）と一致させる
- Level 5以上は上限値でキャップ（`Math.min(level, 5)` でインデックス管理）

**レベルパラメータ表**:

| Level | playerSpeed | ghostSpeed | frightenedSpeed | frightenedDuration | INKY | CLYDE |
|-------|-------------|------------|-----------------|-------------------|------|-------|
| 1     | 5.5         | 4.5        | 3.0             | 6.0s              | 30   | 60    |
| 2     | 5.8         | 5.0        | 3.0             | 5.0s              | 20   | 40    |
| 3     | 6.0         | 5.5        | 3.0             | 4.0s              | 15   | 30    |
| 4     | 6.2         | 5.8        | 3.0             | 3.0s              | 10   | 20    |
| 5+    | 6.5         | 6.2        | 3.0             | 2.0s              | 5    | 10    |

注: modeSchedule（SCATTER/CHASE交替間隔）はLevel 1〜3は同一、Level 4+は若干SCATTER時間を短縮。

### 2. GhostManager（ghost.ts を変更）

**責務**:
- レベルパラメータに基づいてゴーストの速度・イジケを制御

**実装の要点**:
- プライベートフィールドとして `ghostSpeed`, `frightenedSpeed`, `frightenedDuration`, `releaseThresholds`, `modeSchedule` を保持
- `reset(params: LevelParams)` でパラメータを受け取り、フィールドに格納
- `moveGhost` 内の速度参照を定数から `this.ghostSpeed` 等に変更
- `triggerFrightened` の `FRIGHTENED_DURATION` を `this.frightenedDuration` に変更
- `update` 内の `GHOST_RELEASE_DOT_THRESHOLDS` を `this.releaseThresholds` に変更
- `update` 内の `MODE_SCHEDULE` を `this.modeSchedule` に変更
- コンストラクタでは Level 1 のデフォルト値（既存定数）で初期化

### 3. PlayerManager（player.ts を変更）

**責務**:
- レベルパラメータに基づいてプレイヤー速度を制御

**実装の要点**:
- プライベートフィールド `speed: number` を追加（デフォルト: `PLAYER_SPEED`）
- `reset(speed?: number)` でオプションの速度を受け取り（未指定時は Level 1 デフォルト）
- `update` 内の `PLAYER_SPEED` を `this.speed` に変更

### 4. GameLoop（gameLoop.ts を変更）

**責務**:
- レベル変化時に適切なパラメータを各マネージャへ渡す

**実装の要点**:
- `getLevelParams` を `constants.ts` からインポート
- `startNewGame()`: Level 1 params を渡してリセット
- `startNextLevel()`: 新しい level の params を渡してリセット
- `respawnPlayer()`: 現在の level の params を渡してリセット（速度維持のため）
- `state.level` が既に `GameState` に存在するので追加不要

## データフロー

### レベルアップ時のパラメータ適用

```
1. ステージクリア → STAGE_CLEAR フェーズ
2. phaseTimer >= CLEAR_DURATION → startNextLevel() 呼び出し
3. state.level++ (既存)
4. getLevelParams(state.level) → LevelParams オブジェクト生成
5. ghostMgr.reset(params) → ghostSpeed, frightenedDuration etc. をフィールドに格納
6. player.reset(params.playerSpeed) → speed フィールドに格納
7. READY フェーズへ遷移
8. プレイ再開 → 新しい速度で動作
```

## エラーハンドリング戦略

- `getLevelParams` は存在しないレベルに対して最終要素（Level 5相当）を返す。`??` オペレータで安全にフォールバック。
- TypeScript の `strict` モードで型安全性を担保。

## テスト戦略

### ユニットテスト
- `getLevelParams(1)` が Level 1 の正しい値を返すこと
- `getLevelParams(5)` / `getLevelParams(10)` が同じ上限値を返すこと（キャップ確認）
- 各レベルでパラメータが単調増加/減少すること（ghostSpeed増加、frightenedDuration減少）

### 統合テスト（手動）
- Level 1 でプレイ → ステージクリア → Level 2 でゴーストが明確に速くなっていること
- Level 5 でもプレイが成立すること（理不尽な速度でない）

## 依存ライブラリ

新規追加なし。ランタイム依存ゼロを維持。

## ディレクトリ構造

変更ファイルのみ:

```
src/
├── constants.ts  ← LevelParams 型 + getLevelParams() 追加
├── ghost.ts      ← reset(params) シグネチャ変更、速度参照をインスタンス変数化
├── player.ts     ← reset(speed?) シグネチャ変更、速度参照をインスタンス変数化
└── gameLoop.ts   ← getLevelParams を使ってリセット時にパラメータ注入
```

## 実装の順序

1. `constants.ts` に `LevelParams` 型と `getLevelParams()` を追加
2. `ghost.ts` の `reset` / `moveGhost` / `triggerFrightened` / `update` を変更
3. `player.ts` の `reset` / `update` を変更
4. `gameLoop.ts` で `getLevelParams` を使うよう変更
5. ユニットテスト追加
6. ビルド確認・型チェック

## セキュリティ考慮事項

- 外部入力なし。ゲーム内部の純粋な数値計算のみ。セキュリティリスクなし。

## パフォーマンス考慮事項

- `getLevelParams` は毎フレームではなくリセット時のみ呼ばれるため、パフォーマンス影響なし。
- オブジェクトの生成は reset 時の1回のみ。

## 将来の拡張性

- `LevelParams` に `modeSchedule` が含まれるため、将来的にレベルごとの SCATTER/CHASE パターン変更も対応可能
- `LevelParams` に `extraLifeThreshold` など追加パラメータを容易に追加できる構造
