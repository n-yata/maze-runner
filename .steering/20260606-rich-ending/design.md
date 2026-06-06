# 設計書: エンディング演出のリッチ化

## アーキテクチャ概要

既存の演出資産（`ParticleSystem` / `AudioManager` / `Starfield`）をエンディング
（`ALL_CLEAR` フェーズ）に接続し、段階を増やして視覚・聴覚・物語の余韻を強化する。
責務分離は現状の設計を踏襲する:

- **状態進行・キュー発火**: `GameLoop`（`phaseTimer` の境界またぎを検出し、音/パーティクルを1回ずつ発火）
- **描画・演出**: `Renderer`（`drawEnding` を多段階化。シェイク／ワープは `phaseTimer` から決定論的に算出）
- **共有定数**: `constants.ts`（段階境界・総尺を `GameLoop` と `Renderer` で共有し、ズレで演出が切れるのを防ぐ）

```
GameLoop.update(ALL_CLEAR)
  ├─ phaseTimer を進める
  ├─ crossed(境界) を判定 → audio.play(...) / particles.spawnBurst(...)（各1回）
  └─ phaseTimer >= ENDING_DURATION で createInitialState()（TITLEへ）

Renderer.render(ALL_CLEAR)
  ├─ starfield.setWarp(発進段階なら>1) → starfield.draw(dt)   ← ワープ加速
  └─ drawEnding(phaseTimer, parts)
       ├─ 段階A 回収完了→修理中
       ├─ 段階B 修理完了（システム オールグリーン）
       ├─ 段階C 発進（ロケット上昇＋画面シェイク＋ワープライン）
       └─ 段階D エピローグ（帰還メッセージ→Press SPACE/Tap）
```

## 段階設計（総尺 9.0 秒）

| 段階 | 区間(秒) | 内容 | 境界での発火（GameLoop） |
|------|----------|------|--------------------------|
| A 回収完了/修理中 | 0.0–2.0 | 「全部品 回収完了」＋進捗 | — |
| B 修理完了 | 2.0–4.0 | 「修理 完了」「システム オールグリーン」＋機体 | `t=2.0`: `REPAIR_DONE` 音＋修理スパーク |
| C 発進 | 4.0–6.5 | 「発進！」ロケット上昇・噴射炎・画面シェイク・ワープ | `t=4.0`: `LIFTOFF` 音＋噴射バースト |
| D エピローグ | 6.5–9.0 | 「RESCUE COMPLETE」→帰還メッセージ→Press SPACE/Tap | `t=6.5`: `FANFARE` 音 |

## コンポーネント設計

### 1. constants.ts（定数の集約・拡張）

**責務**: 段階境界・総尺・演出パラメータの単一情報源。

- 既存 `ENDING_REPAIR_DONE_TIME`(2.0) は据え置き。
- `ENDING_LIFTOFF_TIME` を 3.5 → **4.0** に変更（B終了＝発進開始）。
- `ENDING_EPILOGUE_TIME = 6.5`（新規。C終了＝エピローグ開始）。
- `ENDING_DURATION` を 5.0 → **9.0** に変更（総尺）。
- 盤面オフセットを共有するため `UI_HEIGHT = 4 * TILE_SIZE` / `MAP_OFFSET_Y = UI_HEIGHT` を
  constants へ移設（現状 `renderer.ts` のローカル定数）。GameLoop がパーティクル座標を
  盤面ローカルへ換算するのに使う（マジックナンバー重複を避ける）。
- エンディング演出パラメータ: `ENDING_ROCKET_CX`/`ENDING_ROCKET_CY`（噴射原点、canvas座標）、
  `ENDING_SHAKE_MAG`、`ENDING_WARP_FACTOR`。

### 2. types.ts / audio.ts（サウンド追加）

**責務**: エンディング段階に同期する効果音。

- `SoundKey` に `REPAIR_DONE` / `LIFTOFF` / `FANFARE` を追加。
- `SOUND_DEFS` に各定義を追加（既存と同じオシレータ合成。音源ファイルは追加しない）:
  - `REPAIR_DONE`: 明るい復旧音（`triangle`, 中高音, 0.3s 程度）
  - `LIFTOFF`: 発進の轟き（`sawtooth`, 低音, 0.6s 程度, gain やや大）
  - `FANFARE`: 帰還の勝利音（`triangle`, 高音, 0.5s 程度）

### 3. GameLoop（段階キューの発火）

**責務**: `ALL_CLEAR` 中に `phaseTimer` の境界またぎを検出し、音/パーティクルを**1回ずつ**発火。

**実装の要点**:
- `update` の `ALL_CLEAR` ケースを次の形に拡張:
  ```ts
  case 'ALL_CLEAR': {
    const before = this.state.phaseTimer;
    this.state.phaseTimer += dt;
    this.fireEndingCues(before, this.state.phaseTimer);
    if (this.state.phaseTimer >= ALL_CLEAR_DURATION) {
      this.state = this.createInitialState();
    }
    break;
  }
  ```
- ヘルパー `private crossed(before, after, t) { return before < t && after >= t; }`（純粋・テスト容易）。
- `fireEndingCues(before, after)`:
  - `crossed(…, ENDING_REPAIR_DONE_TIME)`: `audio.play('REPAIR_DONE')` ＋ ロケット位置に青緑スパーク。
  - `crossed(…, ENDING_LIFTOFF_TIME)`: `audio.play('LIFTOFF')` ＋ 噴射口にオレンジ大量バースト。
  - `crossed(…, ENDING_EPILOGUE_TIME)`: `audio.play('FANFARE')`。
- パーティクル座標は `ENDING_ROCKET_CX`, `ENDING_ROCKET_CY - MAP_OFFSET_Y`（盤面ローカル換算）。
  既存 `spawnBurst` をそのまま利用（座標系は他の発火と同一）。
- ミュート時は `AudioManager.play` 側が no-op（既存仕様）。視覚演出は影響を受けない。

### 4. Renderer / drawEnding（多段階描画・シェイク・ワープ）

**責務**: 段階A〜Dの描画。発進のシェイクとワープを `phaseTimer` から決定論的に算出（state追加不要）。

**実装の要点**:
- `drawEnding` を4段階に拡張。既存の `glowText` / `drawPanel` / `drawRocket` / `pulseAlpha` を再利用。
- **画面シェイク**: 発進段階で `shake = ENDING_SHAKE_MAG * decay * sin(t*freq)` を算出し、
  `ctx.save(); ctx.translate(sx, sy)` で演出全体を揺らして `restore()`。発進直後最大→減衰。
- **ワープ**: `render` の `ALL_CLEAR` 分岐で、発進段階のとき `starfield.setWarp(ENDING_WARP_FACTOR)`、
  それ以外は `setWarp(1)`。加えて発進段階は `drawEnding` 内で上方向のワープライン（白ストリーク）を重ねる。
- **エピローグ**: 段階Dで帰還メッセージを `drawIntro` と同様に1行ずつ reveal 表示し、
  末尾に `Press SPACE / Tap`（`pulseAlpha()`）。

### 5. Starfield（ワープ加速対応の小改修）

**責務**: 視差スクロールに速度倍率を持たせ、発進中だけ星を加速（連続性を保つ）。

**実装の要点**:
- 現状 `draw(ctx, timeMs)` は絶対時刻ベースで、倍率を単純乗算すると位置がジャンプする。
  内部に経過時間を蓄積する方式へ変更:
  - フィールド `private elapsedMs = 0; private warp = 1;`
  - `setWarp(factor: number)`: 倍率を設定（発進段階で `ENDING_WARP_FACTOR`、通常 1）。
  - `draw(ctx, dtMs: number)`: `this.elapsedMs += dtMs * this.warp;` とし、内部時刻 `elapsedMs` で
    星・星雲を描く（倍率を変えても位置が連続）。
- 呼び出し側 `Renderer.render` は前回 `performance.now()` を保持して **フレーム差分 dtMs** を渡す形へ変更
  （呼び出しは renderer 1箇所のみ。テストは StubRenderer なので影響なし）。

## データフロー

### エンディング進行
```
1. 最終ステージクリア → startNextLevel() が phase=ALL_CLEAR, phaseTimer=0
2. 毎フレーム update(dt): phaseTimer 加算 → fireEndingCues で境界キュー発火
3. render(dt): setWarp（発進段階のみ加速）→ starfield.draw → drawEnding（段階別描画＋シェイク）
4. phaseTimer >= ENDING_DURATION(9.0) → createInitialState() で TITLE へ
5. エンディング中の SPACE/Tap でも handleStart() が即 TITLE へ（既存動作を維持）
```

## エラーハンドリング戦略

- 純粋な描画・演出のため新規例外は発生しない。`AudioContext` 未初期化/ミュートは既存 `play` のガードで安全。
- 段階境界キューは `crossed` の半開区間判定で、同一境界を二重発火しない。

## テスト戦略

### ユニットテスト（`tests/unit/gameflow.test.ts`）
- 既存「ALL_CLEAR → TITLE after N seconds」「resets parts …」の `5.1` を
  `ENDING_DURATION` import に置換し、尺変更へ追随（マジックナンバー除去）。
- 新規: `ALL_CLEAR` を 0→`ENDING_DURATION` まで `tickFor` し、`audio.play` が
  `REPAIR_DONE` / `LIFTOFF` / `FANFARE` を**それぞれ1回ずつ**呼ぶことを検証（境界の二重発火がないこと）。
- 新規: 各境界の直前まで進めても発火せず、またいだ最初のフレームで発火することを検証。

### 既存テストの非回帰
- `constants.test.ts` 等、尺以外のテストは変更不要であることを確認。

## ディレクトリ構造

```
src/
  constants.ts   # 段階境界/総尺/演出パラメータ追加、UI_HEIGHT/MAP_OFFSET_Y 移設
  types.ts       # SoundKey に REPAIR_DONE/LIFTOFF/FANFARE 追加
  audio.ts       # SOUND_DEFS に3音追加
  gameLoop.ts    # ALL_CLEAR キュー発火（fireEndingCues / crossed）
  renderer.ts    # drawEnding 多段階化、シェイク/ワープライン、MAP_OFFSET_Y を import、starfield へ dt 供給
  background.ts  # Starfield に elapsedMs/warp、setWarp、draw(dtMs)
tests/unit/
  gameflow.test.ts # 尺の定数化＋エンディングキューのテスト追加
```

## 実装の順序

1. `constants.ts`: 段階境界・総尺・演出パラメータ・`UI_HEIGHT`/`MAP_OFFSET_Y` を追加/変更。
2. `types.ts` / `audio.ts`: `SoundKey` と `SOUND_DEFS` に3音追加。
3. `background.ts`: `Starfield` をワープ対応（`elapsedMs`/`warp`/`setWarp`/`draw(dtMs)`）。
4. `gameLoop.ts`: `fireEndingCues` / `crossed`、`ALL_CLEAR` キュー発火。
5. `renderer.ts`: `MAP_OFFSET_Y` を constants から import、`drawEnding` 多段階化＋シェイク＋ワープライン、`starfield` へ dt 供給。
6. `tests/unit/gameflow.test.ts`: 尺の定数化＋エンディングキューのテスト追加。
7. テスト/lint/typecheck/build を緑にする。

## セキュリティ考慮事項

- 外部入力・ネットワーク・シークレットに無関係（クライアント内の描画/音声生成のみ）。
- ハードコードされた URL/キー/アカウント情報を新規に持ち込まない。

## パフォーマンス考慮事項

- パーティクルは固定プール（160）で GC スパイクなし。発進バーストも上限内に収める。
- 加算合成は既存方針を踏襲（`shadowBlur` を避ける）。
- ワープは内部時刻スケールのみで追加描画コストは軽微（ワープラインは数十本に制限）。

## 将来の拡張性

- 段階・尺は constants 集約のため調整が容易。
- スタッフロール（今回スコープ外）は段階Eとして追加可能な構造。
