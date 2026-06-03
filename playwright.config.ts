import { defineConfig, devices } from '@playwright/test';

/**
 * E2E スモークテスト構成。
 * - webServer: `npm run build` で dist/*.js を生成してから `serve` で静的配信。
 * - desktop(chromium) と mobile(Pixel 5 相当, pointer:coarse) の 2 プロジェクト。
 * - 本番コードへのテスト用フックは一切使わず、DOM の存在/不在・Canvas のピクセル変化・
 *   console error の有無のみで検証するブラックボックステスト。
 */
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      // Pixel 5 = viewport 393x851, pointer:coarse, isMobile, touch 有効
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm run build && npx serve . -l 3000',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
