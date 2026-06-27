// GAM browser e2e — Security Audit Timeline.
//
// Verifies the unified audit stream surfaces a login session + code request on
// the same account, and that the AccountDetailView activity timeline + the
// /admin/audit page both render them.
//
// Run:  npm run test:e2e -- gam-audit-timeline

import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { env, login, captureConsole } from './lib.js'

const BENCH_DIR = process.env.GAM_BENCH_DIR || '/home/frappe/frappe-bench'
const STATE_FILE = '/tmp/.gam_e2e_audit.json'

const PROVISION_PY = `
import json, frappe
h = frappe.generate_hash
now = frappe.utils.now_datetime
from gam.tests.utils import make_email, make_account, purge_fixtures, TEST_ADDRESS

purge_fixtures()
em = make_email()
acc = make_account("STEAM", "GAM-E2E-AUDIT-" + h(length=4).upper(), em)

# an AVAILABLE code so request_code will succeed
frappe.get_doc({
    "doctype": "GAM Email Code",
    "email": em, "email_address": TEST_ADDRESS, "platform": "STEAM",
    "code": "AUDIT1", "received_at": now(),
    "expires_at": frappe.utils.add_to_date(now(), minutes=15),
    "status": "AVAILABLE",
}).insert(ignore_permissions=True)

# a checkout (login session) on the account — recorded with IP/UA context
frappe.set_user("Administrator")
from gam.api import checkout_account
checkout_account(acc, purpose="LOGIN-AUDIT", lease_minutes=60)

frappe.db.commit()
open("${STATE_FILE}", "w").write(json.dumps({"account": acc, "email": em}))
print("PROVISIONED account=" + acc)
`

const CLEANUP_PY = `
import frappe
from gam.tests.utils import purge_fixtures
for n in frappe.get_all("GAM Account", {"username":["like","GAM-E2E-AUDIT-%"]}, pluck="name"):
    frappe.delete_doc("GAM Account", n, force=True)
for n in frappe.get_all("GAM Email Code", {"code":"AUDIT1"}, pluck="name"):
    frappe.delete_doc("GAM Email Code", n, force=True)
frappe.db.commit()
print("CLEANED")
`

function runBench(py) {
  const kind = py.includes('CLEANED') ? 'cleanup' : 'provision'
  const tmp = `/tmp/.gam_e2e_audit_${kind}.py`
  writeFileSync(tmp, py.trim())
  execSync(`echo '%run ${tmp}' | bench --site erp.local console 2>/dev/null`, {
    cwd: BENCH_DIR, encoding: 'utf-8', timeout: 40_000,
  })
}

let fixture = null

test.describe('GAM security audit timeline', () => {
  let consoleErrors = []

  test.beforeAll(() => {
    runBench(PROVISION_PY)
    fixture = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  })
  test.afterAll(() => runBench(CLEANUP_PY))
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

  test('checkout + code appear in /admin/audit and on the account activity tab', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })

    // Request a code on the account (creates a CODE_REQUEST audit row).
    await page.goto(`${env.base}/accounts/${fixture.account}`)
    await expect(page.getByRole('heading', { name: 'Chi tiết Tài khoản' })).toBeVisible({ timeout: 10_000 })
    const codeBtn = page.getByRole('button', { name: /Lấy Verification Code/i })
    await codeBtn.first().click({ timeout: 10_000 })
    await expect(page.getByText('AUDIT1', { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    // The account detail activity timeline should list the checkout (LOGIN).
    await expect(page.getByText('LOGIN-AUDIT').first()).toBeVisible({ timeout: 10_000 })

    // The unified audit page must show both the login and the code request.
    await page.goto(`${env.base}/admin/audit`)
    await expect(page.getByRole('heading', { name: 'Audit Timeline' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('AUDIT1', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
  })
})
