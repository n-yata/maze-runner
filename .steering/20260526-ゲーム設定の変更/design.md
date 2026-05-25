# 設計

## 変更ファイル一覧
- `src/types.ts` — GamePhase に `'ALL_CLEAR'` を追加
- `src/constants.ts` — `MAX_LEVEL = 3` を追加、MAP_DATA_2/MAP_DATA_3 を追加（map.ts へ移動も検討したが、定数として constants に置く）
- `src/map.ts` — `MAP_DATA_2`, `MAP_DATA_3` を追加。`reset(level)` で切り替え。コンストラクタ引数は不要、reset 時に level を受け取る
- `src/gameLoop.ts` — `startNextLevel()` で level が MAX_LEVEL に達したら ALL_CLEAR フェーズへ。ALL_CLEAR フェーズのタイマー管理追加
- `src/renderer.ts` — `drawAllClear()` メソッド追加、switch case に ALL_CLEAR を追加
- `src/audio.ts` — ALL_CLEAR 用サウンドを追加（オプション）
- `tests/unit/map.test.ts` — マップ切り替えのテストを追加（任意）

## MapManager の変更設計
```ts
// reset() に level を渡す
reset(level: number = 1): void {
  const data = getMapData(level);
  this.tiles = data.map(v => v as TileType);
  this.dotState = this.tiles.map(t => t === 2 || t === 3);
  this.totalDots = this.dotState.filter(Boolean).length;
  this.buildOffscreenCanvas(); // マップが変わるのでキャッシュ再構築
}
```

## gameLoop の ALL_CLEAR フロー
- `startNextLevel()` で `this.state.level >= MAX_LEVEL` のとき STAGE_CLEAR → ALL_CLEAR に遷移
- ALL_CLEAR フェーズは 5 秒後にタイトルへ自動遷移（または SPACE/タップで即タイトル）

## マップ設計方針
- 28×31 タイルの数値配列（MAP_DATA と同形式）
- タイル値: 0=EMPTY, 1=WALL, 2=DOT, 3=POWER_DOT, 4=TUNNEL
- ゴーストハウス(rows 11-19, cols 9-18 付近)の構造は維持
- トンネル(row 14, col 0/27 = 4)は維持
- プレイヤースタート(col 13, row 23)周辺は EMPTY/DOT を確保
