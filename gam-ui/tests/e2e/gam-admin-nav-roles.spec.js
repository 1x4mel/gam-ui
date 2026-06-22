// GAM browser e2e — sidebar reorg + per-role account sections with dynamic game links.
//
// Covers:
//   * "Tài khoản" entry lives in the Quản trị (admin) section.
//   * Each Account Role renders as its own sidebar section: a header label, a
//     "Tất cả" entry, plus one link per game that has accounts for that role
//     (loaded dynamically from gam.api.get_role_game_sections — never hard-coded).
//   * A role section links to the dedicated /role/<value> view (role scope).
//   * Clicking a game under a role navigates to /role/<value>/game/<game>
//     and the scoped role|game view renders that game's accounts.
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
} from './lib.js'

let consoleErrors = []

test.describe('GAM nav + role sections', () => {
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

  test('admin — Tài khoản lives in the Quản trị section', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // "Tài khoản" is an admin-section entry (Quản trị), separate from the
    // per-role sections below it.
    await clickNav(page, 'Tài khoản')
    await waitForHeading(page, 'Tài khoản')
  })

  test('admin — each Account Role renders as its own sidebar section', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const aside = page.locator('aside').first()
    // Account Roles are now section HEADERS (labels), not links.
    await expect(aside.getByText(/Trader/)).toBeVisible()
    await expect(aside.getByText(/Booster/)).toBeVisible()
    // Every role section always shows a "Tất cả" entry (role-filtered list).
    await expect(aside.getByRole('link', { name: /Tất cả/ }).first()).toBeVisible()
  })

  test('admin — role section links to the dedicated /role view', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // The Trader "Tất cả" entry now routes to /role/TRADER (split out of /accounts).
    await page.goto(`${env.base}/role/TRADER`)
    await expect(page).toHaveURL(/\/role\/TRADER$/)

    // The role scope is shown as a static badge in the toolbar — no filter chip.
    await expect(page.locator('main')).toContainText(/Trader/)
    // The task-oriented role view has no platform/role/status filter chips.
    await expect(page.locator('main').getByRole('button', { name: /^Trader$/ })).toHaveCount(0)
  })

  // Delete every GAM Account Role Game binding referencing an e2e-prefixed
  // account. Must run BEFORE the account cleanup, otherwise Frappe Link
  // integrity blocks the account delete and orphans the bindings.
  async function purgeBindingsForE2eAccounts(page) {
    const accounts = await listFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])
    for (const acc of accounts) {
      await cleanupFixtures(page, 'GAM Account Role Game', [['account', '=', acc.name]])
    }
  }

  // Seed a game + a TRADER account + a first-class (role, game) binding, so the
  // Trader sidebar section has a dynamic game link to assert / click. Cleaned up
  // by the caller (teardownTraderWithGame).
  async function seedTraderWithGame(page) {
    await purgeBindingsForE2eAccounts(page)
    await cleanupFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])
    await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])

    const game = await createFixture(page, 'GAM Game', {
      game_name: e2eName('game'),
      is_active: 1,
    })
    const emails = await listFixtures(page, 'GAM Email', [['is_active', '=', 1]], ['name'])
    test.skip(!emails.length, 'no active GAM Email to link — run gam.setup.seed_demo')

    // GAM Account now holds identity/credentials only (no role, no games table).
    // Include `account_password` so a leaked fixture can't break the gam-smoke
    // reveal step (which lands on the first account by modified DESC).
    const account = await createFixture(page, 'GAM Account', {
      platform: 'STEAM',
      username: e2eName('acc'),
      email: emails[0].name,
      status: 'ACTIVE',
      account_password: 'e2e-trader-pass',
    })
    // Phương án B — the (role, game) pair is a first-class binding, decoupled
    // from the account. Seed it explicitly so the Trader section surfaces this
    // game dynamically (aggregated from `tabGAM Account Role Game`).
    const binding = await createFixture(page, 'GAM Account Role Game', {
      account: account.name,
      role: 'TRADER',
      game: game.name,
      is_main: 1,
    })
    return { game, account, binding }
  }

  // Order matters: drop the binding first (else Link integrity blocks the
  // account delete), then the account, then the game.
  async function teardownTraderWithGame(page, game, account, binding) {
    if (binding) await deleteFixture(page, 'GAM Account Role Game', binding.name)
    if (account) await deleteFixture(page, 'GAM Account', account.name)
    if (game) await deleteFixture(page, 'GAM Game', game.name)
  }

  test('admin — a role section lists its games dynamically (fixture-seeded)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const { game, account, binding } = await seedTraderWithGame(page)

    try {
      // Reload so the sidebar's games-by-role cache refreshes from the backend.
      await page.goto(`${env.base}/`)
      await waitForHeading(page, 'Dashboard')

      const aside = page.locator('aside').first()
      // Under the Trader section, the seeded game now appears as a nav link.
      await expect(aside.getByRole('link', { name: game.game_name })).toBeVisible({
        timeout: 10000,
      })
    } finally {
      await teardownTraderWithGame(page, game, account, binding)
    }
  })

  test('admin — clicking a game under a role opens the scoped /role view', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const { game, account, binding } = await seedTraderWithGame(page)

    try {
      await page.goto(`${env.base}/`)
      await waitForHeading(page, 'Dashboard')

      const aside = page.locator('aside').first()
      await aside.getByRole('link', { name: game.game_name }).click()

      // URL is the dedicated role|game path (role + game in path params).
      await expect(page).toHaveURL(/\/role\/TRADER\/game\//)
      // The view's title (PageHeader h2) is the game name.
      await waitForHeading(page, game.game_name)
      // The seeded account (which owns this game) is in the scoped results.
      await expect(page.getByText(account.username, { exact: true })).toBeVisible({
        timeout: 10000,
      })
    } finally {
      await teardownTraderWithGame(page, game, account, binding)
    }
  })
})
