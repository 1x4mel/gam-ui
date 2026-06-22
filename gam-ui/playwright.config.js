// Playwright config for the GAM browser e2e smoke suite.
//
// This automates the manual smoke flow that used to be deferred across
// sessions (login → dashboard → reveal → request code → checkout → logs →
// webhook config → account settings).
//
// Requirements at run time (see deploy/README.md §5):
//   1. Frappe bench serving site `erp.local` on :8000  (bench serve / bench start)
//   2. This config auto-starts the Vite dev server (npm run dev) on :5174,
//      which proxies /api + /socket.io → bench.
//   3. On minimal/sandbox OSes without the Chromium shared libs installed,
//      export LD_LIBRARY_PATH before running (see deploy/README.md §5).
import { defineConfig, devices } from '@playwright/test'

const E2E_BASE = process.env.GAM_E2E_BASE || 'http://localhost:5174'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: E2E_BASE,
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: 'vi-VN',
    timezoneId: 'UTC',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Auto-start the SPA dev server (proxies /api → bench on :8000).
  // `reuseExistingServer` lets you keep your own `npm run dev` running.
  webServer: {
    command: 'npm run dev',
    url: E2E_BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
