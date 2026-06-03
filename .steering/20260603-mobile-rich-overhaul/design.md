# 設計書

## アーキテクチャ概要

既存の **ゲームループパターン**（Input / Update / Render / Storage / Audio の責務分離、`docs/architecture.md`）を維持したまま、以下を行う:

1. 盤面グリッドを横長(28×31)から**縦長(21×37)へ再定義**し、グリッド依存のハードコードを定数駆動に置き換える。
2. 3ステージのマップ配列を縦長レイアウトで作り直す。
3. Render層に**背景レイヤ(Starfield/Nebula)・パーティクル系・宇宙飛行士描画・ネオン壁・UIトランジション**を追加する。Render層はGameStateを更新しないアーキ制約を厳守する。

```
GameLoop (rAF, 固定タイムステップ)
  ├ UPDATE: Player / GhostMgr / FruitMgr / Collision / ParticleSystem.update
  │         （Starfield は時刻ドリブンのため update 不要。draw 内で performance.now() から直接計算）
  └ RENDER: Background(Starfield+Nebula視差) → Map(ネオン壁, Offscreen) → Dots/PowerCore(発光)
            → Fruit(発光) → Particles → Astronaut/Ghost → HUD(タイポ+トランジション)
グリッド定数 (constants.ts) ── 全モジュールが参照する単一の真実
```

## グリッド再設計（核心: requirements.md 未決事項の確定）

### 確定値

| 項目 | 現行 | 新 | 根拠 |
|------|------|----|------|
| COLS | 28 | **21** | 中心列=10で左右対称。ゴーストハウス(5幅)+両側マスを確保しつつ縦長化 |
| ROWS(プレイ) | 31 | **37** | 縦長比を稼ぐ。トンネル行を中央(行18)に置き上下を概ね対称化し設計負荷を抑える |
| TILE_SIZE | 16 | 16 | ピクセル整合維持 |
| UI帯 | 上4行 | 上4行 | 既存の `UI_HEIGHT=4*TILE / MAP_OFFSET_Y` 方式を踏襲 |
| CANVAS_WIDTH | 448 | **336** | 21*16 |
| CANVAS_HEIGHT | 560 | **656** | (37+4)*16 |
| アスペクト(W/H) | 0.80 | **0.51** | スマホ縦長(≒0.46)に接近。残余白は星空で充填(要求合意済み) |

iPhone SE(320×568, 0.56)・縦長端末(0.46)いずれも `fitToViewport` の `min(scaleX,scaleY)` で全体が収まり、余白は星空背景が埋める。最小幅320pxでも横21タイルは可読。

### 新しい固定位置（マップ配列と一致させる）

```
TUNNEL_COLS = [0, 20]          # 中央トンネル行(行18)の両端
GHOST_HOUSE_CENTER = {x:10, y:18}
GHOST_HOUSE_DOOR   = {x:10, y:15}
GHOST_HOUSE_COLS   = [8, 12]   # ハウス侵入制限の列範囲(ハードコード11..16の置換)
GHOST_STARTS = { BLINKY:{10,15}, PINKY:{10,18}, INKY:{9,18}, CLYDE:{11,18} }
PLAYER_START = {x:10, y:28}
GHOST_SCATTER_TARGETS = { BLINKY:{18,0}, PINKY:{2,0}, INKY:{20,36}, CLYDE:{0,36} }
```
※ 上記はマップ設計と相互依存。マップ配列確定時に壁と矛盾しないよう最終調整する（tasklistで担保）。

## コンポーネント設計

### 1. constants.ts（グリッド定数の単一の真実）
**責務**: 新グリッド寸法・位置・ステージ別パラメータの提供。
**実装の要点**:
- `COLS/ROWS/CANVAS_*` を新値へ。`GHOST_HOUSE_COLS` を追加。位置定数を新グリッドへ。
- `STAGE_WALL_COLORS` は流用可。ネオン用に各ステージへ `glow`(発光色) を追加。

### 2. map.ts（3ステージの縦長マップ + 接続性保証）
**責務**: 21×37 マップ3種の保持、壁/ドット/トンネル判定、Offscreen静的描画。
**実装の要点**:
- `MAP_DATA_1/2/3` を21×37の新配列で作り直す。左右対称で設計し、中央トンネル行・ゴーストハウスを成立させる。
- ネオン壁描画（グラデ+グロー+角丸）に対応。静的部分はOffscreenにキャッシュ（60fps維持）。
- **接続性をテストで検証**: 全ドットがプレイヤー初期位置からflood-fillで到達可能・左右対称・ゴーストハウス/トンネル存在を自動チェック（受け入れ条件「到達不能ドット無し」を保証）。

### 3. ghost.ts / player.ts（グリッド依存の脱ハードコード）
**責務**: 移動・トンネルワープ・ゴーストAI。
**実装の要点**:
- `ghost.ts:240` `28 * TILE_SIZE` → `COLS * TILE_SIZE`。
- `ghost.ts:278` ハウス侵入判定 `nc>=11&&nc<=16` → `GHOST_HOUSE_COLS` と `GHOST_HOUSE_DOOR.y`/`CENTER.y` 由来へ。
- scatterターゲット・ハウス座標は constants 参照のまま新値で機能。AIロジック自体は不変。

### 4. renderer.ts（描画刷新）
**責務**: 全フェーズの描画。
**実装の要点**:
- `UI_HEIGHT/MAP_OFFSET_Y` は維持（CANVAS_HEIGHT追従）。中央寄せ系テキストは新CANVAS_*で自動追従。
- **Astronaut描画**: `drawShipBody` を `drawAstronautBody(r, dir, animPhase)` に置換。ヘルメット+バイザー反射(楕円ハイライト)、胴体スーツ(陰影グラデ)、進行方向に応じた向き、歩行/浮遊アニメ(手足の位相)。残機アイコン・死亡演出(被弾→スピン→破片)も飛行士で統一。
- **ネオン壁**: `shadowBlur`+グラデ+角丸で発光通路。Offscreenキャッシュ前提。
- **アイテム/エサ発光**: グロー半径・明滅強化。
- **UIタイポ+トランジション**: スコア/READY/CLEAR/GAME OVER にグロー・フェード・スケールイン。`phaseTimer` を用いた時間ベース演出。

### 5. background.ts（新規: 星空・星雲・視差）
**責務**: 深宇宙の動く背景。CANVAS全体（盤面外含む）を埋める。
**実装の要点**:
- 多層星(近/中/遠)で視差スクロール。星雲は半透明グラデ円を数枚。
- `update(dt)` で位置更新、`draw(ctx)` で描画。状態は自前で保持しGameStateを汚さない。
- 星数・更新は上限管理（低スペック配慮）。`prefers-reduced-motion` は将来拡張。

### 6. particles.ts（新規: 取得パーティクル/スパーク）
**責務**: ドット/エサ/フルーツ取得・ゴースト撃破時のスパーク演出。
**実装の要点**:
- 軽量パーティクルプール（最大数固定で再利用、GC負荷回避）。`spawn(x,y,color)` / `update(dt)` / `draw(ctx)`。
- GameLoopのUPDATEで `update`、RENDERで `draw`。イベント発火はPlayer/Ghostの食べ判定箇所からコールバック/キュー経由（Render層から状態変更しない）。

### 7. main.ts（fitToViewport 縦長対応 + PC余白充填）
**責務**: キャンバスのビューポート適合。
**実装の要点**:
- 縦長キャンバスを `min(scaleX,scaleY)` でフィット（アスペクト維持）。タッチ端末の26列クリップ処理は新グリッドに合わせ見直し（縦長では不要化の可能性 → 単純フィットへ）。
- 盤面外の余白は **body背景=星空** が見えるよう、Background をページ全面に描く（キャンバス自体を画面サイズに広げ内側に盤面をレターボックス配置 or body側CSSグラデ+canvas内Backgroundで充填）。実装方針はtasklistで確定。

## データフロー

### ドット取得→パーティクル
```
1. Player.update が eatDot 成功を検知
2. 取得座標・色をパーティクルイベントとして発行(キュー or コールバック)
3. GameLoop が ParticleSystem.spawn を呼ぶ(UPDATE内)
4. RENDER で ParticleSystem.draw → スパーク表示
```

### 描画順（毎フレーム）
```
1. Background.draw (星空/星雲/視差, 画面全面)
2. Map.drawTo (ネオン壁, Offscreen転送)
3. Map.drawDots (発光ドット/コア)
4. Fruit / Particles
5. Astronaut / Ghosts
6. HUD (スコア・残機・フェーズ演出)
```

## エラーハンドリング戦略

### カスタムエラークラス
新規例外は不要（ゲーム描画ロジック中心）。Canvas context取得失敗は既存どおり throw。

### エラーハンドリングパターン
- OffscreenCanvas 非対応環境は既存のフォールバック（直接描画）を踏襲。
- パーティクル/星はプール上限でメモリ暴走を防止。異常値はクランプ。
- localStorage 等の既存防御は不変。

## テスト戦略

### ユニットテスト（Vitest）
- **map接続性テスト(新規・最重要)**: 各ステージで (a)左右対称, (b)全ドットが PLAYER_START からflood-fillで到達可能, (c)ゴーストハウス/トンネル行の存在, (d)配列長=COLS*ROWS を検証。
- 既存 `map.test.ts` / `player.test.ts` / `ghost.test.ts` / `constants.test.ts` を新グリッド前提へ更新（座標・トンネル列・ハウス判定）。
- パーティクル/星空はロジック（プール上限・寿命でのリサイクル）を単体検証。純粋関数を切り出してテスト可能に。

### 統合テスト（E2E/手動）
- 既存 `tests/e2e/smoke.spec.ts` を新キャンバス寸法で更新しグリーン維持。
- 縦持ち実機/エミュで上下黒帯解消・3ステージ到達・60fps を手動確認。

## 依存ライブラリ
新規追加なし。**ランタイム依存ゼロを維持**（Canvas/Web標準APIのみ）。

```json
{ "dependencies": {} }
```

## ディレクトリ構造
```
src/
  constants.ts     # 変更: 新グリッド寸法・位置・GHOST_HOUSE_COLS・ステージglow色
  map.ts           # 変更: 21×37 マップ3種・ネオン壁描画・接続性API
  ghost.ts         # 変更: ハードコード除去(totalWidth/ハウス判定)
  player.ts        # 変更: tunnel warp の COLS依存化・パーティクルイベント発行
  renderer.ts      # 変更: 宇宙飛行士・ネオン壁・発光・UIタイポ/トランジション
  background.ts    # 新規: 星空/星雲/視差
  particles.ts     # 新規: パーティクルプール
  gameLoop.ts      # 変更: Background/Particles の update/draw 結線・イベント処理
  main.ts          # 変更: fitToViewport 縦長対応・余白星空充填
  types.ts         # 変更: 必要なら PlayerState にアニメ位相等
tests/unit/
  map.test.ts            # 更新 + 接続性テスト追加
  player.test.ts, ghost.test.ts, constants.test.ts  # 新グリッド前提へ更新
  particles.test.ts      # 新規
tests/e2e/
  smoke.spec.ts          # 更新(キャンバス寸法)
index.html               # theme-color等は不変, CSP維持
```

## 実装の順序
1. **constants.ts** を新グリッド値へ（COLS/ROWS/CANVAS/位置/GHOST_HOUSE_COLS/ステージglow）。
2. **map.ts**: 21×37 マップ3種を左右対称で作成 + 接続性APIと**接続性テスト**を先に書き、テストを通しながら迷路を確定（Red→Green）。
3. **ghost.ts / player.ts**: ハードコード除去・COLS依存化。既存ユニットテストを新グリッドへ更新し通す。
4. **renderer.ts**: 宇宙飛行士描画へ置換（プレイヤー/残機/死亡演出）。
5. **background.ts**(星空/星雲/視差) を新規追加し gameLoop/renderer に結線、main.ts の余白充填。
6. **particles.ts** を新規追加し取得/撃破イベントに結線。
7. **renderer.ts**: ネオン壁・アイテム発光・UIタイポ/トランジション仕上げ。
8. **main.ts**: fitToViewport 縦長対応。
9. テスト更新（unit/e2e）・接続性・品質ゲート（test/lint/typecheck/build）。

## セキュリティ考慮事項
- 外部アセット・外部通信の追加なし。CSP(`img-src 'self' data:` 等)を変更しない。`<meta>` CSP維持。
- PWA(manifest/service-worker)を壊さない。`service-worker.js` のキャッシュ対象に新規`dist/*.js`(background/particles)が含まれることを確認（バージョン定数更新）。
- Canvas描画のみ。DOMへのユーザー入力反映なし（XSS面なし）。

## パフォーマンス考慮事項
- 静的壁(ネオン込み)は OffscreenCanvas にキャッシュし `drawImage` 転送（毎フレーム再描画しない）。
- 星空はレイヤ別に星数上限、視差は加算位置更新のみ。星雲は数枚の半透明円に限定。
- パーティクルは固定サイズプールで再利用しGCスパイク回避。同時数に上限。
- 目標: 60fps維持・メモリ30MB以内（低スペックスマホ）。`shadowBlur` 多用はコスト高 → 静的キャッシュ側に寄せ、動的描画では最小限。

## 将来の拡張性
- グリッド定数を単一の真実にすることで、今後の盤面比変更・新ステージ追加が容易。
- Background/ParticleSystem はゲームロジック非依存の独立モジュールで、他演出へ再利用可能。
- `prefers-reduced-motion` 対応や設定によるエフェクト強度調整の追加余地を残す。
