# 設計: ゲームエンジン基盤

## アーキテクチャ概要

ゲームループパターン（Game Loop Pattern）を採用する。

```
main.ts
  └─ gameLoop.ts (requestAnimationFrame + 固定タイムステップ)
       ├─ map.ts       (タイルマップ、衝突判定)
       ├─ player.ts    (プレイヤー移動・入力処理)
       ├─ ghost.ts     (ゴーストAI、モード管理)
       ├─ renderer.ts  (Canvas描画、OffscreenCanvas)
       ├─ audio.ts     (Web Audio API)
       └─ storage.ts   (localStorage)

共通:
  ├─ types.ts     (全型定義)
  └─ constants.ts (全定数)
```

## モジュール設計

### types.ts

```typescript
type Vec2 = { x: number; y: number };
type TileType = 0 | 1 | 2 | 3 | 4; // EMPTY, WALL, DOT, POWER, TUNNEL
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';
type GhostMode = 'SCATTER' | 'CHASE' | 'FRIGHTENED' | 'EATEN';
type GhostName = 'BLINKY' | 'PINKY' | 'INKY' | 'CLYDE';
type GamePhase = 'TITLE' | 'PLAYING' | 'PAUSE' | 'GAMEOVER' | 'CLEAR';
type SoundKey = 'EAT_DOT' | 'EAT_POWER' | 'EAT_GHOST' | 'DEATH' | 'GAME_START';

interface PlayerState { pos: Vec2; dir: Direction; nextDir: Direction; ... }
interface GhostState { name: GhostName; pos: Vec2; mode: GhostMode; ... }
interface GameState { phase: GamePhase; score: number; lives: number; ... }
```

### constants.ts

- マップサイズ: COLS=28, ROWS=31, TILE_SIZE=16
- 初期位置（プレイヤー・ゴースト）
- ゴーストモード切替スケジュール（秒）
- ゴースト解放タイマー
- 色テーブル（WALL_COLOR, DOT_COLOR 等）
- スコア定数（DOT=10, POWER=50, GHOST=200/400/800/1600）

### map.ts (MapManager)

- PAC-MANスタンダードの28×31マップデータ（数値配列）
- タイル判定: isWall(), isDot(), isPowerDot(), isTunnel()
- OffscreenCanvas に静的マップを事前描画しキャッシュ
- ドット収集状態を管理、getRemainingDots()

### player.ts (PlayerManager)

- 入力（Direction）を受け取り、次フレームの位置を計算
- タイルアライン: タイル中心に到達したら方向転換
- トンネルワープ処理
- ドット収集判定 → スコア加算

### ghost.ts (GhostManager)

- 4体のゴースト状態管理
- モード切替スケジュール（SCATTER→CHASE→... の交互）
- 各ゴーストのターゲット計算:
  - Blinky: プレイヤー現在位置
  - Pinky: プレイヤー前方4タイル（UP時は上+左4のバグを再現）
  - Inky: Blinkyとプレイヤー前方2タイルのベクトル
  - Clyde: 距離>8タイルならChaseターゲット、近ければScatterターゲット
- BFS/最短経路で次のタイルを決定（逆方向禁止）
- FRIGHTENED時: ランダム方向選択
- EATEN時: ゴーストハウスへ直行

### renderer.ts (Renderer)

- 毎フレーム: clearRect → drawImage(静的マップ) → エンティティ描画
- プレイヤー: 口が開閉する円弧アニメーション
- ゴースト: 状態別スプライト（通常/びびり/目玉）
- UI: スコア・ライフ・ハイスコア表示
- CanvasサイズはTILE_SIZE × (COLS or ROWS)で固定

### input.ts (InputManager)

- keydown イベント: Arrow/WASD → Direction
- touchstart/touchend: スワイプ方向検出（30px閾値）
- buffered direction: 1つ先の入力をバッファリング

### audio.ts (AudioManager)

- Web Audio API の AudioContext
- ユーザーインタラクション後に AudioContext.resume()
- 効果音を OscillatorNode + GainNode で生成
- play(key: SoundKey): void

### storage.ts (StorageManager)

- getHighScore(): number
- setHighScore(score: number): void
- localStorage キー: 'mazerun_highscore'

### gameLoop.ts (GameLoop)

```typescript
// 固定タイムステップ: 1/60s
const FIXED_TIMESTEP = 1000 / 60;
let accumulator = 0;

function loop(timestamp: number) {
  accumulator += delta;
  while (accumulator >= FIXED_TIMESTEP) {
    update(FIXED_TIMESTEP / 1000);
    accumulator -= FIXED_TIMESTEP;
  }
  render();
  requestAnimationFrame(loop);
}
```

### main.ts

- DOMContentLoaded でゲーム初期化
- Canvas要素取得
- 各マネージャーのインスタンス化
- GameLoop開始

## ファイル構成

```
maze-runner/
├── index.html
├── manifest.json
├── service-worker.js
├── package.json
├── tsconfig.json
├── .gitignore
├── src/
│   ├── types.ts
│   ├── constants.ts
│   ├── map.ts
│   ├── player.ts
│   ├── ghost.ts
│   ├── renderer.ts
│   ├── input.ts
│   ├── audio.ts
│   ├── storage.ts
│   ├── gameLoop.ts
│   └── main.ts
├── dist/           (tsc出力、git管理外)
└── tests/
    └── unit/
        ├── map.test.ts
        ├── player.test.ts
        ├── ghost.test.ts
        └── storage.test.ts
```

## 技術的決定事項

### バンドラー不使用
- tsc で ESModules として出力
- index.html で `<script type="module" src="dist/main.js">` を読み込む
- importmap は使用しない（ブラウザ直接対応）

### OffscreenCanvas戦略
- 静的マップ（壁・空白）は初期化時に1回だけ描画
- 毎フレームは drawImage でコピー → エンティティのみ差分描画

### ゴースト解放タイマー
- Blinky: 即時
- Pinky: 0秒
- Inky: ドット30個食べたら
- Clyde: ドット60個食べたら

### テスト対象
- map.ts: タイル判定、ドット収集
- player.ts: 移動計算、タイルアライン
- ghost.ts: ターゲット計算、BFS
- storage.ts: localStorage読み書き
