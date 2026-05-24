# 設計: フルゲームフロー

## フェーズ遷移図

```
TITLE ──(入力)──> READY ──(3秒後)──> PLAYING
                                       │
                             ┌─────────┤
                             │         │
                    (ESC)    │    (全ドット収集)
                             ▼         ▼
                           PAUSED   STAGE_CLEAR
                             │         │
                    (ESC)    │    (2秒後・次レベル)
                             └────> PLAYING
                                       │
                               (ゴースト接触)
                                       ▼
                                  PLAYER_DEAD
                                       │
                           ┌──────────┤
                           │           │
                     (残機>0)       (残機0)
                      (1.5秒後)      (1.5秒後)
                           ▼           ▼
                          READY    GAME_OVER
                                       │
                                (3秒後+入力)
                                       ▼
                                     TITLE
```

## GamePhase 型変更

```typescript
// 変更前
type GamePhase = 'TITLE' | 'PLAYING' | 'PAUSE' | 'GAMEOVER' | 'CLEAR';

// 変更後（仕様準拠）
type GamePhase = 'TITLE' | 'READY' | 'PLAYING' | 'PAUSED' | 'PLAYER_DEAD' | 'STAGE_CLEAR' | 'GAME_OVER';
```

## GameState 追加フィールド

```typescript
interface GameState {
  // 既存フィールド（変更なし）
  phase: GamePhase;
  score: number;
  highScore: number;
  lives: number;
  level: number;
  dotsEaten: number;
  // ...

  // 追加フィールド
  phaseTimer: number;      // 各フェーズの経過秒数
  gameoverCanInput: boolean; // GAME_OVER で入力受付可能かフラグ
}
```

## フェーズごとの処理

### TITLE
- 入力（スペース/タップ）で → READY

### READY
- phaseTimer += dt
- 3秒経過で → PLAYING
- 表示: 「READY!」黄色テキスト（中央）

### PLAYING
- 通常のゲームアップデート
- ESC → PAUSED
- 全ドット → STAGE_CLEAR
- プレイヤー死亡 → PLAYER_DEAD

### PAUSED
- ゲームロジック停止
- ESC → PLAYING に戻る
- 表示: 「PAUSED」白テキスト（中央）

### PLAYER_DEAD
- phaseTimer += dt
- ゲームロジック停止（プレイヤー死亡アニメーションのみ）
- 1.5秒後:
  - lives-- (lives > 0) → READY
  - lives == 0 → GAME_OVER

### STAGE_CLEAR
- phaseTimer += dt
- 2秒後:
  - level++
  - map.reset() / player.reset() / ghost.reset()
  - → READY

### GAME_OVER
- phaseTimer += dt
- 3秒後に gameoverCanInput = true
- 入力かつ gameoverCanInput → TITLE
- ハイスコア保存
- 表示: 「GAME OVER」赤テキスト

## 死亡アニメーション

プレイヤー死亡時（PLAYER_DEAD フェーズ）:
- phaseTimer 0.0-0.3s: 通常表示（フリーズ）
- phaseTimer 0.3-1.5s: 口が全開から閉じていく円弧アニメーション
  - progress = (timer - 0.3) / 1.2 (0→1)
  - startAngle = progress * π → 終端に向かって収束
  - 最後は点に縮む

## 入力対応

### ESC キー追加（input.ts）
- `onPause` コールバックを追加
- keydown で 'Escape' → onPause を呼ぶ

## 描画対応（renderer.ts）

```
render() の phase 分岐:
  TITLE     → drawTitle()（既存）
  READY     → マップ+エンティティ描画 + drawReady()オーバーレイ
  PLAYING   → マップ+エンティティ描画（既存）
  PAUSED    → マップ+エンティティ描画 + drawPaused()オーバーレイ
  PLAYER_DEAD → マップ+ゴースト描画 + drawDeadPlayer(timer) + なし
  STAGE_CLEAR → マップ（ドット消え済み）+ drawStageClear()オーバーレイ
  GAME_OVER → マップ描画 + drawGameOver()オーバーレイ
```
