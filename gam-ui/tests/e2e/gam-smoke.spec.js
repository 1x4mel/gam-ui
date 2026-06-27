// GAM browser e2e smoke — automates the manual smoke flow that was deferred
// across sessions: login → dashboard → reveal password → request code →
// checkout/check-in → admin logs → webhook config → account settings → logout,
// plus member role-isolation.
//
// Each test owns one continuous authenticated browser session (Playwright
// gives every test a fresh page, so the session cannot be shared across
// tests). `test.step` keeps the report granular.
//
// Run:  npm run test:e2e     (needs bench :8000 + the auto-started vite dev)
// See deploy/README.md §5 for the full prerequisites.

import { test, expect } from '@playwright/test'
import {
  env,
  login,
  logout,
  clickNav,
  waitForHeading,
  gotoApp,
  captureConsole,
  createFixture,
  listFixtures,
} from './lib.js'

// The smoke flow reveals an account password, which only succeeds when the
// account actually HAS one. Seed our own passworded account (rather than
// relying on whichever account happens to sort first) so a leaked passwordless
// fixture from another spec can't break this test. See the postmortem on the
// `e2e-acc-gd-*` leak that surfaced `reveal_password` → "Password not found".
//
// PERSISTENT, REUSABLE ACCOUNT (not per-run create/delete): the smoke flow
// audits every reveal/code/checkout into append-only logs — `GAM Code Request
// Log` (target_account) and `GAM Account Usage` (account). Those doctypes are
// `read_only: 1` with `delete: 0` for everyone except `Administrator`, so a REST
// DELETE from the test session (GAM Admin) is forbidden and silently swallowed
// by deleteFixture — which in turn leaves a Restrict-linked row blocking the
// account delete (LinkExistsError), i.e. the account LEAKS every run. Per-run
// teardown is therefore impossible by design. Instead we keep ONE stable
// passworded account across runs: created once (find-or-create below) and never
// deleted. Audited log rows simply accumulate, which is exactly what an audit
// log is for. No leak, no duplicate.
//
// NOTE: the username must avoid the substring "gam" (case-insensitive). The
// detail-page h1 assertion uses `.filter({ hasNotText: 'GAM' })` to drop the
// sidebar brand, so a username containing "gam" would be filtered out too.
const SMOKE_USERNAME = 'smoke-reusable'
const SMOKE_PASSWORD = 'smoke-pass-2026'
let seededName = null // docname of the persistent smoke account (for navigation)

/**
 * Find-or-create the single stable smoke account. Returns its docname (or null
 * when no active GAM Email exists to link, in which case the caller skips). On a
 * repeat run the existing account is reused — no create, no delete, no leak.
 */
async function ensureSmokeAccount(page) {
  const existing = await listFixtures(page, 'GAM Account', [['username', '=', SMOKE_USERNAME]], ['name'])
  if (existing.length) return existing[0].name
  const emails = await listFixtures(page, 'GAM Email', [['is_active', '=', 1]], ['name'])
  if (!emails.length) return null
  const seeded = await createFixture(page, 'GAM Account', {
    platform: 'STEAM',
    username: SMOKE_USERNAME,
    email: emails[0].name,
    status: 'ACTIVE',
    account_password: SMOKE_PASSWORD,
  })
  return seeded.name
}

// Capture browser console / page errors so a swallowed client-side failure
// (e.g. an unhandled promise rejection that leaves a list empty) is surfaced
// in the Playwright output when a test fails.
let consoleErrors = []

test.describe('GAM browser e2e smoke', () => {
  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    captureConsole(page, { errors: consoleErrors })
  })

  test.afterEach(async () => {
    const info = test.info()
    if (info.status !== info.expectedStatus && consoleErrors.length) {
      const banner = `\n—— browser console errors (${consoleErrors.length}) ——`
      console.log(banner)
      consoleErrors.forEach((e) => console.log('  •', e))
    }
    // No teardown: the smoke account is PERSISTENT (see ensureSmokeAccount).
    // Audited logs are append-only and cannot be REST-deleted by the test
    // session, so there is nothing safe to clean up here.
  })

  test('admin — full smoke flow (login → dashboard → reveal → code → checkout → logs → settings → logout)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // Seed (or reuse) a passworded account up front so the reveal step is
    // deterministic. ensureSmokeAccount is a find-only no-op on a repeat run.
    await test.step('seed a passworded account for the reveal flow', async () => {
      seededName = await ensureSmokeAccount(page)
      test.skip(!seededName, 'no active GAM Email to link — run gam.setup.seed_demo')
    })

    await test.step('dashboard renders live stats', async () => {
      await waitForHeading(page, 'Dashboard')
      await expect(page.getByText('Xin chào')).toBeVisible()
      // Backend connected → "not connected" empty state absent + a stat card shows.
      await expect(page.getByText('Chưa kết nối backend')).toHaveCount(0)
      await expect(page.getByText('Code chờ')).toBeVisible()
    })

    await test.step('accounts list → detail', async () => {
      await clickNav(page, 'Tài khoản')
      await waitForHeading(page, 'Tài khoản')
      // Navigate to the smoke-owned account specifically (not `.first()`): it
      // carries a password, so the next reveal step is deterministic regardless
      // of what other accounts happen to sort first (get_accounts_list is
      // ORDER BY modified DESC, so leaked fixtures would otherwise win).
      const link = page.locator(`a[href="/accounts/${seededName}"]`)
      await link.waitFor({ state: 'visible', timeout: 15000 })
      await link.click()
      await waitForHeading(page, 'Chi tiết Tài khoản')
      // The detail title is an <h1> (the account username). Filter out the
      // sidebar brand heading (<h1>🎮 GAM</h1>) so this resolves to one element.
      await expect(page.getByRole('heading', { level: 1 }).filter({ hasNotText: 'GAM' })).toBeVisible()
    })

    await test.step('reveal account password (audited)', async () => {
      const revealBtn = page.locator('button[title="Hiện"]').first()
      await revealBtn.waitFor({ state: 'visible', timeout: 10000 })
      await revealBtn.click()
      // A successful reveal flips the toggle into its "hide" state. Assert on
      // the *new* title ("Ẩn") rather than the clicked button — once revealed
      // its title becomes "Ẩn", so re-querying `title="Hiện"` would match the
      // *next* PasswordField (the email credential) instead.
      await expect(page.locator('button[title="Ẩn"]').first()).toBeVisible({ timeout: 10000 })
    })

    await test.step('request verification code (atomic claim)', async () => {
      const codeBtn = page.getByRole('button', { name: /Lấy Verification Code/ })
      if (await codeBtn.isVisible().catch(() => false)) {
        await codeBtn.click()
        // Either a code is claimed (the "Mã xác minh" label) or none is yet
        // available (the amber hint). Both texts are matched exactly / uniquely
        // — a bare "Chưa có code mới" substring also matches another component's
        // empty-state label, which would trip strict mode.
        await expect(
          page
            .getByText('Mã xác minh', { exact: true })
            .or(page.getByText('Chưa có code mới. Vui lòng đợi')),
        ).toBeVisible({ timeout: 15000 })
      }
    })

    await test.step('checkout → check-in lease lifecycle', async () => {
      const checkoutBtn = page.getByRole('button', { name: /Checkout tài khoản/ })
      const visible = await checkoutBtn.isVisible().catch(() => false)
      if (!visible) {
        test.info().annotations.push({ type: 'skip', description: 'account already in use' })
        return
      }
      await checkoutBtn.click()
      await expect(page.getByRole('heading', { name: /Checkout/ })).toBeVisible()
      // Defaults (LOGIN / 120 min) are fine for the smoke.
      await page.getByRole('button', { name: /^Xác nhận$/ }).click()
      // Lease is now IN_USE → the active-usage bar shows "Đang sử dụng".
      await expect(page.getByText('Đang sử dụng')).toBeVisible({ timeout: 15000 })
      // Admin releases the lease (gam.api.checkin_account).
      await page.getByRole('button', { name: /Check-in/ }).click()
      await expect(page.getByText('Đang sử dụng')).toHaveCount(0, { timeout: 15000 })
    })

    await test.step('admin log viewers render', async () => {
      // Reveal Log & Code Request Log are now tabs of the unified Activity hub;
      // reach them via their (redirecting) paths. The rest remain nav entries.
      for (const item of [
        { path: '/admin/reveal-log', heading: 'Nhật ký Reveal' },
        { path: '/admin/code-request-log', heading: 'Yêu cầu mã' },
        { nav: 'Email đến (Webhook)', heading: 'Nhật ký Email đến' },
        { nav: 'Nhật ký sử dụng', heading: 'Nhật ký sử dụng tài khoản' },
        { nav: 'Cài đặt', heading: 'Cài đặt' },
      ]) {
        if (item.path) await gotoApp(page, item.path)
        else await clickNav(page, item.nav)
        await waitForHeading(page, item.heading)
      }
    })

    await test.step('webhook config renders', async () => {
      await clickNav(page, 'Cấu hình Webhook')
      await waitForHeading(page, 'Cấu hình Webhook')
      // Wizard UI: the 5-step pipeline summary card + progress bar are rendered.
      await expect(page.getByText('Tổng quan pipeline')).toBeVisible()
      await expect(page.getByText(/\/ 5 bước/)).toBeVisible()
    })

    await test.step('account settings renders', async () => {
      await gotoApp(page, '/account')
      await waitForHeading(page, 'Cài đặt tài khoản')
    })

    await test.step('logout returns to login', async () => {
      await logout(page)
      await expect(page.getByRole('button', { name: /Bắt đầu/ })).toBeVisible()
    })
  })

  test('member — role isolation (no admin nav, admin routes gated)', async ({ page }) => {
    await login(page, { user: env.memberUser, pass: env.memberPass })
    await waitForHeading(page, 'Dashboard')

    // Member sidebar must NOT expose the admin section.
    await expect(page.locator('aside').getByText('Quản trị', { exact: true })).toHaveCount(0)

    // Direct navigation to an admin-only route bounces to NotFound (router guard).
    await gotoApp(page, '/admin/webhook')
    await expect(page.getByRole('heading', { level: 1, name: /Trang không tồn tại/ })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: /Cấu hình Webhook/ })).toHaveCount(0)

    await logout(page)
  })
})
