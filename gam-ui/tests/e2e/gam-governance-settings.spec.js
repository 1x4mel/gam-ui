// GAM browser e2e — governance thresholds (AdminSettingsView) coverage.
//
// The admin "Cài đặt" view persists the GAM Settings singleton
// (max_online_hours / min_rested_hours / hard_cap_online_hours /
//  block_logout_with_active_lease) via gam.api.save_gam_settings. This spec
// round-trips one field through the real form and confirms the write landed
// server-side, then restores the original value — even on failure.
//
// Run:  npm run test:e2e      (same prerequisites as the smoke + crud suites)

import { test, expect } from '@playwright/test'
import {
  env,
  login,
  gotoApp,
  waitForHeading,
  captureConsole,
  expectToast,
  waitToastCleared,
} from './lib.js'

// Surface swallowed client-side errors on failure (same pattern as siblings).
let consoleErrors = []

/** Read the GAM Settings singleton via the whitelisted GET (bench cookie auths). */
async function getSettings(page) {
  const res = await page.request.get(`${env.base}/api/method/gam.api.get_gam_settings`)
  const body = await res.json()
  return body && body.message ? body.message : body
}

test.describe('GAM governance settings (AdminSettingsView) e2e', () => {
  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    captureConsole(page, { errors: consoleErrors })
  })

  test.afterEach(() => {
    const info = test.info()
    if (info.status !== info.expectedStatus && consoleErrors.length) {
      console.log(`\n—— browser console errors (${consoleErrors.length}) ——`)
      consoleErrors.forEach((e) => console.log('  •', e))
    }
  })

  test('governance — max_online_hours round-trip then restore', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await gotoApp(page, '/admin/settings')
    await waitForHeading(page, 'Cài đặt')

    // The governance form now lives under the lazy "Ngưỡng" top tab (it is
    // rendered only when topTab === 'thresholds'). Click it so the number
    // inputs mount before we interact with them.
    await page.locator('.flex.items-center.gap-1.border-b')
      .getByRole('button').filter({ hasText: 'Ngưỡng' }).click()

    // Capture the live values so we restore exactly (even if the test fails).
    const before = await getSettings(page)
    const origMax = Number(before.max_online_hours) || 8
    const tempMax = origMax === 7 ? 6 : 7

    // The view's onMounted load() populates the inputs asynchronously; wait for
    // the first number input (max_online_hours) to reflect the loaded value so a
    // late load() can't clobber our fill.
    const maxInput = page.locator('input[type="number"]').first()

    try {
      await test.step('update max_online_hours via the governance form', async () => {
        await expect.poll(async () => maxInput.inputValue()).toBe(String(origMax))
        await maxInput.fill(String(tempMax))
        await page.getByRole('button', { name: 'Lưu cài đặt' }).click()
        await expectToast(page, 'Đã lưu cài đặt GAM')
      })

      await test.step('value persisted server-side', async () => {
        await expect
          .poll(async () => Number((await getSettings(page)).max_online_hours))
          .toBe(tempMax)
      })
    } finally {
      await test.step('restore original max_online_hours', async () => {
        // Clear the success toast first so the identical restore toast is a
        // distinct match (otherwise the still-visible one is a false positive).
        await waitToastCleared(page, 'Đã lưu cài đặt GAM')
        await maxInput.fill(String(origMax))
        await page.getByRole('button', { name: 'Lưu cài đặt' }).click()
        await expectToast(page, 'Đã lưu cài đặt GAM')
        await expect
          .poll(async () => Number((await getSettings(page)).max_online_hours))
          .toBe(origMax)
      })
    }
  })
})
