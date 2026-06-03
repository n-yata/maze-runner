import { test, expect, devices } from '@playwright/test';

/**
 * 仮想十字キー（Dパッド）は撤去済み。
 * モバイル相当（pointer:coarse, touch 有効）のビューポートでも
 * #dpad / #btn-up 等の DOM が一切存在しないことを保証する回帰テスト。
 *
 * このファイルはモバイルプロジェクトでのみ意味を持つため、
 * 明示的にモバイルコンテキスト（Pixel 5）を強制して実行する。
 */
test.use({ ...devices['Pixel 5'] });

const DPAD_SELECTORS = ['#dpad', '#btn-up', '#btn-down', '#btn-left', '#btn-right'];

test.describe('Dパッド非在（モバイル相当）', () => {
  test('モバイルビューポートで Dパッド関連要素が存在しない', async ({ page }) => {
    await page.goto('/');

    // ページが描画され始める（Canvas が DOM 上に存在する）ことを前提として確認
    await expect(page.locator('#gameCanvas')).toHaveCount(1);

    for (const selector of DPAD_SELECTORS) {
      await expect(page.locator(selector)).toHaveCount(0);
    }
  });
});
