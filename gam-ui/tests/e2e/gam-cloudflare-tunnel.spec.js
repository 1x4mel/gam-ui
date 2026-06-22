// GAM browser e2e — Cloudflare Tunnel real install via the UI.
//
// Drives the production setup flow end-to-end through the browser:
//   login (GAM Admin) → /admin/webhook → paste the Tunnel token → click
//   "Thiết lập" → the backend runs `sudo cloudflared service install <token>`
//   (passwordless via /etc/sudoers.d/gam-cloudflared) → we assert the
//   `cloudflared` systemd unit becomes `active` and the persisted token
//   decodes back to the same tunnel_id.
//
// This is a REAL infrastructure action: it registers this box as a connector
// for the user's Cloudflare Zero Trust tunnel and leaves the service running.
// The token is read from the GAM_TUNNEL_TOKEN env var (never committed) and the
// test skips cleanly if it is absent, so the suite stays green in CI / sandboxes
// that don't have a real tunnel token.
//
// Run:  GAM_TUNNEL_TOKEN=eyJ... npm run test:e2e -- gam-cloudflare-tunnel

import { test, expect } from '@playwright/test'
import { env, login, gotoApp, waitForHeading, captureConsole } from './lib.js'

/** The real Zero Trust Tunnel connector token (base64 JSON {a,t,s}). */
const TUNNEL_TOKEN = process.env.GAM_TUNNEL_TOKEN || ''

/** Decode a Cloudflare Tunnel token {a:account,t:tunnel,s:secret}. */
function decodeTunnelToken(token) {
  const pad = '='.repeat((4 - (token.length % 4)) % 4)
  return JSON.parse(Buffer.from(token + pad, 'base64').toString('utf8'))
}

/** Same-origin GET to gam.api.get_tunnel_status inside the live session. */
async function getTunnelStatus(page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/method/gam.api.get_tunnel_status', { credentials: 'include' })
    const j = await r.json().catch(() => ({}))
    return j.message || null
  })
}

let consoleErrors = []

test.describe('GAM Cloudflare Tunnel setup e2e', () => {
  test.skip(!TUNNEL_TOKEN, 'GAM_TUNNEL_TOKEN env var required for the real tunnel install test')

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

  test('install tunnel token via UI → cloudflared service active', async ({ page }) => {
    test.setTimeout(150_000)
    const expected = decodeTunnelToken(TUNNEL_TOKEN)

    await test.step('login as GAM Admin + open webhook config', async () => {
      await login(page, { user: env.adminUser, pass: env.adminPass, totp: env.adminTotp })
      await gotoApp(page, '/admin/webhook')
      await waitForHeading(page, 'Cấu hình Webhook')
    })

    await test.step('cloudflared is detected as installed', async () => {
      // The status panel mounts after loadTunnelStatus(); with cloudflared on
      // PATH the backend reports cloudflared_installed=true → "✓ đã cài".
      await expect(page.getByText('✓ đã cài')).toBeVisible({ timeout: 15000 })
    })

    await test.step('paste the tunnel token + click Thiết lập', async () => {
      const tokenInput = page.getByPlaceholder('eyJhIjoi...', { exact: false })
      await expect(tokenInput).toBeVisible()
      await tokenInput.fill(TUNNEL_TOKEN)

      await page.getByRole('button', { name: 'Thiết lập' }).click()

      // installTunnel() flips tunnelInstalling, awaits the backend, then renders
      // tunnelResult.message. Wait for any of the known outcomes (success /
      // waiting-for-active / failure) — all 4 messages share these substrings.
      const resultMsg = page.getByText(
        /Tunnel connector da cai|Da cai service|service install that bai|chua cai/,
      )
      await resultMsg.first().waitFor({ state: 'visible', timeout: 100_000 })

      // Surface the raw backend verdict for the run log.
      const message = (await resultMsg.first().textContent()) || ''
      console.log(`\n—— install_cloudflare_tunnel verdict ——\n  ${message.trim()}`)
      // A hard failure (rc!=0 + not active) is a real regression — stop here.
      expect(message).not.toMatch(/that bai/)
    })

    await test.step('cloudflared.service becomes active', async () => {
      // `cloudflared service install` enables+starts the unit synchronously, but
      // for a Type=notify connector `is-active` flips to "active" only after it
      // registers with the edge — poll the backend status until it stabilises.
      await expect
        .poll(async () => {
          const s = await getTunnelStatus(page)
          return s?.service_active
        }, { timeout: 45_000, intervals: [2000, 2000, 3000, 5000] })
        .toBe(true)
    })

    await test.step('persisted token decodes to the same tunnel/account', async () => {
      const s = await getTunnelStatus(page)
      expect(s).not.toBeNull()
      // Password field read-back must be non-masked (token_saved true) and the
      // decoded tunnel_id/account_id must match the token we submitted.
      expect(s.token_saved).toBe(true)
      expect(s.tunnel_id).toBe(expected.t)
      expect(s.account_id).toBe(expected.a)
      expect(s.cloudflared_installed).toBe(true)
      console.log(
        `\n—— get_tunnel_status ——\n` +
          `  cloudflared_installed: ${s.cloudflared_installed}\n` +
          `  service_active: ${s.service_active}\n` +
          `  tunnel_id: ${s.tunnel_id}\n` +
          `  account_id: ${s.account_id}`,
      )
    })

    await test.step('UI status panel reflects the live service', async () => {
      // loadTunnelStatus() ran after install; the panel must now read "đang chạy".
      await expect(page.getByText('✓ đang chạy')).toBeVisible({ timeout: 10000 })
    })
  })
})
