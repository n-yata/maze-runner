# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### 実装可能なタスクのみを計画
- 計画段階で「実装可能なタスク」のみをリストアップ
- 「将来やるかもしれないタスク」は含めない
- 「検討中のタスク」は含めない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

### タスクが大きすぎる場合
- タスクを小さなサブタスクに分割
- 分割したサブタスクをこのファイルに追加
- サブタスクを1つずつ完了させる

---

## フェーズ1: 基盤（型・定数・ボスロジック）

- [x] 型定義の拡張（`src/types.ts`）
  - [x] `GamePhase` に `'BOSS_READY' | 'BOSS' | 'BOSS_DEFEATED'` を追加
  - [x] `SoundKey` は変更しない（既存SE流用方針。design.md「SE方針」参照）

- [x] ボス戦定数の追加（`src/constants.ts`）
  - [x] フェーズ時間: `BOSS_READY_DURATION`, `BOSS_DEFEATED_DURATION`
  - [x] HP/ダメージ: `BOSS_MAX_HP`, `BOSS_HIT_DAMAGE`, `BOSS_BODY_RADIUS`
  - [x] 本体挙動: `BOSS_SWAY_SPEED`, `BOSS_SWAY_RANGE`
  - [x] 弾幕: `BOSS_BULLET_SPEED`, `BOSS_BULLET_RADIUS`, `BOSS_FIRE_INTERVAL`,
        `BOSS_SPREAD_COUNT`, `BOSS_SPREAD_ARC`, `BOSS_AIMED_INTERVAL`, `BOSS_MAX_BULLETS`
  - [x] 配色: `BOSS_ARENA_COLORS`（既存 `STAGE_WALL_COLORS` は変更しない）
  - [x] `MAX_LEVEL` / `TOTAL_PARTS` / `getLevelParams` を変更しないことを確認

- [x] BossManager のテストを先に作成（Red）（`tests/unit/boss.test.ts`）
  - [x] `reset()` で HP満タン・弾0・`isDefeated===false`
  - [x] `hitByBeams` が本体円内のビームのみ与ダメ、命中ビームは消費（二重ダメージなし）
  - [x] HP は 0 未満にクランプ、`hp<=0` で `isDefeated===true`
  - [x] `checkPlayerHit`（被弾・バリアなし）→ `true`、当たった弾は消える
  - [x] `checkPlayerHit`（被弾・バリアあり）→ `false`（盾）
  - [x] 弾プールが `BOSS_MAX_BULLETS` を超えない（固定長プール）
  - [x] 弾が場外・壁で消滅する（開けた闘技場のため場外=外周壁で消滅）
  - [x] 弾幕が決定論的（乱数非依存：同条件で同配置）

- [x] BossManager の実装（Green）（`src/boss.ts`）
  - [x] `BossBullet` インターフェース＋固定長プール初期化（`LaserManager` に倣う）
  - [x] `reset()` / `clearBullets()`（リスポーン用の残弾一掃を分離）
  - [x] `hp` / `maxHp` / `isDefeated` / `centerPixel` / `getHpRatio()` / `getBullets()`
  - [x] `update(dt, playerPixelPos)`: 本体の左右往復、ばら撒き＋狙い撃ちの2系統発射、全弾前進、場外消滅
  - [x] `hitByBeams(beams)`: 本体円内のビームでHP減算（クランプ）、命中ビーム消費、与ダメ返却
  - [x] `checkPlayerHit(playerPixelPos, hasBarrier)`: 当たり判定→バリア優先→ミス可否返却＆弾消費
  - [x] 座標系は盤面ローカル（描画側で `MAP_OFFSET_Y` 加算）に統一
  - [x] boss.test.ts が全て通ることを確認（9件パス）

## フェーズ2: 統合（盤面・ゲームループ・描画）

- [x] ボス闘技場の追加（`src/map.ts`）
  - [x] `buildBossArena()`（外周壁＋開けた内部、下部にPOWER_DOT配置）
  - [x] `resetBossArena()` でボス盤面を構築する経路を用意（既存 `reset(level)` と整合）
  - [x] `isWall`/`isTunnel`/`getValidFruitPositions`/`drawTo`/`drawDots` がボス盤面で動作（既存API流用）
  - [x] `getValidFruitPositions()` が非空（内部全面ドット＝詰み防止の前提を満たす）

- [x] GameLoop の配線（`src/gameLoop.ts`）
  - [x] `private boss = new BossManager();` をフィールド追加（particles/laser と同様、内部生成）
  - [x] `startNextLevel()` の `level>=MAX_LEVEL` 分岐を `startBossStage()` に差し替え
  - [x] `startBossStage()`: `BOSS_READY` 初期化（map=ボス盤面・player/fruit/laser reset・boss.reset・SE）
  - [x] `switch(phase)` に `BOSS_READY`（時間経過で `BOSS`）を追加
  - [x] `switch(phase)` に `BOSS`（`updateBoss(dt)` 呼び出し）を追加
  - [x] `switch(phase)` に `BOSS_DEFEATED`（時間経過で `ALL_CLEAR`、dotsEaten=0、ハイスコア保存）を追加
  - [x] `updateBoss(dt)` 実装（design.md「ユースケース2」の手順1〜9）
  - [x] 被弾→`PLAYER_DEAD`（既存導線流用）
  - [x] 撃破→`BOSS_DEFEATED`（撃破スパーク大量＋`FANFARE`）
  - [x] `respawnPlayer()` にボス分岐（ボス戦中は `BOSS_READY` へ・ボスHP保持・残弾 `clearBullets()`）
  - [x] `createInitialState()` 経路で TITLE 復帰時に `boss.reset()` され状態初期化される
  - [x] `main.ts` を変更せずに動くことを確認（render 引数は末尾追加・StubRenderer は可変長を許容）

- [x] gameflow.test.ts の拡張（`tests/unit/gameflow.test.ts`）
  - [x] `STAGE_CLEAR(level=3) → BOSS_READY`（旧 ALL_CLEAR 直行ではないこと。既存2テストも更新）
  - [x] `BOSS_READY → BOSS`（`BOSS_READY_DURATION` 経過）＋ 経過前は BOSS_READY 維持
  - [x] ボス戦で `player.die()` → `BOSS → PLAYER_DEAD`
  - [x] `PLAYER_DEAD(ボス・残機あり) → BOSS_READY` ＋ ボスHP保持
  - [x] `PLAYER_DEAD(ボス・残機0) → GAME_OVER`
  - [x] ボスHP=0 → `BOSS → BOSS_DEFEATED`
  - [x] `BOSS_DEFEATED → ALL_CLEAR`（`BOSS_DEFEATED_DURATION` 経過）
  - [x] `ALL_CLEAR → TITLE` でボスHPも初期化される
  - [x] ボス戦中 `partsCollected` は 3 のまま増減しない
  - [x] ボスHP>0 の間は `BOSS_DEFEATED` にならない（早期クリアしない）

- [x] Renderer の描画（`src/renderer.ts`）
  - [x] `render()` の `switch(phase)` に `BOSS_READY`/`BOSS`/`BOSS_DEFEATED` を追加
  - [x] ボス闘技場は `map.drawTo`/`drawDots` を流用＋専用配色（`resetBossArena` の `BOSS_ARENA_COLORS`）
  - [x] `drawBoss(boss)`（巨大エイリアン本体、`boss.centerPixel`+`MAP_OFFSET_Y`）
  - [x] `drawBossBullets(boss)`（加算合成の発光弾、`getBullets()` 走査）
  - [x] `drawBossHpBar(boss)`（`roundRectPath` 枠＋`getHpRatio()` 塗り＋ラベル・残量で色変化）
  - [x] `drawBossWarning()`（`drawPanel`＋点滅警告、`drawIntro` 流儀）
  - [x] `drawBossDefeated()`（フラッシュ＋爆散リング＋破片、`drawDeadPlayer` の shard 流用）
  - [x] `render()` 内で `GameState` を変更しない（読み取り専用・boss は引数渡し）
  - [x] プレイヤー/バリア/レーザー/フルーツ/パーティクルの既存描画を流用

- [x] バランス調整（手動）
  - [x] ブラウザ実描画で BOSS/BOSS_READY/BOSS_DEFEATED の3フェーズが例外なく描画されることを確認
  - [x] 弾密度（同時10〜13発＝避けられる）・HPバー・本体配置（上部中央）を実画面で確認
  - [x] バリア（盾）展開・POWER_DOT動線・レーザー上方反撃が成立することを確認
        ※ `BOSS_MAX_HP`/弾速/間隔は根拠付きの定数。最終的な感触の微調整は実プレイで容易に可能

## フェーズ3: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `npm test`（192件パス。boss 9件・gameflow ボス13件・map ボス5件を新規追加）
- [x] リントエラーがないことを確認
  - [x] `npm run lint`
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`
- [x] ビルドが成功することを確認
  - [x] `npm run build`

## フェーズ4: ドキュメント更新

- [x] 永続ドキュメント更新（必要に応じて）
  - [x] `docs/functional-design.md` の `GamePhase`／画面遷移図にボス系フェーズを追記
  - [x] `docs/architecture.md` のコンパイルフロー一覧に `boss.js` を追記
- [x] README.md を更新（必要に応じて）→ 不要（ゲーム内容の物語進行であり、セットアップ手順に変更なし）
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 受け入れ条件トレーサビリティ（requirements.md 対応）

| 受け入れ条件 | 対応タスク |
|---|---|
| ステージ3クリアでボスステージ開始 | F2: `startBossStage`／gameflow `STAGE_CLEAR→BOSS_READY` |
| 突入時 部品 3/3 のまま | F2: gameflow `partsCollected` 不変テスト |
| 撃破で帰還エンディング(ALL_CLEAR)再生 | F2: gameflow `BOSS_DEFEATED→ALL_CLEAR` |
| ボス戦中のゲームオーバーは既存画面へ | F2: gameflow `PLAYER_DEAD(残機0)→GAME_OVER` |
| タイトル/リスタートでボスHP初期化 | F2: gameflow `ALL_CLEAR→TITLE` でHP初期化 |
| 初期HP>0、レーザー命中でHP減 | F1: boss.test `hitByBeams`／`reset` |
| HP0で撃破→演出→エンディング | F1+F2: `isDefeated`／`BOSS_DEFEATED` |
| HP0まで早期クリアしない | F2: gameflow 早期クリアしないテスト |
| HP残量がUIで分かる | F2: `drawBossHpBar`／`getHpRatio` |
| 一定間隔で弾幕が表示される | F1: boss `update` 発射／F2: `drawBossBullets` |
| 被弾でミス（残機減） | F2: `updateBoss` 被弾→`PLAYER_DEAD` |
| バリア中は被弾しても残機減らない | F1: boss.test `checkPlayerHit(バリアあり)` |
| 残機0でゲームオーバー | F2: 既存導線流用 |
| ボス戦と分かる導入表示 | F2: `drawBossWarning`／`BOSS_READY` |
| ボス本体が盤面上部に描画 | F2: `drawBoss` |
| 60fps を維持 | F1: 固定長プール／F2: バランス調整・手動60fps確認 |

---

## 実装後の振り返り

### 実装完了日
2026-06-06

### 計画と実績の差分

**計画と異なった点**:
- **`BossManager.update` の引数**: design.md では `update(dt)` だったが、狙い撃ち弾がプレイヤー位置を要するため `update(dt, playerPixelPos)` に変更。決定論は保たれる（乱数非依存）。
- **`BOSS_SWAY_SPEED`**: design.md の仮値 `2.2` に対し、実装は `1.1`（往復を穏やかにし、上方の的を狙いやすくするため半速に調整）。design.md は「仮値・実測で調整」と明記済みのため意図的な確定値。
- **ボス命中スコア**: design では言及があったが、スコア源は既存のドット／フルーツで十分なため per-hit 加点は採用せず（マジックナンバー増を回避）。撃破フィードバックは `EAT_GHOST`/`FANFARE`＋スパークで担保。
- **ハイスコア保存タイミング**: design は「BOSS_DEFEATED 満了時」だったが、撃破検知の瞬間（`updateBoss` 内）に前倒し。フレームドロップに強く、より堅牢（implementation-validator も「改善」と評価）。

**新たに必要になったタスク**:
- `tests/unit/map.test.ts` にボス闘技場テスト（5件: 外周壁・内部開放・連結性・パワーエサ・フルーツ非空）を追加。詰み防止の前提（フルーツ有効位置の非空）を回帰で守るため。
- `tests/unit/boss.test.ts` に「撃破済みボスへの `hitByBeams` が0を返す」テストを追加（implementation-validator のテストギャップ指摘に対応）。
- `checkPlayerHit` に「1フレーム1ミスで打ち切る／残弾は clearBullets で清算」のコメントを追記（同上、設計意図の明示）。

**技術的理由でスキップしたタスク**: なし（全タスク完了）。

### 学んだこと

**技術的な学び**:
- 既存の `LaserManager` の固定長プール＋`getBeams()` を、ボスへのダメージ判定（`hitByBeams`）にそのまま流用できた。武器メカを無改修で再利用でき、リグレッション面が最小化された。
- フェーズ駆動ループ（`switch(state.phase)`）は、新フェーズ群（BOSS_READY/BOSS/BOSS_DEFEATED）を足すだけで複雑な状態を素直に表現でき、テスト（`gameflow.test.ts`）にも自然に乗る。`level==4` 特殊面で吸収するより遥かに安全だった。
- `PLAYER_DEAD` ではフェーズ名がボス情報を失うため、`bossActive` フラグでリスポーン先を保持する設計が必要だった。`createInitialState` で必ず false に戻すことで状態汚染を防いだ。

**プロセス上の改善点**:
- design.md でボスステージの表現方法（専用フェーズ vs 特殊面）を最初に決め切ったことで、実装が一直線に進んだ。
- Red-Green（boss.test → boss.ts）で先にロジックの契約を固め、GameLoop 配線時の不確実性を減らせた。
- StubRenderer ではCanvas描画が検証されないため、ブラウザで実Rendererにボス状態を描画する煙テストを併用し、描画コードの実行時例外がないことと見た目を確認できた。

### 次回への改善提案
- Canvas 描画ヘルパーは単体テストで捕まらないため、「実Rendererに各フェーズを1回描かせて例外が出ないか」を確認する軽量ハーネスを定常化すると、描画リグレッションを早期に検出できる。
- 弾幕・HP・弾速などのバランス定数は今回すべて `constants.ts` に集約済み。次回ボス追加時は `BOSS_*` をレベル別テーブル化（`getLevelParams` と同パターン）すれば増設が容易。
