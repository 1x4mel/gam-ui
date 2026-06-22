// GAM browser e2e — admin Role/Game CRUD + sidebar role-section binding + member visibility.
//
// Covers the four flows requested:
//   1. Admin Settings: create/delete Account Roles (TRADER_ITEM, TRADER_CURRENCY,
//      plus delete+restore of the seeded TRADER role).
//   2. Admin Settings: create/delete Games (Diablo 4, PoE 1, PoE 2).
//   3. Admin binds an account to (TRADER_ITEM, Diablo 4) → sidebar renders a
//      "Trader Item" section with a "Diablo 4" game link → clicking it opens
//      /role/TRADER_ITEM/game/<game> scoped to that account only.
//   4. Member visibility:
//        4a. AccessGrant ROLE_GAME|TRADER_ITEM|<game> → member sees the section
//            + game and can open the scoped list (and NOT other sections).
//        4b. match_role fallback → a dedicated user holding the Frappe Role
//            "Trader Item" (zero grants) sees the section + game too.
//        4c. Member with no grant and no matching role → no section + direct
//            nav to /role/TRADER_ITEM/game/<game> → NotFound.
//
// Fixtures are self-contained (seeded + torn down through the SPA's own session
// via REST helpers in lib.js). Order-aware teardown: binding → account → game
// so Frappe Link integrity never blocks the delete.
//
// Run:  npm run test:e2e -- gam-admin-role-game-sidebar

import { test, expect } from '@playwright/test'
import {
  env,
  login,
  logout,
  clickNav,
  gotoApp,
  waitForHeading,
  captureConsole,
  e2eName,
  E2E_PREFIX,
  createFixture,
  deleteFixture,
  cleanupFixtures,
  listFixtures,
  gamCall,
  expectToast,
  waitToastCleared,
  rowForText,
} from './lib.js'

// ===========================================================================
// Constants — the role + game this suite exercises end-to-end.
// ===========================================================================

const TRADER_ITEM_LABEL = 'Trader Item'
const TRADER_ITEM_VALUE = 'TRADER_ITEM'
const TRADER_CURR_LABEL = 'Trader Currency'
const TRADER_CURR_VALUE = 'TRADER_CURRENCY'

let consoleErrors = []

// ===========================================================================
// Shared helpers
// ===========================================================================

/** Best-effort sweep of every e2e-prefixed Account Role option. */
async function cleanupRoleOptions(page) {
  const rows = await listFixtures(
    page,
    'GAM List Option',
    [['category', '=', 'Account Role'], ['label', 'like', `${E2E_PREFIX}%`]],
    ['name'],
  ).catch(() => [])
  for (const r of rows) await deleteFixture(page, 'GAM List Option', r.name)
}

/**
 * Ensure an Account Role GAM List Option exists (idempotent). Mirrors the
 * backend behaviour: saving an Account Role also creates a Frappe Role named
 * after the label, so admins / dedicated test users can hold it.
 * Returns {name, label, value} or null.
 */
async function ensureRoleOption(page, label, value) {
  const existing = await listFixtures(
    page,
    'GAM List Option',
    [['category', '=', 'Account Role'], ['value', '=', value]],
    ['name', 'label', 'value'],
  )
  if (existing.length) return existing[0]
  await gamCall(page, 'gam.api.save_list_option', {
    values: JSON.stringify({
      category: 'Account Role',
      label,
      value,
      icon: '📦',
      color: 'amber',
      sort_order: 0,
      is_active: 1,
    }),
  })
  const created = await listFixtures(
    page,
    'GAM List Option',
    [['category', '=', 'Account Role'], ['value', '=', value]],
    ['name', 'label', 'value'],
  )
  return created[0] || null
}

/** Delete every GAM Account Role Game binding referencing an e2e account.
 *  Must run BEFORE the account cleanup (Link integrity). */
async function purgeBindingsForE2eAccounts(page) {
  const accounts = await listFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])
  for (const acc of accounts) {
    await cleanupFixtures(page, 'GAM Account Role Game', [['account', '=', acc.name]])
  }
}

/**
 * Seed the full TRADER_ITEM × game chain used by tests §3 / §4.
 *   • game   : GAM Game "e2e-Diablo 4"
 *   • account: GAM Account (STEAM)
 *   • binding: GAM Account Role Game (account, TRADER_ITEM, game, is_main=1)
 * Order-aware teardown returned to the caller.
 */
async function seedTraderItemWithGame(page, { roleValue = TRADER_ITEM_VALUE, gameName = 'e2e-Diablo 4' } = {}) {
  await purgeBindingsForE2eAccounts(page)
  await cleanupFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])
  await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])

  await ensureRoleOption(page, TRADER_ITEM_LABEL, TRADER_ITEM_VALUE)

  const game = await createFixture(page, 'GAM Game', { game_name: gameName, is_active: 1 })
  const emails = await listFixtures(page, 'GAM Email', [['is_active', '=', 1]], ['name'])
  test.skip(!emails.length, 'no active GAM Email to link — run gam.setup.seed_demo')

  const account = await createFixture(page, 'GAM Account', {
    platform: 'STEAM',
    username: e2eName('acc'),
    email: emails[0].name,
    status: 'ACTIVE',
    account_password: 'e2e-trader-item-pass',
  })
  const binding = await createFixture(page, 'GAM Account Role Game', {
    account: account.name,
    role: roleValue,
    game: game.name,
    is_main: 1,
  })
  return { game, account, binding }
}

/** Teardown in Link-integrity-safe order: binding → account → game → role option.
 *  Also sweeps the TRADER_ITEM role option created by ensureRoleOption so it
 *  doesn't leak into other spec files (e.g. gam-admin-nav-roles). */
async function teardownTraderItemWithGame(page, { game, account, binding } = {}) {
  if (binding) await deleteFixture(page, 'GAM Account Role Game', binding.name)
  if (account) await deleteFixture(page, 'GAM Account', account.name)
  if (game) await deleteFixture(page, 'GAM Game', game.name)
  // Remove the TRADER_ITEM role option created by ensureRoleOption (not a seed).
  for (const v of [TRADER_ITEM_VALUE, TRADER_CURR_VALUE]) {
    const rows = await listFixtures(page, 'GAM List Option', [['category', '=', 'Account Role'], ['value', '=', v]], ['name']).catch(() => [])
    for (const r of rows) await deleteFixture(page, 'GAM List Option', r.name)
  }
}

/** Open the GamesView "Game & DLC" tab strip and pick a tab by visible label. */
async function openGamesTab(page, tabLabel) {
  await clickNav(page, 'Game & DLC')
  await waitForHeading(page, 'Game & DLC')
  const tabStrip = page.locator('.flex.items-center.gap-1.border-b')
  await tabStrip.getByRole('button').filter({ hasText: tabLabel }).click()
}

// ===========================================================================
// Suite
// ===========================================================================

test.describe('GAM admin role/game/sidebar binding e2e', () => {
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

  // ------------------------------------------------------------------------
  // §1.1 — Create TWO new Account Roles: Trader Item + Trader Currency.
  // ------------------------------------------------------------------------
  test('§1.1 admin — create Account Roles "Trader Item" + "Trader Currency"', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    // Sweep any leftover from a previous interrupted run (scoped to the two
    // role VALUES we own — never the seeded ones).
    for (const v of [TRADER_ITEM_VALUE, TRADER_CURR_VALUE]) {
      const rows = await listFixtures(page, 'GAM List Option', [['category', '=', 'Account Role'], ['value', '=', v]], ['name'])
      for (const r of rows) await deleteFixture(page, 'GAM List Option', r.name)
    }

    try {
      await openGamesTab(page, 'Role')

      const rolePairs = [[TRADER_ITEM_LABEL, TRADER_ITEM_VALUE], [TRADER_CURR_LABEL, TRADER_CURR_VALUE]]
      for (const [i, [label, value]] of rolePairs.entries()) {
        if (i > 0) await waitToastCleared(page, 'Đã lưu')
        await test.step(`create ${label}`, async () => {
          await page.getByRole('button', { name: /^\+ Thêm$/ }).click()
          await expect(page.getByRole('heading', { name: new RegExp(`Thêm ${'Account Role'}`) })).toBeVisible()
          const modal = page.locator('.fixed.inset-0')
          await modal.getByPlaceholder('Steam', { exact: true }).fill(label)
          await page.getByRole('button', { name: 'Lưu', exact: true }).click()
          await expectToast(page, 'Đã lưu')

          // The option card renders the auto-derived value next to the label.
          const card = page.locator('.rounded-2xl').filter({ hasText: label }).first()
          await expect(card).toBeVisible({ timeout: 10_000 })
          await expect(card.getByText(`(${value})`, { exact: true })).toBeVisible()
        })
      }

      // Server-side confirmation: both options persisted with the right value.
      await expect.poll(async () => {
        const rows = await listFixtures(page, 'GAM List Option', [['category', '=', 'Account Role'], ['value', 'in', [TRADER_ITEM_VALUE, TRADER_CURR_VALUE]]], ['value'])
        return rows.map((r) => r.value).sort()
      }).toEqual([TRADER_CURR_VALUE, TRADER_ITEM_VALUE].sort())
    } finally {
      // Belt-and-suspenders cleanup (the spec owns these two values).
      for (const v of [TRADER_ITEM_VALUE, TRADER_CURR_VALUE]) {
        const rows = await listFixtures(page, 'GAM List Option', [['category', '=', 'Account Role'], ['value', '=', v]], ['name'])
        for (const r of rows) await deleteFixture(page, 'GAM List Option', r.name)
      }
    }
  })

  // ------------------------------------------------------------------------
  // §1.2 — Delete the SEEDED "Trader" role then restore it (capture/restore).
  //        Skipped while any real (non-e2e) account binding still uses TRADER.
  // ------------------------------------------------------------------------
  test('§1.2 admin — delete seeded TRADER role then restore', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // Guard: never delete the seed role while real data depends on it.
    const trBindings = await listFixtures(page, 'GAM Account Role Game', [['role', '=', 'TRADER']], ['name', 'account'])
    const realUsage = trBindings.filter((b) => !(b.account || '').startsWith(E2E_PREFIX))
    test.skip(realUsage.length > 0, 'seeded TRADER role is referenced by real accounts — skipping delete test')

    // Capture the exact seed row so the restore is byte-identical.
    const seedRows = await listFixtures(
      page,
      'GAM List Option',
      [['category', '=', 'Account Role'], ['value', '=', 'TRADER']],
      ['name', 'label', 'value', 'icon', 'color', 'sort_order', 'is_active'],
    )
    const seed = seedRows[0]
    test.skip(!seed, 'TRADER seed role not found — re-run gam.setup.seed_demo / patches')

    try {
      await openGamesTab(page, 'Role')

      await test.step('delete the Trader role card', async () => {
        const card = page.locator('.rounded-2xl').filter({ hasText: 'Trader' }).filter({ hasText: '(TRADER)' }).first()
        await card.getByRole('button', { name: 'Xoá', exact: true }).click()
        await page.locator('.fixed.inset-0').getByRole('button', { name: 'Xoá', exact: true }).click()
        await expectToast(page, 'Đã xoá')
      })

      // Card gone from the UI …
      await expect(page.locator('.rounded-2xl').filter({ hasText: '(TRADER)' })).toHaveCount(0, { timeout: 10_000 })
      // … and from the server.
      await expect.poll(async () => {
        const rows = await listFixtures(page, 'GAM List Option', [['category', '=', 'Account Role'], ['value', '=', 'TRADER']], ['name'])
        return rows.length
      }).toBe(0)
    } finally {
      // Restore the byte-identical option (save_list_option is idempotent upsert).
      await gamCall(page, 'gam.api.save_list_option', {
        values: JSON.stringify({
          category: 'Account Role',
          label: seed.label,
          value: seed.value,
          icon: seed.icon || '',
          color: seed.color || '',
          sort_order: seed.sort_order || 0,
          is_active: 1,
        }),
      }).catch((e) => console.log('restore TRADER role failed:', e.message))
    }
  })

  // ------------------------------------------------------------------------
  // §2.1 — Create THREE games: Diablo 4, Path of Exile 1, Path of Exile 2.
  // ------------------------------------------------------------------------
  test('§2.1 admin — create Games Diablo 4 / PoE 1 / PoE 2', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await purgeBindingsForE2eAccounts(page)
    await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])

    const games = [
      { name: 'e2e-Diablo 4', publisher: 'Blizzard' },
      { name: 'e2e-Path of Exile 1', publisher: 'Grinding Gear Games' },
      { name: 'e2e-Path of Exile 2', publisher: 'Grinding Gear Games' },
    ]

    try {
      await openGamesTab(page, 'Game')

      for (const [i, g] of games.entries()) {
        // Toasts stack; clear the previous one before triggering the next so
        // expectToast doesn't hit a strict-mode violation (two visible toasts).
        if (i > 0) await waitToastCleared(page, 'Đã tạo')
        await test.step(`create ${g.name}`, async () => {
          await page.getByRole('button', { name: /^\+ Thêm Game$/ }).click()
          const modal = page.locator('.fixed.inset-0')
          await modal.getByPlaceholder('Diablo 4').fill(g.name)
          await modal.getByPlaceholder('Blizzard').fill(g.publisher)
          await page.getByRole('button', { name: 'Lưu', exact: true }).click()
          await expectToast(page, 'Đã tạo')
          // The game card renders the game_name as a bold row title.
          await expect(page.locator('.rounded-2xl').filter({ hasText: g.name })).toBeVisible({ timeout: 10_000 })
        })
      }

      // Server-side: all three persisted.
      await expect.poll(async () => {
        const rows = await listFixtures(page, 'GAM Game', [['game_name', 'in', games.map((g) => g.name)]], ['game_name'])
        return rows.length
      }).toBe(games.length)
    } finally {
      await purgeBindingsForE2eAccounts(page)
      await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])
    }
  })

  // ------------------------------------------------------------------------
  // §2.2 — Delete a game through the UI; the card disappears.
  // ------------------------------------------------------------------------
  test('§2.2 admin — delete a Game (card disappears)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await cleanupFixtures(page, 'GAM Game', [['game_name', 'like', `${E2E_PREFIX}%`]])

    const name = e2eName('game')
    await createFixture(page, 'GAM Game', { game_name: name, is_active: 1 })

    try {
      await openGamesTab(page, 'Game')
      const card = page.locator('.rounded-2xl').filter({ hasText: name }).first()
      await expect(card).toBeVisible({ timeout: 10_000 })

      await card.getByRole('button', { name: 'Xoá', exact: true }).click()
      await page.locator('.fixed.inset-0').getByRole('button', { name: 'Xoá', exact: true }).click()
      await expectToast(page, 'Đã xoá')

      await expect(page.locator('.rounded-2xl').filter({ hasText: name })).toHaveCount(0, { timeout: 10_000 })
      await expect.poll(async () => {
        const rows = await listFixtures(page, 'GAM Game', [['game_name', '=', name]], ['name'])
        return rows.length
      }).toBe(0)
    } finally {
      await cleanupFixtures(page, 'GAM Game', [['game_name', '=', name]])
    }
  })

  // ------------------------------------------------------------------------
  // §3 — Admin binds account → (TRADER_ITEM, Diablo 4) → sidebar section +
  //      scoped list, including a negative account (different game).
  // ------------------------------------------------------------------------
  test('§3 admin — bind (TRADER_ITEM, Diablo 4) → sidebar section + scoped list', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const seeded = await seedTraderItemWithGame(page)
    // A second account bound to TRADER_ITEM but a DIFFERENT game, to prove the
    // scoped view filters by game (not just by role).
    const otherGame = await createFixture(page, 'GAM Game', { game_name: 'e2e-Other Game', is_active: 1 })
    const emails = await listFixtures(page, 'GAM Email', [['is_active', '=', 1]], ['name'])
    const otherAccount = await createFixture(page, 'GAM Account', {
      platform: 'STEAM',
      username: e2eName('acc2'),
      email: emails[0].name,
      status: 'ACTIVE',
      account_password: 'e2e-other-pass',
    })
    const otherBinding = await createFixture(page, 'GAM Account Role Game', {
      account: otherAccount.name,
      role: TRADER_ITEM_VALUE,
      game: otherGame.name,
      is_main: 1,
    })

    try {
      await page.goto(`${env.base}/`)
      await waitForHeading(page, 'Dashboard')

      const aside = page.locator('aside').first()

      await test.step('sidebar shows the Trader Item section + Diablo 4 link', async () => {
        await expect(aside.getByText(/📂 Trader Item/)).toBeVisible({ timeout: 10_000 })
        await expect(aside.getByRole('link', { name: new RegExp(seeded.game.game_name) })).toBeVisible()
      })

      await test.step('clicking the game link opens the scoped list', async () => {
        await aside.getByRole('link', { name: new RegExp(seeded.game.game_name) }).click()
        await expect(page).toHaveURL(/\/role\/TRADER_ITEM\/game\//)
        await waitForHeading(page, seeded.game.game_name)
        // The bound account is in the scoped results.
        await expect(page.getByText(seeded.account.username, { exact: true })).toBeVisible({ timeout: 10_000 })
      })

      await test.step('a TRADER_ITEM account on a different game is NOT in this list', async () => {
        await expect(page.getByText(otherAccount.username, { exact: true })).toHaveCount(0)
      })
    } finally {
      await deleteFixture(page, 'GAM Account Role Game', otherBinding.name)
      await deleteFixture(page, 'GAM Account', otherAccount.name)
      await deleteFixture(page, 'GAM Game', otherGame.name)
      await teardownTraderItemWithGame(page, seeded)
    }
  })

  // ------------------------------------------------------------------------
  // §4a — Member WITH an AccessGrant ROLE_GAME|TRADER_ITEM|<game> sees the
  //       section + game; other sections stay hidden.
  // ------------------------------------------------------------------------
  test('§4a member — AccessGrant ROLE_GAME|TRADER_ITEM|Diablo4 → sees section + scoped list', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    const seeded = await seedTraderItemWithGame(page)

    // The default gam-member has ZERO grants (match_role policy). We only need
    // to wipe the grant we add here in teardown to restore that default — no
    // capture needed (and get_access_grants currently trips a MariaDB `key`
    // reserved-word bug, so we avoid it).
    try {
      await test.step('grant ROLE_GAME|TRADER_ITEM|<game> to the member via /admin/access', async () => {
        await gotoApp(page, '/admin/access')
        await waitForHeading(page, 'Phân quyền truy cập')

        // Pick the member in the user picker.
        await page.locator('input[placeholder="Tìm theo tên / email..."]').fill(env.memberUser)
        await page.getByRole('button', { name: env.memberUser }).first().click()

        // Wait for the role-group matrix to render the Trader Item group.
        const group = page.locator('.rounded-xl.border').filter({ hasText: TRADER_ITEM_LABEL }).first()
        await expect(group).toBeVisible({ timeout: 10_000 })

        // The game row label is "Trader Item · <game_name>" → gameShort() keeps
        // the game half, so the rendered checkbox row text is the game_name.
        const row = group.locator('label').filter({ hasText: seeded.game.game_name }).first()
        await row.locator('input[type="checkbox"]').click()

        await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
        await expectToast(page, 'Đã lưu phân quyền')
      })

      await test.step('member logs in and sees the section + game', async () => {
        await logout(page)
        await login(page, { user: env.memberUser, pass: env.memberPass })
        await page.goto(`${env.base}/`)
        await waitForHeading(page, 'Dashboard')

        const aside = page.locator('aside').first()
        await expect(aside.getByText(/📂 Trader Item/)).toBeVisible({ timeout: 10_000 })
        await expect(aside.getByRole('link', { name: new RegExp(seeded.game.game_name) })).toBeVisible()

        // The granted game link opens the scoped list and shows the account.
        await aside.getByRole('link', { name: new RegExp(seeded.game.game_name) }).click()
        await expect(page).toHaveURL(/\/role\/TRADER_ITEM\/game\//)
        await waitForHeading(page, seeded.game.game_name)
        await expect(page.getByText(seeded.account.username, { exact: true })).toBeVisible({ timeout: 10_000 })
      })

      await test.step('non-granted sections stay hidden', async () => {
        const aside = page.locator('aside').first()
        // The section header renders as "📂 <label>", so use a regex anchored
        // on the emoji + label. "📂 Trader(?! Item)" matches the bare Trader
        // header but NOT "📂 Trader Item" (negative lookahead).
        await expect(aside.getByText(/📂 Trader(?! Item)/)).toHaveCount(0)
        await expect(aside.getByText(/📂 Booster/)).toHaveCount(0)
      })
    } finally {
      // Restore the member's default (zero grants): wipe everything we set.
      // Must re-login as admin because the member session can't manage grants.
      try { await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp }) } catch {}
      await gamCall(page, 'gam.api.save_access_grants', {
        user: env.memberUser,
        app: 'GAM',
        grants: [],
      }).catch((e) => console.log('revert member grants failed:', e.message))
      await teardownTraderItemWithGame(page, seeded)
    }
  })

  // ------------------------------------------------------------------------
  // §4b — match_role fallback: a dedicated user holding the Frappe Role
  //       "Trader Item" (zero grants) sees the section + game.
  //       Provisioned by scripts/provision-trader-item-user.mjs (bench execute).
  // ------------------------------------------------------------------------
  test('§4b member — Frappe Role "Trader Item" (match_role fallback) → sees section + scoped list', async ({ page }) => {
    const tiUser = process.env.GAM_TI_USER || 'gam-trader-item@test.local'
    const tiPass = process.env.GAM_TI_PASS || 'GAM@test-2026'

    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    const seeded = await seedTraderItemWithGame(page)

    try {
      // Login as the dedicated match_role user (zero grants → fallback kicks in).
      await logout(page)
      await login(page, { user: tiUser, pass: tiPass })
      await page.goto(`${env.base}/`)
      await waitForHeading(page, 'Dashboard')

      const aside = page.locator('aside').first()
      await expect(aside.getByText(/📂 Trader Item/)).toBeVisible({ timeout: 10_000 })
      await expect(aside.getByRole('link', { name: new RegExp(seeded.game.game_name) })).toBeVisible()

      await aside.getByRole('link', { name: new RegExp(seeded.game.game_name) }).click()
      await expect(page).toHaveURL(/\/role\/TRADER_ITEM\/game\//)
      await waitForHeading(page, seeded.game.game_name)
      await expect(page.getByText(seeded.account.username, { exact: true })).toBeVisible({ timeout: 10_000 })
    } finally {
      await teardownTraderItemWithGame(page, seeded)
    }
  })

  // ------------------------------------------------------------------------
  // §4c — Default gam-member (zero grants, no matching Frappe role) sees NO
  //       Trader Item section and is bounced to NotFound on direct nav.
  // ------------------------------------------------------------------------
  test('§4c member — no grant + no matching role → no section + /role → NotFound', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    const seeded = await seedTraderItemWithGame(page)

    try {
      await logout(page)
      await login(page, { user: env.memberUser, pass: env.memberPass })
      await page.goto(`${env.base}/`)
      await waitForHeading(page, 'Dashboard')

      const aside = page.locator('aside').first()
      await expect(aside.getByText(/📂 Trader Item/)).toHaveCount(0)
      await expect(aside.getByRole('link', { name: new RegExp(seeded.game.game_name) })).toHaveCount(0)

      // Direct nav to the scoped view is denied by the router guard.
      await page.goto(`${env.base}/role/${TRADER_ITEM_VALUE}/game/${encodeURIComponent(seeded.game.name)}`)
      await expect(
        page.getByRole('heading', { level: 1, name: /Trang không tồn tại/ }),
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await teardownTraderItemWithGame(page, seeded)
    }
  })
})
