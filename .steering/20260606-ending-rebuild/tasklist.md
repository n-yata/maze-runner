# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ1: 段階境界・発火の再定義

- [x] `constants.ts` のエンディング段階境界を新6段階へ置換
  - [x] `ENDING_REPAIR_DONE_TIME` / `ENDING_EPILOGUE_TIME` を廃止
  - [x] `ENDING_WALK_START=1.5` / `ENDING_BOARD_TIME=4.5` / `ENDING_LIFTOFF_TIME=6.0` / `ENDING_WARP_TIME=7.5` / `ENDING_EARTH_TIME=10.0` を定義
  - [x] `ENDING_DURATION=13.5` へ変更、コメントを絵コンテに合わせ更新
  - [x] `ENDING_ROCKET_CX/CY` を停泊レイアウトに合わせ見直し

- [x] `gameLoop.ts` の import と `fireEndingCues` を新境界へ再マップ
  - [x] import を新境界定数名へ更新
  - [x] `ENDING_BOARD_TIME` で `REPAIR_DONE` ＋小バースト発火
  - [x] `ENDING_LIFTOFF_TIME` で `LIFTOFF` ＋オレンジ大量バースト発火
  - [x] `ENDING_EARTH_TIME` で `FANFARE` 発火

## フェーズ2: 帰還シーンの描画再構築（renderer.ts）

- [x] `ALL_CLEAR` ケースから `map.drawTo(...)` を削除（背景は星空のみ）
- [x] ワープ加速の判定期間を `ENDING_WARP_TIME 〜 ENDING_EARTH_TIME` に変更
- [x] 新規ヘルパー `drawSurface(alpha)` を追加（惑星地表ホライズン）
- [x] 新規ヘルパー `drawEarth(cx, cy, r, alpha)` を追加（青い地球＋大気グロー）
- [x] `drawEnding` を6段階構成に再構築
  - [x] A 着陸: 地表＋停泊船＋飛行士フェードイン
  - [x] B 歩行: 飛行士が船へ歩いて乗船（歩行アニメ→ハッチへ消える）
  - [x] C 点火: 炎立ち上げ＋画面シェイク開始
  - [x] D 発進: 機体上昇・画面外へ＋シェイク減衰＋地表フェードアウト
  - [x] E ワープ: `drawWarpLines` ＋終盤の減速
  - [x] F 帰還: `drawEarth` 出現→接近、最後に `Press SPACE / Tap` 導線のみ
- [x] `drawEndingEpilogue`（物語テキスト）を削除し F の導線描画へ置換

## フェーズ3: テスト更新

- [x] `tests/unit/gameflow.test.ts` の import を新境界定数名へ更新
- [x] エンディング効果音テストを新境界（BOARD/LIFTOFF/EARTH）で1回ずつ発火するよう更新
- [x] `ALL_CLEAR → TITLE after ENDING_DURATION` が新尺で通ることを確認

## フェーズ4: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `npm test`（170 passed）
- [x] リントエラーがないことを確認
  - [x] `npm run lint`
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`
- [x] ビルドが成功することを確認
  - [x] `npm run build`

## フェーズ5: 検証・ドキュメント

- [x] `implementation-validator` による品質検証（High1/Medium2/Low1 を検出 → 全て対応済み）
- [x] クルトワ（security-engineer）によるコミット前セキュリティレビュー（Critical/High ゼロ・クリア）
- [x] 実装後の振り返り（このファイル下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-06

### 計画と実績の差分

**計画と異なった点**:
- `drawEnding` のシェイク制御を、当初の「単一期間」案から点火(C)で増加・発進(D)で減衰する2区間に分けた。点火→発進の体感を連続させるため。
- 飛行士の描画は既存 `drawAstronautBody` をそのまま流用しつつ、座標・alpha 付きで呼ぶ薄いラッパ `drawAstronautAt` を新設（歩行/待機の使い回しを簡潔にするため）。

**新たに必要になったタスク**:
- ギュレル（implementation-validator）検証で見つかった以下を追加対応:
  - [High] 段階E の余分な `ctx.restore()` を削除（冒頭 save の解放は L682 の1回のみ。アンダーフロー修正）。
  - [Medium] BOARD 境界のパーティクル発火テストを追加（LIFTOFF と対称化）。
  - [Low] `drawEarth` の陸地パッチ配列を `Renderer.EARTH_PATCHES` 定数へ抽出（毎フレーム生成を解消）。

**技術的理由でスキップしたタスク**:
- なし（全タスク完了）。

### 学んだこと

**技術的な学び**:
- Canvas の save/restore は早期 return を連ねる描画関数で対応が崩れやすい。「冒頭 save を1回だけ restore で解放」という不変条件を、各分岐の return 前で必ず満たす設計が重要。段階Eだけ共通 restore の後にさらに restore していたのが盲点だった。
- 段階境界を `constants.ts` に集約し renderer/gameLoop/test が共有する方式は、尺変更（9→13.5秒）やテンポ調整を1ファイルで完結でき、演出のズレも防げて有効だった。

**プロセス上の改善点**:
- requirements.md を `/plan-feature` で先に固めたことで、add-feature 側は設計・実装に集中でき、絵コンテの認識ズレが起きなかった。
- 検証（ギュレル）→修正→再テストのループで High を1件潰せた。描画ロジックは型チェックを通っても状態スタックの論理バグが残りうるため、サブエージェント検証の価値が高い。

### 次回への改善提案
- Canvas 描画の追加時は、関数冒頭で `const depth = ctx ...`（概念上の save 深さ）を意識し、分岐ごとの restore 対応をレビュー観点に明示する。
- エンディングのような時間駆動演出は、段階境界の昇順保証テスト＋各境界の発火テスト（音・パーティクル）をセットで用意するとリグレッションに強い。
