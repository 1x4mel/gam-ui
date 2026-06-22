// GAM browser e2e — Webhook Setup Wizard (gated 5-step stepper).
//
// Verifies the redesigned WebhookConfigView:
//   • loads the wizard summary ("Tổng quan pipeline") + progress bar;
//   • GAM_WEBHOOK_URL shown in step 3 uses the PUBLIC DOMAIN, not the local
//     IP/origin (the regression we fixed: window.location.origin → backend
//     worker_url = https://<public_host>/api/method/gam.api.receive_email_webhook);
//   • step gating is correct — a step unlocks only when the previous step is
//     done (locked steps render the lock note, done steps render ✓).
//   • the cloudflared_installed signal is propagated from get_tunnel_status
//     into get_webhook_setup_state (regression: the field was dropped, so the
//     step-1 cell wrongly showed "✗ chưa cài" even though cloudflared exists).
//
// State-adaptive: reads gam.api.get_webhook_setup_state to derive the expected
// done-count + locked/open set, so the suite stays green as the admin progresses
// through real setup.
//
// Structure: the always-applicable assertions live in the first test (which
// therefore reports PASSED whenever the wizard renders correctly). The two
// behaviours that only apply in specific pipeline states (power-user "Bỏ qua"
// unlock, and the self-confirm persist) are separate tests that skip cleanly
// when their preconditions aren't met — so a conditional skip can never void
// the primary green result. Run:  npm run test:e2e -- gam-webhook-wizard

import { test, expect } from '@playwright/test'
import { env, login, gotoApp, waitForHeading, captureConsole, gamCall } from './lib.js'

/** Same-origin GET to gam.api.get_webhook_setup_state inside the live session. */
async function getSetupState(page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/method/gam.api.get_webhook_setup_state', { credentials: 'include' })
    const j = await r.json().catch(() => ({}))
    return j.message || null
  })
}

/** Same-origin GET to gam.api.get_tunnel_status inside the live session. */
async function getTunnelStatus(page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/method/gam.api.get_tunnel_status', { credentials: 'include' })
    const j = await r.json().catch(() => ({}))
    return j.message || null
  })
}

/** Derive the wizard step flags the same way the Vue component does. */
function expectedSteps(s) {
  const s1 = !!(s && s.tunnel_active && s.token_saved)
  const s2 = !!(s && s.host_reachable)
  const s3 = !!(s && s.worker_deployed)
  const s4 = !!(s && s.email_routing_done)
  return { 1: s1, 2: s2, 3: s3, 4: s4, 5: !!(s4 && (s.total_received || 0) > 0) }
}

let consoleErrors = []

test.describe('GAM Webhook setup wizard', () => {
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

  // ─────────────────────────────────────────────────────────────────────────
  // Primary test — always runs. Reports PASSED whenever the wizard renders and
  // its core invariants (worker URL uses the public domain, cloudflared signal
  // propagated, gating correct) hold, regardless of how far the admin has
  // progressed through the pipeline.
  // ─────────────────────────────────────────────────────────────────────────
  test('wizard renders with gated steps + domain-based worker URL', async ({ page }) => {
    test.setTimeout(120_000)

    await test.step('login as GAM Admin + open webhook config', async () => {
      await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
      await gotoApp(page, '/admin/webhook')
      await waitForHeading(page, 'Cấu hình Webhook')
    })

    let state, steps
    await test.step('wizard summary mounts + setup state loads', async () => {
      await expect(page.getByText('Tổng quan pipeline')).toBeVisible({ timeout: 20000 })
      // setup state should resolve (admin is authenticated)
      state = await expect.poll(getSetupState.bind(null, page), { timeout: 20000 }).toBeTruthy()
      state = await getSetupState(page)
      steps = expectedSteps(state)
      const done = [1, 2, 3, 4, 5].filter((n) => steps[n]).length
      await expect(page.getByText(`${done} / 5 bước`)).toBeVisible()
    })

    await test.step('worker URL uses the PUBLIC DOMAIN (not local IP / origin)', async () => {
      expect(state.public_host, 'public_host must be set to assert the URL').toBeTruthy()
      // Backend computes worker_url = https://<public_host>/api/method/gam.api.receive_email_webhook
      expect(state.worker_url).toContain(state.public_host)
      expect(state.worker_url).toMatch(/^https:\/\//)
      expect(state.worker_url).toContain('/api/method/gam.api.receive_email_webhook')
      // Regression guard: must NOT leak the local IP or the dev origin.
      expect(state.worker_url).not.toMatch(/192\.168\./)
      expect(state.worker_url).not.toMatch(/\/\/localhost/)
    })

    await test.step('step 1 reflects the live tunnel state', async () => {
      if (steps[1]) {
        // done → emerald service status + ✓ badge in the step header
        await expect(page.getByText('✓ đang chạy')).toBeVisible({ timeout: 15000 })
      } else {
        // not done → the "Thiết lập" action is reachable (step 1 is always open)
        await expect(page.getByRole('button', { name: /Thiết lập/ })).toBeVisible()
      }
    })

    await test.step('step 1 cloudflared signal is propagated from tunnel status (regression)', async () => {
      // Root cause of the "cloudflared chưa cài" UI bug: get_webhook_setup_state
      // omitted cloudflared_installed, so state.cloudflared_installed was undefined
      // and the cell rendered "✗ chưa cài" even though cloudflared IS installed.
      const tun = await getTunnelStatus(page)
      expect(tun, 'get_tunnel_status must resolve').toBeTruthy()
      // the field MUST be present (defined) and a boolean in the setup state…
      expect(state.cloudflared_installed).toBeDefined()
      expect(typeof state.cloudflared_installed).toBe('boolean')
      // …and it must agree with the authoritative tunnel status.
      expect(state.cloudflared_installed).toBe(!!tun.cloudflared_installed)
      // the UI cell text follows that flag: ✓ khi đã cài, ✗ khi chưa cài.
      const expected = state.cloudflared_installed ? '✓ đã cài' : '✗ chưa cài'
      await expect(page.getByText(expected).first()).toBeVisible()
    })

    await test.step('step 3 worker URL is shown only when host is verified (gated)', async () => {
      const workerUrlPattern = new RegExp(state.worker_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      if (steps[2]) {
        // host reachable → step 3 open → the GAM_WEBHOOK_URL secret row is visible
        await expect(page.getByText('GAM_WEBHOOK_URL').first()).toBeVisible({ timeout: 15000 })
        await expect(page.locator('code').filter({ hasText: workerUrlPattern })).toBeVisible()
      } else {
        // host NOT reachable → step 3 locked → URL row absent
        await expect(page.getByText('GAM_WEBHOOK_URL')).toHaveCount(0)
      }
    })

    await test.step('locked steps render the lock note', async () => {
      // Find the first not-done step; it must be locked (unless it's open as the
      // current in-progress step). The first locked step shows the 🔒 note.
      let firstLocked = null
      for (const n of [2, 3, 4, 5]) {
        if (!steps[n]) { firstLocked = n; break }
      }
      if (firstLocked) {
        await expect(page.getByText(/🔒.*hoàn thành/i).first()).toBeVisible()
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Conditional test — only applies while there is at least one locked step
  // (i.e. the admin hasn't finished the pipeline yet). Skips cleanly otherwise
  // so it never voids the primary result above.
  // ─────────────────────────────────────────────────────────────────────────
  test('power-user "Bỏ qua" force-opens a locked step (§B)', async ({ page }) => {
    test.setTimeout(120_000)

    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await gotoApp(page, '/admin/webhook')
    await waitForHeading(page, 'Cấu hình Webhook')
    // Wait for the wizard body to finish loading (the lock notes / "Bỏ qua"
    // buttons only render after the component's load() resolves).
    await expect(page.getByText('Tổng quan pipeline')).toBeVisible({ timeout: 20000 })

    await expect.poll(getSetupState.bind(null, page), { timeout: 20000 }).toBeTruthy()
    const state = await getSetupState(page)
    const steps = expectedSteps(state)

    // A step's lock note renders when the PREVIOUS step isn't done yet
    // (WebhookConfigView: stepOpen(n) = stepDone(n-1)). So the first locked
    // step is the first n whose predecessor is incomplete — not the first
    // incomplete step itself (those can differ, e.g. tunnel done but host not
    // verified → step 2 is open, step 3 is the first locked one).
    let firstLocked = null
    for (const n of [2, 3, 4, 5]) {
      if (!steps[n - 1]) { firstLocked = n; break }
    }
    if (!firstLocked) {
      test.skip(true, 'no locked step to unlock — admin already past step 4')
      return
    }

    const skip = page.getByRole('button', { name: '🔓 Bỏ qua' }).first()
    await expect(skip).toBeVisible()
    // The step's own lock note sits above its body; once unlocked the note
    // for that step disappears and the step content renders.
    await skip.click()
    // Per-step body marker that is only rendered once the step is open.
    const bodyMarker = {
      2: page.getByRole('button', { name: /Thiết lập domain/i }),
      3: page.getByText('GAM_WEBHOOK_URL').first(),
      4: page.getByRole('button', { name: /đã tạo rule Email Routing/i }),
      5: page.getByRole('link', { name: /Mở Email Inbound Log/i }),
    }[firstLocked]
    await expect(bodyMarker).toBeVisible({ timeout: 10000 })
    // Backend state is untouched by the override (no round-trip on unlock).
    const after = await getSetupState(page)
    expect(after.worker_deployed).toBe(!!steps[3])
    expect(after.email_routing_done).toBe(!!steps[4])
    // Reload re-derives gating from the backend, clearing the local override.
    await page.reload()
    await waitForHeading(page, 'Cấu hình Webhook')
    await expect(page.getByText(/🔒.*hoàn thành/i).first()).toBeVisible()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Conditional test — only applies the moment step 3 has just opened (host
  // verified) but the admin hasn't self-confirmed the Worker deploy yet. Skips
  // cleanly in every other pipeline state.
  // ─────────────────────────────────────────────────────────────────────────
  test('self-confirm step persists (worker / routing)', async ({ page }) => {
    test.setTimeout(120_000)

    await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
    await gotoApp(page, '/admin/webhook')
    await waitForHeading(page, 'Cấu hình Webhook')
    // Wait for the wizard body so the step-3 confirm button is present before
    // we assert on it.
    await expect(page.getByText('Tổng quan pipeline')).toBeVisible({ timeout: 20000 })

    await expect.poll(getSetupState.bind(null, page), { timeout: 20000 }).toBeTruthy()
    const state = await getSetupState(page)
    const steps = expectedSteps(state)

    if (!(steps[2] && !steps[3])) {
      test.skip(true, 'step 3 not open or already done — self-confirm path skipped')
      return
    }

    const confirmBtn = page.getByRole('button', { name: /đã Deploy Worker/i })
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()
    // The flag should round-trip through the backend (cf_worker_deployed → true).
    await expect.poll(
      async () => (await getSetupState(page))?.worker_deployed,
      { timeout: 15000 },
    ).toBeTruthy()
    // Restore for cleanliness so the suite is re-runnable (CSRF-safe via gamCall).
    await gamCall(page, 'gam.api.set_webhook_setup_step', { step: 'worker', done: '0' })
  })
})
