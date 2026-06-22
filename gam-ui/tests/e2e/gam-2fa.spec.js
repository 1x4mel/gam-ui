// Runtime verification of the LoginView 2-step 2FA flow (Design §6.3 / B4).
//
// This is the LAST "code-only" feature of gam-ui — the LoginView 2-step flow
// (password → OTP) and the TotpCodeWidget were shipped in sessions 8/9 but had
// never been exercised at runtime because enabling 2FA globally on the shared
// `erp.local` site was deemed too risky for the other co-tenant apps.
//
// Frappe 2FA is ROLE-scoped: `System Settings.enable_two_factor_auth` is the
// global gate, but a user is only challenged if they hold a Role with
// `two_factor_auth = 1`. `gam.ops.setup_2fa_test` exploits this to enable 2FA
// for a DEDICATED test role + user only (gam-2fa@test.local), so:
//   • the other e2e users (gam-admin/gam-member) keep logging in with NO OTP,
//   • the rest of the co-tenant site is never challenged,
//   • even a crashed run that leaves global 2FA on is harmless (no production
//     role carries the two_factor_auth flag).
//
// `setup_2fa_test` provisions the user's OTP secret, marks first-time OTP
// login as done (so Frappe runs the TOTP challenge instead of emailing a QR),
// and returns `{ user, password }`. The plaintext base32 secret is ONLY
// returned when `reveal=1` is passed (P1.6 — a default call never leaks it),
// and the whole op is gated behind `gam_allow_2fa_test=1` on the site config
// (dev/staging only; production stays blocked). We pass `reveal=1` here and
// derive the 6-digit code with the SAME production util the app uses
// (`src/utils/totp.js`), exactly like the `login()` helper does.

import { test, expect } from '@playwright/test'
import { generateTotp } from '../../src/utils/totp.js'
import { env, login, gotoApp, gamCall } from './lib.js'

test.describe.configure({ mode: 'serial' })

test.describe('2FA login (runtime)', () => {
  // Dedicated admin context used only to provision / tear down the 2FA test
  // user through the SPA's same-origin session.
  let adminPage
  /** { user, password, totp_secret } provisioned by gam.ops.setup_2fa_test */
  let provisioned

  test.beforeAll(async ({ browser }) => {
    adminPage = await browser.newPage()
    await login(adminPage, { user: env.adminUser, pass: env.adminPass })
    provisioned = await gamCall(adminPage, 'gam.ops.setup_2fa_test', { reveal: 1 })
    expect(provisioned?.totp_secret).toBeTruthy()
  })

  test.afterAll(async () => {
    // Restore the co-tenant site: flip global 2FA back off. Idempotent +
    // best-effort (the dedicated role/user are harmless once 2FA is off).
    if (adminPage) {
      await gamCall(adminPage, 'gam.ops.teardown_2fa_test').catch(() => {})
      await adminPage.close().catch(() => {})
    }
  })

  test('password step challenges for a one-time code and rejects a wrong one', async ({ page }) => {
    await test.step('submit password → 2FA challenge appears', async () => {
      await gotoApp(page, '/login')
      await page.locator('input[autocomplete="username"]').fill(provisioned.user)
      await page.locator('input[autocomplete="current-password"]').fill(provisioned.password)
      await page.getByRole('button', { name: /Bắt đầu/ }).click()

      // The core runtime assertion: the 2-step challenge screen renders.
      await expect(page.getByText('Xác thực 2 bước')).toBeVisible({ timeout: 20000 })
      await expect(page.locator('input[autocomplete="one-time-code"]')).toBeVisible()
      await expect(page.getByRole('heading', { level: 2, name: /Dashboard/ })).toBeHidden()
    })

    await test.step('wrong code is rejected (stays on the OTP step)', async () => {
      await page.locator('input[autocomplete="one-time-code"]').fill('000000')
      await page.getByRole('button', { name: /Xác nhận/ }).click()

      // LoginView surfaces either "Mã không đúng..." (re-issued challenge) or
      // "Mã xác thực không đúng..." (server error). Either way: error visible,
      // NOT logged in.
      await expect(page.getByText(/Mã không đúng|Mã xác thực không đúng/)).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByRole('heading', { level: 2, name: /Dashboard/ })).toBeHidden()
    })
  })

  test('correct TOTP code completes the login', async ({ page }) => {
    await gotoApp(page, '/login')
    await page.locator('input[autocomplete="username"]').fill(provisioned.user)
    await page.locator('input[autocomplete="current-password"]').fill(provisioned.password)
    await page.getByRole('button', { name: /Bắt đầu/ }).click()
    await expect(page.getByText('Xác thực 2 bước')).toBeVisible({ timeout: 20000 })

    // Derive the current 6-digit code from the provisioned secret (30s window,
    // same params Frappe's pyotp.TOTP uses) and submit it.
    const code = await generateTotp(provisioned.totp_secret, { period: 30, digits: 6 })
    await page.locator('input[autocomplete="one-time-code"]').fill(code)
    await page.getByRole('button', { name: /Xác nhận/ }).click()

    await expect(page.getByRole('heading', { level: 2, name: /Dashboard/ })).toBeVisible({
      timeout: 20000,
    })
  })
})
