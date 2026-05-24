# 技術仕様書 (Architecture Design Document)

## テクノロジースタック

### 言語・ランタイム

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Node.js | v24.11.0 | 開発環境（ビルドのみ） | tsc の実行環境。ゲームの実行自体はブラウザ |
| TypeScript | 5.x | ソース言語 | 型安全性・IDE補完によるゲームロジックのバグ防止。コンパイル後はゼロランタイム依存 |
| npm | 11.x | パッケージ管理 | Node.js 標準搭載。devDependencies のみ（tsc・テストランナー） |

### フレームワーク・ライブラリ

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| ライブラリなし（ランタイム） | — | — | GitHub Pages push だけで公開・依存ゼロでメンテコスト最小 |
| Canvas API | ブラウザ標準 | ゲーム描画 | フレームレート制御が容易・ゲーム描画に最適・外部ライブラリ不要 |
| Web Audio API / HTML Audio | ブラウザ標準 | BGM・SE | 依存ゼロ・モバイルの自動再生ポリシーに適切に対応可能 |

### 開発ツール

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| tsc (TypeScript Compiler) | 5.x | TS → JS コンパイル | 外部バンドラー不要・単一 JS 出力に対応 |
| Vitest | 最新安定版 | ユニットテスト | TypeScript ネイティブ対応・高速・設定最小 |
| http-server | 最新安定版 | ローカル開発サーバー | 静的ファイル配信・Service Worker の動作確認 |

---

## アーキテクチャパターン

### ゲームループパターン（Game Loop Pattern）

本プロジェクトはサーバーを持たないブラウザゲームのため、伝統的なレイヤードアーキテクチャではなく **ゲームループパターン** を採用する。

```
┌──────────────────────────────────────────────────┐
│  ブラウザ（GitHub Pages 静的配信）                  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  GameLoop (requestAnimationFrame)         │   │
│  │                                          │   │
│  │   ┌──────────────┐  ┌────────────────┐  │   │
│  │   │  UPDATE      │  │  RENDER        │  │   │
│  │   │              │  │                │  │   │
│  │   │ • Player     │  │ • MapRenderer  │  │   │
│  │   │ • GhostMgr   │  │ • PlayerRender │  │   │
│  │   │ • MapManager │  │ • GhostRender  │  │   │
│  │   │ • Collision  │  │ • HUD          │  │   │
│  │   └──────┬───────┘  └───────┬────────┘  │   │
│  │          │                  │            │   │
│  │   ┌──────┴──────────────────┴────────┐  │   │
│  │   │  GameState（共有状態）             │  │   │
│  │   └──────────────────────────────────┘  │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │InputMgr   │  │AudioMgr    │  │StorageMgr  │  │
│  │(Swipe/KB) │  │(BGM/SE)    │  │(localStorage│  │
│  └───────────┘  └────────────┘  └────────────┘  │
└──────────────────────────────────────────────────┘
```

#### ゲームループの責務分離

| レイヤー | 責務 | 禁止事項 |
|---------|------|---------|
| **Input** | ユーザー入力の受付・方向変換 | GameState への直接書き込み（コールバック経由のみ） |
| **Update** | ゲーム状態の更新（物理・AI・衝突） | Canvas への描画 |
| **Render** | Canvas への描画 | GameState の更新 |
| **Storage** | localStorage の読み書き | ゲームロジック |
| **Audio** | BGM・SE の再生制御 | ゲームロジック |

---

## ビルドアーキテクチャ

### コンパイルフロー

```
src/*.ts
    │
    ▼
tsc (tsconfig.json)
    │  outDir: dist/
    │  target: ES2020
    │  module: ES2020
    │  strict: true
    ▼
dist/
├── main.js
├── types.js
├── constants.js
├── map.js
├── player.js
├── ghost.js
├── renderer.js
├── input.js
├── audio.js
├── storage.js
└── gameLoop.js
```

**index.html** は `<script type="module" src="dist/main.js">` で読み込む。
ES Modules をネイティブ使用するため、バンドラー不要。対応ブラウザ（Chrome 80+, Safari 14+, Firefox 75+）で動作。

### tsconfig.json 方針

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

---

## データ永続化戦略

### ストレージ方式

| データ種別 | ストレージ | フォーマット | 理由 |
|-----------|----------|-------------|------|
| ハイスコア | localStorage | JSON 文字列 | サーバー不要・ブラウザ標準・永続的 |
| ゲーム進行状態 | メモリ（GameState） | TypeScript オブジェクト | リロード時のリセットが自然な UX |
| PWA アセット | Service Worker Cache | バイナリ/テキスト | オフライン対応・初回後高速ロード |

### バックアップ戦略

ゲームの性質上、データはハイスコアのみ（軽量）。バックアップは不要。
ユーザーが localStorage をクリアした場合はスコアリセットとして許容する。

---

## PWA アーキテクチャ

### Service Worker キャッシュ戦略

```
初回訪問時:
  ブラウザ → GitHub Pages CDN → Service Worker がキャッシュに格納

2回目以降:
  ブラウザ → Service Worker キャッシュ（オフライン対応）
             ↓ バックグラウンドで更新チェック（stale-while-revalidate）
```

**キャッシュ対象**:
- `index.html`
- `dist/main.js`（および全モジュール）
- `assets/sounds/*.mp3`
- `assets/icons/*.png`
- `manifest.json`

**キャッシュ更新**: `service-worker.js` のバージョン定数を更新することで古いキャッシュを削除。

---

## パフォーマンス要件

### レスポンスタイム

| 操作 | 目標時間 | 測定環境 |
|------|---------|---------|
| 初回ロード（キャッシュなし） | 3秒以内 | 3G相当（3Mbps）・スマホ |
| 初回ロード（Service Worker キャッシュ後） | 500ms以内 | 任意のネットワーク |
| タッチ入力 → 方向変換反映 | 16ms以内（1フレーム） | iOS Safari / Android Chrome |
| ゲームループ1フレーム処理 | 16ms以内（60fps維持） | Chrome 最新版、デスクトップ |

### リソース使用量

| リソース | 上限 | 理由 |
|---------|------|------|
| JS バンドルサイズ | 50KB（非圧縮） | 3G 環境での高速ロード |
| 音声アセット合計 | 2MB以内 | モバイルデータ通信への配慮 |
| メモリ使用量 | 30MB以内 | 低スペックスマホでの安定動作 |
| localStorage 使用量 | 1KB以内 | ハイスコア JSON のみ |

### 最適化戦略

| 最適化 | 実装方法 |
|--------|---------|
| 静的マップ描画キャッシュ | `OffscreenCanvas` に壁・床を事前描画し `drawImage` で転送 |
| 固定タイムステップ | `requestAnimationFrame` + accumulator で Update と Render を分離 |
| ゴーストパス計算 | 毎フレーム BFS せず、交差点通過時のみ方向を再計算 |
| サウンドプリロード | ゲーム開始前に全 SE を `Audio` オブジェクトとしてメモリに保持 |

---

## セキュリティアーキテクチャ

### データ保護

- **外部通信なし**: API 呼び出し・fetch 一切なし。攻撃面が最小
- **localStorage 読み込み時の防御**: `JSON.parse` + 型ガードで不正値を除去し、デフォルト値にフォールバック
- **ユーザー入力の DOM 反映なし**: スコアは Canvas に描画するため XSS リスクなし

### 入力検証

- **スワイプ閾値**: 30px 未満の移動は無視（誤操作防止）
- **ゲームフェーズ検証**: PLAYING フェーズ以外では入力をドロップ
- **方向の妥当性チェック**: `'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE'` の型ガード

### Content Security Policy（CSP）

GitHub Pages は HTTP ヘッダーのカスタマイズが不可のため、`<meta>` タグで設定:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self'">
```

- `script-src 'self'`: 自ドメインの JS のみ許可
- `media-src 'self'`: 自ドメインの音声ファイルのみ許可
- インラインスクリプト・外部CDN を禁止

### オートプレイ制限対応

```typescript
// ユーザーインタラクション（タップ/クリック）後にのみ AudioContext を resume()
document.addEventListener('pointerdown', () => {
  audioContext.resume();
}, { once: true });
```

---

## スケーラビリティ設計

### 現在のスコープ

静的ゲームのため、スケーリング要件は事実上なし（GitHub Pages CDN が無制限のアクセスを処理）。

### 機能拡張性

| 拡張 | 対応方法 |
|------|---------|
| レベル追加 | `constants.ts` にレベル別パラメータ（ゴースト速度・イジケ時間）を追加 |
| 新ゴーストAI | `ghost.ts` に新クラスを追加し、`GhostManager` に登録 |
| 新マップ | `map.ts` に新しい `TileType[][]` 配列を追加 |
| オンラインランキング | `StorageManager` をインターフェース化し、`LocalStorageAdapter` と `ApiAdapter` を切り替え可能に設計 |

---

## テスト戦略

### ユニットテスト（Vitest）
- **フレームワーク**: Vitest（TypeScript ネイティブ、DOM 環境不要）
- **対象**: 純粋関数・ゲームロジック
  - ゴーストターゲット計算（Blinky/Pinky/Inky/Clyde の4種）
  - 交差点での方向選択アルゴリズム
  - スワイプ方向計算（閾値・誤検知防止）
  - スコア計算（ドット・パワーエサ・ゴースト連鎖）
  - `StorageManager` の保存・読み込み・不正値フォールバック
  - マップ衝突判定・ドット収集
- **カバレッジ目標**: ゲームロジック（`ghost.ts`, `player.ts`, `map.ts`）80% 以上

### 統合テスト（手動）
- ゲームループ起動 → 60fps の維持確認（Chrome DevTools Performance タブ）
- 全ドット収集 → ステージクリア遷移の確認

### 手動E2Eテスト（実機）
- iPhone（Safari）・Android（Chrome）でのスワイプ操作確認
- PWA インストール → オフライン起動
- ページリロード後のハイスコア保持

---

## 技術的制約

### 環境要件（エンドユーザー）

| 要件 | 詳細 |
|------|------|
| ブラウザ | Chrome 80+, Safari 14+, Firefox 75+（ES Modules 対応） |
| JavaScript | 有効であること（ゲーム動作に必須） |
| 画面解像度 | 最小幅 320px（iPhone SE 対応） |
| ストレージ | localStorage 有効（ハイスコア保存用、無効でもゲーム動作可） |

### 環境要件（開発者）

| 要件 | 詳細 |
|------|------|
| Node.js | v24.11.0 以上（`tsc` 実行用） |
| npm | 11.x 以上 |
| OS | Windows / macOS / Linux（クロスプラットフォーム） |

### パフォーマンス制約
- `requestAnimationFrame` はバックグラウンドタブで低頻度（または停止）になる — ゲームを一時停止状態に移行する設計が必要
- iOS Safari では `AudioContext` の自動再生が制限される — ユーザーインタラクション後に初期化

### セキュリティ制約
- GitHub Pages は HTTPS 必須（Service Worker の要件を自動的に満たす）
- GitHub Pages では HTTP レスポンスヘッダーのカスタマイズが不可 — CSP は `<meta>` タグで対応

---

## 依存関係管理

| ライブラリ | 分類 | 用途 | バージョン管理方針 |
|-----------|------|------|-------------------|
| typescript | devDependency | TS → JS コンパイル | `~5.x.x`（パッチのみ自動） |
| vitest | devDependency | ユニットテスト | `^最新安定版`（マイナーまで許可） |
| http-server | devDependency | ローカル開発サーバー | `^最新安定版` |

**ランタイム依存ゼロ**を維持する。`dependencies` には何も追加しない。
