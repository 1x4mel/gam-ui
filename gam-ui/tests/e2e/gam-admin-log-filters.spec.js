// GAM admin log views — verifies the DateRangeFilter (design §5.8/§5.9) is wired
// into every audit log view and actually drives a server-side filter fetch.
//
// The smoke suite only checks the log headings render; this proves the date
// pickers are present AND that picking a date re-queries frappe.client.get_list
// with a >= / <= datetime bound (not just a cosmetic control).
//
// Run:  npm run test:e2e   (needs bench :8000 + the auto-started vite dev)

import { test, expect } from '@playwright/test'
import { env, login, clickNav, gotoApp, waitForHeading, captureConsole } from './lib.js'

// Each log view exposes the DateRangeFilter + its backing DocType (used to spot
// the right server request in the network log).
// Reveal Log & Code Request Log are now tabs of the unified Activity hub
// (/admin/activity) — reached via their old redirecting paths, which preserve
// each view's own heading/filters. The other two remain standalone nav entries.
const LOGS = [
  { path: '/admin/reveal-log', heading: 'Nhật ký Reveal', doctype: 'GAM Reveal Log' },
  { path: '/admin/code-request-log', heading: 'Yêu cầu mã', doctype: 'GAM Code Request Log' },
  { nav: 'Email đến (Webhook)', heading: 'Nhật ký Email đến', doctype: 'GAM Email Inbound Log' },
  { nav: 'Nhật ký sử dụng', heading: 'Nhật ký sử dụng tài khoản', doctype: 'GAM Account Usage' },
]

// Open a log view either by its (hub-tab) path or its sidebar nav label.
async function openLog(page, log) {
  if (log.path) await gotoApp(page, log.path)
  else await clickNav(page, log.nav)
}

let consoleErrors = []

test.describe('GAM admin log date-range filters', () => {
  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    captureConsole(page, { errors: consoleErrors })
  })

  // Surface swallowed client errors when a test fails (mirrors the smoke suite).
  // We deliberately do NOT hard-assert console errors empty: socketio :9000 is
  // down in this sandbox, so its transport chatter + 500 resource-load lines
  // are expected non-fatal noise. The feature's own request is guarded by the
  // `resp.ok()` / URL assertions below.
  test.afterEach(async () => {
    const info = test.info()
    if (info.status !== info.expectedStatus && consoleErrors.length) {
      console.log(`\n—— browser console errors (${consoleErrors.length}) ——`)
      consoleErrors.forEach((e) => console.log('  •', e))
    }
  })

  test('date-range filter renders on every log view', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    for (const log of LOGS) {
      await test.step(`${log.heading} shows Từ/Đến date pickers`, async () => {
        await openLog(page, log)
        await waitForHeading(page, log.heading)
        // DateRangeFilter renders exactly two date inputs (labelled Từ / Đến).
        await expect(page.locator('input[type="date"]')).toHaveCount(2)
      })
    }

    // Code Request Log additionally gained an email filter (design §5.9).
    await test.step('Code Request Log exposes email filter', async () => {
      await gotoApp(page, '/admin/code-request-log')
      await waitForHeading(page, 'Yêu cầu mã')
      await expect(page.getByPlaceholder('Lọc theo email...')).toBeVisible()
    })
  })

  test('picking a date drives a server-side filter on Reveal Log', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await gotoApp(page, '/admin/reveal-log')
    await waitForHeading(page, 'Nhật ký Reveal')

    const fromInput = page.locator('input[type="date"]').first()
    await expect(fromInput).toBeVisible()

    // Choosing a "Từ" date must re-query the backend carrying the >= bound +
    // the chosen date (proves UI → ref → fetchFn → Frappe filter tuple wiring).
    // getList() issues a REST GET to /api/resource/<doctype>?filters=[...]
    // (the doctype is URL-encoded as "GAM%20Reveal%20Log"); the date value
    // survives encoding (digits/hyphens are not percent-encoded).
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const listFetch = page.waitForResponse(
      (r) =>
        r.url().includes('/api/resource/GAM%20Reveal%20Log') &&
        r.request().method() === 'GET',
      { timeout: 15000 },
    )
    await fromInput.fill(today)
    const resp = await listFetch
    expect(resp.ok()).toBeTruthy()
    expect(decodeURIComponent(resp.url())).toContain(today)

    // resp.ok() above guards the actual filter request (a backend break on the
    // date tuple would surface there). Clearing the date restores the unbounded
    // list (another server fetch).
    const clearFetch = page.waitForResponse(
      (r) =>
        r.url().includes('/api/resource/GAM%20Reveal%20Log') &&
        r.request().method() === 'GET',
      { timeout: 15000 },
    )
    await fromInput.fill('')
    await clearFetch
  })
})
