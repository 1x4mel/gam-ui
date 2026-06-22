// GAM browser e2e — admin Account Link coverage.
//
// Extends the suite (gam-smoke + gam-admin-crud + gam-admin-settings) with the
// GAM Account Link flow: create a link between two accounts through the UI, then
// exercise the backend controller's guards end-to-end.
//
// The controller (gam_account_link.py) enforces two rules:
//   • anti-self       — an account cannot link to itself
//   • anti-duplicate  — no second ACTIVE link between the same two accounts,
//                       in EITHER direction
//
// The anti-self rule is NOT reachable through the UI (the link picker excludes
// the current account), and is already covered by the backend pytest
// (gam/tests/test_doctype.py). This spec therefore focuses on what the UI can
// actually trigger: the duplicate guard, which the controller enforces in both
// directions — proving the contract holds across the REST boundary the SPA uses.
//
// The test seeds its own fixtures (email + two accounts) through the same-origin
// REST helpers in lib.js and tears them down again, so it is idempotent and
// leaves the DB clean across runs.
//
// Run:  npm run test:e2e      (same prerequisites as the smoke suite)

import { test, expect } from '@playwright/test'
import {
  env,
  login,
  gotoApp,
  captureConsole,
  e2eName,
  E2E_PREFIX,
  createFixture,
  deleteFixture,
  cleanupFixtures,
  expectToast,
  pickSelectOption,
} from './lib.js'

// Surface swallowed client-side errors on failure (same pattern as the other specs).
let consoleErrors = []

test.describe('GAM admin Account Link e2e', () => {
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

  test('account links — create + duplicate guard both directions (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // Purge stale e2e accounts / emails left by an interrupted run.
    await cleanupFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}`]])
    await cleanupFixtures(page, 'GAM Email', [['address', 'like', `%${E2E_PREFIX}%`]])

    // Seed a fresh email + two active accounts (A, B) the link dialog can pick.
    const stamp = Date.now()
    const emailAddr = `${E2E_PREFIX}lkemail-${stamp}@e2e.test`
    const usernameA = e2eName('lk-a')
    const usernameB = e2eName('lk-b')

    const email = await createFixture(page, 'GAM Email', { address: emailAddr, is_active: 1 })
    const accA = await createFixture(page, 'GAM Account', {
      platform: 'STEAM',
      username: usernameA,
      email: email.name,
      status: 'ACTIVE',
    })
    const accB = await createFixture(page, 'GAM Account', {
      platform: 'BATTLENET',
      username: usernameB,
      email: email.name,
      status: 'ACTIVE',
    })

    await test.step('create a link A → B through the dialog', async () => {
      await gotoApp(page, `/accounts/${accA.name}`)
      await expect(page.locator('h1').filter({ hasText: usernameA })).toBeVisible()
      await openLinkDialog(page)

      await pickSelectOption(page, 'Chọn tài khoản', usernameB)
      await page.getByRole('button', { name: 'Liên kết', exact: true }).click()
      await expectToast(page, 'Đã tạo liên kết')
      // The section reloads and lists B as a link (rendered by its doc name).
      await expect(page.getByText(accB.name, { exact: true })).toBeVisible({ timeout: 10000 })
    })

    await test.step('the link also shows on B (bidirectional query)', async () => {
      await gotoApp(page, `/accounts/${accB.name}`)
      await expect(page.locator('h1').filter({ hasText: usernameB })).toBeVisible()
      // AccountLinkSection queries or_filters (source OR target), so the A→B
      // link appears on B's page pointing back at A.
      await expect(page.getByText(accA.name, { exact: true })).toBeVisible({ timeout: 10000 })
    })

    await test.step('creating the same link A → B again is rejected', async () => {
      await gotoApp(page, `/accounts/${accA.name}`)
      await openLinkDialog(page)
      await pickSelectOption(page, 'Chọn tài khoản', usernameB)
      await page.getByRole('button', { name: 'Liên kết', exact: true }).click()
      // The controller throws → createDoc rejects → the dialog surfaces the
      // server message inline (no toast, no navigation).
      await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 10000 })
    })

    await test.step('reverse direction B → A is also rejected', async () => {
      await gotoApp(page, `/accounts/${accB.name}`)
      await openLinkDialog(page)
      await pickSelectOption(page, 'Chọn tài khoản', usernameA)
      await page.getByRole('button', { name: 'Liên kết', exact: true }).click()
      await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 10000 })
    })

    // Teardown: link first (it references both accounts), then accounts, then email.
    await cleanupFixtures(page, 'GAM Account Link', [['source_account', 'in', [accA.name, accB.name]]])
    await deleteFixture(page, 'GAM Account', accA.name)
    await deleteFixture(page, 'GAM Account', accB.name)
    await deleteFixture(page, 'GAM Email', email.name)
  })
})

/**
 * Click the "🔗 Liên kết" section's "+ Thêm" button (disambiguated from the
 * Games section, which has its own identically-labelled add button) and wait for
 * the create-link modal to render.
 */
async function openLinkDialog(page) {
  const section = page
    .getByRole('heading', { name: /Liên kết/ })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
  await section.getByRole('button', { name: '+ Thêm' }).click()
  await expect(page.getByRole('heading', { name: /Thêm Liên kết/ })).toBeVisible()
}
