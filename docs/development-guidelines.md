# 開発ガイドライン (Development Guidelines)

## コーディング規約

### 命名規則

#### 変数・関数

```typescript
// ✅ 良い例: 役割が明確
const ghostManager = new GhostManager();
const dotsRemaining = countDots(state.map);
const isFrightened = ghost.mode === 'FRIGHTENED';

function calculateBlinkyTarget(playerPos: Vec2): Vec2 { }
function chooseGhostDirection(ghost: GhostState, target: Vec2): Direction { }

// ❌ 悪い例: 曖昧
const gm = new GhostManager();
const count = get(map);
function calc(g: any, t: any): any { }
```

**原則**:
- 変数: `camelCase`、名詞または名詞句
- 関数: `camelCase`、動詞で始める
- 定数（モジュールスコープ）: `UPPER_SNAKE_CASE`
- Boolean: `is`, `has`, `can` で始める（例: `isFrightened`, `canMove`, `hasEatenDot`）

#### クラス・インターフェース・型

```typescript
// クラス: PascalCase
class GhostManager { }
class MapManager { }
class InputManager { }

// インターフェース/型: PascalCase（I 接頭辞なし）
interface GameState { }
interface GhostState { }

// ユニオン型: PascalCase
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';
type GhostMode = 'SCATTER' | 'CHASE' | 'FRIGHTENED' | 'EATEN' | 'HOUSE' | 'LEAVING';
```

#### ゲーム固有の命名

```typescript
// タイル座標: Vec2 型、変数名に Pos/Tile を付ける
const playerPos: Vec2 = { x: 14, y: 23 };
const blinkyTarget: Vec2 = getBlinkyTarget(state);

// ピクセル座標: 変数名に PixelPos を付ける
const playerPixelPos: Vec2 = { x: 224, y: 368 };

// フレーム数: 変数名に Frame/Timer を付ける
const frightenedTimer: number = 300;
const releaseTimer: number = 60;
```

---

### コードフォーマット

**インデント**: 2スペース（TypeScript）

**行の長さ**: 最大 100 文字

**セミコロン**: 必須

**クォート**: シングルクォート（`'`）

```typescript
// ✅ 良い例
function getBlinkyTarget(state: GameState): Vec2 {
  return { ...state.player.pos };
}

// ❌ 悪い例: タブ・不統一なクォート
function getBlinkyTarget(state: GameState): Vec2 {
	return { ...state.player.pos };  // タブインデント
}
```

---

### 型定義の規約

```typescript
// ✅ 良い例: 明示的な型注釈
function canMove(map: TileType[][], pos: Vec2, dir: Direction): boolean {
  const next = moveVec2(pos, dir);
  return !isWall(map, next);
}

// ❌ 悪い例: any 型の使用
function canMove(map: any, pos: any, dir: any): any {
  // ...
}
```

**`any` の使用は原則禁止**。型が不明な場合は `unknown` を使い、型ガードで絞り込む。

---

### コメント規約

コメントは「なぜそうするか（WHY）」のみ書く。「何をするか（WHAT）」はコードから読み取れるため不要。

```typescript
// ✅ 良い例: WHY を説明
// 原作の UP 先読みバグを意図的に再現（忠実再現のため）
const pivotOffset = directionToVec2(direction === 'UP' ? 'LEFT' : direction, 2);

// ✅ 良い例: 非自明なアルゴリズムの説明
// Inky のターゲット: プレイヤー前方2タイルを中心に Blinky を対称反転
const target = { x: pivot.x * 2 - blinkyPos.x, y: pivot.y * 2 - blinkyPos.y };

// ❌ 悪い例: コードを繰り返すだけ
// プレイヤーの位置を返す
return state.player.pos;
```

**クラス・公開メソッドには TSDoc を書く**（非自明なもののみ）:

```typescript
/**
 * 交差点で target に最も近い移動方向を選択する。
 * 逆走と壁への侵入は自動的に除外される。
 * 距離が等しい場合は UP > LEFT > DOWN > RIGHT の優先順で決定（原作準拠）。
 */
private chooseDirection(pos: Vec2, currentDir: Direction, target: Vec2): Direction {
  // ...
}
```

---

### エラーハンドリング

ゲームの性質上、致命的なエラーでゲームを停止させず、復帰可能な設計とする。

```typescript
// ✅ 良い例: localStorage 読み込み失敗は無視してデフォルト値を返す
loadHighScore(): number {
  try {
    const raw = localStorage.getItem(this.KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return 0;
    const score = (parsed as Record<string, unknown>).score;
    return typeof score === 'number' ? score : 0;
  } catch {
    return 0;
  }
}

// ✅ 良い例: Canvas 未対応時はフォールバックメッセージ
const ctx = canvas.getContext('2d');
if (!ctx) {
  document.body.innerHTML = '<p>このブラウザはサポートされていません。</p>';
  return;
}

// ❌ 悪い例: ゲームループ内で例外をスローする
update(state: GameState): void {
  if (someEdgeCase) throw new Error('想定外の状態'); // ゲームが止まる
}
```

---

### ゲームループ内のコード規約

ゲームループ（`update()` / `render()`）は 1 フレーム 16ms 以内に完了する必要がある。

```typescript
// ✅ 良い例: 毎フレーム計算を避け、交差点通過時のみ方向を更新
if (isAtTileBoundary(ghost.pixelPos, TILE_SIZE)) {
  ghost.direction = this.chooseDirection(ghost.pos, ghost.direction, ghost.target);
}

// ❌ 悪い例: 毎フレーム全ノードを探索する BFS
update(): void {
  const path = bfsFullPath(ghost.pos, ghost.target); // 毎フレームに BFS は重すぎる
}

// ✅ 良い例: 静的マップはキャッシュして drawImage で再利用
private renderStaticMap(): void {
  if (!this.mapCache) {
    this.mapCache = this.buildMapCache(); // 初回のみ描画
  }
  this.ctx.drawImage(this.mapCache, 0, 0); // 以降は転送のみ
}
```

---

## Git 運用ルール

### ブランチ戦略

```
main          ← GitHub Pages 公開ブランチ（安定版のみ）
  └── develop ← 開発の統合ブランチ
      ├── feature/[機能名]   ← 新機能
      ├── fix/[修正内容]     ← バグ修正
      └── refactor/[対象]   ← リファクタリング
```

**運用ルール**:
- `main` への直接コミット禁止。PR 経由のみ
- `feature/*` / `fix/*` は `develop` から分岐し、完了後に PR で `develop` へマージ
- GitHub Pages は `main` ブランチから公開

---

### コミットメッセージ規約（Conventional Commits）

```
<type>(<scope>): <subject>

<body（任意）>
```

**Type**:

| type | 用途 |
|------|------|
| `feat` | 新機能（ゴーストAI追加、スコア機能等） |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみの変更 |
| `style` | フォーマット修正（動作変更なし） |
| `refactor` | リファクタリング |
| `perf` | パフォーマンス改善 |
| `test` | テスト追加・修正 |
| `chore` | ビルド設定・依存関係更新 |

**scope**（ゲームコンポーネントに合わせる）:
`ghost`, `player`, `map`, `renderer`, `input`, `audio`, `storage`, `pwa`, `loop`

**例**:

```
feat(ghost): Inky の挟み撃ちターゲット計算を実装

BlinkyとPinkyを組み合わせた複雑なAIロジックを追加。
プレイヤー前方2タイルを中心にBlinkyを対称反転した位置を
ターゲットとして設定。

Closes #12
```

```
fix(input): スワイプ閾値未満の入力が方向転換に影響する問題を修正

touchend イベントで移動距離を計算する際、30px 未満の入力を
無視するガードを追加。スクロールとの誤検知も同時に解消。
```

---

### プルリクエストのルール

**作成前チェックリスト**:
- [ ] `npm run typecheck`（型チェック）がパス
- [ ] `npm test`（Vitest）がパス
- [ ] `npm run build`（tsc）が成功
- [ ] `npm run lint` がエラーゼロ

**PR テンプレート**:

```markdown
## 変更の種類
- [ ] 新機能 (feat)
- [ ] バグ修正 (fix)
- [ ] リファクタリング (refactor)
- [ ] ドキュメント (docs)
- [ ] その他 (chore)

## 変更内容
### 何を変更したか

### なぜ変更したか

## テスト
- [ ] ユニットテスト追加・更新
- [ ] ブラウザ手動確認（PC・スマホ）

## 関連 Issue
Closes #
```

**レビュープロセス**:
1. セルフレビュー（PR 作成前に自分のコードを読み直す）
2. 自動 CI（型チェック・テスト・ビルド）がパス
3. マージ（1 人以上の承認後）

---

## テスト戦略

### テストピラミッド

```
       /\
      /手動\     スマホ実機・PWA 動作確認
     /------\
    / Vitest \   ユニットテスト（ゲームロジック）
   /──────────\
```

本プロジェクトは UI テスト（E2E）を手動で実施し、ロジックのみ Vitest でカバーする。

### ユニットテスト（Vitest）

**対象**:
- ゴースト AI ターゲット計算（4種全て）
- 交差点での方向選択ロジック（原作優先順の検証）
- マップ衝突判定・ドット収集
- スワイプ方向計算（閾値・誤検知防止）
- `StorageManager`（保存・読み込み・不正値フォールバック）

**カバレッジ目標**: `ghost.ts`, `map.ts`, `player.ts` のゲームロジック関数 80% 以上

**テスト構造（Given-When-Then）**:

```typescript
describe('GhostManager', () => {
  describe('getBlinkyTarget', () => {
    it('プレイヤーの現在位置をターゲットとして返す', () => {
      // Given
      const playerPos: Vec2 = { x: 14, y: 23 };
      const state = createMockState({ playerPos });

      // When
      const target = getBlinkyTarget(state);

      // Then
      expect(target).toEqual({ x: 14, y: 23 });
    });
  });

  describe('chooseDirection', () => {
    it('壁がある方向は候補から除外される', () => {
      // Given
      const map = createMapWithWallAt({ x: 14, y: 22 }); // 上が壁
      const ghostPos: Vec2 = { x: 14, y: 23 };
      const target: Vec2 = { x: 14, y: 20 }; // 上を目指す

      // When
      const dir = chooseDirection(ghostPos, 'LEFT', target, map);

      // Then
      expect(dir).not.toBe('UP'); // 上は壁なので選ばれない
    });

    it('逆走（現在方向の反対）は禁止される', () => {
      // Given: 現在 RIGHT に移動中
      const result = chooseDirection(pos, 'RIGHT', target, map);

      // Then
      expect(result).not.toBe('LEFT');
    });
  });
});
```

**テストファイル命名**: `tests/unit/[対象モジュール名].test.ts`

---

### 手動テスト項目

| テスト内容 | 確認環境 |
|-----------|---------|
| スワイプ操作（上下左右） | iPhone Safari / Android Chrome |
| 壁にぶつかった際のピタッと停止 | 上記と同じ |
| 全ドット収集 → ステージクリア | Chrome PC |
| 残機0 → ゲームオーバー | Chrome PC |
| ページリロード後のハイスコア保持 | Chrome PC |
| PWA インストール → オフライン起動 | iOS / Android |
| 60fps 安定確認 | Chrome DevTools Performance |

---

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Node.js | v24.11.0 | tsc・Vitest の実行環境 |
| npm | 11.x | 依存管理 |

### セットアップ手順

```bash
# 1. リポジトリのクローン
git clone https://github.com/<user>/maze-runner.git
cd maze-runner

# 2. devDependencies のインストール（ランタイム依存なし）
npm install

# 3. TypeScript コンパイル
npm run build

# 4. ローカル開発サーバー起動（Service Worker 動作には HTTPS/localhost が必要）
npm run serve
# → http://localhost:8080 でアクセス
```

### npm スクリプト一覧

```json
{
  "scripts": {
    "build":     "tsc",
    "watch":     "tsc --watch",
    "typecheck": "tsc --noEmit",
    "test":      "vitest run",
    "test:watch":"vitest",
    "coverage":  "vitest run --coverage",
    "lint":      "eslint src/ tests/",
    "serve":     "http-server . -p 8080"
  }
}
```

### 推奨 VS Code 拡張機能

- **ESLint**: リアルタイムの Lint チェック
- **Prettier**: 保存時の自動フォーマット
- **TypeScript and JavaScript Language Features**: 型補完

---

## コードレビュー基準

### レビューポイント

**ゲームロジック**:
- [ ] ゴースト AI のターゲット計算が仕様通りか
- [ ] 逆走禁止・ゴーストドア通過制限が正しく実装されているか
- [ ] スコア加算（連鎖ボーナス含む）が正確か
- [ ] ゲームフェーズ遷移が正しいか

**パフォーマンス**:
- [ ] ゲームループ内で不要な計算・オブジェクト生成がないか
- [ ] 静的マップは `OffscreenCanvas` にキャッシュされているか
- [ ] ゴーストのパス選択が毎フレームでなく交差点通過時のみか

**型安全性**:
- [ ] `any` 型が使われていないか
- [ ] `GameState` の更新が `update()` 内のみで行われているか（`render()` から更新禁止）

**セキュリティ**:
- [ ] `localStorage` の読み込み時に型チェックとフォールバックがあるか
- [ ] オートプレイ制限に対応しているか（ユーザーインタラクション後に BGM 開始）

### レビューコメントの書き方

```markdown
# ✅ 良い例: 問題と改善案を具体的に
[必須] ゴースト AI: Inky のターゲット計算でプレイヤーの UP 方向時に
原作バグの再現が抜けています。`docs/functional-design.md` の注意書きを
参照してください。

[推奨] パフォーマンス: `chooseDirection()` がゲームループ毎フレームで
呼ばれています。交差点通過判定後にのみ呼ぶよう変更を検討してください。

[質問] ここで `frightenedTimer` を 300 にしているのはレベル1固定ですか？
将来のレベル対応を考えると `LEVEL_PARAMS[level].frightenedFrames` の
ような形にする方がよさそうです。

# ❌ 悪い例
このコードは良くないです。
```

---

## CI/CD（GitHub Actions）

### CI ワークフロー（`.github/workflows/ci.yml`）

```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

### デプロイワークフロー（`.github/workflows/deploy.yml`）

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'   # index.html・dist/・assets/ を含むルートを公開
      - uses: actions/deploy-pages@v4
```

---

## 実装チェックリスト（PR 作成前）

### コード品質
- [ ] 命名が明確で一貫している（ゲーム用語を使っているか）
- [ ] `any` 型を使用していない
- [ ] マジックナンバーが `constants.ts` に定義されている
- [ ] ゲームループ内でオブジェクトを大量生成していない

### ゲームロジック
- [ ] ゴースト AI のターゲット計算が `docs/functional-design.md` の仕様通り
- [ ] `render()` 内で `GameState` を変更していない（読み取り専用）
- [ ] スコア加算ロジックが正しい

### テスト
- [ ] 変更したロジックのユニットテストを追加・更新している
- [ ] `npm test` がパス

### ビルド・型
- [ ] `npm run typecheck` がパス
- [ ] `npm run build` が成功

### 動作確認
- [ ] Chrome PC でゲームが正常に動作する
- [ ] 可能なら iOS/Android 実機でスワイプ操作を確認
