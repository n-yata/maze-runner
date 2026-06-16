import { test, expect, devices } from '@playwright/test';
import { canvasHasNonBackgroundPixels } from './helpers';

test.use({ ...devices['Pixel 5'] });

async function sampleCanvasPixel(page: import('@playwright/test').Page, clientX: number, clientY: number) {
  return page.locator('#gameCanvas').evaluate((el, point) => {
    const canvas = el as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((point.x - rect.left) * (canvas.width / rect.width));
    const y = Math.round((point.y - rect.top) * (canvas.height / rect.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return [0, 0, 0, 0];
    return Array.from(ctx.getImageData(x, y, 1, 1).data);
  }, { x: clientX, y: clientY });
}

async function dispatchTouch(page: import('@playwright/test').Page, type: string, x: number, y: number) {
  await page.evaluate(({ eventType, clientX, clientY }) => {
    const touch = new Touch({
      identifier: 1,
      target: window,
      clientX,
      clientY,
    });
    const event = new TouchEvent(eventType, {
      bubbles: true,
      cancelable: true,
      touches: eventType === 'touchend' || eventType === 'touchcancel' ? [] : [touch],
      changedTouches: [touch],
    });
    window.dispatchEvent(event);
  }, { eventType: type, clientX: x, clientY: y });
}

test.describe('touch-location virtual pad', () => {
  test('draws a virtual pad at the touch point while touching', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameCanvas')).toHaveCount(1);
    await expect
      .poll(() => canvasHasNonBackgroundPixels(page), { timeout: 5000 })
      .toBe(true);

    const box = await page.locator('#gameCanvas').boundingBox();
    expect(box).not.toBeNull();
    const touchX = box!.x + box!.width * 0.78;
    const touchY = box!.y + box!.height * 0.76;

    const before = await sampleCanvasPixel(page, touchX, touchY);
    await dispatchTouch(page, 'touchstart', touchX, touchY);
    await dispatchTouch(page, 'touchmove', touchX + 42, touchY + 2);

    await expect
      .poll(() => sampleCanvasPixel(page, touchX, touchY), { timeout: 3000 })
      .not.toEqual(before);
  });
});
