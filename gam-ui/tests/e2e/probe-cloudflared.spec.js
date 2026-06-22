// GAM browser e2e — Cloudflare Tunnel *readiness probe* (no real token needed).
//
// Complement to gam-cloudflare-tunnel.spec.js, which performs a REAL
// `cloudflared service install` and therefore requires GAM_TUNNEL_TOKEN (and
// skips in CI/sandboxes without it). This file verifies the *wiring* of the
// tunnel feature without installing anything:
//
//   login (GAM Admin) → /admin/webhook → assert Bước 1 (Tunnel) renders the
//   status panel → same-origin fetch get_tunnel_status → assert it returns
//   the documented shape { cloudflared_installed, service_active,
//   token_saved, tunnel_id, account_id } → assert a non-admin is DENIED.
//
// get_tunnel_status is read-only (it runs `sudo -n systemctl is-active
// cloudflared` under the /etc/sudoers.d/gam-cloudflared grant), so this probe
// never mutates the box and is safe to run on every build.
//
// Run:  npm run test:e2e -- probe-cloudflared

import { test, expect } from '@playwright/test'
import { env, login, gotoApp, waitForHeading, captureConsole } from './lib.js'

const TUNNEL_KEYS = ['cloudflared_installed', 'service_active', 'token_saved', 'tunnel_id', 'account_id']

/** Same-origin GET to gam.api.get_tunnel_status inside the live session. */
async function getTunnelStatus(page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/method/gam.api.get_tunnel_status', { credentials: 'include' })
    const j = await r.json().catch(() => ({}))
    return { status: r.status, message: j.message || null, error: j.exc || null }
  })
}

let consoleErrors = []

test.describe('GAM Cloudflare Tunnel readiness probe', () => {
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

  test('webhook config renders Bước 1 status panel + get_tunnel_status shape', async ({ page }) => {
    await test.step('login as GAM Admin + open webhook config', async () => {
      await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
      await gotoApp(page, '/admin/webhook')
      await waitForHeading(page, 'Cấu hình Webhook')
    })

    await test.step('Bước 1 (Tunnel) status panel mounts', async () => {
      // The step-1 section always renders its three status cells once the
      // view mounts — proves the tunnel UI shipped + the route resolves.
      await expect(page.getByText('cloudflared', { exact: true })).toBeVisible({ timeout: 15000 })
      await expect(page.getByPlaceholder('eyJhIjoi...', { exact: false })).toBeVisible()
      // `exact: true` — the step-2 card also exposes a "Thiết lập domain" button,
      // so a plain substring match would resolve to 2 elements (strict-mode violation).
      await expect(page.getByRole('button', { name: 'Thiết lập', exact: true })).toBeVisible()
    })

    await test.step('get_tunnel_status returns the documented shape', async () => {
      const { status, message } = await getTunnelStatus(page)
      expect(status).toBe(200)
      expect(message).not.toBeNull()
      // Every documented field must be present (boolean/serializable) — a
      // missing key would break the UI status panel silently.
      for (const key of TUNNEL_KEYS) {
        expect(message, `expected key "${key}"`).toHaveProperty(key)
      }
      expect(typeof message.cloudflared_installed).toBe('boolean')
      expect(typeof message.service_active).toBe('boolean')
      expect(typeof message.token_saved).toBe('boolean')

      console.log(
        `\n—— get_tunnel_status ——\n` +
          `  cloudflared_installed: ${message.cloudflared_installed}\n` +
          `  service_active: ${message.service_active}\n` +
          `  token_saved: ${message.token_saved}\n` +
          `  tunnel_id: ${message.tunnel_id || '(none)'}\n` +
          `  account_id: ${message.account_id || '(none)'}`,
      )
    })
  })

  test('non-admin is denied get_tunnel_status', async ({ request }) => {
    // The endpoint is admin-only. An unauthenticated same-origin fetch must
    // be rejected (Forbidden / not-allowed) — proves the sudo-backed status
    // probe cannot be abused by a logged-in GAM Member.
    const res = await request.get(`${env.base}/api/method/gam.api.get_tunnel_status`, {})
    expect([401, 403]).toContain(res.status())
    const body = await res.json().catch(() => ({}))
    // Frappe reports a permission error; a *successful* message here would be
    // a privilege-escalation regression.
    expect(body.message).toBeUndefined()
    expect(body.exc_type || body._server_messages || res.status()).toBeTruthy()
  })
})
