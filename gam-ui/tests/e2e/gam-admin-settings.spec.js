// GAM browser e2e — admin settings & role-isolation coverage.
//
// Completes the third wave of e2e expansion called out in the handoff:
// RoleAuditView (the B4 co-tenancy isolation audit) and AccountSettingsView
// (self-service profile full_name + password change). These were the last two
// interactive admin surfaces without automated coverage.
//
// The suite stays idempotent:
//   • RoleAuditView is read-only (an audit, never a write) — nothing to clean.
//   • The full_name test mutates the admin User's `full_name`, so it captures
//     the original value first (via the same REST helpers the CRUD suite uses)
//     and restores it before the test ends — even on failure.
//   • The password test rotates the admin password to a one-off temp value and
//     immediately rotates it back. Frappe keeps the current session valid on a
//     self password-change (logout_all_sessions defaults to 0), so both steps
//     happen inside the one logged-in page.
//
// Run:  npm run test:e2e      (same prerequisites as the smoke + crud suites)

import { test, expect } from '@playwright/test'
import {
  env,
  login,
  clickNav,
  gotoApp,
  waitForHeading,
  captureConsole,
  listFixtures,
  expectToast,
  waitToastCleared,
} from './lib.js'

// Surface swallowed client-side errors on failure (same pattern as the other specs).
let consoleErrors = []

test.describe('GAM admin settings & role-audit e2e', () => {
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

  test('role audit — isolated member is reported safe', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    await clickNav(page, 'Cách ly vai trò')
    await waitForHeading(page, 'Cách ly vai trò')

    await test.step('self-audit runs on mount', async () => {
      // The view audits the current admin on mount; the result card renders
      // the audited user's email. We only assert it populated (the admin's own
      // isolation state is environment-dependent — admins legitimately hold
      // System Manager/Administrator) before moving on to a member audit.
      await expect(page.getByText(env.adminUser, { exact: true })).toBeVisible({ timeout: 15000 })
    })

    await test.step('auditing the isolated member reports "safe"', async () => {
      await page.getByPlaceholder('email user cần audit').fill(env.memberUser)
      await page.getByRole('button', { name: 'Kiểm tra' }).click()
      // The result swaps to the member; the email now drives the status banner.
      await expect(page.getByText(env.memberUser, { exact: true })).toBeVisible({ timeout: 10000 })
      // The test user created by `gam.ops.create_test_users` is role-isolated
      // (GAM Member + All/Desk User/Guest only, no breaking roles) — the B4
      // contract we are verifying. If this flips to "CÓ rò rỉ", isolation broke.
      await expect(page.getByText('Đã cách ly an toàn')).toBeVisible()
    })
  })

  test('settings — profile full_name update then restore', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await gotoApp(page, '/account')
    await waitForHeading(page, 'Cài đặt tài khoản')

    // Capture the real current value so we always restore exactly it, even if
    // the test fails mid-way (try/finally below).
    const before = await listFixtures(page, 'User', [['name', '=', env.adminUser]], ['name', 'full_name'])
    const originalName = (before[0] && before[0].full_name) || ''
    const tempName = `E2E ${Date.now()}`

    // The view's onMounted getDoc (`load()`) populates the full_name input
    // asynchronously. If we fill before it resolves, the late `load()` clobbers
    // our value (the input is bound with v-model), so the save persists the
    // original instead of tempName. Wait for the input to reflect the loaded
    // value first — this guarantees `load()` has finished before we type.
    await expect
      .poll(async () => page.locator('input[placeholder="Nguyễn Văn A"]').inputValue())
      .toBe(originalName)

    try {
      await test.step('update full_name via the profile form', async () => {
        await page.locator('input[placeholder="Nguyễn Văn A"]').fill(tempName)
        await page.getByRole('button', { name: 'Lưu hồ sơ' }).click()
        await expectToast(page, 'Đã cập nhật hồ sơ')
        // Confirm the write actually landed server-side (not just the toast).
        await expect
          .poll(async () => {
            const r = await listFixtures(page, 'User', [['name', '=', env.adminUser]], ['full_name'])
            return (r[0] && r[0].full_name) || ''
          })
          .toBe(tempName)
      })

      await test.step('restore the original full_name', async () => {
        // The change toast must clear first, otherwise the identical restore
        // toast would match the still-visible one (false positive).
        await waitToastCleared(page, 'Đã cập nhật hồ sơ')
        await page.locator('input[placeholder="Nguyễn Văn A"]').fill(originalName)
        await page.getByRole('button', { name: 'Lưu hồ sơ' }).click()
        await expectToast(page, 'Đã cập nhật hồ sơ')
        await expect
          .poll(async () => {
            const r = await listFixtures(page, 'User', [['name', '=', env.adminUser]], ['full_name'])
            return (r[0] && r[0].full_name) || ''
          })
          .toBe(originalName)
      })
    } finally {
      // Belt-and-suspenders restore via REST if the UI restore above did not run
      // (e.g. an assertion threw). Re-checks and only writes when still dirty,
      // so a clean run does no extra mutating call.
      const r = await listFixtures(page, 'User', [['name', '=', env.adminUser]], ['full_name'])
      if ((r[0] && r[0].full_name) !== originalName) {
        await restoreDisplayName(page, env.adminUser, originalName)
      }
    }
  })

  test('settings — change password then restore (real API path)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await gotoApp(page, '/account')
    await waitForHeading(page, 'Cài đặt tài khoản')

    // A one-off, policy-strong temp password (upper/lower/digit/symbol). Using a
    // timestamp avoids any password-history collisions across repeated runs.
    const tempPwd = `GAM@e2e-${Date.now()}`

    await test.step('rotate to a temp password', async () => {
      await fillPasswordForm(page, env.adminPass, tempPwd, tempPwd)
      await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click()
      await expectToast(page, 'Đã đổi mật khẩu')
    })

    await test.step('rotate back to the configured password', async () => {
      await waitToastCleared(page, 'Đã đổi mật khẩu')
      await fillPasswordForm(page, tempPwd, env.adminPass, env.adminPass)
      await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click()
      await expectToast(page, 'Đã đổi mật khẩu')
    })
  })
})

// ---------------------------------------------------------------------------
// Local helpers (kept file-local — only this spec fills the password form).
// ---------------------------------------------------------------------------

/** Fill the three password inputs. The old/new/confirm fields are disambiguated
 *  by their `autocomplete` attributes (placeholders are identical `••••••••`). */
async function fillPasswordForm(page, oldPwd, newPwd, confirmPwd) {
  await page.locator('input[autocomplete="current-password"]').fill(oldPwd)
  const newInputs = page.locator('input[autocomplete="new-password"]')
  await newInputs.first().fill(newPwd)
  await newInputs.nth(1).fill(confirmPwd)
}

/**
 * Restore a User's displayed name via REST, re-using the live SPA session.
 * Writes `first_name` (+ clears `last_name`) because Frappe derives `full_name`
 * from those parts on save (same reason the production view writes `first_name`).
 */
async function restoreDisplayName(page, name, value) {
  await page.evaluate(
    async ({ name, value }) => {
      let token = ''
      try {
        const r = await fetch('/api/method/gam.utils.get_session_csrf_token', { credentials: 'include' })
        token = ((await r.json()) || {}).message || ''
      } catch {
        /* ignore */
      }
      await fetch(`/api/resource/User/${encodeURIComponent(name)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': token },
        body: JSON.stringify({ first_name: value, last_name: '' }),
      })
    },
    { name, value },
  )
}
