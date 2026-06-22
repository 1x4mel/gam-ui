/**
 * GAM UI — HTTP integration smoke test.
 *
 * Verifies the backend↔frontend contract over real HTTP against a running
 * Frappe bench (site `erp.local`). Covers everything the gam-ui SPA depends on
 * at runtime — the consolidated boot endpoint (`get_gam_session`), login/logout,
 * dashboard stats, global search, role-isolation audit, and the inbound-email
 * webhook secret gate. This is the runtime smoke (handoff step 3) that the
 * "code-only" frontend/backend work has been waiting on.
 *
 * Run:   node tests/smoke-http.mjs
 *
 * Env (all optional — sensible dev defaults):
 *   GAM_API_BASE        default http://localhost:8000
 *   GAM_SITE            default erp.local   (sent as X-Frappe-Site-Name)
 *   GAM_ADMIN_USER      default gam-admin@test.local
 *   GAM_ADMIN_PASS      default GAM@test-2026
 *   GAM_MEMBER_USER     default gam-member@test.local
 *   GAM_MEMBER_PASS     default GAM@test-2026
 *   GAM_WEBHOOK_SECRET  optional; if set & matches the singleton, the
 *                       happy-path webhook ingest is exercised too.
 *
 * Prereq (once, from ~/frappe-bench):
 *   bench --site erp.local execute gam.ops.create_test_users
 *   bench --site erp.local serve   (or `bench start` + nginx)
 */

const BASE = (process.env.GAM_API_BASE || 'http://localhost:8000').replace(/\/$/, '')
const SITE = process.env.GAM_TEST_SITE || process.env.GAM_SITE || 'erp.local'
const ADMIN_USER = process.env.GAM_ADMIN_USER || 'gam-admin@test.local'
const ADMIN_PASS = process.env.GAM_ADMIN_PASS || 'GAM@test-2026'
const MEMBER_USER = process.env.GAM_MEMBER_USER || 'gam-member@test.local'
const MEMBER_PASS = process.env.GAM_MEMBER_PASS || 'GAM@test-2026'
const WEBHOOK_SECRET = process.env.GAM_WEBHOOK_SECRET || ''

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
    // undici (Node ≥ 20.2) exposes getSetCookie()
    const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const raw of set) {
      const [pair] = raw.split(';')
      const idx = pair.indexOf('=')
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }
  }

  async _fetch(path, { method = 'GET', headers = {}, body } = {}) {
    const finalHeaders = { 'X-Frappe-Site-Name': SITE, ...headers }
    const cookie = this.cookieHeader()
    if (cookie) finalHeaders['Cookie'] = cookie
    if (['POST', 'PUT', 'DELETE'].includes(method) && this.csrf) {
      finalHeaders['X-Frappe-CSRF-Token'] = this.csrf
    }
    const opts = { method, headers: finalHeaders }
    if (body !== undefined) opts.body = body

    const res = await fetch(BASE + path, opts)
    this._captureSetCookie(res)
    return res
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
    // Frappe wraps the method return value in `message`; unwrap it (mirrors
    // gam-ui's frappeCall). `error` holds the traceback when exc_type is set.
    const json = await res.json().catch(() => ({}))
    return { status: res.status, data: json.message, error: json.exc || null }
  }

  async login(usr, pwd) {
    if (!this.csrf) await this.getCsrf()
    const res = await this._fetch('/api/method/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usr, pwd }),
    })
    const data = await res.json().catch(() => ({}))
    // A successful login re-binds the session (and therefore the CSRF token).
    // The token is re-fetched so subsequent POSTs don't send the stale guest
    // token (which Frappe rejects as CSRFTokenError).
    if (data.message === 'Logged In' || data.message === 'No App') {
      this.csrf = data.csrf_token
      if (!this.csrf) await this.getCsrf()
    }
    return { status: res.status, data }
  }

  async logout() {
    await this.call('logout')
    this.cookies.clear()
    // Drop the now-invalid (admin) CSRF token so the next request fetches a
    // fresh guest token — otherwise the guest probe sends a stale token.
    this.csrf = null
  }

  // Raw POST for the guest webhook endpoint (custom headers, no JSON method-route).
  async webhook(payload, secret) {
    const headers = { 'Content-Type': 'application/json' }
    if (secret) headers['X-Webhook-Secret'] = secret
    const res = await this._fetch('/api/method/gam.api.receive_email_webhook', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    return { status: res.status, data: json.message, error: json.exc || null }
  }
}

// ---------------------------------------------------------------------------
// Minimal test harness.
// ---------------------------------------------------------------------------
const results = []
function assert(name, cond, detail = '') {
  const ok = !!cond
  results.push({ name, ok, detail })
  const tag = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`  ${tag} ${name}${detail && !ok ? `  — ${detail}` : ''}`)
  return ok
}

function section(title) {
  console.log(`\n=== ${title} ===`)
}

function expect(name, cond, detail) {
  if (!assert(name, cond, detail)) throw new Error(detail || name)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
async function run() {
  const admin = new Client()
  const guest = new Client()

  // ---- 1. Guest CSRF -----------------------------------------------------
  section('Guest session (no login)')
  const tok = await guest.getCsrf()
  assert('get_session_csrf_token returns a non-empty token', !!tok, 'token empty')

  const { data: guestSess } = await guest.call('gam.utils.get_gam_session')
  expect('guest get_gam_session → user=Guest', guestSess?.user === 'Guest', JSON.stringify(guestSess))
  assert(
    'guest get_gam_session flags all false',
    guestSess?.is_gam_admin === false && guestSess?.is_gam_member === false,
  )
  assert('guest session carries a csrf_token', !!guestSess?.csrf_token)

  // ---- 2. Login as GAM Admin -------------------------------------------
  section(`Login as GAM Admin (${ADMIN_USER})`)
  const { data: loginData } = await admin.login(ADMIN_USER, ADMIN_PASS)
  const loggedIn = loginData?.message === 'Logged In' || loginData?.message === 'No App'
  expect(
    `login returns a session message (${loginData?.message || loginData?.exc_type || 'failed'})`,
    loggedIn,
    JSON.stringify(loginData).slice(0, 300),
  )

  const { data: adminSess } = await admin.call('gam.utils.get_gam_session')
  expect('admin get_gam_session → user matches', adminSess?.user === ADMIN_USER, adminSess?.user)
  assert('admin is_gam_admin=true', adminSess?.is_gam_admin === true)
  assert('admin roles include "GAM Admin"', (adminSess?.roles || []).includes('GAM Admin'))
  assert('admin full_name non-empty', !!adminSess?.full_name)

  // ---- 3. Dashboard + search (Member-readable) --------------------------
  section('Domain read endpoints')
  const { data: stats } = await admin.call('gam.api.get_dashboard_stats')
  assert('get_dashboard_stats returns an object', stats && typeof stats === 'object')

  const { data: search } = await admin.call('gam.api.global_search', { query: 'a' })
  assert('global_search returns an object', search && typeof search === 'object')

  // ---- 4. Role audit (admin-only) --------------------------------------
  section('Role-isolation audit')
  const { data: audit } = await admin.call('gam.api.get_role_audit')
  expect('get_role_audit returns roles array', Array.isArray(audit?.roles), JSON.stringify(audit).slice(0, 200))
  assert('get_role_audit exposes is_isolated flag', typeof audit?.is_isolated === 'boolean')
  assert('get_role_audit exposes warnings array', Array.isArray(audit?.warnings))

  // ---- 5. Webhook secret gate ------------------------------------------
  section('Inbound email webhook gate')
  // No / wrong secret → must be rejected (403).
  const denied = await admin.webhook(
    { email_account: 'smoke@test.local', from: 'noreply@steampowered.com', subject: 'code', body: 'Your code: ABC12', message_id: `smoke-${Date.now()}@test` },
    'definitely-wrong-secret',
  )
  assert('webhook with WRONG secret → 403', denied.status === 403, `status=${denied.status}`)

  const denied2 = await admin.webhook(
    { email_account: 'smoke@test.local', from: 'noreply@steampowered.com', subject: 'code', body: 'Your code: ABC12', message_id: `smoke2-${Date.now()}@test` },
    '',
  )
  assert('webhook with NO secret → 403', denied2.status === 403, `status=${denied2.status}`)

  if (WEBHOOK_SECRET) {
    const ok = await admin.webhook(
      { email_account: 'smoke@test.local', from: 'noreply@steampowered.com', subject: 'Your Steam Guard code', body: 'Your Steam Guard code is ABC12', message_id: `smoke-ok-${Date.now()}@test` },
      WEBHOOK_SECRET,
    )
    assert('webhook with CORRECT secret → 2xx', ok.status >= 200 && ok.status < 300, `status=${ok.status} ${JSON.stringify(ok.data).slice(0, 200)}`)
    assert('webhook ingest returns a status field', !!ok.data?.status || ok.data?.message, JSON.stringify(ok.data).slice(0, 200))
  } else {
    console.log('  ℹ  GAM_WEBHOOK_SECRET not set — skipping happy-path webhook ingest (only 403 gate verified).')
  }

  // ---- 6. Role isolation — Member cannot reach admin endpoint -----------
  section(`Role isolation — GAM Member (${MEMBER_USER})`)
  const member = new Client()
  const { data: mLogin } = await member.login(MEMBER_USER, MEMBER_PASS)
  const memberLoggedIn = mLogin?.message === 'Logged In' || mLogin?.message === 'No App'
  if (!memberLoggedIn) {
    console.log(`  ℹ  Could not log in member (${mLogin?.exc_type || mLogin?.message}) — skipping isolation test.`)
  } else {
    const { data: mSess } = await member.call('gam.utils.get_gam_session')
    assert('member get_gam_session → is_gam_member=true', mSess?.is_gam_member === true)
    assert('member is_gam_admin=false', mSess?.is_gam_admin === false)
    assert('member roles include "GAM Member"', (mSess?.roles || []).includes('GAM Member'))

    // get_role_audit is admin-only → member must be denied.
    const deniedRes = await member.call('gam.api.get_role_audit')
    assert('member denied get_role_audit (admin-only)', !!deniedRes.error, 'expected an error/PermissionError')
  }

  // ---- 7. Logout ---------------------------------------------------------
  section('Logout')
  await admin.logout()
  const { data: afterLogout } = await admin.call('gam.utils.get_gam_session')
  // After logout the session cookie is gone; get_gam_session should report Guest.
  assert('after logout get_gam_session → Guest', afterLogout?.user === 'Guest', afterLogout?.user)

  // ---- Summary -----------------------------------------------------------
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}SMOKE: ${passed}/${results.length} passed${failed ? `, ${failed} FAILED` : ''}\x1b[0m`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((err) => {
  if (err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
    console.error(`\n\x1b[31m✗ Cannot reach ${BASE} — is bench running?\x1b[0m  (start: \`bench --site ${SITE} serve\` from ~/frappe-bench)`)
  } else {
    console.error('\n\x1b[31m✗ Smoke test crashed:\x1b[0m', err)
  }
  process.exit(1)
})
