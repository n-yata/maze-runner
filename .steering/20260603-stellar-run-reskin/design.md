# 設計書

## アーキテクチャ概要

既存の Canvas 手続き描画アーキテクチャを維持したまま、**描画レイヤとカラーパレットのみを差し替える**リスキン。
ゲームロジック（player/ghost/fruit/map のロジック、gameLoop、入力、ストレージ）には一切手を入れない。
変更は「描画と色」「UIレイアウト（Dパッド撤去）」「名称メタ」の3領域に閉じる。

```
[constants.ts] パレット定義 ──→ [map.ts] 壁・結晶・コアの描画
        │                        [renderer.ts] 宇宙船・エイリアン・宇宙アイテム・タイトル描画
        └──────────────────────────────────┘
[index.html] Dパッド撤去 + <title>/PWAメタ ─→ [main.ts] setupDpad撤去 + fitToViewport調整
[manifest.json] アプリ名/テーマカラー
```

不変: `player.ts` / `ghost.ts` / `fruit.ts`(ロジック) / `gameLoop.ts` / `input.ts` / `storage.ts` / `audio.ts` / `types.ts` / マップデータ・タイル座標・AI。

## コンポーネント設計

### 1. constants.ts — カラーパレット差し替え

**責務**: 宇宙テーマの配色を一元定義。

**実装の要点**:
- `COLORS`: BACKGROUND を深宇宙色へ、DOT=エネルギー結晶色、POWER_DOT=コア色（DOTと別色に分離）、PLAYER=宇宙船ハル色、FRIGHTENED系・EATEN_EYES・LIFE_COLOR を宇宙系に。
- `GHOST_COLORS`: 4体のエイリアンを区別できる新4色（内部キー BLINKY/PINKY/INKY/CLYDE は不変）。
- `STAGE_WALL_COLORS`: 各ステージをコロニー/星雲/エイリアン巣の配色へ。
- `FRUIT_TABLE`: スコアは不変、color のみ宇宙鉱石/コア系へ。
- スコア・速度・しきい値など**数値パラメータは一切変更しない**（既存テスト保護）。
- 推進炎などrenderで使う補助色は定数として追加してもよい（例: `SHIP_THRUSTER`）。

### 2. map.ts — 壁・エネルギー結晶・コアの描画

**責務**: 静的マップ（壁）とドット/パワーエサの描画を宇宙モチーフに。

**実装の要点**:
- `drawStaticMap`: 壁は既存の二重矩形を活かしつつ、`STAGE_WALL_COLORS` の新色でコロニー通路感を出す（構造は維持、色のみ）。
- `drawDots`: 通常ドット(tile=2)を「エネルギー結晶」＝小さな菱形(diamond)に、パワーエサ(tile=3)を `COLORS.POWER_DOT` の「コア」＝発光する円に描き分ける。
- タイル座標・当たり判定・dotState ロジックには触れない（描画形状と色のみ変更）。

### 3. renderer.ts — 宇宙船・エイリアン・宇宙アイテム・UI

**責務**: 主人公/敵/フルーツ/タイトル/UIの描画を宇宙テーマへ。

**実装の要点**:
- `drawPlayer`: パックマンの円弧を廃し、**進行方向(`state.dir`)を向く三角形の宇宙船**＋`animFrame`で明滅する推進炎＋コックピットを描画。
- `drawDeadPlayer`: 既存の「フリーズ→スピン→縮小」タイムラインを維持しつつ、形状を宇宙船にして爆散風に（破綻なく消える）。
- `drawGhost`: お化け型を**エイリアン**へ（丸い頭＋触角＋波打つ下端＋大きな目）。FRIGHTENED は青系で点滅、EATEN は逃げる目のみ（既存ロジックの mode 分岐は維持）。
- `drawFruit`: 宇宙アイテム（発光する鉱石/コア）として描画。`getFruitDef(level).color` を使用、点滅ロジックは維持。
- `drawTitle`: 「STELLAR RUN」＋サブ「ステラー・ラン」、配色を宇宙系に。操作説明は維持。
- `drawUI` の残機アイコン: パックアークから小さな宇宙船アイコンへ。
- READY/STAGE CLEAR/ALL CLEAR/GAME OVER/PAUSED: 文言は維持、アクセント色を宇宙系に調整可。

### 4. index.html — Dパッド撤去 + メタ更新

**責務**: 仮想十字キー撤去とマップ拡大、名称/PWAメタ更新。

**実装の要点**:
- `#dpad` の HTML マークアップと、それに関わる CSS（`.dpad-*`、`@media (pointer: coarse/fine)` の dpad 関連指定）を削除。
- Dパッドが消えるため、タッチ/デスクトップとも canvas を縦中央寄せでビューポートに最大表示（`body { justify-content: center }`）。
- `<title>`・`apple-mobile-web-app-title` を「ステラー・ラン」に、`theme-color` を宇宙色に更新。CSP は維持。

### 5. main.ts — setupDpad撤去 + fitToViewport調整

**責務**: Dパッド配線の撤去とビューポートフィット調整。

**実装の要点**:
- `setupDpad()` 関数と呼び出しを削除。未使用になる `Direction` import を整理。
- `fitToViewport`: Dパッドが占めていた縦領域がなくなるため、`scale = min(scaleX, scaleY)` のまま canvas が縦いっぱいに拡大される。coarse 時の横フィット（内側26列）ロジックは維持。
- スワイプ入力(`input.ts`)は window 全体購読のため改修不要。

### 6. manifest.json — アプリ名/テーマカラー

**実装の要点**: `name`/`short_name`/`description`/`theme_color`/`background_color` を宇宙テーマへ。アイコン参照は現状維持（アイコン画像差し替えはスコープ外）。

## データフロー

リスキンのため新たなデータフローは発生しない。描画時に参照する色・形状が変わるのみ。

## エラーハンドリング戦略

新規のエラーパスは発生しない。描画は副作用のない Canvas API 呼び出しのみ。

## テスト戦略

### ユニットテスト
- 既存テスト（player/ghost/fruit/map/constants/gameflow/storage）が**そのまま通る**ことを回帰の保証とする。
- 描画は Canvas 出力のため自動テスト対象外（既存方針踏襲）。色・形状の検証は目視で行う。

### 統合テスト
- ビルド成功 + 全既存テスト通過。
- 目視: 宇宙船/エイリアン/結晶/コア/タイトル表示、モバイルでDパッド非表示・canvas拡大、スワイプ/キーボード操作。

## 依存ライブラリ

追加なし。

## ディレクトリ構造

```
変更ファイル:
  src/constants.ts   (パレット)
  src/map.ts         (壁・結晶・コア描画)
  src/renderer.ts    (船・エイリアン・アイテム・タイトル・UI)
  src/main.ts        (setupDpad撤去・fit調整)
  index.html         (Dパッド撤去・メタ)
  manifest.json      (アプリ名・色)
  docs/product-requirements.md (タイトル表記、必要に応じて)
```

## 実装の順序

1. constants.ts のパレット差し替え（土台）
2. map.ts の壁・結晶・コア描画
3. renderer.ts の船・エイリアン・アイテム・タイトル・UI
4. index.html の Dパッド撤去・メタ更新
5. main.ts の setupDpad 撤去・fitToViewport 調整
6. manifest.json 更新
7. docs タイトル表記の更新（必要に応じて）
8. ビルド・テスト・型チェック・目視確認

## セキュリティ考慮事項

- 外部通信・新規入力経路の追加なし。CSP は現状維持。
- ハードコードのURL/シークレット等は追加しない（純粋な色定義・描画のみ）。

## パフォーマンス考慮事項

- 壁は OffscreenCanvas にプリレンダ済み（変更後も同方式）。船/エイリアン描画はフレーム毎だが図形数は微増にとどめ60fpsを維持。

## 将来の拡張性

- 色・形状を constants と各 draw 関数に集約しているため、別テーマへの再着せ替えやスプライト化（将来）への移行が容易。
