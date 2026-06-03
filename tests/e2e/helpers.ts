import type { Page } from '@playwright/test';

/** index.html / constants.ts と一致する深宇宙の背景色 (#05060F)。 */
export const BACKGROUND_RGB = { r: 0x05, g: 0x06, b: 0x0f };

const CANVAS_SELECTOR = '#gameCanvas';

/**
 * Canvas の内部解像度 (canvas.width / canvas.height) を返す。
 * renderer が constructor で固定値を設定するため、描画開始後は >0 になる。
 */
export async function getCanvasResolution(page: Page): Promise<{ width: number; height: number }> {
  return page.locator(CANVAS_SELECTOR).evaluate((el) => {
    const c = el as HTMLCanvasElement;
    return { width: c.width, height: c.height };
  });
}

/** Canvas 全体の dataURL を取得する。描画差分の比較に使う。 */
export async function getCanvasDataUrl(page: Page): Promise<string> {
  return page.locator(CANVAS_SELECTOR).evaluate((el) =>
    (el as HTMLCanvasElement).toDataURL('image/png'),
  );
}

/**
 * Canvas 上に「背景色以外のピクセルが存在するか」を判定する。
 * 一定間隔でサンプリングし、1 つでも背景色から十分離れた色があれば true。
 * 全面が背景色のまま = 何も描画されていない、を検出するためのもの。
 */
export async function canvasHasNonBackgroundPixels(page: Page): Promise<boolean> {
  return page.locator(CANVAS_SELECTOR).evaluate((el, bg) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height).data;
    const step = 4 * 5; // 5px ごと（RGBA=4byte）にサンプリング
    for (let i = 0; i < img.length; i += step) {
      const r = img[i];
      const g = img[i + 1];
      const b = img[i + 2];
      const a = img[i + 3];
      if (a === 0) continue;
      // 背景色との差が許容誤差を超えたら「描画あり」
      const diff =
        Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
      if (diff > 24) return true;
    }
    return false;
  }, BACKGROUND_RGB);
}

/**
 * Canvas の描画が変化するまで待つ。
 * baseline と異なる dataURL が得られたら true、timeout 内に変化しなければ false。
 */
export async function waitForCanvasChange(
  page: Page,
  baseline: string,
  timeoutMs = 5000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await getCanvasDataUrl(page);
    if (current !== baseline) return true;
    await page.waitForTimeout(100);
  }
  return false;
}
