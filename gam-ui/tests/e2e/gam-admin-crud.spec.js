// GAM browser e2e — admin CRUD coverage.
//
// Extends the smoke suite (gam-smoke.spec.js) with the three interaction-heavy
// flows the handoff called out: GamesView admin CRUD (create + toggle + tabs),
// AccountFormModal create-account (incl. the SearchableSelect email picker),
// and EmailDetailView (view a verification code). These are the only paths in
// the app that *write* data, so they were deliberately split out of the
// read-mostly smoke flow.
//
// Every test seeds its own fixtures and tears them down again (via the
// same-origin REST helpers in lib.js, which re-use the live SPA session), so
// the suite is idempotent and leaves the DB clean across runs.
//
// Run:  npm run test:e2e      (same prerequisites as the smoke suite)

import { test, expect } from '@playwright/test'
import {
  env,
  login,
  clickNav,
  waitForHeading,
  captureConsole,
  e2eName,
  E2E_PREFIX,
  createFixture,
  deleteFixture,
  cleanupFixtures,
  listFixtures,
  expectToast,
  pickSelectOption,
  rowForText,
} from './lib.js'

// Surface swallowed client-side errors on failure (same pattern as the smoke spec).
let consoleErrors = []

test.describe('GAM admin CRUD e2e', () => {
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

  test('games — create + toggle active + tabs (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const gameName = e2eName('game')
    // Purge any stale e2e games left behind by an interrupted run.
    await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])

    await clickNav(page, 'Cài đặt')
    await waitForHeading(page, 'Cài đặt')

    await test.step('create a game via the admin form', async () => {
      await page.getByRole('button', { name: /Thêm Game/ }).click()
      await expect(page.getByRole('heading', { name: /Thêm Game/ })).toBeVisible()
      await page.getByPlaceholder('Diablo 4').fill(gameName)
      await page.getByPlaceholder('Blizzard').fill('E2E Publisher')
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expectToast(page, 'Đã tạo')
      // The list reloaded — the new game is now rendered.
      await expect(page.getByText(gameName, { exact: true })).toBeVisible({ timeout: 10000 })
    })

    await test.step('toggle the game inactive, then active again', async () => {
      const row = rowForText(page, gameName)
      // Created games default to is_active=1 → toggle button reads "Tắt".
      await row.getByRole('button', { name: 'Tắt', exact: true }).click()
      await expect(row.getByRole('button', { name: 'Bật', exact: true })).toBeVisible({ timeout: 10000 })
      await row.getByRole('button', { name: 'Bật', exact: true }).click()
      await expect(row.getByRole('button', { name: 'Tắt', exact: true })).toBeVisible({ timeout: 10000 })
    })

    await test.step('Server / DLC sub-tabs switch and render', async () => {
      // Server/DLC are sub-tabs under the default "Game & DLC" top tab. The
      // sub-strip (no border-b) is distinct from the top-level tab strip.
      const tabStrip = page.locator('.flex.items-center.gap-1.mb-4.flex-wrap:not(.border-b)')
      await tabStrip.getByRole('button').filter({ hasText: 'Server' }).click()
      await expect(page.getByRole('button', { name: /Thêm Server/ })).toBeVisible()
      await tabStrip.getByRole('button').filter({ hasText: 'DLC' }).click()
      await expect(page.getByRole('button', { name: /Thêm DLC/ })).toBeVisible()
    })

    await cleanupFixtures(page, 'GAM Game', [['game_name', '=', gameName]])
  })

  test('accounts — admin creates an account via the form (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const username = e2eName('acc')
    await cleanupFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])

    // The form requires a linked email — use the first active one. If none is
    // seeded, the test is skipped (not failed): run
    // `bench --site erp.local execute gam.setup.seed_demo`.
    const emails = await listFixtures(page, 'GAM Email', [['is_active', '=', 1]], ['name', 'address'])
    test.skip(!emails.length, 'no active GAM Email to link — run gam.setup.seed_demo')

    await clickNav(page, 'Tài khoản')
    await waitForHeading(page, 'Tài khoản')
    await page.getByRole('button', { name: /Thêm/ }).click()
    await expect(page.getByRole('heading', { name: /Thêm Tài khoản/ })).toBeVisible()

    await test.step('fill + submit the create form', async () => {
      // Phase-4 redesign: platform chips render as "🎮 Steam" (icon + label),
      // and the list toolbar has an identically-labelled Platform filter, so
      // scope to the modal overlay and match case-insensitively.
      await page.locator('.fixed.inset-0').getByRole('button', { name: /Steam/i }).click()
      await page.getByPlaceholder('Tên đăng nhập').fill(username)
      await pickSelectOption(page, 'Chọn email', emails[0].address)
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expectToast(page, 'Đã tạo tài khoản')
    })

    await test.step('the new account appears in the list', async () => {
      await expect(page.getByText(username, { exact: true })).toBeVisible({ timeout: 10000 })
    })

    await cleanupFixtures(page, 'GAM Account', [['username', '=', username]])
  })

  test('account — create with game + DLC, verify on detail (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const username = e2eName('acc-gd')
    const gameName = e2eName('game')
    const dlcName = e2eName('dlc')

    await cleanupFixtures(page, 'GAM Account', [['username', '=', username]])

    const emails = await listFixtures(page, 'GAM Email', [['is_active', '=', 1]], ['name', 'address'])
    test.skip(!emails.length, 'no active GAM Email to link — run gam.setup.seed_demo')

    // Seed a game + a DLC scoped to it (the form filters DLC by the chosen game).
    const game = await createFixture(page, 'GAM Game', { game_name: gameName })
    const dlc = await createFixture(page, 'GAM DLC', { game: game.name, dlc_name: dlcName })

    await test.step('create account with a game + DLC selected', async () => {
      await clickNav(page, 'Tài khoản')
      await waitForHeading(page, 'Tài khoản')
      await page.getByRole('button', { name: /Thêm/ }).click()
      await expect(page.getByRole('heading', { name: /Thêm Tài khoản/ })).toBeVisible()

      const modal = page.locator('.fixed.inset-0')
      await modal.getByRole('button', { name: /Steam/i }).click()
      await page.getByPlaceholder('Tên đăng nhập').fill(username)
      await pickSelectOption(page, 'Chọn email', emails[0].address)

      // Games section: add a row, pick the seeded game, tick its DLC chip.
      await modal.getByRole('button', { name: /Game$/ }).click()
      await pickSelectOption(page, 'Chọn game', gameName)
      await modal.locator('label', { hasText: dlcName }).first().click()
      // Each game row now requires a Role (first-class (role, game) binding —
      // Phương án B). Pick BOOSTER so the row passes submit validation.
      await modal.locator('select')
        .filter({ has: page.locator('option[value="BOOSTER"]') })
        .selectOption('BOOSTER')

      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expectToast(page, 'Đã tạo tài khoản')
    })

    await test.step('game + DLC appear on the account detail page', async () => {
      await expect(page.getByText(username, { exact: true }).first()).toBeVisible({ timeout: 10000 })
      await rowForText(page, username).click()
      await expect(page.getByText(gameName, { exact: true })).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(`DLC: ${dlcName}`, { exact: true })).toBeVisible()
    })

    // teardown: account first (owns the game child rows), then the masters
    await cleanupFixtures(page, 'GAM Account', [['username', '=', username]])
    await deleteFixture(page, 'GAM DLC', dlc.name)
    await deleteFixture(page, 'GAM Game', game.name)
  })

  test('email detail — view a verification code (fixture-seeded, cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // Codes normally arrive via the Cloudflare webhook. For a deterministic UI
    // test we seed one directly through the SPA session (no webhook needed).
    const codeValue = `E2E${Date.now().toString().slice(-6)}`
    const created = await createFixture(page, 'GAM Email Code', {
      platform: 'STEAM',
      code: codeValue,
      received_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      status: 'AVAILABLE',
    })

    await test.step('the seeded code shows in the list', async () => {
      await clickNav(page, 'Mã Code')
      await waitForHeading(page, 'Mã Code')
      await expect(page.getByText(codeValue, { exact: true })).toBeVisible({ timeout: 10000 })
    })

    await test.step('opening it renders the detail page', async () => {
      await page.getByText(codeValue, { exact: true }).click()
      await waitForHeading(page, 'Chi tiết Mã')
      // The code hero shows the seeded value.
      await expect(page.locator('code').filter({ hasText: codeValue })).toBeVisible()
    })

    await deleteFixture(page, 'GAM Email Code', created.name)
  })

  test('games — edit + delete (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const gameName = e2eName('game')
    await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])

    await clickNav(page, 'Cài đặt')
    await waitForHeading(page, 'Cài đặt')

    await test.step('create a game', async () => {
      await page.getByRole('button', { name: /Thêm Game/ }).click()
      await page.getByPlaceholder('Diablo 4').fill(gameName)
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expectToast(page, 'Đã tạo')
      await expect(page.getByText(gameName, { exact: true })).toBeVisible({ timeout: 10000 })
    })

    await test.step('edit the game (Sửa mode)', async () => {
      const edited = `${gameName}-edited`
      const row = rowForText(page, gameName)
      await row.getByRole('button', { name: 'Sửa', exact: true }).click()
      await expect(page.getByRole('heading', { name: /Sửa Game/ })).toBeVisible()
      await page.getByPlaceholder('Diablo 4').fill(edited)
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expectToast(page, 'Đã cập nhật')
      await expect(page.getByText(edited, { exact: true })).toBeVisible({ timeout: 10000 })
      // Delete via the row button, then confirm in the dialog overlay.
      const editedRow = page.locator('.rounded-2xl').filter({ hasText: edited }).first()
      await editedRow.getByRole('button', { name: 'Xoá', exact: true }).click()
      await page.locator('.fixed.inset-0').getByRole('button', { name: 'Xoá', exact: true }).click()
      await expectToast(page, 'Đã xoá')
      await expect(page.getByText(edited, { exact: true })).toBeHidden({ timeout: 10000 })
    })
  })

  test('servers — custom name create + delete, no region (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const gameName = e2eName('game')
    await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])
    await cleanupFixtures(page, 'GAM Game Server', [['server_name', 'like', `${E2E_PREFIX}%`]])

    // Seed a game to attach the server to (server requires a game link).
    await createFixture(page, 'GAM Game', { game_name: gameName, is_active: 1 })

    await clickNav(page, 'Cài đặt')
    await waitForHeading(page, 'Cài đặt')
    const tabStrip = page.locator('.flex.items-center.gap-1.mb-4.flex-wrap:not(.border-b)')
    await tabStrip.getByRole('button').filter({ hasText: 'Server' }).click()

    const serverName = e2eName('server')
    await test.step('create a server with a free-text name (region is gone)', async () => {
      await page.getByRole('button', { name: /Thêm Server/ }).click()
      await expect(page.getByRole('heading', { name: /Thêm Server/ })).toBeVisible()
      // No Region select anymore — the server name is a free-text field.
      await expect(page.getByPlaceholder('AMERICAS')).toBeHidden()
      await pickSelectOption(page, 'Chọn game', gameName)
      await page.getByPlaceholder(/Chim Sẻ/).fill(serverName)
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expectToast(page, 'Đã tạo')
      // Server rows render "<game> · <server_name>" so match by row content, not exact text.
      await expect(page.locator('.rounded-2xl').filter({ hasText: serverName })).toBeVisible({ timeout: 10000 })
    })

    await test.step('delete the server', async () => {
      const row = page.locator('.rounded-2xl').filter({ hasText: serverName }).first()
      await row.getByRole('button', { name: 'Xoá', exact: true }).click()
      await page.locator('.fixed.inset-0').getByRole('button', { name: 'Xoá', exact: true }).click()
      await expectToast(page, 'Đã xoá')
      await expect(page.getByText(serverName, { exact: true })).toBeHidden({ timeout: 10000 })
    })

    await cleanupFixtures(page, 'GAM Game', [['game_name', '=', gameName]])
  })
})
