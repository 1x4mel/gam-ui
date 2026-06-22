#!/usr/bin/env node
/**
 * gam-ui — deploy PREFLIGHT / go-live readiness check.
 *
 * Distinct from `test:smoke` (HTTP contract) and `test:e2e` (browser): this
 * verifies that the DEPLOY ENVIRONMENT is ready to serve gam-ui at /gam-ui/ —
 * i.e. it automates the "Operational checklist before go-live" in
 * deploy/README.md.
 *
 * It is NON-DESTRUCTIVE: it never creates/updates/deletes Frappe documents.
 * It only reads via guest/admin sessions + REST frappe.client.get*, plus a raw
 * TCP PING to the bench-managed redis_cache/redis_queue (so the documented
 * "redis down → rate-limited whitelisted methods HTTP 500" pitfall is caught
 * before a deploy, without mutating any data).
 *
 * Exit codes:
 *   0  no FAILs (warnings are reported but do not fail unless --strict)
 *   1  one or more FAILs (blocking — do NOT deploy), or warnings under --strict
 *
 * Run:   node scripts/preflight.mjs [--strict]
 *
 * Env (all optional — sensible dev defaults):
 *   GAM_API_BASE          default http://localhost:8000
 *   GAM_SITE              default erp.local            (X-Frappe-Site-Name)
 *   GAM_ADMIN_USER        default gam-admin@test.local
 *   GAM_ADMIN_PASS        default GAM@test-2026
 *   GAM_MEMBER_USER       default gam-member@test.local
 *   GAM_MEMBER_PASS       default GAM@test-2026
 *   GAM_REDIS_CACHE_HOST  default 127.0.0.1   (set to '' to skip the redis probe)
 *   GAM_REDIS_CACHE_PORT  default 13000
 *   GAM_REDIS_QUEUE_HOST  default 127.0.0.1
 *   GAM_REDIS_QUEUE_PORT  default 11000
 */
import net from 'node:net'

const BASE = (process.env.GAM_API_BASE || 'http://localhost:8000').replace(/\/$/, '')
const SITE = process.env.GAM_SITE || 'erp.local'
const ADMIN_USER = process.env.GAM_ADMIN_USER || 'gam-admin@test.local'
const ADMIN_PASS = process.env.GAM_ADMIN_PASS || 'GAM@test-2026'
const MEMBER_USER = process.env.GAM_MEMBER_USER || 'gam-member@test.local'
const MEMBER_PASS = process.env.GAM_MEMBER_PASS || 'GAM@test-2026'

const REDIS_CACHE = { host: process.env.GAM_REDIS_CACHE_HOST ?? '127.0.0.1', port: Number(process.env.GAM_REDIS_CACHE_PORT || 13000) }
const REDIS_QUEUE = { host: process.env.GAM_REDIS_QUEUE_HOST ?? '127.0.0.1', port: Number(process.env.GAM_REDIS_QUEUE_PORT || 11000) }

const STRICT = process.argv.includes('--strict')

// Known dev/staging webhook_secret values that must be rotated before go-live.
const DEV_WEBHOOK_SECRETS = new Set(['smoke-secret-2026', 'test-gam-secret-2026'])

// Main user-facing DocTypes whose presence confirms the `gam` migration ran.
const MAIN_DOCTYPES = [
  'GAM Account',
  'GAM Email',
  'GAM Game',
  'GAM Game Server',
  'GAM DLC',
  'GAM Email Code',
  'GAM Code Pattern',
  'GAM Account Link',
  'GAM Reveal Log',
  'GAM Code Request Log',
  'GAM Email Inbound Log',
  'GAM Account Usage',
]

const tty = process.stdout.isTTY
const C = {
  ok: tty ? '\x1b[32m' : '',
  warn: tty ? '\x1b[33m' : '',
  fail: tty ? '\x1b[31m' : '',
  dim: tty ? '\x1b[2m' : '',
  b: tty ? '\x1b[1m' : '',
  x: tty ? '\x1b[0m' : '',
}

// ---------------------------------------------------------------------------
// Tiny HTTP client with a cookie jar + CSRF token (mirrors gam-ui api layer).
// ---------------------------------------------------------------------------
class Client {
  constructor() {
    this.cookies = new Map()
    this.csrf = null
  }

  cookieHeader() {
    if (!this.cookies.size) return undefined
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  _captureSetCookie(res) {
    const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const raw of set) {
      const [pair] = raw.split(';')
      const idx = pair.indexOf('=')
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }
  }

  async _fetch(path, { method = 'GET', headers = {}, body, timeoutMs = 10000 } = {}) {
    const finalHeaders = { 'X-Frappe-Site-Name': SITE, ...headers }
    const cookie = this.cookieHeader()
    if (cookie) finalHeaders['Cookie'] = cookie
    if (['POST', 'PUT', 'DELETE'].includes(method) && this.csrf) {
      finalHeaders['X-Frappe-CSRF-Token'] = this.csrf
    }
    const opts = { method, headers: finalHeaders }
    if (body !== undefined) opts.body = body

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(BASE + path, { ...opts, signal: ctrl.signal })
      this._captureSetCookie(res)
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  async getCsrf() {
    const res = await this._fetch('/api/method/gam.utils.get_session_csrf_token')
    const data = await res.json().catch(() => ({}))
    if (data.message) this.csrf = data.message
    return data.message || null
  }

  async call(method, args = {}) {
    if (!this.csrf) await this.getCsrf()
    const res = await this._fetch(`/api/method/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    const json = await res.json().catch(() => ({}))
    return { status: res.status, data: json.message, error: json.exc || null, raw: json }
  }

  async login(usr, pwd) {
    if (!this.csrf) await this.getCsrf()
    const res = await this._fetch('/api/method/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usr, pwd }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.message === 'Logged In' || data.message === 'No App') {
      this.csrf = data.csrf_token
      if (!this.csrf) await this.getCsrf()
    }
    return { status: res.status, data }
  }
}

// ---------------------------------------------------------------------------
// Reporting.
// ---------------------------------------------------------------------------
const results = []
const LEVELS = { ok: 'ok', warn: 'warn', fail: 'fail' }

function section(title) {
  console.log(`\n${C.b}── ${title} ──${C.x}`)
}

function record(name, level, detail = '') {
  results.push({ name, level, detail })
  const icon = level === 'ok' ? '✓' : level === 'warn' ? '⚠' : '✗'
  const color = level === 'ok' ? C.ok : level === 'warn' ? C.warn : C.fail
  const suffix = detail ? `  ${C.dim}— ${detail}${C.x}` : ''
  console.log(`  ${color}${icon}${C.x} ${name}${suffix}`)
}

const ok = (n, d = '') => record(n, LEVELS.ok, d)
const warn = (n, d = '') => record(n, LEVELS.warn, d)
const fail = (n, d = '') => record(n, LEVELS.fail, d)

// ---------------------------------------------------------------------------
// Redis TCP PING — raw socket so it works with no redis client dep and is
// completely non-destructive (no key reads/writes, just the RESP PING).
// ---------------------------------------------------------------------------
function pingRedis({ host, port }, label) {
  return new Promise((resolve) => {
    if (!host) return resolve(record(`${label} probe skipped (host empty)`, LEVELS.warn))
    const sock = net.createConnection({ host, port })
    let buf = ''
    const done = (fn) => {
      clearTimeout(timer)
      sock.destroy()
      fn()
    }
    const timer = setTimeout(() => done(() => resolve(fail(`${label} reachable`, 'connect timed out'))), 2000)
    sock.on('error', (e) => done(() => resolve(fail(`${label} reachable`, e.code || e.message))))
    sock.on('connect', () => sock.write('PING\r\n'))
    sock.on('data', (chunk) => {
      buf += chunk.toString()
      if (buf.includes('PONG')) done(() => resolve(ok(`${label} reachable (PONG)`)))
      else done(() => resolve(warn(`${label} reachable`, `unexpected reply: ${buf.trim()}`)))
    })
  })
}

function finish() {
  const fails = results.filter((r) => r.level === 'fail')
  const warns = results.filter((r) => r.level === 'warn')
  const oks = results.filter((r) => r.level === 'ok')
  const tag = fails.length ? C.fail : warns.length && STRICT ? C.fail : C.ok
  const status = fails.length
    ? 'NOT READY (blocking failures)'
    : STRICT && warns.length
      ? 'NOT READY (--strict, warnings treated as failures)'
      : 'READY'
  console.log(`\n${tag}${C.b}PREFLIGHT: ${oks.length} ok, ${warns.length} warn, ${fails.length} fail — ${status}${C.x}`)
  if (!fails.length && warns.length && !STRICT) {
    console.log(`${C.dim}(warnings are informational; pass --strict to fail on them)${C.x}`)
  }
  process.exit(fails.length || (STRICT && warns.length) ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Checks.
// ---------------------------------------------------------------------------
async function run() {
  console.log(`${C.b}gam-ui deploy preflight${C.x} → ${BASE}  (site: ${SITE})${STRICT ? '  [strict]' : ''}`)

  const guest = new Client()
  const admin = new Client()

  // ---- 1. Bench reachable & guest boot -----------------------------------
  section('Bench reachable & guest boot')
  try {
    const tok = await guest.getCsrf()
    if (tok) ok('get_session_csrf_token returns a token')
    else fail('get_session_csrf_token returns a token', 'empty token — bench up?')
  } catch (e) {
    fail('bench reachable', `${e.message} — is bench running on ${BASE}?`)
    return finish()
  }

  const g = await guest.call('gam.utils.get_gam_session')
  if (g.error) fail('guest get_gam_session', 'returned an error')
  else {
    if (g.data?.user === 'Guest') ok('guest get_gam_session → user=Guest')
    else fail('guest get_gam_session → user=Guest', `got ${g.data?.user}`)
    if (g.data?.is_gam_admin === false && g.data?.is_gam_member === false) ok('guest flags all false')
    else warn('guest flags all false', 'expected is_gam_admin/member=false pre-login')
  }

  // ---- 2. Admin login & boot ---------------------------------------------
  section(`Admin login & boot (${ADMIN_USER})`)
  const lg = await admin.login(ADMIN_USER, ADMIN_PASS)
  const loggedIn = lg.data?.message === 'Logged In' || lg.data?.message === 'No App'
  if (!loggedIn) {
    fail(`admin login (${ADMIN_USER})`, lg.data?.exc_type || lg.data?.message || 'login failed')
    warn('skipping admin-boot checks', 'create users via: bench --site erp.local execute gam.ops.create_test_users')
  } else {
    ok(`admin login (${ADMIN_USER})`)
    const a = await admin.call('gam.utils.get_gam_session')
    if (a.error) fail('admin get_gam_session', 'returned an error')
    else {
      if (a.data?.is_gam_admin === true) ok('admin is_gam_admin=true')
      else fail('admin is_gam_admin=true', 'user lacks GAM Admin role')
      if ((a.data?.roles || []).includes('GAM Admin')) ok('admin roles include "GAM Admin"')
      else fail('admin roles include "GAM Admin"', 'role missing — re-seed roles / B2')
    }
  }

  // Domain read endpoints (proves the `gam` app whitelisted methods resolve).
  if (loggedIn) {
    section('Domain read endpoints')
    const stats = await admin.call('gam.api.get_dashboard_stats')
    if (stats.error) fail('get_dashboard_stats responds', 'error — app/migration broken?')
    else ok('get_dashboard_stats responds')

    const srch = await admin.call('gam.api.global_search', { query: 'a' })
    if (srch.error) fail('global_search responds', 'error')
    else ok('global_search responds')

    const audit = await admin.call('gam.api.get_role_audit')
    if (audit.error) fail('get_role_audit responds', 'error')
    else ok('get_role_audit responds')
  }

  // ---- 3. DocTypes migrated ----------------------------------------------
  if (loggedIn) {
    section('DocTypes migrated')
    for (const dt of MAIN_DOCTYPES) {
      const r = await admin.call('frappe.client.get_count', { doctype: dt })
      if (r.error) fail(`DocType "${dt}"`, 'missing/error — run bench migrate')
      else ok(`DocType "${dt}" present`)
    }

    // Singleton Webhook Config (name == doctype for Is Single).
    const wh = await admin.call('frappe.client.get', { doctype: 'GAM Webhook Config', name: 'GAM Webhook Config' })
    if (wh.error || !wh.data) {
      fail('GAM Webhook Config singleton', 'missing — migration/seed incomplete')
    } else {
      ok('GAM Webhook Config singleton present')
      if (wh.data.is_active) ok('webhook config is_active=true')
      else warn('webhook config is_active=false', 'inbound emails will be rejected until enabled')
      if (wh.data.webhook_email) ok('webhook_email set', wh.data.webhook_email)
      else warn('webhook_email empty', 'Cloudflare Email Routing has no target inbox')
      // webhook_secret is a Password field → masked by REST. Verify rotation
      // *behaviourally* & non-destructively: every known DEV secret MUST now be
      // rejected by the live endpoint (HTTP 403). This proves the live secret is
      // no longer a dev value WITHOUT exposing it and WITHOUT creating any
      // document (receive_email_webhook throws PermissionError BEFORE it parses
      // the payload, so the empty body never reaches persistence).
      if (wh.data.is_active) {
        const leaked = []
        for (const dev of DEV_WEBHOOK_SECRETS) {
          const r = await guest._fetch('/api/method/gam.api.receive_email_webhook', {
            method: 'POST',
            headers: { 'X-Webhook-Secret': dev, 'Content-Type': 'application/json' },
            body: '{}',
          })
          if (r.status !== 403) leaked.push(`${dev} → HTTP ${r.status}`)
        }
        if (!leaked.length) ok('webhook_secret rotated (all dev secrets rejected)')
        else fail('webhook_secret rotated (dev secrets rejected)', `accepted: ${leaked.join(', ')} — rotate GAM Webhook Config.webhook_secret`)
      } else {
        warn('webhook_secret rotation not verified', 'config is_active=false — enable to verify')
      }
    }
  }

  // ---- 4. Cloudflare Tunnel ingress (read-only probe) --------------------
  // The tunnel is the production ingress path. Verify the stack is ready
  // WITHOUT installing anything: get_tunnel_status is admin-only + read-only
  // (it runs `sudo -n systemctl is-active cloudflared`, which itself proves
  // the /etc/sudoers.d/gam-cloudflared grant is in place). If the admin hits
  // "Thiết lập" with cloudflared missing the install fails, so we surface
  // that before a deploy rather than at first-use.
  if (loggedIn) {
    section('Cloudflare Tunnel ingress')
    const tun = await admin.call('gam.api.get_tunnel_status')
    if (tun.error) {
      fail('get_tunnel_status responds', 'error — backend endpoint broken?')
    } else {
      const s = tun.data || {}
      ok('get_tunnel_status responds')
      if (s.cloudflared_installed) {
        ok('cloudflared installed', s.cloudflared_path || '')
      } else {
        // Not blocking (admin can paste the apt command from the UI), but
        // warn loudly so it isn't discovered at first-use.
        warn('cloudflared installed', 'binary not on PATH — UI install will show the apt command')
      }
      if (s.token_saved) ok('tunnel token saved', `tunnel=${s.tunnel_id || '(undecoded)'}`)
      else warn('tunnel token saved', 'no token yet — admin must paste it in Bước 1')
      if (s.service_active) ok('cloudflared service active')
      else {
        warn(
          'cloudflared service active',
          'tunnel not connected — run Bước 1 (install) before serving public traffic',
        )
      }
    }
  }

  // ---- 5. Seed data -------------------------------------------------------
  if (loggedIn) {
    section('Seed data')
    const stats = await admin.call('gam.api.get_dashboard_stats')
    if (!stats.error && stats.data && typeof stats.data === 'object') {
      const nums = Object.values(stats.data).filter((v) => typeof v === 'number')
      const total = nums.reduce((s, n) => s + n, 0)
      if (total > 0) ok('dashboard reports data', `sum=${total}`)
      else warn('dashboard reports no data', 'run: bench --site erp.local execute gam.setup.seed_demo')
    } else {
      warn('dashboard data check skipped', 'get_dashboard_stats unavailable')
    }
  }

  // ---- 6. Redis (rate-limiter / cache) -----------------------------------
  section('Redis (rate-limiter / cache)')
  await pingRedis(REDIS_CACHE, `redis_cache :${REDIS_CACHE.port}`)
  await pingRedis(REDIS_QUEUE, `redis_queue :${REDIS_QUEUE.port}`)
  const redisFail = results.some(
    (r) => r.level === 'fail' && r.name.startsWith('redis_'),
  )
  if (redisFail) {
    warn(
      'rate-limited methods will HTTP 500 without redis',
      'use `bench start` (or start bench redis instances) before serving',
    )
  }

  // ---- 7. Role isolation (member) ----------------------------------------
  section(`Role isolation — GAM Member (${MEMBER_USER})`)
  const member = new Client()
  const m = await member.login(MEMBER_USER, MEMBER_PASS)
  const mLoggedIn = m.data?.message === 'Logged In' || m.data?.message === 'No App'
  if (!mLoggedIn) {
    warn(`member login (${MEMBER_USER})`, `${m.data?.exc_type || m.data?.message} — create via gam.ops.create_test_users`)
  } else {
    const ms = await member.call('gam.utils.get_gam_session')
    if (ms.data?.is_gam_member === true) ok('member is_gam_member=true')
    else fail('member is_gam_member=true', 'role mapping wrong')
    if (ms.data?.is_gam_admin === false) ok('member is_gam_admin=false')
    else fail('member is_gam_admin=false', 'privilege escalation risk!')
    const mRoles = ms.data?.roles || []
    const breaking = mRoles.filter((r) => ['System Manager', 'Administrator'].includes(r))
    if (breaking.length === 0) ok('member holds no isolation-breaking role')
    else fail('member holds no isolation-breaking role', `found: ${breaking.join(', ')}`)

    // get_role_audit is admin-only → member must be denied.
    const denied = await member.call('gam.api.get_role_audit')
    if (denied.error) ok('member denied get_role_audit (admin-only)')
    else fail('member denied get_role_audit (admin-only)', 'endpoint leaked to member!')
  }

  finish()
}

run().catch((e) => {
  fail('preflight crashed', e.stack || e.message)
  finish()
})
