// Shared helpers for the GAM browser e2e smoke suite.
//
// These mirror the manual smoke flow described in the handoff
// (login → dashboard → reveal → request code → checkout → logs →
// webhook config → account settings) and turn it into repeatable code.
//
// Selectors are intentionally text/role/attribute based (no brittle CSS
// classes) so they survive Tailwind class churn.

import { expect } from '@playwright/test'
import { generateTotp } from '../../src/utils/totp.js'

/**
 * Runtime configuration, overridable via env vars.
 *
 * Defaults target the dev site `erp.local` with the isolated test users
 * created by `bench --site erp.local execute gam.ops.create_test_users`
 * (`gam-admin@test.local` / `gam-member@test.local`, password `GAM@test-2026`)
 * and the Vite dev server on :5174 (proxying /api → bench :8000).
 */
export const env = {
  base: process.env.GAM_E2E_BASE || 'http://localhost:5174',
  /**
   * Frappe site name. Defaults to the dev site `erp.local`; override with
   * `GAM_TEST_SITE` (e.g. `gam_test`) so CI can run against a disposable,
   * re-seeded bench site instead of the shared dev DB (Phase 3.2 isolation).
   * Smoke/HTTP helpers read the same var via `process.env.GAM_TEST_SITE`.
   */
  site: process.env.GAM_TEST_SITE || process.env.GAM_SITE || 'erp.local',
  adminUser: process.env.GAM_ADMIN_USER || 'gam-admin@test.local',
  adminPass: process.env.GAM_ADMIN_PASS || 'GAM@test-2026',
  /** Base32 OTP secret — only needed when Frappe 2FA is enabled at runtime. */
  adminTotp: process.env.GAM_ADMIN_TOTP || '',
  memberUser: process.env.GAM_MEMBER_USER || 'gam-member@test.local',
  memberPass: process.env.GAM_MEMBER_PASS || 'GAM@test-2026',
}

/** Escape a string for safe embedding in a RegExp. */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Navigate the SPA to a path (path is appended to env.base). */
export async function gotoApp(page, path = '/') {
  await page.goto(`${env.base}${path}`)
}

/**
 * Attach console + uncaught-error listeners so client-side JS failures surface
 * in the Playwright output / failure snapshots (they are otherwise invisible —
 * a swallowed promise rejection leaves the page silently showing an empty state).
 *
 * Returns the arrays it populates so a test can assert on / print them.
 */
export function captureConsole(page, { errors = [], logs = [] } = {}) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
    else logs.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`)
  })
  return { errors, logs }
}

/**
 * The desktop sidebar is hover-to-reveal (it slides off-screen when the mouse
 * leaves). Pin it open so subsequent nav clicks are stable.
 */
export async function pinSidebar(page) {
  await page.mouse.move(2, 300) // 4px hover trigger strip on the left edge
  await page.locator('aside').first().waitFor({ state: 'visible', timeout: 5000 })
  const pin = page.locator('aside button[title="Ghim sidebar"]')
  if (await pin.isVisible().catch(() => false)) {
    await pin.click().catch(() => {})
  }
}

/**
 * Click a sidebar nav link by its visible label (the emoji icon is part of the
 * accessible name, so we match by substring).
 */
export async function clickNav(page, label) {
  // The desktop sidebar is hover-to-reveal; nudge the left trigger strip so the
  // link is on-screen before we click. (login() also pre-pins via localStorage,
  // so on a continuing session the hover is a harmless belt-and-suspenders.)
  await page.mouse.move(2, 300)
  const link = page
    .locator('aside')
    .first()
    .getByRole('link', { name: new RegExp(escapeRegex(label)) })
  await link.click()
}

/**
 * Log in via the LoginView form. Handles the optional Frappe 2FA step:
 * if a challenge appears and `opts.totp` (base32 secret) is provided, the
 * current 6-digit code is generated with the same production util the app uses
 * (`src/utils/totp.js`) and submitted. Throws a clear error if 2FA is required
 * but no secret was supplied.
 *
 * Resolves once the Dashboard heading is visible.
 */
export async function login(page, { user, pass, totp = '' } = {}) {
  // Pre-pin the sidebar so nav links are always on-screen for the whole
  // session (the AppLayout reads `localStorage.gam_sidebarPinned` on mount).
  await page.addInitScript(() => {
    try {
      localStorage.setItem('gam_sidebarPinned', 'true')
    } catch {
      /* ignore */
    }
  })
  await gotoApp(page, '/login')

  await page.locator('input[autocomplete="username"]').fill(user)
  await page.locator('input[autocomplete="current-password"]').fill(pass)
  await page.getByRole('button', { name: /Bắt đầu/ }).click()

  // Wait for any of: dashboard, 2FA challenge, or an auth error.
  const outcome = page
    .getByRole('heading', { level: 2, name: /Dashboard/ })
    .or(page.getByText('Xác thực 2 bước'))
    .or(page.getByText(/Sai email hoặc mật khẩu|Mật khẩu đã hết hạn|Không thể kết nối máy chủ/))
  await outcome.first().waitFor({ state: 'visible', timeout: 20000 })

  if (await page.getByText('Sai email hoặc mật khẩu|Mật khẩu đã hết hạn|Không thể kết nối máy chủ').first().isVisible().catch(() => false)) {
    throw new Error(`Login failed for ${user} (check credentials / backend reachability)`)
  }

  if (await page.getByText('Xác thực 2 bước').isVisible().catch(() => false)) {
    if (!totp) {
      throw new Error(
        `2FA challenge presented for ${user} but GAM_*_TOTP secret not set — ` +
          'enable with GAM_ADMIN_TOTP (base32) or disable Frappe 2FA for the smoke run.',
      )
    }
    const code = await generateTotp(totp, { period: 30, digits: 6 })
    if (!code) throw new Error(`Could not derive TOTP code from the supplied secret for ${user}`)
    await page.locator('input[autocomplete="one-time-code"]').fill(code)
    await page.getByRole('button', { name: /Xác nhận/ }).click()
    await page
      .getByRole('heading', { level: 2, name: /Dashboard/ })
      .waitFor({ state: 'visible', timeout: 20000 })
  }

  await expect(page).toHaveURL(/\/$|\/#?$/)
}

/** Open the user menu and sign out, returning to /login. */
export async function logout(page) {
  await pinSidebar(page)
  await page.locator('aside').first().getByRole('button', { name: /▼/ }).click()
  await page.getByRole('button', { name: /Đăng xuất/ }).click()
  await page.waitForURL(/\/login/, { timeout: 15000 })
}

/**
 * Wait for a view's PageHeader heading (rendered as <h2> by PageHeader.vue).
 * `title` is matched as a substring so emoji icons don't get in the way.
 */
export async function waitForHeading(page, title, timeout = 15000) {
  await page
    .getByRole('heading', { level: 2, name: new RegExp(escapeRegex(title)) })
    .first()
    .waitFor({ state: 'visible', timeout })
}

// ===========================================================================
// Fixture management — create / list / delete GAM records through the SPA's
// own session. The fetches run inside the browser page (page.evaluate) so they
// are same-origin, share the live session cookie and refresh the Frappe CSRF
// token for modifying verbs exactly like the production api/index.js wrapper.
//
// This lets the admin-CRUD specs seed + tear down their own data so the whole
// suite stays idempotent across runs (no manual DB cleanup, no accumulating
// junk from interrupted runs).
// ===========================================================================

/** Stable prefix so leftover fixtures from an interrupted run are cleanable. */
export const E2E_PREFIX = 'e2e-'

/** A unique, prefix-tagged name, e.g. `e2e-game-1718450000000`. */
export function e2eName(kind) {
  return `${E2E_PREFIX}${kind}-${Date.now()}`
}

/**
 * Same-origin fetch executed inside the browser page. Re-uses the live SPA
 * session (cookies) and refreshes the Frappe CSRF token for POST/PUT/DELETE.
 * Returns `{ status, data }` where `data` is the parsed Frappe JSON envelope.
 */
async function pageFetch(page, path, { method = 'GET', body } = {}) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const headers = {}
      if (method !== 'GET') {
        let token = ''
        try {
          const r = await fetch('/api/method/gam.utils.get_session_csrf_token', { credentials: 'include' })
          token = ((await r.json()) || {}).message || ''
        } catch {
          /* ignore */
        }
        if (!token) {
          const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/)
          if (m) token = m[1]
        }
        headers['X-Frappe-CSRF-Token'] = token
      }
      const opts = { method, credentials: 'include', headers }
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
        opts.body = JSON.stringify(body)
      }
      const res = await fetch(path, opts)
      let data = null
      try {
        data = await res.json()
      } catch {
        /* non-JSON (e.g. 404) */
      }
      return { status: res.status, data }
    },
    { path, method, body },
  )
}

/** Create a GAM record via REST; returns the created doc (incl. its `name`). */
export async function createFixture(page, doctype, payload) {
  const { data } = await pageFetch(page, `/api/resource/${encodeURIComponent(doctype)}`, {
    method: 'POST',
    body: payload,
  })
  if (!data || data.exc) {
    throw new Error(`createFixture ${doctype} failed: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data.data
}

/** Delete a GAM record by name. Best-effort — never throws (teardown path). */
export async function deleteFixture(page, doctype, name) {
  if (!name) return
  await pageFetch(page, `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }).catch(() => {})
}

/** List GAM records matching `filters` (returns the requested `fields`). */
export async function listFixtures(page, doctype, filters, fields = ['name']) {
  const params = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters || []),
    limit_page_length: '200',
  })
  const { data } = await pageFetch(page, `/api/resource/${encodeURIComponent(doctype)}?${params}`)
  return (data && data.data) || []
}

/**
 * Best-effort sweep that deletes every record matching `filters`. Used to
 * purge stale e2e fixtures before/after a CRUD test so runs are idempotent.
 */
export async function cleanupFixtures(page, doctype, filters) {
  const rows = await listFixtures(page, doctype, filters).catch(() => [])
  for (const r of rows) await deleteFixture(page, doctype, r.name)
}

/**
 * Invoke a whitelisted `gam.*` method through the SPA's same-origin session.
 * The fetch runs inside the browser page (page.evaluate) so it re-uses the
 * live session cookie and refreshes the Frappe CSRF token for the POST,
 * exactly like the production api/index.js wrapper. Returns the unwrapped
 * `message` payload; throws on a Frappe `exc`.
 *
 * Used by the 2FA spec to provision / tear down the dedicated 2FA test user
 * (gam.ops.setup_2fa_test / gam.ops.teardown_2fa_test).
 */
export async function gamCall(page, method, params = {}) {
  const { data } = await pageFetch(page, `/api/method/${method}`, {
    method: 'POST',
    body: params,
  })
  if (!data || data.exc) {
    throw new Error(`gamCall ${method} failed: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data.message
}

// ===========================================================================
// UI helpers for the admin-CRUD specs
// ===========================================================================

/**
 * Wait for a toast notification containing `text` to appear. Toasts are
 * rendered top-right by ToastProvider.vue and auto-dismiss after ~3s, so this
 * is polled with a tight timeout.
 */
export async function expectToast(page, text, timeout = 8000) {
  await expect(
    page.locator('.fixed.top-6.right-6').getByText(text, { exact: false }),
  ).toBeVisible({ timeout })
}

/**
 * Wait until no toast containing `text` is visible. Toasts auto-dismiss after
 * ~3s (ToastProvider.vue); this lets a test perform a *second* action that
 * surfaces the same message without the still-visible first toast causing a
 * false-positive `expectToast`. Used by the change→restore flows below.
 */
export async function waitToastCleared(page, text, timeout = 6000) {
  await expect(
    page.locator('.fixed.top-6.right-6').getByText(text, { exact: false }),
  ).toBeHidden({ timeout })
}

/**
 * Pick an option from a `SearchableSelect`. The trigger is its text `<input>`
 * (matched by `placeholder`); the option list is teleported to <body> inside a
 * `.dropdown-animation` container. `optionText` is matched on the rendered
 * `<li>` (pass the full visible label so a shared substring is unambiguous).
 */
export async function pickSelectOption(page, placeholder, optionText) {
  await page.locator(`input[placeholder="${placeholder}"]`).click()
  const opt = page
    .locator('.dropdown-animation li')
    .filter({ hasText: optionText })
    .first()
  await opt.waitFor({ state: 'visible', timeout: 8000 })
  await opt.click()
}

/**
 * Resolve the nearest card/row ancestor of the element whose text equals
 * `text`. List rows are `.rounded-2xl` cards, but they are not always <div>s:
 * game/server/list-option rows are <div>, while account rows render as
 * <router-link> (<a>). Match any element tag with that class so a follow-up
 * action (toggle, delete) is scoped to the matching row only.
 */
export function rowForText(page, text) {
  return page
    .getByText(text, { exact: true })
    .locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]')
}
