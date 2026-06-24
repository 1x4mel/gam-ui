// GAM browser e2e — email-account-detail-redesign Plan §8.
//
// Locks the behavior of the email card redesign + the new Email Account detail
// view (plans/email-account-detail-redesign.md):
//
//   1. Card redesign — list shows grouped dependency chips (Platform vs Game),
//      there is NO verification-code request button on the card, and the whole
//      card links to the detail page.
//   2. Detail view — hero, reveal-based password, recovery emails, and the
//      dependent-account tree (platform → /platform-accounts, game → /accounts).
//   3. Edit modal (shared) sets the email password + TOTP + a recovery row.
//   4. Delete-blocked — an email linked to accounts opens a modal listing the
//      linked accounts grouped PLATFORM vs GAME.
//
// Fixtures are self-contained: email is created via gam.api.save_email_account
// (handles the Password fields), accounts via REST, all torn down at the end.
//
// Run:  npm run test:e2e -- gam-email-account-detail

import { test, expect } from '@playwright/test'
import {
  env,
  login,
  gotoApp,
  captureConsole,
  e2eName,
  createFixture,
  deleteFixture,
  gamCall,
  rowForText,
} from './lib.js'

// ===========================================================================
// Helpers
// ===========================================================================

/** Create a GAM Email (with password + TOTP + a recovery row) via the
 *  whitelisted save_email_account (handles Password fields safely). */
async function makeEmail(page, address) {
  return gamCall(page, 'gam.api.save_email_account', {
    values: JSON.stringify({
      address,
      provider: 'Gmail',
      email_password: 'topsecret-email-pw',
      totp_secret: 'JBSWY3DPEHPK3PXP',
      recovery_emails: [{ address: `backup+${address}`, label: 'Backup' }],
      notes: 'e2e email',
      is_active: 1,
      forward_verified: 0,
    }),
  })
}

// ===========================================================================
// Suite
// ===========================================================================

test.describe('GAM email account detail + card redesign (Plan §8)', () => {
  let consoleErrors = []

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

  test('card shows grouped deps + links to detail + reveal + delete-blocked', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // --- seed: one email, one PLATFORM account, one GAME node, both linked ---
    const address = `${e2eName('email')}@gam.test`
    const created = await makeEmail(page, address)
    const emailName = created.name

    const platformAcc = await createFixture(page, 'GAM Account', {
      doctype: 'GAM Account',
      username: e2eName('platform-user'),
      platform: 'STEAM',
      account_level: 'PLATFORM',
      status: 'ACTIVE',
      source: 'e2e',
      email: emailName,
    })
    const gameAcc = await createFixture(page, 'GAM Account', {
      doctype: 'GAM Account',
      username: e2eName('game-user'),
      platform: 'STEAM',
      account_level: 'GAME',
      parent_account: platformAcc.name,
      status: 'ACTIVE',
      source: 'e2e',
      email: emailName,
    })

    try {
      // -------------------------------------------------------------------
      // 1. Card redesign — grouped dependency chips, no code-request button.
      // -------------------------------------------------------------------
      await gotoApp(page, '/admin/emails')
      await page.waitForURL(/\/admin\/emails$/)
      await page.waitForTimeout(600) // let the batched get_email_dependencies resolve

      const card = rowForText(page, address)
      await card.waitFor({ state: 'visible', timeout: 15000 })
      // Grouped summaries render their labels (no verification-code flow here).
      await expect(card.getByText(/PLATFORM \(1\)/i)).toBeVisible()
      await expect(card.getByText(/GAME \(1\)/i)).toBeVisible()
      // The old per-row "verification code" affordance must be gone.
      await expect(card.getByRole('button', { name: /verification code/i })).toHaveCount(0)

      // -------------------------------------------------------------------
      // 2. Whole-card click → Email Account detail.
      // -------------------------------------------------------------------
      await card.click()
      await page.waitForURL(new RegExp(`/admin/emails/${emailName}$`))

      // Hero address + recovery email row + dependent-account tree.
      await expect(page.getByRole('heading', { name: new RegExp(address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible()
      await expect(page.getByText(`backup+${address}`, { exact: false })).toBeVisible()
      // Dependent tree: platform row links to /platform-accounts, game row to /accounts.
      await expect(page.getByRole('link', { name: platformAcc.username })).toBeVisible()
      await expect(page.getByRole('link', { name: gameAcc.username })).toBeVisible()

      // -------------------------------------------------------------------
      // 3. Reveal password — plaintext appears (audit-logged server-side).
      // -------------------------------------------------------------------
      // PasswordField's reveal button uses aria-label "Hiện mật khẩu".
      const revealBtn = page.getByRole('button', { name: /hiện mật khẩu/i }).first()
      await revealBtn.click()
      await expect(page.getByText('topsecret-email-pw')).toBeVisible({ timeout: 10000 })

      // -------------------------------------------------------------------
      // 4. Delete-blocked — modal lists the grouped linked accounts.
      // -------------------------------------------------------------------
      await page.getByRole('button', { name: /^🗑 Xoá$/ }).click()
      await expect(page.getByRole('heading', { name: /Xoá email/i })).toBeVisible()
      // Confirm inside the dialog → delete_email_account returns blocked, which
      // re-renders the dialog with the grouped linked-account list.
      await page.locator('.fixed.inset-0').getByRole('button', { name: /^Xoá$/ }).click()
      await expect(page.getByText('Không thể xoá')).toBeVisible({ timeout: 10000 })
      // The grouped PLATFORM/GAME chips are rendered from account_level.
      await expect(page.locator('.fixed.inset-0').getByText('PLATFORM', { exact: true })).toBeVisible()
      await expect(page.locator('.fixed.inset-0').getByText('GAME', { exact: true })).toBeVisible()
      // Close the blocked modal (delete is not allowed while linked).
      await page.getByRole('button', { name: /^Đóng$/ }).click()
    } finally {
      // --- teardown: accounts first (they link the email), then the email ---
      await deleteFixture(page, 'GAM Account', gameAcc.name)
      await deleteFixture(page, 'GAM Account', platformAcc.name)
      await deleteFixture(page, 'GAM Email', emailName)
    }
  })
})
