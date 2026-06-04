# 設計書

## アーキテクチャ概要

既存のマネージャ分割（MapManager / PlayerManager / GhostManager / Renderer /
GameLoop ...）を踏襲し、新規ファイルは追加しない。今回の変更は以下の3レイヤに閉じる。

- **状態定義**: `src/types.ts`（GhostMode の意味変更）
- **ゲームロジック**: `src/ghost.ts`（撃破挙動）, `src/gameLoop.ts`（TITLEのタイマー進行）
- **描画**: `src/renderer.ts`（タイトル演出・消滅敵の非描画）, `src/constants.ts`（不要定数の整理）

```
GameLoop.update ──(dt)──> 各Manager.update
   │  TITLE: phaseTimer += dt   ← 追加（タイトルアニメ駆動）
   │  PLAYING: ghostMgr.update ──> 撃破時 mode='VANISHED'（旧 EATEN）
   ▼
GameLoop.render ──> Renderer.render
   │  TITLE: drawTitle(phaseTimer)  ← ロゴ登場 + 宇宙飛行士浮遊
   │  PLAYING: drawGhost ──> VANISHED は描画スキップ
```

## コンポーネント設計

### 1. GhostMode の意味変更（types.ts / ghost.ts / constants.ts）

**責務**:
- パワーエサ撃破後の敵を「その場で即消滅・そのステージ中は復活なし」にする

**実装の要点**:
- `GhostMode` の `'EATEN'` を `'VANISHED'` に置き換える（リネーム＋挙動変更）。
  EATEN は「目玉で巣に戻り復活」という旧概念で、新仕様では存在しないため残さない。
- `GhostManager.update` のゴーストループ冒頭で `if (g.mode === 'VANISHED') continue;`
  を入れ、移動・衝突判定・方向選択を一切行わない。これにより:
  - `moveGhost` の EATEN speed 分岐（EATEN_SPEED）が不要 → 削除
  - `chooseDirection` の EATEN 用「ハウス再進入許可」分岐が不要 → 削除
  - `getTarget` の EATEN 用「GHOST_HOUSE_DOOR を目指す」分岐が不要 → 削除
  - `checkCollision` の `if (g.mode === 'EATEN') return false` が不要 → 削除
- `handleCollision`: FRIGHTENED 接触時に `g.mode = 'VANISHED'` とする。
  連続撃破スコア（`eatenScore` インデックス）と `audio.play('EAT_GHOST')` は維持。
- `triggerFrightened`: 既存の `g.mode !== 'EATEN'` ガードを `!== 'VANISHED'` に変更
  （消滅済みの敵を再びおびえ状態に戻さない）。
- `reset()` は `createGhost`（mode='SCATTER'）で全敵を作り直すため、
  次ステージ開始・ミス後リセット時の全員復活は既存ロジックで自動的に成立する。
- `constants.ts`: `EATEN_SPEED`、`GHOST_EATEN_EYES`、`GHOST_EATEN_PUPIL` を削除。

### 2. 消滅敵の非描画（renderer.ts）

**責務**:
- VANISHED 状態の敵を画面に描かない

**実装の要点**:
- `drawGhost` 冒頭の `if (g.mode === 'EATEN') { this.drawEyes(...); return; }` を
  `if (g.mode === 'VANISHED') return;`（何も描かない）に変更。
- 未使用になる `drawEyes` メソッドを削除。
- 撃破スパーク（gameLoop の `spawnBurst('#FFFFFF', ...)`）は既存どおり残すため、
  消えた瞬間の手応えは維持される（スコープ外＝専用消滅エフェクトは追加しない）。

### 3. タイトル画面の作り込み（gameLoop.ts / renderer.ts）

**責務**:
- ロゴ「STELLAR RUN」の登場アニメと宇宙飛行士の浮遊アニメを表示する

**実装の要点**:
- `GameLoop.update` の `case 'TITLE'` を `break` から `this.state.phaseTimer += dt;`
  に変更し、タイトル経過時間を進める（登場アニメの駆動に使用）。
- `Renderer.render` の TITLE 分岐を `this.drawTitle(state.phaseTimer)` に変更。
- `drawTitle(timer)` を拡張:
  - **ロゴ登場**: 最初の約0.6秒で「STELLAR RUN」をフェードイン＋ポップイン
    （ease-out スケール）。`drawReady`/`drawStageClear` の既存 ease-out 式
    `0.5 + 0.5*k*(2-k)` を踏襲して一貫性を保つ。サブ「ステラー・ラン」も続けて出す。
  - **宇宙飛行士の浮遊**: 既存 `drawAstronautBody(r, dir, anim)` を流用し、ロゴ下に1体を
    描く。`performance.now()` ベースで左右ゆっくり往復（位置）＋上下 bob＋歩行 anim を与え、
    画面端で向き（LEFT/RIGHT）を反転させる。
  - **開始導線**: 「Press SPACE / Tap」（pulseAlpha 明滅）と
    「Arrows / WASD / Swipe」は既存どおり維持。
- 既存の `drawPanel` / `glowText` / `pulseAlpha` ヘルパーを再利用する。
- レイアウトは CANVAS 中央基準の相対座標で、既存タイトルと同様に縦長・PC双方で破綻しない。

## データフロー

### パワーエサで敵を倒す
```
1. updatePlaying: didEatPowerDot() → ghostMgr.triggerFrightened()
2. ghostMgr.update: FRIGHTENED の敵にプレイヤーが接触
3. handleCollision: スコア加算 + EAT_GHOST 再生 + g.mode='VANISHED'
4. 以降フレーム: ループ冒頭の continue で当該敵は移動・衝突・描画されない
5. ステージクリア/ミス → reset() で createGhost、全敵 SCATTER で復活
```

### タイトル表示
```
1. 起動 or ALL_CLEAR/GAME_OVER 後 → phase='TITLE', phaseTimer=0
2. update: TITLE で phaseTimer += dt
3. render: drawTitle(phaseTimer) → ロゴ登場(0〜0.6s) + 飛行士浮遊(常時)
4. SPACE/Tap → handleStart → startNewGame
```

## エラーハンドリング戦略

新規のエラー経路はなし。既存のキャンバス2Dコンテキスト取得失敗時の throw を踏襲。
状態列挙のリネーム（EATEN→VANISHED）は TypeScript の網羅性チェックで漏れを検出する。

## テスト戦略

### ユニットテスト
- `ghost.ts`: パワーエサ撃破で対象敵が `mode==='VANISHED'` になり、以降 update で
  pixelPos が変化しない（移動しない）こと
- `ghost.ts`: VANISHED の敵はプレイヤー接触で `player.die()` を誘発しないこと
- `ghost.ts`: `reset()` 後に全敵が `SCATTER`（非 VANISHED）に戻ること
- 撃破時の連続スコア（200/400/800/1600）が従来どおり返ること

### 統合テスト
- 既存テストが EATEN を参照していないか確認し、参照していれば VANISHED 仕様へ更新
- 描画系（renderer）は canvas 依存のため、既存方針に従いロジック層中心に検証

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
src/
  types.ts        # GhostMode: 'EATEN' → 'VANISHED'
  ghost.ts        # 撃破=VANISHED化、VANISHEDスキップ、EATEN分岐削除
  renderer.ts     # drawTitle拡張、drawGhostのVANISHED非描画、drawEyes削除
  gameLoop.ts     # TITLEでphaseTimer進行、drawTitle(timer)呼び出し
  constants.ts    # EATEN_SPEED / GHOST_EATEN_* 削除
```

## 実装の順序

1. types.ts: GhostMode を 'VANISHED' へ
2. ghost.ts: 撃破挙動・VANISHEDスキップ・EATEN分岐削除
3. constants.ts: 不要定数の削除
4. renderer.ts: drawGhost の VANISHED 非描画、drawEyes 削除
5. gameLoop.ts: TITLE の phaseTimer 進行、drawTitle(timer) 呼び出し
6. renderer.ts: drawTitle 拡張（ロゴ登場 + 飛行士浮遊）
7. テスト更新・追加、lint/typecheck/build

## セキュリティ考慮事項

- 外部入力・ネットワーク・シークレットの新規取り扱いなし。XSS/インジェクション経路は増えない。
- 描画文字列はすべて静的リテラルで、ユーザー入力を canvas に反映しない。

## パフォーマンス考慮事項

- VANISHED 敵を update/描画でスキップするため、撃破後はむしろ処理が軽くなる。
- タイトルアニメは TITLE フェーズ限定で、ゲームプレイ中のフレーム予算に影響しない。
- 既存の固定タイムステップ（1/60）と星空描画の負荷構造は変更しない。

## 将来の拡張性

- 消滅専用エフェクト（爆散・フェード）は将来 VANISHED 遷移時に particles へ
  フックして追加可能（今回はスコープ外）。
- タイトルの操作説明強化・ハイスコア表示も drawTitle に追記する形で拡張できる。
