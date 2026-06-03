# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: カラーパレット差し替え（constants.ts）

- [x] `COLORS` を宇宙テーマへ（BACKGROUND/DOT=結晶/POWER_DOT=コア分離/PLAYER=船/FRIGHTENED系/EATEN_EYES/LIFE_COLOR）
- [x] `GHOST_COLORS` を区別可能なエイリアン4色へ（キーは不変）
- [x] `STAGE_WALL_COLORS` をコロニー/星雲/巣の配色へ
- [x] `FRUIT_TABLE` の color を宇宙鉱石/コア系へ（score は不変）
- [x] 推進炎など補助色の定数を追加（必要な場合）
- [x] 速度・スコア・しきい値などの数値は変更していないことを確認

## フェーズ2: 壁・結晶・コアの描画（map.ts）

- [x] `drawDots` で通常ドットを「エネルギー結晶（菱形）」に描画
- [x] `drawDots` でパワーエサを `COLORS.POWER_DOT` の「発光コア」に描画
- [x] `drawStaticMap` の壁が新パレットでコロニー感になることを確認（構造は維持）

## フェーズ3: 船・エイリアン・アイテム・UI（renderer.ts）

- [x] `drawPlayer` を進行方向を向く宇宙船＋推進炎＋コックピットに
- [x] `drawDeadPlayer` を宇宙船ベースの爆散演出に（既存タイムライン維持）
- [x] `drawGhost` をエイリアン（頭＋触角＋大きな目）に（mode分岐維持）
- [x] `drawFruit` を発光する宇宙アイテムに（点滅ロジック維持）
- [x] `drawTitle` を「STELLAR RUN / ステラー・ラン」に
- [x] `drawUI` の残機アイコンを宇宙船アイコンに
- [x] READY/STAGE CLEAR/ALL CLEAR/GAME OVER のアクセント色を宇宙系に調整

## フェーズ4: UI刷新（Dパッド撤去）

- [x] `index.html` の `#dpad` HTML マークアップを削除
- [x] `index.html` の `.dpad-*` および dpad関連 CSS/メディアクエリを削除
- [x] `index.html` で canvas を縦中央寄せ・ビューポート最大表示に
- [x] `main.ts` の `setupDpad()` 関数と呼び出しを削除、未使用 import を整理
- [x] `main.ts` の `fitToViewport` を確認・調整（Dパッド分の縦領域を canvas へ。min(scaleX,scaleY)で縦拡大、中央寄せで全体表示）

## フェーズ5: 名称・PWAメタ更新

- [x] `index.html` の `<title>`・`apple-mobile-web-app-title`・`theme-color` を更新
- [x] `manifest.json` の name/short_name/description/theme_color/background_color を更新
- [x] `docs/product-requirements.md` 等のタイトル表記を必要に応じて更新

## フェーズ5.5: E2Eテスト追加（Playwright・スモーク中心）

- [x] Playwright を devDependency として導入し、設定（playwright.config）を追加
- [x] テスト用にローカルサーバ起動（build後に静的配信）を webServer 設定で自動化
- [x] スモークE2E: ページ読込で canvas が描画される（非空ピクセル判定）
- [x] スモークE2E: 開始操作（SPACE）で TITLE→READY の描画変化
- [x] スモークE2E: 矢印キー操作でプレイヤーが移動する（描画変化を検証）
- [x] スモークE2E: モバイル相当ビューポートで仮想十字キー（#dpad/#btn-*）が存在しない（count 0）
- [x] `package.json` に `test:e2e` スクリプト追加（既存 `test` と分離）
- [x] E2E がローカルで通ることを確認（10 passed: desktop/mobile）

## フェーズ6: 品質チェックと修正

- [x] `npm test`（既存テスト全通過＝回帰なし。108 passed）
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`

## フェーズ7: ドキュメント更新

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-03

### 計画と実績の差分

**計画通りに進んだ点**:
- リスキンの原則「描画と色のみ変更・ゲームロジック不変」を完全に維持。
  player/ghost/fruit(ロジック)/gameLoop/input/storage/audio/types に diff ゼロ。
- 描画は constants のパレットと renderer/map の各 draw 関数に集約されており、差し替えは想定どおり局所で完結。

**計画から追加・変更した点**:
- 作業途中でシャビから「E2Eテスト追加」の追加要求。フェーズ5.5として取り込み、Playwright（スモーク中心）を
  test-engineer(ギュレル)に委譲して導入（desktop/mobile 10ケース、全パス）。
- 実装検証(implementation-validator)の指摘を反映し、`drawGhost` の stroke 設定を save/restore でスコープ化、
  瞳色 `GHOST_EATEN_PUPIL`・コアグロー `POWER_DOT_GLOW` を定数化（ハードコード排除）。

### 学んだこと

**技術的な学び**:
- Canvas手続き描画は「形状を描く関数」と「色定数」を分離しておくと、ロジック無改変のリスキンが安全に行える。
  `drawShipBody` を主人公・残機アイコン・死亡演出で共通化でき、修正点を1箇所に集約できた。
- 状態が window 非露出のCanvasゲームでも、E2Eは「Canvasピクセル変化」「DOM要素の存在/不在」で
  本番コードを汚さずブラックボックス検証できる。

**プロセス上の改善点**:
- /plan-feature で固めた requirements.md を /add-feature が再生成せず尊重する連携がスムーズに機能した。
- 作業中の追加要求(E2E)を別steeringに切らず同一フェーズへ取り込み、tasklistで一元管理できた。

### 次回への改善提案
- 色のrgba派生（グロー等）が増える場合、hex→rgba変換ユーティリティを用意すると重複定義を防げる。
- E2Eの READY→PLAYING 実待機3.5sはCI時間を圧迫しうる。将来テスト用にREADY時間を環境変数化する場合は
  本番デフォルト不変を厳守する（テスト専用フックを本番に入れない原則の範囲で検討）。
- アイコン画像(icons/*)は旧テーマのまま。PWAアイコンの宇宙テーマ差し替えは別作業として検討余地あり。
