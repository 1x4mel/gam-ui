// GAM browser e2e — accounts-email-redesign Plan §7.
//
// Locks the behavior of the four pieces delivered under
// `plans/accounts-email-redesign.md` that previously had no dedicated spec:
//
//   1. Configurable list Settings (GamesView Platform/Role/Status tabs) —
//      create + delete a custom option through the SPA.
//   2. Custom platform drives account creation — a Platform list option added
//      by the admin is immediately pickable in the AccountFormModal chips, and
//      the stored value round-trips (platform→code_platform stays data-driven).
//   3. Email delete guard — an email linked to a GAM Account is *blocked* from
//      deletion (modal lists the linked accounts); once unlinked it deletes.
//   4. Unrecognized-email Ignore ("Bỏ qua") — dismisses the sender from the
//      panel and flips the inbound log `ignored` flag.
//
// Fixtures are self-contained: list-options / accounts / emails are seeded +
// torn down through the SPA's own session (REST + gamCall helpers in lib.js);
// the inbound log is provisioned via `bench console %run` because GAM Admin
// has create=0 on `GAM Email Inbound Log` (same precedent as
// gam-email-content.spec.js).
//
// Run:  npm run test:e2e -- gam-admin-listoptions

import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import {
  env,
  login,
  clickNav,
  waitForHeading,
  captureConsole,
  e2eName,
  E2E_PREFIX,
  deleteFixture,
  cleanupFixtures,
  listFixtures,
  expectToast,
  gamCall,
  rowForText,
} from './lib.js'

const BENCH_DIR = process.env.GAM_BENCH_DIR || '/home/frappe/frappe-bench'

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Resolve a GAM List Option `name` from its stored `value` + `category`.
 * Used so a test can clean up an option it created via REST (create does not
 * always return the doctype name through every code path).
 */
async function findListOptionName(page, category, value) {
  const rows = await listFixtures(
    page,
    'GAM List Option',
    [['category', '=', category], ['value', '=', value]],
    ['name', 'value'],
  )
  return rows[0]?.name || ''
}

/** Best-effort sweep of every e2e-prefixed list option, across categories. */
async function cleanupListOptions(page, labelLike) {
  const rows = await listFixtures(page, 'GAM List Option', [['label', 'like', labelLike]], ['name'])
  for (const r of rows) await deleteFixture(page, 'GAM List Option', r.name)
}

// ===========================================================================
// Suite
// ===========================================================================

test.describe('GAM configurable lists + email delete/ignore (Plan §7)', () => {
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

  // --------------------------------------------------------------------------
  // 1. Settings CRUD — custom Platform create + delete through the UI.
  // --------------------------------------------------------------------------
  test('settings — custom Platform create + delete (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await cleanupListOptions(page, `${E2E_PREFIX}%`)

    const label = e2eName('platform')
    const expectedValue = label.replace(/-/g, '_').toUpperCase() // UPPER_SNAKE auto-derive

    await clickNav(page, 'Game & DLC')
    await waitForHeading(page, 'Game & DLC')

    const tabStrip = page.locator('.flex.items-center.gap-1.border-b')

    await test.step('open the Platform tab and add a custom option', async () => {
      await tabStrip.getByRole('button').filter({ hasText: 'Platform' }).click()
      // The configurable-list section's only "+ Thêm" button is the inline create.
      await page.getByRole('button', { name: /^\+ Thêm$/ }).click()
      await expect(page.getByRole('heading', { name: /Thêm Platform/ })).toBeVisible()
      // Two inputs share a case-insensitive "Steam" placeholder (the label
      // field "Steam" + the auto-derived value preview "STEAM"), so scope to
      // the modal + match case-sensitively to target the label field only.
      const modal = page.locator('.fixed.inset-0')
      await modal.getByPlaceholder('Steam', { exact: true }).fill(label)
      // code_platform defaults to STEAM — pick POE to prove the mapping is
      // data-driven (not the default), then pick an icon for easy row matching.
      await modal.locator('select').selectOption('POE')
      await modal.getByPlaceholder('🎮').fill('👾')
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expectToast(page, 'Đã lưu')
    })

    // The option's `label` is rendered as a bare text node right next to the
    // `(value)` span, so the two collapse into a single text block — there is
    // no element whose text is exactly `label`. The label is unique per run,
    // so match the card by `hasText` instead of `getByText(exact)`.
    const optionCard = () => page.locator('.rounded-2xl').filter({ hasText: label }).first()

    await test.step('the new option renders with its auto-derived value + code-platform', async () => {
      const row = optionCard()
      await expect(row).toBeVisible({ timeout: 10_000 })
      await expect(row.getByText(`(${expectedValue})`, { exact: true })).toBeVisible()
      await expect(row.getByText(/code-platform:/)).toBeVisible()
      await expect(row.getByText('POE', { exact: true })).toBeVisible()
    })

    await test.step('delete the option — row disappears', async () => {
      const row = optionCard()
      await row.getByRole('button', { name: 'Xoá', exact: true }).click()
      // ConfirmDialog overlay
      await page.locator('.fixed.inset-0').getByRole('button', { name: 'Xoá', exact: true }).click()
      await expectToast(page, 'Đã xoá')
      await expect(optionCard()).toHaveCount(0, { timeout: 10_000 })
    })

    // Belt-and-suspenders: nothing should remain, but purge defensively.
    const name = await findListOptionName(page, 'Platform', expectedValue)
    await deleteFixture(page, 'GAM List Option', name)
  })

  // --------------------------------------------------------------------------
  // 2. Custom platform + custom role → account creation round-trips the value.
  // --------------------------------------------------------------------------
  test('account — custom platform + role from configurable lists (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const username = e2eName('acc')
    await cleanupFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])
    await cleanupListOptions(page, `${E2E_PREFIX}%`)

    const emails = await listFixtures(page, 'GAM Email', [['is_active', '=', 1]], ['name', 'address'])
    test.skip(!emails.length, 'no active GAM Email to link — run gam.setup.seed_demo')

    // Seed a custom Platform + a custom Role via the SPA session (admin).
    const platformLabel = e2eName('platform')
    const platformValue = platformLabel.replace(/-/g, '_').toUpperCase()
    const roleLabel = e2eName('role')
    const roleValue = roleLabel.replace(/-/g, '_').toUpperCase()
    await gamCall(page, 'gam.api.save_list_option', {
      values: JSON.stringify({
        category: 'Platform', label: platformLabel, value: platformValue,
        code_platform: 'OTHER', icon: '👾', color: 'orange', sort_order: 0, is_active: 1,
      }),
    })
    await gamCall(page, 'gam.api.save_list_option', {
      values: JSON.stringify({
        category: 'Account Role', label: roleLabel, value: roleValue,
        code_platform: '', icon: '🌟', color: 'amber', sort_order: 0, is_active: 1,
      }),
    })

    await test.step('create an account on the custom platform + game row role', async () => {
      await clickNav(page, 'Tài khoản')
      await waitForHeading(page, 'Tài khoản')
      await page.getByRole('button', { name: /Thêm/ }).click()
      await expect(page.getByRole('heading', { name: /Thêm Tài khoản/ })).toBeVisible()

      const modal = page.locator('.fixed.inset-0')
      // The custom platform chip must now render from the freshly-saved option.
      await modal.getByRole('button', { name: new RegExp(platformLabel) }).click()
      await page.getByPlaceholder('Tên đăng nhập').fill(username)
      await expect(modal.getByRole('button', { name: new RegExp(platformLabel) })).toHaveClass(/bg-indigo-600/)
      // pick the linked email
      await page.locator('input[placeholder="Chọn email"]').click()
      await page
        .locator('.dropdown-animation li')
        .filter({ hasText: emails[0].address })
        .first()
        .click()
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expectToast(page, 'Đã tạo tài khoản')
    })

    await test.step('the stored platform value round-trips (data-driven, not hardcoded)', async () => {
      const accs = await listFixtures(
        page,
        'GAM Account',
        [['username', '=', username]],
        ['name', 'username', 'platform'],
      )
      expect(accs.length).toBe(1)
      expect(accs[0].platform).toBe(platformValue)
      // The new account shows in the list.
      await expect(page.getByText(username, { exact: true }).first()).toBeVisible({ timeout: 10_000 })
    })

    // teardown: account first (references the option), then the options.
    await cleanupFixtures(page, 'GAM Account', [['username', '=', username]])
    await deleteFixture(page, 'GAM List Option', await findListOptionName(page, 'Platform', platformValue))
    await deleteFixture(page, 'GAM List Option', await findListOptionName(page, 'Account Role', roleValue))
  })

  // --------------------------------------------------------------------------
  // 3. Email delete — blocked while an account links it, ok after unlinking.
  // --------------------------------------------------------------------------
  test('email delete — blocked while linked, succeeds once unlinked (cleaned up)', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const address = `${e2eName('email')}@e2e.test`
    const username = e2eName('acc-blocked')

    // Seed a GAM Email + an account that links it. save_email_account / the
    // account must go through gam.api (Password handling + safe create).
    const email = await gamCall(page, 'gam.api.save_email_account', {
      values: JSON.stringify({ address, provider: 'Other', is_active: 1, forward_verified: 0 }),
    })
    const account = await gamCall(page, 'gam.api.save_account', {
      values: JSON.stringify({
        platform: 'STEAM', username, email: email.name, status: 'ACTIVE', source: 'e2e',
      }),
    })
    // save_account returns the created doc name — assert the contract so a silent
    // regression (empty/undefined name) is caught before the UI flow runs.
    expect(account?.name, 'save_account returned a doc name').toBeTruthy()

    try {
      await clickNav(page, 'Quản lý Email')
      await waitForHeading(page, 'Quản lý Email')

      await test.step('delete is blocked — the linked account is surfaced', async () => {
        const row = rowForText(page, address)
        await row.getByRole('button', { name: 'Xoá', exact: true }).click()
        // First the confirm overlay; the backend returns blocked → it swaps to
        // the "Không thể xoá" panel listing the linked account.
        await page.locator('.fixed.inset-0').getByRole('button', { name: 'Xoá', exact: true }).click()
        await expect(page.getByText('Không thể xoá', { exact: false })).toBeVisible({ timeout: 10_000 })
        await expect(page.getByText(username, { exact: true })).toBeVisible()
        // Only the "Đóng" (close) action is available — no destructive button.
        await page.locator('.fixed.inset-0').getByRole('button', { name: 'Đóng', exact: true }).click()
        await expect(page.getByText('Không thể xoá', { exact: false })).toBeHidden()
      })

      await test.step('once the account is removed, the email deletes', async () => {
        // Unlink by deleting the account (cleanup helper uses REST delete).
        await cleanupFixtures(page, 'GAM Account', [['username', '=', username]])

        const row = rowForText(page, address)
        await row.getByRole('button', { name: 'Xoá', exact: true }).click()
        await page.locator('.fixed.inset-0').getByRole('button', { name: 'Xoá', exact: true }).click()
        await expectToast(page, /Đã xoá/)
        await expect(page.getByText(address, { exact: true })).toBeHidden({ timeout: 10_000 })
      })
    } finally {
      // Defensive: ensure nothing leaks even if an assertion failed mid-flow.
      await cleanupFixtures(page, 'GAM Account', [['username', '=', username]])
      // If the email survived, delete it through the guarded API (safe — no link now).
      await gamCall(page, 'gam.api.delete_email_account', { email_name: email.name }).catch(() => {})
    }
  })

  // --------------------------------------------------------------------------
  // 4. Ignore ("Bỏ qua") — dismisses an unrecognized sender.
  // --------------------------------------------------------------------------
  test('unrecognized email — Ignore hides the sender + sets ignored flag', async ({ page }) => {
    // Provision an unrecognized inbound log via bench console (GAM Admin has
    // create=0 on GAM Email Inbound Log, so REST insert is rejected).
    const address = `${e2eName('unrec')}@e2e.test`
    const subject = `GAM-E2E-IGNORE-${Date.now()}`
    const prov = provisionUnrecognized(address, subject)
    test.skip(!prov.ok, 'bench console provisioning unavailable — run on a box with bench')

    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    try {
      await clickNav(page, 'Quản lý Email')
      await waitForHeading(page, 'Quản lý Email')

      await test.step('the unrecognized panel shows the sender', async () => {
        await expect(page.getByText(address, { exact: true })).toBeVisible({ timeout: 10_000 })
        await expect(page.getByText(subject, { exact: true })).toBeVisible()
      })

      await test.step('clicking "Bỏ qua" hides it + flips the flag', async () => {
        const row = rowForText(page, address)
        await row.getByRole('button', { name: 'Bỏ qua', exact: true }).click()
        await expectToast(page, 'Đã bỏ qua')
        await expect(page.getByText(address, { exact: true })).toBeHidden({ timeout: 10_000 })

        // Server-side truth: the inbound log now has ignored=1.
        const flag = await checkIgnored(prov.name)
        expect(flag).toBe(true)
      })
    } finally {
      cleanupUnrecognized(subject)
    }
  })
})

// ===========================================================================
// bench console provisioning for the Ignore test (GAM Email Inbound Log has
// create=0 for GAM Admin, so we insert via frappe through `bench console %run`).
// Each helper writes a temp python file + runs `bench console %run`, mirroring
// the gam-email-content.spec.js precedent.
// ===========================================================================

function runBench(py) {
  const tmp = `/tmp/.gam_e2e_lopts_${Date.now()}.py`
  writeFileSync(tmp, py.trim())
  try {
    return execSync(`echo '%run ${tmp}' | bench --site erp.local console 2>/dev/null`, {
      cwd: BENCH_DIR,
      encoding: 'utf-8',
      timeout: 30_000,
    })
  } catch {
    return ''
  }
}

/** Insert one unrecognized inbound log for the Ignore test. Returns {ok,name}. */
function provisionUnrecognized(address, subject) {
  const out = runBench(`
import frappe
addr = ${JSON.stringify(address)}
subj = ${JSON.stringify(subject)}
now = frappe.utils.now_datetime()
doc = frappe.get_doc({
    "doctype": "GAM Email Inbound Log",
    "email_from": "Sender <" + addr + ">",
    "email_account": "gam@e2e.test",
    "email_subject": subj,
    "message_id": "<e2e-ig-" + frappe.generate_hash(length=10) + "@e2e.test>",
    "received_at": now,
    "fetched_at": now,
    "status": "NO_MATCH",
    "detected_platform": "",
    "ignored": 0,
})
doc.insert(ignore_permissions=True)
frappe.db.commit()
print("PROVISIONED " + doc.name)
`)
  const m = out.match(/PROVISIONED\s+(\S+)/)
  return { ok: !!m, name: m ? m[1] : '' }
}

/** Read the `ignored` flag of an inbound log via bench console (REST-safe). */
function checkIgnored(name) {
  const out = runBench(`
import frappe, json
v = frappe.db.get_value("GAM Email Inbound Log", ${JSON.stringify(name)}, "ignored")
print("IGNORED_FLAG=" + json.dumps({"ignored": bool(frappe.utils.cint(v))}))
`)
  const m = out.match(/IGNORED_FLAG=(\{.*\})/)
  if (!m) return false
  try {
    return JSON.parse(m[1]).ignored === true
  } catch {
    return false
  }
}

/** Remove every e2e-prefixed inbound log left behind by the Ignore test. */
function cleanupUnrecognized(subjectLike) {
  runBench(`
import frappe
for stale in frappe.get_all("GAM Email Inbound Log", filters=[["email_subject","like", ${JSON.stringify(subjectLike).replace(/'/g, "\\'")}]], pluck="name"):
    frappe.delete_doc("GAM Email Inbound Log", stale, force=True)
frappe.db.commit()
print("CLEANED")
`)
}
