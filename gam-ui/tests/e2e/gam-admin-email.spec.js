// GAM browser e2e — Email management (Phase 2): ignore + safe delete (blocked → ok).
//
// Covers the two Phase-2 surfaces the rest of the suite doesn't exercise at the
// UI layer:
//   1. "Bỏ qua" (Ignore) button — dismisses an unrecognized sender; the row
//      vanishes from the panel and the underlying GAM Email Inbound Log is
//      flagged ignored=1 (verified end-to-end via gam.api.get_unrecognized_emails).
//   2. Safe delete — deleting a GAM Email that still has a linked GAM Account is
//      blocked; the blocked-accounts modal lists the account as a router-link.
//      After the account is removed the email deletes cleanly.
//
// GAM Email Inbound Log is `read_only` + `in_create` (no REST create), so the
// ignore test seeds it through a bench-console provisioning script — the same
// harness pattern as gam-forwarded-code.spec.js. The delete test uses the
// standard REST createFixture helpers for GAM Email + GAM Account.
//
// Run:  npm run test:e2e -- gam-admin-email

import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import {
  env,
  login,
  gotoApp,
  captureConsole,
  expectToast,
  createFixture,
  cleanupFixtures,
  gamCall,
} from './lib.js'

const BENCH_DIR = process.env.GAM_BENCH_DIR || '/home/frappe/frappe-bench'
const STATE_FILE = '/tmp/.gam_e2e_email.json'

// Unique prefix so e2e rows never collide with real data and can be swept on
// every run (idempotent). Lower-cased so it matches both the email address and
// the inbound-log LIKE filter.
const E2E_PREFIX = 'gam-e2e-email'
// Unique ignore-sender per run (timestamp) so leftover logs from a prior failed
// run are irrelevant — provisioning purges them anyway.
const IGNORE_SENDER = `${E2E_PREFIX}-ign-${Date.now()}@e2e.test`

// --- Bench-console provisioning for the ignore test -------------------------
// GAM Email Inbound Log is read_only/in_create → cannot be REST-created, so
// seed it directly via `bench console` (mirrors the forwarded-code harness).
const PROVISION_PY = `
import json, frappe
from frappe.utils import now_datetime

prefix = "${E2E_PREFIX}"
sender = "${IGNORE_SENDER}"

# Purge any stale e2e ignore logs first (idempotent across runs).
for n in frappe.db.get_all("GAM Email Inbound Log",
        filters={"email_from": ["like", "%" + prefix + "%"]},
        pluck="name"):
    frappe.delete_doc("GAM Email Inbound Log", n, force=True)
frappe.db.commit()

# An "unrecognized" log = no resolved gam_email + a NO_MATCH/OK status + ignored=0
# (the exact filter gam.api.get_unrecognized_emails queries).
log = frappe.get_doc({
    "doctype": "GAM Email Inbound Log",
    "email_account": prefix + "-inbox@e2e.test",
    "email_from": sender,
    "email_subject": "e2e ignore smoke",
    "status": "NO_MATCH",
    "received_at": now_datetime(),
})
log.insert(ignore_permissions=True)
frappe.db.commit()

out = {"inbound_name": log.name, "sender": sender}
open("${STATE_FILE}", "w").write(json.dumps(out))
print("PROVISIONED inbound=" + log.name + " sender=" + sender)
`

const CLEANUP_PY = `
import frappe
prefix = "${E2E_PREFIX}"
for n in frappe.db.get_all("GAM Email Inbound Log",
        filters={"email_from": ["like", "%" + prefix + "%"]},
        pluck="name"):
    frappe.delete_doc("GAM Email Inbound Log", n, force=True)
frappe.db.commit()
print("CLEANED")
`

function runBench(py) {
  const kind = py.includes('CLEANED') ? 'cleanup' : 'provision'
  const tmp = '/tmp/.gam_e2e_email_' + kind + '.py'
  writeFileSync(tmp, py.trim())
  execSync(`echo '%run ${tmp}' | bench --site erp.local console 2>/dev/null`, {
    cwd: BENCH_DIR,
    encoding: 'utf-8',
    timeout: 30_000,
  })
}

let provisioned = null

test.describe('GAM admin email management (ignore + safe delete)', () => {
  let consoleErrors = []

  test.beforeAll(() => {
    runBench(PROVISION_PY)
    provisioned = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  })

  test.afterAll(() => {
    runBench(CLEANUP_PY)
  })

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
  // Test 1 — "Bỏ qua" dismisses an unrecognized sender and flags the log.
  // --------------------------------------------------------------------------
  test('unrecognized email — Ignore (Bỏ qua) hides the row + flags the log', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    const sender = provisioned.sender
    expect(sender).toBeTruthy()

    await test.step('the unrecognized panel lists the seeded sender', async () => {
      await gotoApp(page, '/admin/emails')
      await expect(page.getByRole('heading', { name: /Quản lý Email/ })).toBeVisible({ timeout: 10_000 })
      // The panel heading only renders when unrecognized.length > 0.
      await expect(page.getByText(/Email chưa nhận diện/)).toBeVisible({ timeout: 10_000 })
      // The sender is shown verbatim in the row's mono span.
      await expect(page.getByText(sender, { exact: true })).toBeVisible({ timeout: 10_000 })
    })

    await test.step('clicking Bỏ qua toasts + removes the row', async () => {
      // Scope the Ignore button to the row that contains this sender (the
      // provider-filter chip strip is also .rounded-xl but holds no sender text).
      const row = page.locator('div.rounded-xl').filter({ hasText: sender }).first()
      await row.getByRole('button', { name: 'Bỏ qua' }).click()

      await expectToast(page, 'Đã bỏ qua')
      // loadUnrecognized() refreshes the panel → the row disappears.
      await expect(page.getByText(sender, { exact: true })).toBeHidden({ timeout: 10_000 })
    })

    await test.step('the backend no longer surfaces the sender', async () => {
      const rows = await gamCall(page, 'gam.api.get_unrecognized_emails')
      const stillThere = (rows || []).some(
        (r) => (r.candidate_address || r.email_from || '') === sender,
      )
      expect(stillThere).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Test 2 — delete blocked (linked account) → unlink → delete ok.
  // --------------------------------------------------------------------------
  test('delete email — blocked while linked, ok after the account is removed', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // Sweep any stale e2e email/account from an interrupted run (idempotent).
    await cleanupFixtures(page, 'GAM Account', [['username', 'like', `${E2E_PREFIX}%`]])
    await cleanupFixtures(page, 'GAM Email', [['address', 'like', `${E2E_PREFIX}%`]])

    const stamp = Date.now()
    const emailAddr = `${E2E_PREFIX}-del-${stamp}@e2e.test`
    const username = `${E2E_PREFIX}-del-${stamp}`

    // Seed an email + an account that links it (the link is what blocks deletion).
    const email = await createFixture(page, 'GAM Email', { address: emailAddr, is_active: 1 })
    const account = await createFixture(page, 'GAM Account', {
      platform: 'STEAM',
      username,
      email: email.name,
      status: 'ACTIVE',
    })

    try {
      await gotoApp(page, '/admin/emails')
      await expect(page.getByRole('heading', { name: /Quản lý Email/ })).toBeVisible({ timeout: 10_000 })

      await test.step('first delete attempt is blocked and lists the linked account', async () => {
        const emailRow = page.locator('div.rounded-2xl').filter({ hasText: emailAddr }).first()
        await expect(emailRow).toBeVisible({ timeout: 10_000 })
        await emailRow.getByRole('button', { name: 'Xoá' }).click()

        // Confirm in the modal (scoped to the overlay so it doesn't match the
        // row's own "Xoá" button).
        const modal = page.locator('.fixed.inset-0')
        await modal.getByRole('button', { name: 'Xoá', exact: true }).click()

        // confirmRemove → delete_email_account returns {blocked: true,
        // linked_accounts:[...]} → the modal switches to the blocked view.
        await expect(modal.getByText(/Không thể xoá/)).toBeVisible({ timeout: 10_000 })
        // The linked account is rendered as a router-link with its username.
        await expect(modal.getByRole('link', { name: username })).toBeVisible({ timeout: 10_000 })

        // Close the blocked modal so we can act on the account.
        await modal.getByRole('button', { name: 'Đóng' }).click()
        await expect(modal.getByText(/Không thể xoá/)).toBeHidden({ timeout: 10_000 })
      })

      await test.step('removing the linked account unblocks the email', async () => {
        // Delete the account via the API (the accounts-list UI delete is
        // already covered by gam-admin-listoptions; here we just need it gone).
        const res = await gamCall(page, 'gam.api.delete_account', { name: account.name })
        expect(res && res.deleted).toBe(true)
      })

      await test.step('second delete attempt succeeds', async () => {
        const emailRow = page.locator('div.rounded-2xl').filter({ hasText: emailAddr }).first()
        await emailRow.getByRole('button', { name: 'Xoá' }).click()

        const modal = page.locator('.fixed.inset-0')
        await modal.getByRole('button', { name: 'Xoá', exact: true }).click()

        await expectToast(page, 'Đã xoá')
        // The row is removed on successful delete (load() refreshes the list).
        await expect(emailRow).toBeHidden({ timeout: 10_000 })

        // Belt-and-suspenders: confirm the email doc is really gone.
        const gone = await gamCall(page, 'frappe.client.get_value', {
          doctype: 'GAM Email',
          fieldname: 'name',
          filters: JSON.stringify({ name: email.name }),
        }).catch(() => null)
        expect(gone && gone.name).toBeFalsy()
      })
    } finally {
      // Never leave the fixture behind, even if a step failed mid-flow.
      await gamCall(page, 'gam.api.delete_account', { name: account.name }).catch(() => {})
      await gamCall(page, 'gam.api.delete_email_account', { email_name: email.name }).catch(() => {})
    }
  })
})
