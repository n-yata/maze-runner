# バグ修正 設計

## Bug 1 修正: 衝突判定の改善

### 根本原因
- `ghost.ts:168-185` の衝突判定がタイル座標の完全一致のみ
- `gameLoop.ts` の実行順序: `player.update()` → `ghostMgr.update()` (衝突チェック → ゴースト移動)
- プレイヤーとゴーストが向き合って移動し1フレームでタイルを「交差」する場合に検出漏れ

```
フレームN: プレイヤーtile=(12,23)、ゴーストtile=(14,23)
→ player.update(): プレイヤーtile→(13,23)
→ ghost.update() 衝突チェック: プレイヤー(13,23) vs ゴースト(14,23) → ミス
→ ghost.moveGhost(): ゴースト→(13,23)
フレームN+1: player.update(): プレイヤーtile→(14,23)
→ ghost.update() 衝突チェック: プレイヤー(14,23) vs ゴースト(13,23) → ミス
```

### 修正方針
ピクセル座標ベースの距離判定に変更。
タイル一致 OR ピクセル距離が閾値（TILE_SIZE * 0.75 = 12px）未満で衝突。

```ts
const playerPx = player.getPixelPos();
const pdx = g.pixelPos.x - playerPx.x;
const pdy = g.pixelPos.y - playerPx.y;
const hitThreshold = TILE_SIZE * 0.75;
if (pdx * pdx + pdy * pdy < hitThreshold * hitThreshold) {
  // collision
}
```

さらに、ゴースト移動後にも衝突チェックを実施（二重チェック）することで、
「移動前後を跨いだすれ違い」を確実に検出する。

## Bug 2 修正: 壁すり抜け防止

### 根本原因
- `chooseDirection()` の通常モード（CHASE/SCATTER）で `let bestDir: Direction = g.dir`
- 全方向が「壁 or 後退禁止」の場合（行き止まり）、`bestDist === Infinity` のまま `g.dir` が返る
- 現在の方向が壁方向 → 壁に突入

### 修正方針
`bestDist === Infinity`（有効な方向なし）のとき、後退（opposite）を返す。

```ts
if (bestDist === Infinity) {
  return opp;  // 行き止まりでは後退を許可
}
```

FRIGHTENEDモードでは既に同様の処理がある (`if (valid.length === 0) return opp`)。
通常モードにも同様のフォールバックを追加。

## 変更対象ファイル
- `src/ghost.ts`: `update()` 衝突判定・`chooseDirection()` フォールバック
- `tests/unit/ghost.test.ts`: 新規テストケース追加
