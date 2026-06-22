// GAM browser e2e — "Đang hoạt động" realtime timer redesign (/active).
//
// Covers the rewrite that fixed the "0s/8h" freeze:
//   * a checked-in lease shows a live, second-by-second elapsed timer (NOT a
//     frozen "0s") thanks to the DB-server clock sync (server_epoch_now_ms);
//   * every lease card renders a progressbar whose fill + accent follow the
//     tier ladder (safe/soon/near/over/critical) and whose label carries a
//     Vietnamese word so colour is not the only signal (accessibility);
//   * the summary bar reflects urgency counts.
//
// The suite is state-adaptive: it reuses any existing GAM Account, checks it
// out via gam.api.checkout_account (skipping cleanly if none is available or
// all are taken), asserts the UI, then releases the lease on teardown.
//
// Run:  npm run test:e2e   (same prerequisites as the smoke suite)

import { test, expect } from '@playwright/test'
import {
  env,
  login,
  gotoApp,
  waitForHeading,
  captureConsole,
  gamCall,
  listFixtures,
} from './lib.js'

let consoleErrors = []

// Elapsed label produced by formatDuration: "5s", "2m 5s", "1h 2m 5s".
const ELAPSED_RE = /^\d+[hms](\s\d+[ms])*(\s\d+s)?$/

test.describe('GAM active view — realtime timer', () => {
  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    captureConsole(page, { errors: consoleErrors })
  })

  test.afterEach(async () => {
    const info = test.info()
    if (info.status !== info.expectedStatus && consoleErrors.length) {
      console.log(`\n—— browser console errors (${consoleErrors.length}) ——`)
      consoleErrors.forEach((e) => console.log('  •', e))
    }
  })

  test('admin — checked-in lease shows a ticking timer + progress bar + tier label', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // Pick any account that is NOT currently in use so checkout_account succeeds.
    const accounts = await listFixtures(page, 'GAM Account', [], ['name'])
    const active = await gamCall(page, 'gam.api.get_active_usage')
    const inUse = new Set((active?.leases || []).map((l) => l.account))
    const target = (accounts || []).find((a) => !inUse.has(a.name))
    test.skip(!target, 'no checkout-able GAM Account available — run gam.setup.seed_demo')

    // Ensure a clean slate, then create an IN_USE lease.
    await gamCall(page, 'gam.api.checkin_account', { account: target.name }).catch(() => {})
    await gamCall(page, 'gam.api.checkout_account', {
      account: target.name,
      purpose: 'TEST',
      lease_minutes: 480,
    })

    try {
      await test.step('the lease appears on /active with a progress bar', async () => {
        await gotoApp(page, '/active')
        await waitForHeading(page, /Đang hoạt động/)
        // The card renders the ARIA progressbar.
        const bar = page.getByRole('progressbar').first()
        await expect(bar).toBeVisible({ timeout: 15000 })
        await expect(bar).toHaveAttribute('aria-valuenow')
      })

      await test.step('the elapsed timer is live (not frozen on 0s)', async () => {
        // The first card's timer label (e.g. "⏱ 3s" / "⏱ 1m 2s").
        const timer = page.locator('[role="progressbar"]').first().locator('..').locator('span.font-mono span').first()
        await expect(timer).toBeVisible({ timeout: 10000 })
        const a = (await timer.textContent()).trim()
        expect(a, 'timer should render a duration, not a frozen 0s bug').toMatch(/\d+s/)
        // Wait ~2.5s and confirm the seconds advanced (realtime tick).
        await page.waitForTimeout(2500)
        const b = (await timer.textContent()).trim()
        expect(b, 'timer must advance in realtime').toMatch(ELAPSED_RE)
        expect(b).not.toEqual(a)
      })

      await test.step('colour is not the only signal (a11y: a Vietnamese tier label)', async () => {
        // Each card surfaces a tier word: An toàn / Sắp hết / Gần giới hạn / Quá giờ / Quá hard cap.
        const tierLabels = ['An toàn', 'Sắp hết', 'Gần giới hạn', 'Quá giờ', 'Quá hard cap']
        const section = page.locator('section').first()
        await expect(section.locator('span').filter({ hasText: new RegExp(tierLabels.join('|')) }).first()).toBeVisible()
      })

      await test.step('releasing the lease removes the card', async () => {
        await gamCall(page, 'gam.api.checkin_account', { account: target.name })
        await page.reload()
        await waitForHeading(page, /Đang hoạt động/)
        // Either the card is gone or the empty state shows. The progressbar for
        // this account must no longer be present.
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 15000 })
      })
    } finally {
      // Always release the lease so the suite is re-runnable.
      await gamCall(page, 'gam.api.checkin_account', { account: target.name }).catch(() => {})
    }
  })
})
