// GAM browser e2e — dedicated role|game operational view (/role/:role(/game/:game)).
//
// Covers the split of the old `/accounts?role=...&game=...` filter into its own
// task-oriented, member-first view:
//   * Admin reaches /role/TRADER/game/<game>; cards show a Checkin CTA and NO
//     Sửa/Xoá CRUD chrome (CRUD stays on the /accounts back-office).
//   * Back-compat: old /accounts?role=...(&game=...) 301-style redirects to /role/...
//   * A member WITHOUT the ROLE_GAME|role|game grant is bounced to NotFound.
//
// Run:  npm run test:e2e   (same prerequisites as the smoke suite)

import { test, expect } from '@playwright/test'
import {
  env,
  login,
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

test.describe('GAM role|game view', () => {
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

  // Drop every GAM Account Role Game binding referencing an e2e-prefixed
  // account BEFORE the account cleanup (Frappe Link integrity otherwise blocks
  // the account delete and orphans the bindings).
  async function purgeBindingsForE2eAccounts(page) {
    const accounts = await listFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])
    for (const acc of accounts) {
      await cleanupFixtures(page, 'GAM Account Role Game', [['account', '=', acc.name]])
    }
  }

  // Seed a game + a TRADER account + a first-class (role, game) binding so the
  // /role/TRADER/game/<game> view has an account to render. Mirrors the seed in
  // gam-admin-nav-roles.spec.js.
  async function seedTraderWithGame(page) {
    await purgeBindingsForE2eAccounts(page)
    await cleanupFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])
    await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])

    const game = await createFixture(page, 'GAM Game', { game_name: e2eName('game'), is_active: 1 })
    const emails = await listFixtures(page, 'GAM Email', [['is_active', '=', 1]], ['name'])
    test.skip(!emails.length, 'no active GAM Email to link — run gam.setup.seed_demo')

    // Include `account_password` so that if this fixture ever leaks into the
    // shared list, the gam-smoke reveal step won't trip on "Password not found".
    const account = await createFixture(page, 'GAM Account', {
      platform: 'STEAM',
      username: e2eName('acc'),
      email: emails[0].name,
      status: 'ACTIVE',
      account_password: 'e2e-trader-pass',
    })
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

  test('admin — operate card shows Checkin CTA, no Sửa/Xoá CRUD', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    const { game, account, binding } = await seedTraderWithGame(page)

    try {
      await page.goto(`${env.base}/role/TRADER/game/${encodeURIComponent(game.name)}`)
      await waitForHeading(page, game.game_name)

      // Task-oriented: a Checkin CTA is rendered on the account card.
      await expect(page.locator('main').getByRole('button', { name: /Checkin/ })).toBeVisible({ timeout: 10000 })
      // Admin CRUD chrome is intentionally absent here (it lives on /accounts).
      await expect(page.locator('main').getByRole('button', { name: /^Sửa$/ })).toHaveCount(0)
      await expect(page.locator('main').getByRole('button', { name: /^Xoá$/ })).toHaveCount(0)
      // The seeded account is present in the scoped list.
      await expect(page.getByText(account.username, { exact: true })).toBeVisible({ timeout: 10000 })
    } finally {
      await teardownTraderWithGame(page, game, account, binding)
    }
  })

  test('admin — back-compat redirect from /accounts?role=...(&game=...)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    const { game, account, binding } = await seedTraderWithGame(page)

    try {
      // role-only → /role/TRADER
      await page.goto(`${env.base}/accounts?role=TRADER`)
      await expect(page).toHaveURL(/\/role\/TRADER$/)

      // role+game → /role/TRADER/game/<game>
      await page.goto(`${env.base}/accounts?role=TRADER&game=${encodeURIComponent(game.name)}`)
      await expect(page).toHaveURL(/\/role\/TRADER\/game\//)
    } finally {
      await teardownTraderWithGame(page, game, account, binding)
    }
  })

  test('member without the role|game grant is bounced to NotFound', async ({ page }) => {
    // The default gam-member has no ROLE_GAME grants and its Frappe role does
    // not match "Trader", so the /role guard denies access → NotFound view.
    await login(page, { user: env.memberUser, pass: env.memberPass })
    await page.goto(`${env.base}/role/TRADER`)
    await expect(
      page.getByRole('heading', { level: 1, name: /Trang không tồn tại/ }),
    ).toBeVisible({ timeout: 15000 })
  })
})
