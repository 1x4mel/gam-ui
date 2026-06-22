# gam-ui — Production deployment

Co-tenant SPA served **same-origin** at `/gam-ui/` alongside erpnext + trader-ui
on site `erp.local`. Shared session cookie (SSO), no CORS. Three pieces:

1. **Build & publish** the SPA to a static directory.
2. **nginx** serves `/gam-ui/` and proxies `/api` + `/socket.io` to bench.
3. **Cloudflare Email Worker** forwards inbound mail → `gam.api.receive_email_webhook`.

---

## 0. Preflight (go-live readiness)

`scripts/preflight.mjs` automates the operational checklist below — a
**non-destructive** probe of the running bench + redis that answers *"is this
stack ready to serve gam-ui?"* before you publish. It checks: bench reachable +
guest/admin boot (`get_gam_session`), the `gam` domain read endpoints, all
migrated DocTypes + the Webhook Config singleton, seed data, the bench redis
instances (so rate-limited whitelisted methods won't 500), and member
role-isolation (no `System Manager`/`Administrator`, admin endpoints denied).

```bash
cd /home/frappe/gam/gam-ui
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20

npm run preflight              # informational: exits 0 even with warnings
npm run preflight -- --strict  # exit 1 on any warning (CI gate)
```

Warnings are surfaced (not blocking) by default; `--strict` fails on them.
`npm run deploy` runs the preflight gate automatically unless you pass
`--skip-preflight`.

---

## 1. Build & publish

`npm run deploy` runs `scripts/deploy.sh`, which activates Node ≥ 20 itself,
runs the preflight gate (§0), builds with `.env.production`
(`VITE_BASE_URL=/gam-ui/`), sanity-checks the built `index.html` actually
targets `/gam-ui/`, then publishes `dist/*` into the deploy dir.

```bash
cd /home/frappe/gam/gam-ui

npm run deploy                       # preflight → build → publish → verify
npm run deploy -- --skip-preflight   # skip the readiness gate
```

The deploy dir defaults to **`$GAM_UI_DEPLOY_DIR`** (`/var/www/gam-ui`); override
it to publish elsewhere:

```bash
GAM_UI_DEPLOY_DIR=/srv/gam-ui npm run deploy
```

> The deploy target may need write permission (e.g. `sudo chown -R $USER /var/www/gam-ui`).
>
> **Base-path foot-gun:** `vite.config.js` must read `VITE_BASE_URL` via Vite's
> `loadEnv()` (it does) — Vite never populates `process.env` from `.env` files.
> Reading `process.env.VITE_BASE_URL` silently falls back to `/`, so assets
> resolve at `/assets/...` and 404 behind the `/gam-ui/` nginx alias. The deploy
> script's base-path check guards against exactly this.

---

## 1b. One-shot production setup (fresh box: nginx + supervisor + SPA)

If the box currently only runs the dev server (`bench serve :8000`, **no web
server in front**), `scripts/prod-setup.sh` brings it to a real production
stack in one idempotent pass:

- installs `nginx` + `supervisor` (apt, skipped if present),
- generates the frappe `supervisor.conf` + `nginx.conf` (`bench setup …`),
- **injects the `/gam-ui/` static location** into the `erp.local` server block
  (idempotent — survives `bench setup nginx` regeneration),
- installs both configs into `/etc`, removes the stock `default` site,
- starts gunicorn + node socketio + redis + workers under **supervisor**
  (replaces the ad-hoc `bench serve`),
- builds + publishes the SPA, then verifies `/api/method/ping`, `/gam-ui/`,
  asset base path, and `/socket.io`.

It backs up the previous `/etc/nginx`, `/etc/supervisor`, and bench `config/`
to `~/frappe-bench/backups/prod-setup-<ts>/` before changing anything.

```bash
cd /home/frappe/gam/gam-ui
npm run prod:setup                                  # sudo prompt for password
# or with overrides / opt-outs:
sudo bash scripts/prod-setup.sh --skip-build        # nginx+supervisor only
sudo bash scripts/prod-setup.sh --keep-bench-serve  # nginx reverse-proxies existing :8000 (no gunicorn takeover)
sudo BENCH_USER=frappe SITE=erp.local bash scripts/prod-setup.sh
```

After it prints `✓ Production setup complete`, visit **`http://<host>/gam-ui/`**.
`--keep-bench-serve` is the lowest-risk path (keeps the running `bench serve`
intact; nginx just fronts it) if you are not ready for the gunicorn/supervisor
cutover.

> The injected `/gam-ui/` location is the same one in `nginx-gam-ui.conf`;
> `prod-setup.sh` automates the manual merge described in §2 below.

---

## 2. nginx

`nginx-gam-ui.conf` holds the `/gam-ui/` location block (static SPA shell +
immutable fingerprinted assets + no-cache `index.html`). Merge its two
`location` blocks into the existing `erp.local` server block that already
proxies `/api` and `/socket.io` to bench. Reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Visit **`https://erp.local/gam-ui/`** — login uses the shared erp.local session.

If **Two-Factor Authentication** is enabled in Frappe (System Settings → Enable
Two Factor Authentication), the login screen automatically switches to the OTP
step (TOTP / Email / SMS) and posts `otp` + `tmp_id` back to `/api/method/login`.

---

## 3. Cloudflare Email Worker (inbound codes)

`cloudflare-email-worker.js` + `wrangler.toml` receive mail at the
`webhook_email` address and POST each message to
`gam.api.receive_email_webhook`, authenticated with `X-Webhook-Secret`.

The worker runs on Cloudflare's edge, so it needs a **public HTTPS endpoint**.
The cleanest way to expose this box is a **Cloudflare Zero Trust Tunnel**
(§3a) — no open inbound ports, no public IP required, TLS is automatic, and
WebSocket (`/socket.io`) passes through natively. Then deploy the worker (§3b)
and wire Email Routing (§3c).

> Replace **`gam.example.com`** everywhere below with your real domain (a zone
> already managed in your Cloudflare account).

### 3a. Expose gam-ui publicly — Cloudflare Zero Trust Tunnel

The tunnel forwards your public hostname to nginx on `:80`, so the SPA
(`/gam-ui/`), the API (`/api/...`), and realtime (`/socket.io`) are all served
under one public origin.

```bash
# 1. Install cloudflared (official Cloudflare apt repo)
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

# 2. Authenticate (opens a browser; authorise cloudflared for your zone)
cloudflared tunnel login

# 3. Create the tunnel  →  prints a TUNNEL-UUID and writes ~/.cloudflared/<UUID>.json
cloudflared tunnel create gam

# 4. Publish a DNS CNAME pointing the public host at the tunnel
cloudflared tunnel route dns gam gam.example.com

# 5. Tunnel ingress → forward the public host to nginx (same-origin SPA+API+ws)
sudo tee /etc/cloudflared/config.yml >/dev/null <<'YAML'
tunnel: <TUNNEL-UUID>                         # ← paste the UUID from step 3
credentials-file: /home/frappe/.cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: gam.example.com                 # ← your public host
    service: http://localhost:80              # nginx (serves /gam-ui/, /api, /socket.io)
  - service: http_status:404                  # catch-all (required)
YAML

# 6. *** CRITICAL: map the public host to the erp.local site in Frappe ***
#    Frappe resolves the site from the Host header. Without this, a request for
#    gam.example.com is "site not found" and login cookies are never issued.
bench --site erp.local add-domain gam.example.com

# 7. Install cloudflared as a boot-time service (reconnects automatically)
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

**Verify the public path** (from anywhere on the internet):

```bash
curl -s -o /dev/null -w "spa=%{http_code}\n"   https://gam.example.com/gam-ui/   # → 200
curl -s        https://gam.example.com/api/method/ping                          # → {"message":"pong"}
# Browse: https://gam.example.com/gam-ui/  (login works — same-origin cookies)
```

> **Dashboard alternative (Remote-managed tunnel):** Zero Trust → Networks →
> Tunnels → *Create a tunnel*. Install the connector with the token it shows,
> then add a **Public Hostname** `gam.example.com` → service `http://localhost:80`.
> You still MUST run `bench --site erp.local add-domain gam.example.com` (step 6).
>
> **Optional (gam-only box):** make the domain root open the app directly by
> adding to the nginx server block:
> `location = / { return 302 /gam-ui/; }`
> (reload: `sudo nginx -t && sudo systemctl reload nginx`).

### 3b. Deploy the Email Worker

Now that the public endpoint exists, deploy the worker pointing its webhook at
the tunnel host.

#### 3b.1 — Dead-letter KV namespace (Phase 4.2)

The worker never permanently bounces a verification email when Frappe is briefly
unavailable (HTTP 5xx). Instead it buffers the payload into a KV **dead-letter
queue** and an operator re-submits it once the backend is healthy. Create the
namespace once, then paste the printed `id` into `wrangler.toml`
(`REPLACE_WITH_GAM_DLQ_NAMESPACE_ID`):

```bash
npx wrangler kv:namespace create GAM_DLQ
```

#### 3b.2 — Secrets + deploy

```bash
cd /home/frappe/gam/gam-ui/deploy
npm install postal-mime                 # MIME parser for the Workers runtime
npx wrangler login                      # one time (or export CLOUDFLARE_API_TOKEN)

# Public webhook endpoint via the tunnel:
npx wrangler secret put GAM_WEBHOOK_URL  # https://gam.example.com/api/method/gam.api.receive_email_webhook

# The rotated secret (saved by prod-setup.sh) — pipe so it is not echoed to the terminal:
cat ~/.gam-webhook-secret | npx wrangler secret put GAM_WEBHOOK_SECRET

# Drain credentials (operator re-submit of buffered 5xx messages):
npx wrangler secret put GAM_DRAIN_URL    # https://gam.example.com/api/method/gam.api.drain_email_dlq
npx wrangler secret put GAM_DRAIN_TOKEN  # Frappe API key / bearer authorizing the drain call

npx wrangler deploy                     # publishes gam-email-worker to the edge
```

`GAM_WEBHOOK_SECRET` MUST equal `GAM Webhook Config.webhook_secret` — it already
does (both come from `~/.gam-webhook-secret`, rotated away from the dev value).

#### 3b.3 — Draining the dead-letter queue

When Frappe was down during an inbound email, the message sits in `GAM_DLQ`
(TTL 7 days). After the backend recovers, replay them:

```bash
# How many are buffered?
curl -sf https://gam-email-worker.<your-subdomain>.workers.dev/ \
  -H "authorization: Bearer $(cat ~/.gam-drain-token)"

# Replay all → re-ingested via gam.api.drain_email_dlq (de-duped by message_id):
curl -sf -X POST https://gam-email-worker.<your-subdomain>.workers.dev/ \
  -H "authorization: Bearer $(cat ~/.gam-drain-token)"
```

Definitive failures (HTTP 4xx — bad secret / malformed payload) are still
`setReject`-ed and bounced by Cloudflare immediately; only transient 5xx are
buffered.

### 3c. Email Routing + verify

In the **Cloudflare dashboard → Email → Email Routing**:

1. Enable Email Routing on the domain that owns the `webhook_email` inbox.
2. Add a routing rule: the inbox address (or a catch-all) → **Send to a Worker**
   → select `gam-email-worker`.

Incoming verification emails are now parsed and matched against the seeded Code
Patterns (STEAM / BATTLENET / POE), creating `GAM Email Code` records in real
time. Watch **GAM Email Inbound Log** (`/admin/email-inbound-log`) for delivery
/ matching status; a live match also fires the realtime `gam_new_code` toast in
the UI (socket.io is now reachable through the tunnel).

**Verify rotation without exposing the secret:** `node scripts/preflight.mjs --strict`
probes the live endpoint with every known dev secret and expects them all to be
rejected (HTTP 403) — green means the live secret is no longer a dev value.

---

## 4. Smoke testing (HTTP contract)

[`tests/smoke-http.mjs`](../tests/smoke-http.mjs) verifies the backend↔frontend
contract over real HTTP — guest CSRF, the consolidated boot endpoint
(`get_gam_session`), login / logout, dashboard stats, global search, the
role-isolation audit, and the webhook secret gate (incl. a happy-path email→code
ingest when the secret is provided).

```bash
cd /home/frappe/frappe-bench
bench --site erp.local execute gam.ops.create_test_users   # one-time: seed isolated test users
bench --site erp.local serve --port 8000 &                  # or `bench start` + nginx

cd /home/frappe/gam/gam-ui
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20
npm run test:smoke
# happy-path webhook ingest (needs GAM Webhook Config.webhook_secret set):
GAM_WEBHOOK_SECRET=<the-configured-secret> npm run test:smoke
```

Defaults target `http://localhost:8000` + the test users
`gam-admin@test.local` / `gam-member@test.local` (`GAM@test-2026`). Override via
`GAM_API_BASE`, `GAM_SITE`, `GAM_ADMIN_*`, `GAM_MEMBER_*`, `GAM_WEBHOOK_SECRET`.
Exits non-zero on any failure, so it can gate CI / pre-deploy checks.

---

## 5. Browser e2e smoke (Playwright)

Six spec files cover the app end-to-end against a real headless Chromium:

* [`tests/e2e/gam-smoke.spec.js`](../tests/e2e/gam-smoke.spec.js) — the
  **read-mostly smoke flow**: admin login (incl. optional 2FA) → dashboard
  stats → account list → detail → reveal password → request code → checkout →
  check-in → every admin log viewer → webhook config → account settings →
  logout, plus a member session asserting role isolation (no admin nav, admin
  routes bounce to 404).
* [`tests/e2e/gam-admin-crud.spec.js`](../tests/e2e/gam-admin-crud.spec.js) —
  the **write paths**: GamesView admin CRUD (create a game, toggle active, switch
  Server/DLC tabs), AccountFormModal create-account (incl. the SearchableSelect
  email picker), and EmailDetailView (view a verification code). Each test seeds
  its own fixtures and tears them down again through the SPA's own session
  (`tests/e2e/lib.js` REST helpers), so the suite is idempotent and leaves the
  DB clean.
* [`tests/e2e/gam-admin-settings.spec.js`](../tests/e2e/gam-admin-settings.spec.js)
  — the **admin settings & role-isolation paths**: RoleAuditView audits the
  isolated test member and asserts it reports "safe" (the B4 co-tenancy
  contract), and AccountSettingsView exercises a real profile `full_name`
  update + restore and a real password rotation + restore (Frappe keeps the
  session valid on a self password-change). The full_name test captures the
  original value first and restores it in a `finally`, so it is self-cleaning
  even on failure.
* [`tests/e2e/gam-admin-links.spec.js`](../tests/e2e/gam-admin-links.spec.js) —
  the **relationship paths**: create a `GAM Account Link` between two seeded
  accounts through the dialog, verify it surfaces on both accounts
  (bidirectional `or_filters` query), then assert the controller's duplicate
  guard rejects a second link in **both** directions (A→B again and B→A). The
  anti-self guard is covered by the backend pytest and is not reachable from the
  UI (the picker excludes the current account). Self-seeding + self-cleaning.
* [`tests/e2e/gam-2fa.spec.js`](../tests/e2e/gam-2fa.spec.js) — the
  **2FA login path**: drives the LoginView 2-step flow at runtime. It provisions
  a DEDICATED 2FA test role + user via `gam.ops.setup_2fa_test` (so 2FA is
  role-scoped and does **not** challenge any other co-tenant user), asserts the
  password step yields the OTP challenge, that a wrong code is rejected, and that
  a TOTP code derived from the provisioned secret (same `src/utils/totp.js` the
  app ships) completes the login. `afterAll` flips global 2FA back off
  (`gam.ops.teardown_2fa_test`), so the suite self-cleans and a crashed run is
  harmless.
* [`tests/e2e/gam-admin-log-filters.spec.js`](../tests/e2e/gam-admin-log-filters.spec.js)
  — the **audit-log filter path**: verifies the `DateRangeFilter` (design §5.8 /
  §5.9) is wired into all four log views (Reveal / Code Request / Email Inbound /
  Account Usage) and that picking a "Từ" date actually drives a server-side
  filter fetch (REST GET to `/api/resource/GAM Reveal Log` with a `>=` datetime
  bound) rather than being cosmetic. The Code Request Log also exposes the
  §5.9 email filter.

```bash
cd /home/frappe/frappe-bench
bench --site erp.local execute gam.ops.create_test_users   # one-time
bench --site erp.local execute gam.setup.seed_demo          # seed games/emails/accounts
bench --site erp.local serve --port 8000 &                  # or `bench start` + nginx

cd /home/frappe/gam/gam-ui
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20
npx playwright install chromium          # one-time browser download
npm run test:e2e                         # auto-starts `npm run dev` (:5174 → bench)
```

Configuration via env (all optional, defaults target the dev stack above):
`GAM_E2E_BASE`, `GAM_ADMIN_USER`/`GAM_ADMIN_PASS`/`GAM_ADMIN_TOTP`,
`GAM_MEMBER_USER`/`GAM_MEMBER_PASS`. Set `GAM_ADMIN_TOTP` to the base32 OTP
secret **only when Frappe 2FA is enabled globally** — the smoke spec reuses the
app's own `src/utils/totp.js` to derive the live 6-digit code for the login
step. The dedicated `gam-2fa` spec needs **no env**: it provisions its own
role-scoped 2FA user at runtime via `gam.ops.setup_2fa_test`, so it works on a
fresh dev stack and cleans up after itself.

> **`bench serve` does not start redis-cache/queue.** `bench serve` is a
> single-process dev server; unlike `bench start` it does **not** launch the
> bench-managed `redis_cache` (`:13000`) / `redis_queue` (`:11000`) / socketio
> (`:9000`). The smoke flow exercises rate-limited whitelisted methods
> (`reveal_password`, `request_code`, `checkout_account`, `checkin_account`)
> whose Frappe rate-limiter reads `frappe.cache` → `redis_cache`. Without
> redis-cache on `:13000` those endpoints return **HTTP 500**
> (`redis.exceptions.ConnectionError … 13000`). For a fully-green run either
> use `bench start`, or launch the bench redis instances manually:
> ```bash
> redis-server ~/frappe-bench/config/redis_cache.conf --daemonize yes --dir /tmp --logfile /tmp/redis_cache.log
> redis-server ~/frappe-bench/config/redis_queue.conf --daemonize yes --dir /tmp --logfile /tmp/redis_queue.log
> ```
> (The optional realtime `/socket.io` connection needs socketio on `:9000`, but
> its absence is non-fatal — it only logs soft console warnings; the app
> degrades gracefully without live updates.)

> **Minimal/sandbox OS without the Chromium shared libs:** if `libnspr4` /
> `libnss3` / `libasound2` are missing and you have no `sudo`, extract them
> locally and export the path before running:
> ```bash
> mkdir -p ~/pwlibs && cd ~/pwlibs
> apt-get download libnspr4 libnss3 libasound2
> for d in *.deb; do dpkg-deb -x "$d" root; done
> export LD_LIBRARY_PATH="$HOME/pwlibs/root/usr/lib/x86_64-linux-gnu:$HOME/pwlibs/root/usr/lib/x86_64-linux-gnu/nss:$LD_LIBRARY_PATH"
> npm run test:e2e
> ```

---

## Operational checklist before go-live

- [ ] **`npm run preflight`** reports READY (0 fail) — it automates most of the
      checks below (DocTypes migrated, redis up, role isolation, webhook config).
- [ ] `encryption_key` of `erp.local` backed up (decrypts every Password field).
- [ ] `GAM Webhook Config.webhook_secret` rotated away from the dev value.
- [ ] Scheduler + RQ workers running (`bench start` / supervisor) so
      `expire_email_codes` + `force_release_leases` fire on time.
- [ ] Real GAM users created with `GAM Admin` / `GAM Member` roles **and no**
      erpnext/trader-ui roles, no `System Manager` (co-tenancy role isolation).
- [ ] `bench --site erp.local enable-scheduler`.
- [ ] Automated HTTP contract smoke passes: `npm run test:smoke` (23 checks).
- [ ] Automated browser e2e passes: `npm run test:e2e` — the smoke suite
      (admin full flow + member role isolation), the admin CRUD suite
      (GamesView create/toggle, AccountFormModal create, EmailDetailView),
      the admin settings suite (RoleAuditView member-isolation audit,
      AccountSettingsView full_name + password change/restore), the
      account-links suite (create link + duplicate guard both directions),
      the 2FA suite (role-scoped OTP challenge/verify), **and** the
      log-filters suite (DateRangeFilter on all 4 audit logs + server-side
      date filter fetch). Supersedes the manual walkthrough below.
- [ ] Manual browser smoke-test the full flow: login (incl. 2FA) → dashboard →
      reveal → request code → checkout → games → logs → webhook config →
      account settings.
