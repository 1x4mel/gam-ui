// GAM browser e2e — shift-handoff (bàn giao ca) settings + active-view wiring.
//
// The handoff logic itself (atomic close+open, chain cap, L2 for the receiver,
// decline/reopen) is covered by the backend test suite (test_handoff.py). This
// spec covers the parts that only the browser can prove:
//   1. the new `continuous_online_cap_hours` setting renders in the admin form
//      AND round-trips through gam.api.save_gam_settings / get_gam_settings.
//   2. the "Đang hoạt động" view mounts for an admin and exposes the handoff
//      affordance (button + modal) when a lease is present.
//
// Run:  npm run test:e2e   (needs bench :8000 + the auto-started vite dev)

import { test, expect } from '@playwright/test'
import { env, login, gotoApp, waitForHeading, captureConsole, listFixtures } from './lib.js'

let consoleErrors = []

test.describe('GAM shift handoff (bàn giao ca)', () => {
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

  test('admin settings persist continuous_online_cap_hours', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await gotoApp(page, '/admin/settings')
    await waitForHeading(page, 'Cài đặt')

    const capInput = page.locator('input[placeholder="16"]')

    await test.step('cap field renders', async () => {
      await expect(capInput).toBeVisible({ timeout: 10000 })
    })

    // Capture the real current value so we always restore exactly it.
    const before = await listFixtures(
      page,
      'GAM Settings',
      [['name', '=', 'GAM Settings']],
      ['name', 'continuous_online_cap_hours'],
    )
    const original = Number((before[0] && before[0].continuous_online_cap_hours) || 16)
    const temp = (original === 17 ? 18 : 17)

    try {
      await test.step('save a new cap value', async () => {
        await capInput.fill(String(temp))
        await page.getByRole('button', { name: 'Lưu cài đặt' }).click()
      })

      await test.step('value persisted server-side', async () => {
        await expect
          .poll(
            async () => {
              const rows = await listFixtures(
                page,
                'GAM Settings',
                [['name', '=', 'GAM Settings']],
                ['continuous_online_cap_hours'],
              )
              return Number((rows[0] && rows[0].continuous_online_cap_hours) || 0)
            },
            { timeout: 10000 },
          )
          .toBe(temp)
      })
    } finally {
      // restore
      await capInput.fill(String(original))
      await page.getByRole('button', { name: 'Lưu cài đặt' }).click()
    }
  })

  test('active view exposes the handoff button', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await gotoApp(page, '/active')
    await waitForHeading(page, /Đang hoạt động/)

    // If at least one lease is present, the handoff button must be visible on
    // a card (admin can hand off any lease). When there are no leases the view
    // shows the empty state — we assert the page mounted either way.
    const handoffBtn = page.getByRole('button', { name: 'Bàn giao' })
    const emptyState = page.getByText('Không có tài khoản đang hoạt động')
    await expect(handoffBtn.or(emptyState)).toBeVisible({ timeout: 10000 })

    if (await handoffBtn.first().isVisible().catch(() => false)) {
      await test.step('handoff modal opens with receiver picker', async () => {
        await handoffBtn.first().click()
        await expect(page.getByText('Bàn giao ca')).toBeVisible({ timeout: 5000 })
        await expect(page.getByText('Online liên tục')).toBeVisible()
      })
    }
  })
})
