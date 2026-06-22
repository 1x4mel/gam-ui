// GAM browser e2e — forwarded-email owner resolution + code retrieval.
//
// Verifies Phase C (the linchpin fix): when a forwarded email arrives at the
// webhook, the system resolves the real owner via the `from` (forwarder) field
// and links the GAM Email Code to the correct GAM Email.  Then the user can
// request_code for the linked game account and get the right code.
//
// Provisioning tests _resolve_gam_email directly (forwarded scenario: to=inbox,
// from=owner), creates the Code + Account, then the browser test requests the
// code via the SPA and verifies it matches.
//
// Run:  npm run test:e2e -- gam-forwarded-code

import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { env, login, captureConsole } from './lib.js'

const BENCH_DIR = process.env.GAM_BENCH_DIR || '/home/frappe/frappe-bench'
const STATE_FILE = '/tmp/.gam_e2e_fwd.json'

const OWNER_ADDR = 'gam-e2e-fwd@example.com'
const INBOX_ADDR = 'gam-e2e-inbox@example.com'
const CODE_VALUE = '8a9-342-832b'

// --- Provisioning -----------------------------------------------------------
const PROVISION_PY = `
import json, frappe
h = frappe.generate_hash
now = frappe.utils.now_datetime
owner_addr = "${OWNER_ADDR}"

# --- Clean up stale e2e records ---
for dt, flt in [
    ("GAM Account", [["username","like","GAM-E2E-FWD-%"]]),
    ("GAM Email Code", [["code","=", "${CODE_VALUE}"]]),
    ("GAM Email", [["address","=", owner_addr]]),
]:
    for n in frappe.get_all(dt, filters=flt, pluck="name"):
        frappe.delete_doc(dt, n, force=True)
frappe.db.commit()

# --- 1. Create the GAM Email (the owner) ---
e = frappe.new_doc("GAM Email")
e.address = owner_addr
e.provider = "Outlook"
e.is_active = 1
e.insert(ignore_permissions=True)
gam_name = e.name

# --- 2. Test forwarded-email resolution directly ---
from gam.api import _resolve_gam_email
resolved_name, resolved_via = _resolve_gam_email("${INBOX_ADDR}", owner_addr, "", "")
assert resolved_name == gam_name, f"RESOLVE FAIL: expected {gam_name}, got {resolved_name}"
assert resolved_via == "sender", f"RESOLVE FAIL: expected 'sender', got {resolved_via}"

# --- 3. Create a GAM Email Code linked to the owner (platform=POE) ---
code = frappe.new_doc("GAM Email Code")
code.email = gam_name
code.email_address = owner_addr
code.platform = "POE"
code.code = "${CODE_VALUE}"
code.email_subject = "FW: Path Of Exile Account Unlock Code"
code.email_from = owner_addr
code.received_at = now()
code.fetched_at = now()
code.expires_at = frappe.utils.add_to_date(now(), minutes=15)
code.status = "AVAILABLE"
code.source_uid = "<e2e-fwd-" + h(length=10) + "@test.local>"
code.insert(ignore_permissions=True)

# --- 4. Create a GAM Account linked to the email (platform=STANDALONE → POE) ---
acc = frappe.new_doc("GAM Account")
acc.platform = "STANDALONE"
acc.username = "GAM-E2E-FWD-" + h(length=4).upper()
acc.email = gam_name
acc.status = "ACTIVE"
acc.insert(ignore_permissions=True)

frappe.db.commit()
out = {"gam_name": gam_name, "account_name": acc.name, "code": "${CODE_VALUE}", "resolved_via": resolved_via}
open("${STATE_FILE}", "w").write(json.dumps(out))
print("PROVISIONED gam_email=" + gam_name + " account=" + acc.name + " resolved_via=" + resolved_via)
`

const CLEANUP_PY = `
import frappe
for dt, flt in [
    ("GAM Account", [["username","like","GAM-E2E-FWD-%"]]),
    ("GAM Email Code", [["code","=", "${CODE_VALUE}"]]),
    ("GAM Email", [["address","=", "${OWNER_ADDR}"]]),
]:
    for n in frappe.get_all(dt, filters=flt, pluck="name"):
        frappe.delete_doc(dt, n, force=True)
frappe.db.commit()
print("CLEANED")
`

function runBench(py) {
  const kind = py.includes('CLEANED') ? 'cleanup' : 'provision'
  const tmp = '/tmp/.gam_e2e_fwd_' + kind + '.py'
  writeFileSync(tmp, py.trim())
  execSync(`echo '%run ${tmp}' | bench --site erp.local console 2>/dev/null`, {
    cwd: BENCH_DIR,
    encoding: 'utf-8',
    timeout: 30_000,
  })
}

let fixture = null

test.describe('GAM forwarded-email code resolution', () => {
  let consoleErrors = []

  test.beforeAll(() => {
    runBench(PROVISION_PY)
    fixture = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
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

  test('forwarded email → code linked to owner → request_code returns it', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // The provisioning script already verified _resolve_gam_email resolved
    // via the "sender" strategy.  Now verify the SPA can retrieve the code.
    await test.step('provisioning resolved the owner via "sender" strategy', () => {
      expect(fixture.resolved_via).toBe('sender')
      expect(fixture.gam_name).toBeTruthy()
    })

    await test.step('navigate to account detail + request code', async () => {
      await page.goto(`${env.base}/accounts/${fixture.account_name}`)
      // Wait for the account detail toolbar heading (page loaded).
      await expect(page.getByRole('heading', { name: 'Chi tiết Tài khoản' })).toBeVisible({ timeout: 10_000 })

      // Click the "Lấy Verification Code" button.
      const codeBtn = page.getByRole('button', { name: /Lấy Verification Code/i })
      await codeBtn.first().click({ timeout: 10_000 })

      // The code should appear in the result area.
      await expect(page.getByText(fixture.code, { exact: true })).toBeVisible({ timeout: 15_000 })
    })
  })
})
