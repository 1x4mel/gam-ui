// GAM browser e2e — email content display (Phase A2) + Code Patterns CRUD (Phase B4).
//
// Verifies:
//   A2 — expanding an inbound-log row lazy-loads the full email body via getDoc,
//        shows it in an escaped <pre> (never v-html), exposes a plain↔HTML toggle,
//        and renders the platform tag (matched_platform indigo for OK,
//        detected_platform amber for NO_MATCH).
//   B4 — the Code Patterns admin page renders the seeded POE pattern and supports
//        full create / delete CRUD through the SPA.
//
// Fixtures are provisioned via `bench console %run` (Node execSync) which writes
// /tmp/.gam_e2e_inbound.json. The records carry realistic body/html so the UI's
// lazy-load + display path is exercised end-to-end. The backend pipeline (body
// persistence + code extraction + _detect_platform) is already covered by the
// session's direct webhook POST verification; this spec focuses on the UI layer.
//
// Run:  npm run test:e2e -- gam-email-content

import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { env, login, clickNav, waitForHeading, expectToast, captureConsole } from './lib.js'

const BENCH_DIR = process.env.GAM_BENCH_DIR || '/home/frappe/frappe-bench'
const STATE_FILE = '/tmp/.gam_e2e_inbound.json'

// --- Provisioning Python (run via `bench console %run`) ----------------------
// Creates two GAM Email Inbound Log records (OK + NO_MATCH) with body/html +
// detected_platform/matched_platform, after sweeping any stale e2e rows.
const PROVISION_PY = `
import json, frappe
h = frappe.generate_hash
now = frappe.utils.now_datetime
for stale in frappe.get_all("GAM Email Inbound Log", filters=[["email_subject","like","GAM-E2E-%"]], pluck="name"):
    frappe.delete_doc("GAM Email Inbound Log", stale, force=True)
ok_code = "7e2-9f1-4a8b"
ok_marker = "GAM-E2E-OK-" + h(length=6)
ok_body = ("Your Path of Exile account has been locked.\\n" + "The verification code is " + ok_code + ".\\n" + "Enter this code to continue.\\n" + "Marker " + ok_marker)
ok_html = "<html><body><p>Path of Exile code " + ok_code + "</p></body></html>"
ok_doc = frappe.get_doc({"doctype":"GAM Email Inbound Log","email_from":"noreply@grindinggear.com","email_subject":"GAM-E2E-OK-SUBJECT","email_account":"e2e@test.local","email_body":ok_body,"email_html":ok_html,"message_id":"<e2e-ok-"+h(length=10)+"@test.local>","received_at":now(),"fetched_at":now(),"detected_platform":"POE","matched_platform":"POE","status":"OK"})
ok_doc.insert(ignore_permissions=True)
nm_marker = "GAM-E2E-NM-" + h(length=6)
nm_body = ("Your Path of Exile login notification.\\n" + "No code needed this time.\\n" + "Marker " + nm_marker)
nm_doc = frappe.get_doc({"doctype":"GAM Email Inbound Log","email_from":"noreply@grindinggear.com","email_subject":"GAM-E2E-NM-SUBJECT","email_account":"e2e@test.local","email_body":nm_body,"email_html":"<p>"+nm_marker+"</p>","message_id":"<e2e-nm-"+h(length=10)+"@test.local>","received_at":now(),"fetched_at":now(),"detected_platform":"POE","status":"NO_MATCH"})
nm_doc.insert(ignore_permissions=True)
frappe.db.commit()
out = {"ok_marker":ok_marker,"ok_code":ok_code,"ok_subject":"GAM-E2E-OK-SUBJECT","ok_log_name":ok_doc.name,"nm_marker":nm_marker,"nm_subject":"GAM-E2E-NM-SUBJECT","nm_log_name":nm_doc.name}
open("/tmp/.gam_e2e_inbound.json","w").write(json.dumps(out))
print("PROVISIONED ok="+ok_doc.name+" nm="+nm_doc.name)
`

const CLEANUP_PY = `
import frappe
for stale in frappe.get_all("GAM Email Inbound Log", filters=[["email_subject","like","GAM-E2E-%"]], pluck="name"):
    frappe.delete_doc("GAM Email Inbound Log", stale, force=True)
frappe.db.commit()
print("CLEANED")
`

function runBench(py) {
  const kind = py.includes('CLEANED') ? 'cleanup' : 'provision'
  const tmp = '/tmp/.gam_e2e_' + kind + '.py'
  writeFileSync(tmp, py.trim())
  execSync(`echo '%run ${tmp}' | bench --site erp.local console 2>/dev/null`, {
    cwd: BENCH_DIR,
    encoding: 'utf-8',
    timeout: 30_000,
  })
}

let fixture = null

test.describe('GAM email content display + code patterns', () => {
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

  test('OK email: expand shows body + matched platform (indigo) + HTML toggle', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await clickNav(page, 'Email đến')
    await waitForHeading(page, 'Nhật ký Email đến')

    // Scope to the row card containing the unique subject (avoids strict-mode
    // collisions when other POE rows exist on the page).
    const row = page.locator('.rounded-2xl').filter({ hasText: fixture.ok_subject })

    await test.step('expand the OK email row', async () => {
      await row.getByText(fixture.ok_subject, { exact: true }).click()
      // The "Nội dung email" label only renders after the lazy getDoc resolves.
      await expect(row.getByText('Nội dung email', { exact: true })).toBeVisible({ timeout: 10_000 })
    })

    await test.step('full body text is displayed (escaped <pre>)', async () => {
      // Substring match — the <pre> holds the entire body, not just the marker.
      await expect(row.getByText(fixture.ok_marker)).toBeVisible()
      await expect(row.getByText(fixture.ok_code)).toBeVisible()
    })

    await test.step('matched platform shows as indigo POE tag', async () => {
      await expect(row.locator('.text-indigo-400').filter({ hasText: 'POE' })).toBeVisible()
    })

    await test.step('HTML toggle switches to raw HTML source', async () => {
      await row.getByRole('button', { name: 'HTML nguồn' }).click()
      await expect(row.getByText(/Path of Exile code/)).toBeVisible()
    })
  })

  test('NO_MATCH email: expand shows detected platform (amber) + body', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await clickNav(page, 'Email đến')
    await waitForHeading(page, 'Nhật ký Email đến')

    const row = page.locator('.rounded-2xl').filter({ hasText: fixture.nm_subject })

    await row.getByText(fixture.nm_subject, { exact: true }).click()
    await expect(row.getByText('Nội dung email', { exact: true })).toBeVisible({ timeout: 10_000 })

    await test.step('detected platform shows as amber POE tag (no matched_platform)', async () => {
      await expect(row.locator('.text-amber-400').filter({ hasText: 'POE' })).toBeVisible()
    })

    await test.step('body text is displayed', async () => {
      await expect(row.getByText(fixture.nm_marker)).toBeVisible()
    })
  })

  test('code patterns page renders seeded POE pattern + create/delete CRUD', async ({ page }) => {
    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await clickNav(page, 'Code Patterns')
    await waitForHeading(page, 'Code Patterns')

    await test.step('seeded POE pattern is listed', async () => {
      await expect(page.locator('.rounded-2xl').filter({ hasText: 'POE' })).toBeVisible()
    })

    const crudSender = 'e2e-crud-' + Date.now().toString(36) + '-test'

    await test.step('create a new pattern', async () => {
      await page.getByRole('button', { name: '+ Thêm Pattern' }).click()
      await expect(page.getByText('Thêm Pattern', { exact: true })).toBeVisible()

      // Scope to the open modal so the always-visible Test-panel inputs
      // (also font-mono) don't shadow the form fields.
      const modal = page.locator('.fixed.inset-0')
      // Platform select (the only <select> in the modal).
      await modal.locator('select').selectOption('OTHER')
      // Sender pattern — first font-mono input in the modal form.
      await modal.locator('input.font-mono').nth(0).fill(crudSender)
      // Code regex — second font-mono input.
      await modal.locator('input.font-mono').nth(1).fill('([A-Z]{4}-[0-9]{3})')

      await page.getByRole('button', { name: 'Lưu' }).click()
      await expectToast(page, 'Đã tạo')
    })

    await test.step('new pattern appears in the list', async () => {
      await expect(page.getByText(crudSender, { exact: true })).toBeVisible()
    })

    await test.step('Test panel extracts the code for a matching sample email', async () => {
      // From must contain the new pattern's sender substring so it wins the match.
      await page.getByPlaceholder('noreply@steampowered.com').fill('someone@' + crudSender + '.com')
      await page.getByPlaceholder('Steam Guard Code', { exact: true }).fill('E2E test subject')
      await page.getByPlaceholder('Your Steam Guard code is ABC12 …').fill('Your code is ABCD-123, use it now.')
      await page.getByRole('button', { name: 'Chạy test' }).click()

      // Match banner + extracted code are rendered from the matcher result.
      await expect(page.getByText('✓ Khớp')).toBeVisible()
      await expect(page.getByText('ABCD-123', { exact: true })).toBeVisible()
    })

    await test.step('delete the pattern', async () => {
      page.once('dialog', (d) => d.accept())
      const row = page.locator('.rounded-2xl').filter({ hasText: crudSender })
      await row.getByRole('button', { name: 'Xoá' }).click()
      await expectToast(page, 'Đã xoá')
      await expect(page.getByText(crudSender, { exact: true })).toHaveCount(0)
    })
  })
})
