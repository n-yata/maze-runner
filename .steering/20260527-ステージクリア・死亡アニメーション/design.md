# 設計

## ファイル変更対象
- `src/map.ts`: `drawToFlash(ctx, offsetY, wallColor, wallInnerColor)` 追加
- `src/renderer.ts`: `drawDeadPlayer()` スピン追加、STAGE_CLEAR ケース更新

## drawToFlash の実装方針
offscreen キャッシュを使わず直接描画（STAGE_CLEAR 時のみ呼ばれるため性能問題なし）
wallColor/wallInnerColor を外部指定できる設計にして白フラッシュに対応

## 死亡アニメーション3フェーズ
1. timer < 0.3: 通常表示（フリーズ）
2. 0.3 ≤ timer < 0.9: ctx.save/rotate で高速スピン（4π = 2回転）
3. 0.9 ≤ timer < 1.5: 半径を 0 に向けて縮小して消える

## ステージクリアフラッシュ
render() の STAGE_CLEAR ケースで `Math.floor(state.phaseTimer / 0.25) % 2 === 0` で白フラッシュ判定
フラッシュ時: drawToFlash('#FFFFFF', '#CCCCCC')
通常時: drawTo() (既存)
