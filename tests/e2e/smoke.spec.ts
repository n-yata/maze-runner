import { test, expect } from '@playwright/test';
import type { ConsoleMessage } from '@playwright/test';
import {
  getCanvasResolution,
  getCanvasDataUrl,
  canvasHasNonBackgroundPixels,
  waitForCanvasChange,
} from './helpers';

/**
 * デスクトップ/モバイル両プロジェクトで実行されるスモークテスト。
 * 本番コードのテスト用フックには一切依存せず、
 * Canvas の描画ピクセルと console error のみで振る舞いを検証する。
 *
 * READY → PLAYING の遷移には実時間で 3 秒かかる（gameLoop READY_DURATION）。
 */

test.describe('ステラー・ラン スモーク', () => {
  test('ページ読込で gameCanvas が解像度を持ち、背景以外が描画される', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#gameCanvas');
    await expect(canvas).toHaveCount(1);

    // renderer が canvas.width/height を固定値に設定する → >0 であること
    const { width, height } = await getCanvasResolution(page);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);

    // TITLE 画面で迷路やタイトルが描かれ、Canvas が「空（全面背景色）」でないこと
    await expect
      .poll(() => canvasHasNonBackgroundPixels(page), { timeout: 5000 })
      .toBe(true);
  });

  test('SPACE 押下で描画内容が変化する（TITLE → READY 遷移）', async ({ page }) => {
    await page.goto('/');

    // TITLE が描画されるまで待つ
    await expect
      .poll(() => canvasHasNonBackgroundPixels(page), { timeout: 5000 })
      .toBe(true);

    const before = await getCanvasDataUrl(page);

    // 開始操作（SPACE）。TITLE → READY でドット・敵・READY 表示が増え描画が変わる
    await page.keyboard.press('Space');

    const changed = await waitForCanvasChange(page, before, 5000);
    expect(changed).toBe(true);
  });

  test('PLAYING 中の矢印キー操作でプレイヤーが動き描画が変化する', async ({ page }) => {
    await page.goto('/');

    await expect
      .poll(() => canvasHasNonBackgroundPixels(page), { timeout: 5000 })
      .toBe(true);

    // TITLE → READY
    await page.keyboard.press('Space');

    // READY (3s) → PLAYING を待つ。余裕を持って 3.5s 待機。
    await page.waitForTimeout(3500);

    const before = await getCanvasDataUrl(page);

    // PLAYING 中に左方向へ移動入力（プレイヤー初期位置から左は通路）
    await page.keyboard.press('ArrowLeft');

    // プレイヤーが移動 → 描画が変化するはず
    const changed = await waitForCanvasChange(page, before, 5000);
    expect(changed).toBe(true);
  });

  test('ページ読込〜操作で console error が発生しない', async ({ page }) => {
    // index.html の CSP meta タグに対しブラウザが出す既知の情報メッセージ。
    // `frame-ancestors` は HTTP ヘッダ経由でのみ有効で <meta> では無視される、という
    // 仕様どおりの警告であり、アプリ由来のランタイムエラーではないため除外する。
    const KNOWN_PLATFORM_NOISE = [
      /frame-ancestors' is ignored when delivered via a <meta> element/,
    ];
    const isKnownNoise = (text: string): boolean =>
      KNOWN_PLATFORM_NOISE.some((re) => re.test(text));

    const errors: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error' && !isKnownNoise(msg.text())) {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto('/');
    await expect
      .poll(() => canvasHasNonBackgroundPixels(page), { timeout: 5000 })
      .toBe(true);

    // 一連の基本操作を流す
    await page.keyboard.press('Space');
    await page.waitForTimeout(3500);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });
});
