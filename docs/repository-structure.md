# リポジトリ構造定義書 (Repository Structure Document)

## プロジェクト構造

```
maze-runner/
├── index.html                 # エントリポイント（Canvas 要素・モジュール読み込み）
├── manifest.json              # PWA マニフェスト
├── service-worker.js          # PWA キャッシュ制御（コンパイル済み JS をキャッシュ）
├── tsconfig.json              # TypeScript コンパイル設定
├── package.json               # npm スクリプト・devDependencies のみ
├── package-lock.json          # 依存バージョン固定
├── .gitignore
├── LICENSE                    # ライセンス（MIT 等）
├── CREDITS.md                 # 使用フリー素材のクレジット・ライセンス表記
├── README.md                  # プロジェクト概要・遊び方
│
├── src/                       # TypeScript ソースコード
│   ├── main.ts                # エントリポイント（Canvas取得・初期化・依存注入）
│   ├── types.ts               # 共通型定義（Vec2, Direction, GameState 等）
│   ├── constants.ts           # ゲーム定数（タイルサイズ・速度・スコア・色）
│   ├── gameLoop.ts            # GameLoop クラス・ゲームサイクル管理
│   ├── map.ts                 # MapManager クラス・マップデータ・衝突判定
│   ├── player.ts              # Player クラス・移動制御
│   ├── ghost.ts               # GhostManager クラス・4体ゴースト AI
│   ├── renderer.ts            # Renderer クラス・全 Canvas 描画
│   ├── input.ts               # InputManager クラス・スワイプ/キーボード
│   ├── audio.ts               # AudioManager クラス・BGM/SE 制御
│   └── storage.ts             # StorageManager クラス・localStorage
│
├── dist/                      # tsc コンパイル出力（git 管理対象外）
│   ├── main.js
│   ├── types.js
│   ├── constants.js
│   ├── gameLoop.js
│   ├── map.js
│   ├── player.js
│   ├── ghost.js
│   ├── renderer.js
│   ├── input.js
│   ├── audio.js
│   └── storage.js
│
├── assets/
│   ├── sounds/                # 音声ファイル（フリー素材）
│   │   ├── bgm.mp3            # バックグラウンドミュージック
│   │   ├── dot.mp3            # ドット収集 SE
│   │   ├── power_pellet.mp3   # パワーエサ収集 SE
│   │   ├── eat_ghost.mp3      # ゴースト食べ SE
│   │   ├── player_death.mp3   # プレイヤー死亡 SE
│   │   ├── stage_clear.mp3    # ステージクリア SE
│   │   └── game_start.mp3     # ゲーム開始 SE
│   └── icons/                 # PWA アイコン
│       ├── icon-192.png       # 192×192px
│       └── icon-512.png       # 512×512px
│
├── tests/
│   └── unit/                  # Vitest ユニットテスト
│       ├── ghost.test.ts      # GhostManager AI ロジック
│       ├── map.test.ts        # MapManager 衝突判定・ドット収集
│       ├── player.test.ts     # Player 移動制御
│       ├── input.test.ts      # InputManager スワイプ方向計算
│       └── storage.test.ts    # StorageManager 保存・読み込み
│
├── docs/                      # プロジェクトドキュメント
│   ├── ideas/                 # ブレインストーミング・アイデアメモ
│   │   └── ideas.md
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md（本ドキュメント）
│   ├── development-guidelines.md
│   └── glossary.md
│
├── .steering/                 # 作業単位のタスク管理（git 管理対象外を推奨）
│   └── [YYYYMMDD]-[task-name]/
│       ├── requirements.md
│       ├── design.md
│       └── tasklist.md
│
└── .claude/                   # Claude Code 設定
    ├── settings.json
    ├── skills/
    └── agents/
```

---

## ディレクトリ詳細

### src/（ソースコードディレクトリ）

ゲームのすべての TypeScript ソースコードを格納する。ランタイム依存ゼロのため、外部ライブラリの `import` は禁止。

#### src/types.ts

**役割**: プロジェクト全体で使用する型定義の一元管理

**配置する型**:
- `Vec2`, `Direction`, `TileType`, `GhostMode`, `GamePhase`
- `PlayerState`, `GhostState`, `GameState`
- `HighScore`, `SoundKey`

**命名規則**: PascalCase の `interface` / `type` のみ。クラスは含めない。

**依存関係**:
- 依存可能: なし（他ファイルに依存しない根幹ファイル）
- 依存禁止: `src/` 内の他すべてのモジュール

---

#### src/constants.ts

**役割**: マジックナンバーの排除・ゲームパラメータの一元管理

**配置する定数**:
- タイルサイズ・マップ行列数
- 各レベルのゴースト速度・イジケ時間
- スコア定義（ドット: 10, パワーエサ: 50, ゴースト連鎖: 200/400/800/1600）
- モード切替スケジュール（フレーム数）
- ゴースト放出タイマー
- カラー定義（CSS 色文字列）

**命名規則**: `UPPER_SNAKE_CASE` の `const`

**依存関係**:
- 依存可能: `types.ts` のみ
- 依存禁止: 他のすべての `src/` モジュール

---

#### src/map.ts

**役割**: マップデータ定義・衝突判定・ドット管理・ワープ処理

**配置する内容**:
- `INITIAL_MAP`: `TileType[][]` の初期マップ定数
- `MapManager` クラス（衝突判定・ドット収集・ワープ出口取得）

**命名規則**: クラスは `PascalCase`、定数は `UPPER_SNAKE_CASE`

**依存関係**:
- 依存可能: `types.ts`, `constants.ts`
- 依存禁止: `ghost.ts`, `player.ts`, `renderer.ts`, `input.ts`, `audio.ts`

---

#### src/player.ts

**役割**: プレイヤーの位置・移動方向・速度の更新

**配置する内容**:
- `Player` クラス（`update()` で GameState を更新）

**依存関係**:
- 依存可能: `types.ts`, `constants.ts`, `map.ts`
- 依存禁止: `ghost.ts`, `renderer.ts`, `input.ts`, `audio.ts`

---

#### src/ghost.ts

**役割**: 4体ゴーストの AI・移動・モード管理

**配置する内容**:
- `GhostManager` クラス
- 各ゴーストのターゲット計算関数（`private` メソッドとして実装）
- 交差点での方向選択ロジック

**命名規則**: AI 関連の `private` メソッドは `get[GhostName]Target()` 形式

**依存関係**:
- 依存可能: `types.ts`, `constants.ts`, `map.ts`
- 依存禁止: `player.ts`（GameState 経由で参照）、`renderer.ts`, `input.ts`, `audio.ts`

---

#### src/renderer.ts

**役割**: Canvas API を使った全画面描画（描画のみ、状態更新禁止）

**配置する内容**:
- `Renderer` クラス
- `OffscreenCanvas` を使った壁・床の事前レンダリングキャッシュ

**依存関係**:
- 依存可能: `types.ts`, `constants.ts`
- 依存禁止: `map.ts`, `player.ts`, `ghost.ts`（GameState 経由でのみ参照）

---

#### src/input.ts

**役割**: ユーザー入力（スワイプ・キーボード）の検出と方向変換

**配置する内容**:
- `InputManager` クラス
- スワイプ閾値（30px）による方向判定ロジック

**依存関係**:
- 依存可能: `types.ts`, `constants.ts`
- 依存禁止: ゲームロジック全般（コールバック経由でのみ GameState に影響）

---

#### src/audio.ts

**役割**: BGM・SE の再生制御

**配置する内容**:
- `AudioManager` クラス
- `AudioContext.resume()` によるオートプレイ制限対応

**依存関係**:
- 依存可能: `types.ts`
- 依存禁止: ゲームロジック全般

---

#### src/storage.ts

**役割**: localStorage を使ったハイスコアの永続化

**配置する内容**:
- `StorageManager` クラス
- JSON パース失敗時のデフォルト値フォールバック

**依存関係**:
- 依存可能: `types.ts`
- 依存禁止: ゲームロジック全般

---

#### src/gameLoop.ts

**役割**: `requestAnimationFrame` ベースのゲームループ・GameState 初期化

**配置する内容**:
- `GameLoop` クラス（固定タイムステップ実装）
- `createInitialGameState()` ファクトリ関数

**依存関係**:
- 依存可能: `types.ts`, `constants.ts`, `map.ts`, `player.ts`, `ghost.ts`, `renderer.ts`, `audio.ts`, `storage.ts`
- 依存禁止: `input.ts`（コールバック経由で受け取る）

---

#### src/main.ts

**役割**: アプリケーションのエントリポイント・依存注入

**配置する内容**:
- Canvas 要素の取得
- 全コンポーネントのインスタンス化
- `InputManager` のコールバック登録
- Service Worker の登録
- `GameLoop.start()` の呼び出し

**依存関係**:
- 依存可能: すべての `src/` モジュール

---

### tests/unit/（ユニットテストディレクトリ）

**構造**:
```
tests/unit/
├── ghost.test.ts      # GhostManager（ターゲット計算・方向選択）
├── map.test.ts        # MapManager（衝突判定・ドット収集・ワープ）
├── player.test.ts     # Player（移動制御・タイル境界処理）
├── input.test.ts      # InputManager（スワイプ方向計算・閾値）
└── storage.test.ts    # StorageManager（CRUD・不正値フォールバック）
```

**命名規則**: `[テスト対象ファイル名].test.ts`

**テストフレームワーク**: Vitest（JSDOM 環境不要のロジックのみテスト）

---

### assets/（静的アセット）

**sounds/**: MP3 形式の音声ファイル。フリー素材のみ使用。ライセンスは `CREDITS.md` に記載。

**icons/**: PWA 用アイコン。PNG 形式。`manifest.json` から参照。

---

### docs/（ドキュメントディレクトリ）

| ファイル | 内容 |
|---------|------|
| `ideas/` | ブレインストーミング・技術調査メモ |
| `product-requirements.md` | プロダクト要求定義書 (PRD) |
| `functional-design.md` | 機能設計書 |
| `architecture.md` | アーキテクチャ設計書 |
| `repository-structure.md` | リポジトリ構造定義書（本ドキュメント） |
| `development-guidelines.md` | 開発ガイドライン |
| `glossary.md` | ユビキタス言語定義 |

---

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| ゲームコンポーネント（クラス） | `src/` | `camelCase.ts`（モジュール名） | `gameLoop.ts` |
| 型定義 | `src/types.ts` | PascalCase（型・インターフェース名） | `GameState`, `Vec2` |
| 定数 | `src/constants.ts` | UPPER_SNAKE_CASE | `TILE_SIZE`, `DOT_SCORE` |
| エントリポイント | `src/main.ts` | 固定 | `main.ts` |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニットテスト | `tests/unit/` | `[対象].test.ts` | `ghost.test.ts` |

### 設定ファイル

| ファイル種別 | 配置先 | 命名規則 |
|------------|--------|---------|
| TypeScript 設定 | プロジェクトルート | `tsconfig.json` |
| npm 設定 | プロジェクトルート | `package.json` |
| PWA マニフェスト | プロジェクトルート | `manifest.json` |
| Service Worker | プロジェクトルート | `service-worker.js`（コンパイル不要） |

---

## 命名規則

### ディレクトリ名

- `src/`, `dist/`, `tests/`, `assets/`, `docs/` など: 複数形、kebab-case

### ファイル名

- **TypeScript クラスファイル**: `camelCase.ts`（クラス名に対応したモジュール名）
  - 例: `gameLoop.ts`, `ghostManager.ts`（ただし今回は `ghost.ts` と短縮）
- **型定義・定数ファイル**: `camelCase.ts`
  - 例: `types.ts`, `constants.ts`
- **テストファイル**: `[対象].test.ts`
  - 例: `ghost.test.ts`, `map.test.ts`

### TypeScript シンボル名

| 種別 | 規則 | 例 |
|------|------|-----|
| クラス | PascalCase | `GhostManager`, `MapManager` |
| インターフェース | PascalCase | `GameState`, `GhostState` |
| 型エイリアス | PascalCase | `Direction`, `GhostMode` |
| 定数 | UPPER_SNAKE_CASE | `TILE_SIZE`, `DOT_SCORE` |
| 変数・関数 | camelCase | `updateGhosts`, `calculateTarget` |
| プライベートメソッド | camelCase（`private` 修飾子） | `getBlinkyTarget()` |

---

## 依存関係のルール

### モジュール依存グラフ

```
main.ts
  ├─→ gameLoop.ts
  │     ├─→ map.ts ─→ types.ts, constants.ts
  │     ├─→ player.ts ─→ types.ts, constants.ts, map.ts
  │     ├─→ ghost.ts ─→ types.ts, constants.ts, map.ts
  │     ├─→ renderer.ts ─→ types.ts, constants.ts
  │     ├─→ audio.ts ─→ types.ts
  │     └─→ storage.ts ─→ types.ts
  └─→ input.ts ─→ types.ts, constants.ts
```

**循環依存の禁止**: `types.ts` と `constants.ts` のみが循環なしの根幹。他のモジュールは上位から下位への一方向依存のみ許可。

**禁止される依存例**:
- `map.ts` → `ghost.ts`（ゴースト AI はマップに依存するが逆は不可）
- `player.ts` → `ghost.ts`（衝突判定は `gameLoop.ts` / `ghost.ts` が担当）
- `renderer.ts` → `player.ts`（描画は GameState のみを参照）

---

## スケーリング戦略

### 機能の追加

| 追加規模 | 対応方法 |
|---------|---------|
| 定数追加（新レベルパラメータ等） | `constants.ts` に追記 |
| 新ゴースト行動パターン | `ghost.ts` の `GhostManager` にメソッド追加 |
| 新マップ | `map.ts` に新配列定数を追加し、`GameState.level` で切り替え |
| 新機能（ランキング等） | 新ファイルを `src/` に追加し、`main.ts` で依存注入 |

### ファイルサイズの管理

- 1ファイル 300行以下を目安
- `ghost.ts` が肥大化した場合は `ghostAI.ts`（ターゲット計算）と分割を検討

---

## 除外設定（.gitignore）

```
node_modules/
dist/
*.log
.DS_Store
coverage/
```

**`dist/` は git 管理対象外**。GitHub Pages へのデプロイは GitHub Actions で `tsc` を実行し `dist/` を生成する方式を採用する（または `dist/` を含むブランチを別途作成）。

> **注意**: GitHub Pages で ES Modules を使う場合、`dist/` をリポジトリに含める方式でもよい。プロジェクト初期はシンプルに `dist/` を git 管理下に置き、CI/CD 整備後に切り替える。
