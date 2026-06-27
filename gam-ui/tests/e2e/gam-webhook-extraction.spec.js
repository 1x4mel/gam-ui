// GAM browser e2e — webhook email extraction (4 dimensions).
//
// Simulates the two real forwarded emails the admin reported by feeding
// realistic payloads through `gam.api._ingest_email_payload` — the exact
// function `receive_email_webhook` runs after the secret check (so we exercise
// the FULL ingest pipeline: ForwardedHeaderBlock parser → owner resolution →
// platform/game/code, without depending on the bench HTTP port).
//
//   • Battle.net auto-forward (SRS relay): envelope from=noreply@hotmail.com,
//     body `To:` = MERISEDE3379@HOTMAIL.COM → owner resolved from body To:.
//   • POE manual forward: envelope from=TrishPavlica322@hotmail.com,
//     body `To:` = same → owner resolved from the forwarder.
//
// Then the browser verifies: code retrieval from the game-account detail page,
// and the unrecognized panel surfaces the real recipient (not the relay).
//
// Run:  npm run test:e2e -- gam-webhook-extraction

import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { env, login, captureConsole } from './lib.js'

const BENCH_DIR = process.env.GAM_BENCH_DIR || '/home/frappe/frappe-bench'
const STATE_FILE = '/tmp/.gam_e2e_whex.json'

const BN_OWNER = 'gam-e2e-bn@hotmail.com'   // MERISEDE3379 stand-in
const POE_OWNER = 'gam-e2e-poe@hotmail.com'  // TrishPavlica322 stand-in
const UNREG_OWNER = 'gam-e2e-unreg-bn@hotmail.com'
const INBOX = 'gam-e2e-inbox@hotmail.com'
const BN_CODE = 'G5WDJ8'
const POE_CODE = 'cc3-e71-607c'
const UNREG_CODE = 'ZZ00ZZ'

// --- Provisioning -----------------------------------------------------------
// Realistic Battle.net auto-forward body (underscore divider + body To: owner).
const BN_BODY = `________________________________
From: Battle.net <noreply@battle.net>
Sent: Saturday, June 27, 2026 4:56:27 AM (UTC+00:00)
To: ${BN_OWNER} <${BN_OWNER}>
Subject: Battle.net Account Verification

[Warning] Hello! If this isn't your account, don't click anything!

Here's your security code:

${BN_CODE}

We've received a security request from your Battle.net Account.
The code will expire in 10 minutes.
`

// Realistic POE manual-forward body (-----Original Message-----).
const POE_BODY = `-----Original Message-----
From: Path of Exile <support@grindinggear.com>
Sent: Thursday, June 18, 2026 1:54:33 PM (UTC+08:00)
To: ${POE_OWNER}
Subject: Path of Exile Account Unlock Code

Your Path of Exile account has been locked. Type the following access code:

${POE_CODE}

Our support staff will never ask you for this unlock code.
`

const PROVISION_PY = `
import json, frappe
h = frappe.generate_hash

# Clean stale e2e rows.
for dt, flt in [
    ("GAM Account", [["username","like","GAM-E2E-WHEX-%"]]),
    ("GAM Email Code", [["code","in", ["${BN_CODE}", "${POE_CODE}", "${UNREG_CODE}"]]]),
    ("GAM Email Inbound Log", [["email_account","=", "${INBOX}"]]),
    ("GAM Email", [["address","in", ["${BN_OWNER}", "${POE_OWNER}", "${UNREG_OWNER}"]]]),
]:
    for n in frappe.get_all(dt, filters=flt, pluck="name"):
        frappe.delete_doc(dt, n, force=True)
frappe.db.commit()

# Apply the alphanumeric BATTLENET regex fix to the live DB pattern.
from gam.setup import upgrade_code_patterns
upgrade_code_patterns()

# Owner emails (the auto/manual forward targets that ARE registered).
owners = {}
for addr in ["${BN_OWNER}", "${POE_OWNER}"]:
    e = frappe.new_doc("GAM Email")
    e.address = addr
    e.provider = "Outlook"
    e.is_active = 1
    e.insert(ignore_permissions=True)
    owners[addr] = e.name
# NOTE: ${UNREG_OWNER} is intentionally NOT created → it must surface in the
# unrecognized panel with candidate_address = the real recipient.

# Battle.net PLATFORM account + a Diablo 4 GAME child (inherits email).
bn = frappe.new_doc("GAM Account")
bn.platform = "BATTLENET"
bn.username = "GAM-E2E-WHEX-BN-" + h(length=4).upper()
bn.email = owners["${BN_OWNER}"]
bn.account_level = "PLATFORM"
bn.status = "ACTIVE"
bn.insert(ignore_permissions=True)
d4 = frappe.new_doc("GAM Account")
d4.platform = "BATTLENET"
d4.username = "GAM-E2E-WHEX-D4-" + h(length=4).upper()
d4.email = owners["${BN_OWNER}"]
d4.account_level = "GAME"
d4.parent_account = bn.name
d4.status = "ACTIVE"
d4.insert(ignore_permissions=True)

# POE standalone account.
poe = frappe.new_doc("GAM Account")
poe.platform = "STANDALONE"
poe.username = "GAM-E2E-WHEX-POE-" + h(length=4).upper()
poe.email = owners["${POE_OWNER}"]
poe.account_level = "GAME"
poe.status = "ACTIVE"
poe.insert(ignore_permissions=True)
frappe.db.commit()

# --- Drive the webhook ingest pipeline with the two real forwarded emails ---
from gam.api import _ingest_email_payload, get_unrecognized_emails

bn_payload = {
    "email_account": "${INBOX}",
    "from": "noreply@hotmail.com",          # SRS relay (NOT the owner)
    "subject": "Battle.net Account Verification",
    "body": ${JSON.stringify(BN_BODY)},
    "message_id": "<e2e-whex-bn-" + h(length=8) + "@test.local>",
    "received_at": frappe.utils.now_datetime().isoformat(),
}
poe_payload = {
    "email_account": "${INBOX}",
    "from": "${POE_OWNER}",                 # manual forwarder IS the owner
    "subject": "FW: Path of Exile Account Unlock Code",
    "body": ${JSON.stringify(POE_BODY)},
    "message_id": "<e2e-whex-poe-" + h(length=8) + "@test.local>",
    "received_at": frappe.utils.now_datetime().isoformat(),
}
unreg_body = bn_payload["body"].replace("${BN_OWNER}", "${UNREG_OWNER}").replace("${BN_CODE}", "${UNREG_CODE}")
unreg_payload = {
    "email_account": "${INBOX}",
    "from": "noreply@hotmail.com",
    "subject": "Battle.net Account Verification",
    "body": unreg_body,
    "message_id": "<e2e-whex-unreg-" + h(length=8) + "@test.local>",
    "received_at": frappe.utils.now_datetime().isoformat(),
}

bn_res = _ingest_email_payload(bn_payload)
poe_res = _ingest_email_payload(poe_payload)
unreg_res = _ingest_email_payload(unreg_payload)
assert bn_res["status"] == "ok", f"BN ingest failed: {bn_res}"
assert poe_res["status"] == "ok", f"POE ingest failed: {poe_res}"

# The Battle.net code must be linked to the BN owner (resolved from body To:),
# NOT left unrecognized.
bn_code_doc = frappe.get_doc("GAM Email Code", bn_res["name"])
assert bn_code_doc.email == owners["${BN_OWNER}"], \\
    f"BN code linked to wrong owner: {bn_code_doc.email}"
assert bn_code_doc.platform == "BATTLENET"

# The unrecognized forward must persist candidate_address = the real recipient.
unreg_log = frappe.get_last_doc(
    "GAM Email Inbound Log",
    {"email_account": "${INBOX}", "candidate_address": "${UNREG_OWNER}"},
)
assert unreg_log.candidate_address == "${UNREG_OWNER}", \\
    f"unrecognized candidate_address={unreg_log.candidate_address}"

frappe.db.commit()

# Verify the unrecognized-panel endpoint itself surfaces the real recipient.
frappe.set_user("Administrator")
panel = get_unrecognized_emails()
unreg_in_panel = any((r.get("candidate_address") or "").lower() == "${UNREG_OWNER}" for r in panel)
frappe.set_user("Guest")
frappe.db.commit()
out = {
    "bn_account": d4.name, "poe_account": poe.name,
    "bn_code": "${BN_CODE}", "poe_code": "${POE_CODE}",
    "unreg_owner": "${UNREG_OWNER}",
    "unreg_in_panel": bool(unreg_in_panel),
}
open("${STATE_FILE}", "w").write(json.dumps(out))
print("PROVISIONED bn=" + d4.name + " poe=" + poe.name + " unreg_in_panel=" + str(unreg_in_panel))
`

const CLEANUP_PY = `
import frappe
for dt, flt in [
    ("GAM Account", [["username","like","GAM-E2E-WHEX-%"]]),
    ("GAM Email Code", [["code","in", ["${BN_CODE}", "${POE_CODE}", "${UNREG_CODE}"]]]),
    ("GAM Email Inbound Log", [["email_account","=", "${INBOX}"]]),
    ("GAM Email", [["address","in", ["${BN_OWNER}", "${POE_OWNER}", "${UNREG_OWNER}"]]]),
]:
    for n in frappe.get_all(dt, filters=flt, pluck="name"):
        frappe.delete_doc(dt, n, force=True)
frappe.db.commit()
print("CLEANED")
`

function runBench(py) {
  const kind = py.includes('CLEANED') ? 'cleanup' : 'provision'
  const tmp = `/tmp/.gam_e2e_whex_${kind}.py`
  writeFileSync(tmp, py.trim())
  execSync(`echo '%run ${tmp}' | bench --site erp.local console 2>/dev/null`, {
    cwd: BENCH_DIR,
    encoding: 'utf-8',
    timeout: 40_000,
  })
}

let fixture = null

test.describe('GAM webhook extraction — Battle.net + POE forwards', () => {
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

  test('Battle.net auto-forward → code linked to owner → Diablo 4 gets it', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await page.goto(`${env.base}/accounts/${fixture.bn_account}`)
    await expect(page.getByRole('heading', { name: 'Chi tiết Tài khoản' })).toBeVisible({ timeout: 10_000 })
    const codeBtn = page.getByRole('button', { name: /Lấy Verification Code/i })
    await codeBtn.first().click({ timeout: 10_000 })
    await expect(page.getByText(fixture.bn_code, { exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test('POE manual forward → code linked to forwarder → standalone gets it', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await page.goto(`${env.base}/accounts/${fixture.poe_account}`)
    await expect(page.getByRole('heading', { name: 'Chi tiết Tài khoản' })).toBeVisible({ timeout: 10_000 })
    const codeBtn = page.getByRole('button', { name: /Lấy Verification Code/i })
    await codeBtn.first().click({ timeout: 10_000 })
    await expect(page.getByText(fixture.poe_code, { exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test('unrecognized panel shows the real recipient, not the relay', async ({ page }) => {
    // The provisioning ingested an unregistered Battle.net auto-forward, then
    // called the REAL get_unrecognized_emails() admin endpoint (as Administrator)
    // and recorded whether it surfaced the original recipient. This asserts the
    // data layer the panel renders — deterministic against the shared dev DB.
    expect(fixture.unreg_in_panel, 'unrecognized endpoint must surface the real recipient').toBe(true)
    // And confirm the SPA's unrecognized panel renders at all (smoke the UI).
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await page.goto(`${env.base}/admin/emails`)
    await expect(page.getByRole('heading', { name: 'Quản lý Email' })).toBeVisible({ timeout: 10_000 })
  })
})
