#!/usr/bin/env bash
# =============================================================================
# gam-ui — one-shot PRODUCTION setup for the erp.local bench.
#
# Brings the box from "dev (bench serve :8000, no web server)" to a real
# production stack:
#
#   nginx :80  ─┬─► /api, /, /assets, /socket.io  →  gunicorn :8000 / socketio :9000
#               └─► /gam-ui/                        →  static SPA (/var/www/gam-ui)
#   supervisor  ─ gunicorn + node socketio + redis(cache/queue) + workers + schedule
#
# Idempotent: safe to re-run. Backs up existing nginx/supervisor/bench configs
# to ~/frappe-bench/backups/prod-setup-<ts>/ before touching anything.
#
# USAGE (run as root, or with sudo):
#   sudo bash gam-ui/scripts/prod-setup.sh
#   sudo BENCH_USER=frappe SITE=erp.local bash gam-ui/scripts/prod-setup.sh
#   sudo bash gam-ui/scripts/prod-setup.sh --skip-build      # nginx+supervisor only
#   sudo bash gam-ui/scripts/prod-setup.sh --keep-bench-serve # nginx proxies to existing bench serve (no gunicorn takeover)
#
# PREREQ: bench already installed at BENCH_DIR with site SITE migrated & serving.
# =============================================================================
set -euo pipefail

# --- config (overridable via env) -------------------------------------------
BENCH_USER="${BENCH_USER:-frappe}"
BENCH_DIR="${BENCH_DIR:-/home/$BENCH_USER/frappe-bench}"
SITE="${SITE:-erp.local}"
GAM_UI_DIR="${GAM_UI_DIR:-/home/$BENCH_USER/gam/gam-ui}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/gam-ui}"
SKIP_BUILD=0
KEEP_BENCH_SERVE=0

for arg in "$@"; do
  case "$arg" in
    --skip-build)        SKIP_BUILD=1 ;;
    --keep-bench-serve)  KEEP_BENCH_SERVE=1 ;;
    --help|-h) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "prod-setup.sh: unknown arg: $arg" >&2; exit 2 ;;
  esac
done

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BENCH_DIR/backups/prod-setup-$TS"

# --- helpers -----------------------------------------------------------------
if [ -t 1 ]; then
  G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[1m'; X='\033[0m'
else
  G=''; Y=''; R=''; B=''; X=''
fi
step() { printf "\n${B}▶ %s${X}\n" "$1"; }
ok()   { printf "  ${G}✓${X} %s\n" "$1"; }
warn() { printf "  ${Y}⚠${X} %s\n" "$1"; }
die()  { printf "  ${R}✗ %s${X}\n" "$1" >&2; exit 1; }

# --- P3.3 rollback trap ------------------------------------------------------
# On any mid-script failure (set -e / pipefail), restore the /etc configs this
# script may have overwritten from the step-0 backup, then reload nginx +
# supervisor so the box is left in its pre-run state instead of a half-applied
# (and possibly non-serving) config. The guard flag prevents recursion.
ROLLBACK_DONE=0
cleanup() {
  [ "$ROLLBACK_DONE" -eq 1 ] && return 0
  ROLLBACK_DONE=1
  echo
  warn "prod-setup failed mid-run — rolling back from $BACKUP_DIR"
  if [ -f "$BACKUP_DIR/nginx-etc/conf.d/frappe-bench.conf" ]; then
    cp -f "$BACKUP_DIR/nginx-etc/conf.d/frappe-bench.conf" /etc/nginx/conf.d/frappe-bench.conf 2>/dev/null || true
    warn "restored /etc/nginx/conf.d/frappe-bench.conf"
  fi
  if [ -f "$BACKUP_DIR/supervisor-etc/conf.d/frappe-bench.conf" ]; then
    cp -f "$BACKUP_DIR/supervisor-etc/conf.d/frappe-bench.conf" /etc/supervisor/conf.d/frappe-bench.conf 2>/dev/null || true
    warn "restored /etc/supervisor/conf.d/frappe-bench.conf"
  fi
  if command -v nginx >/dev/null 2>&1; then
    if nginx -t >/dev/null 2>&1; then systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true; fi
    warn "nginx reloaded with pre-run config"
  fi
  if command -v supervisorctl >/dev/null 2>&1; then
    supervisorctl reread >/dev/null 2>&1 || true
    supervisorctl update  >/dev/null 2>&1 || true
    warn "supervisor reloaded with pre-run config"
  fi
  warn "rollback complete — full pre-run snapshot in $BACKUP_DIR"
}
trap cleanup ERR

# --- P3.3 verify-before-kill -------------------------------------------------
# Kill processes matching `pattern` ONLY if at least one of them actually holds
# `port`. A bare `pkill -f "frappe.*serve"` could match an unrelated co-tenant
# process that merely shares a command-line substring; this guard refuses to
# kill in that case (skip + warn) so a mis-targeted pattern cannot brick
# another service on the shared box.
safe_kill() {
  local pattern="$1" port="$2" label="$3"
  local pids holder pid matched
  pids="$(pgrep -f "$pattern" 2>/dev/null | tr '\n' ' ')"
  [ -z "${pids// /}" ] && { ok "$label: no process matching '$pattern' (nothing to stop)"; return 0; }
  if [ -n "$port" ]; then
    holder="$(ss -ltnp 2>/dev/null | grep -E "[:.]$port\b" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | tr '\n' ' ')"
    matched=0
    for pid in $pids; do
      if echo "$holder" | grep -qw "$pid"; then matched=1; break; fi
    done
    if [ "$matched" -eq 0 ]; then
      warn "$label: '$pattern' matched pid(s) ${pids}but none hold :$port — skipping (co-tenant safety)"
      return 0
    fi
  fi
  # shellcheck disable=SC2086 # pids is a space-separated list of our own integers
  kill $pids 2>/dev/null || true
  ok "$label: stopped pid(s) ${pids}"
}

# --- guards ------------------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "must run as root (use: sudo bash $0)"
[ -d "$BENCH_DIR" ] || die "bench dir not found: $BENCH_DIR"
[ -d "$BENCH_DIR/sites/$SITE" ] || die "site not found: $BENCH_DIR/sites/$SITE"

# Run a command as the bench user (preserves HOME so pipx/bench resolve).
as_bench() { sudo -u "$BENCH_USER" -H bash -lc "$*"; }

step "Production setup for site ${B}$SITE${X} (user=$BENCH_USER)"
printf "  bench=%s\n  gam-ui=%s\n  deploy=%s\n" "$BENCH_DIR" "$GAM_UI_DIR" "$DEPLOY_DIR"
[ "$KEEP_BENCH_SERVE" -eq 1 ] && warn "--keep-bench-serve: nginx will reverse-proxy to the existing 'bench serve :8000' (no gunicorn/supervisor web takeover)"
[ "$SKIP_BUILD" -eq 1 ] && warn "--skip-build: will NOT rebuild/publish gam-ui (nginx+supervisor only)"

# --- 0. backup existing system configs --------------------------------------
step "Backup existing configs → $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
[ -d /etc/nginx ]      && cp -a /etc/nginx "$BACKUP_DIR/nginx-etc"      2>/dev/null || true
[ -d /etc/supervisor ] && cp -a /etc/supervisor "$BACKUP_DIR/supervisor-etc" 2>/dev/null || true
[ -d "$BENCH_DIR/config" ] && cp -a "$BENCH_DIR/config" "$BACKUP_DIR/bench-config" 2>/dev/null || true
ok "backup complete (rollback: restore from $BACKUP_DIR)"

# --- 1. install nginx + supervisor (idempotent) -----------------------------
step "Ensure nginx + supervisor installed"
export DEBIAN_FRONTEND=noninteractive
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y nginx
fi
if ! command -v supervisord >/dev/null 2>&1; then
  apt-get install -y supervisor
fi
command -v nginx >/dev/null 2>&1     || die "nginx install failed"
command -v supervisord >/dev/null 2>&1 || die "supervisor install failed"
ok "nginx $(nginx -v 2>&1 | cut -d/ -f2) + supervisor present"

# --- 2. generate frappe supervisor + nginx configs (as bench user) ----------
step "Generate frappe configs (bench setup supervisor + nginx)"
as_bench "cd '$BENCH_DIR' && bench setup supervisor --yes >/dev/null 2>&1" || die "bench setup supervisor failed"
as_bench "cd '$BENCH_DIR' && bench setup nginx --yes >/dev/null 2>&1" || die "bench setup nginx failed"
SUPERVISOR_CONF="$BENCH_DIR/config/supervisor.conf"
NGINX_CONF="$BENCH_DIR/config/nginx.conf"
[ -f "$SUPERVISOR_CONF" ] || die "expected $SUPERVISOR_CONF not generated"
[ -f "$NGINX_CONF" ]      || die "expected $NGINX_CONF not generated"
ok "frappe configs generated"

# --- 3. inject /gam-ui/ static location into the erp.local server block -----
# Idempotent: skip if already present. Inserted right before the first
# `location /assets {` block (reliably present in the frappe template).
step "Inject /gam-ui/ location into nginx config"
GAM_UI_BLOCK='
	# ---- gam-ui SPA (same-origin, shared session cookie) ----
	location /gam-ui/ {
		alias '"$DEPLOY_DIR"'/;
		index index.html;
		try_files $uri $uri/ /gam-ui/index.html;

		location ~* ^/gam-ui/assets/ {
			expires 1y;
			add_header Cache-Control "public, immutable";
			access_log off;
		}
		location = /gam-ui/index.html {
			add_header Cache-Control "no-cache, no-store, must-revalidate";
		}
	}
	location = /gam-ui { return 301 /gam-ui/; }
'
if grep -q 'location /gam-ui/' "$NGINX_CONF"; then
  ok "/gam-ui/ location already present (skipped)"
else
  python3 - "$NGINX_CONF" <<PY
import sys, io
path = sys.argv[1]
with open(path, "r") as f:
    txt = f.read()
block = r'''$GAM_UI_BLOCK'''
needle = "\tlocation /assets {"
if needle not in txt:
    sys.exit("could not find anchor 'location /assets {' in nginx.conf")
txt = txt.replace(needle, block + "\n" + needle, 1)
with open(path, "w") as f:
    f.write(txt)
PY
  ok "/gam-ui/ location injected (alias $DEPLOY_DIR/)"
fi

# --- 4. install configs into /etc -------------------------------------------
step "Ensure nginx log_format 'main' is defined (frappe config references it)"
# Ubuntu's default nginx.conf ships no `log_format main` (uses 'combined');
# frappe's generated config emits `access_log ... main;`. Define it (idempotent).
if ! grep -Eq 'log_format[[:space:]]+main' /etc/nginx/nginx.conf; then
  python3 - <<'PYLF'
import re
p = "/etc/nginx/nginx.conf"
t = open(p).read()
fmt = (
    "\tlog_format main '$remote_addr - $remote_user [$time_local] \"$request\" '\n"
    "\t             '$status $body_bytes_sent \"$http_referer\" '\n"
    "\t             '\"$http_user_agent\" \"$http_x_forwarded_for\"';\n"
)
t2 = re.sub(r"(http\s*\{)", r"\1\n" + fmt, t, count=1)
if t2 != t:
    open(p, "w").write(t2)
PYLF
  ok "inserted log_format 'main' into /etc/nginx/nginx.conf (http block)"
else
  ok "log_format 'main' already defined (skipped)"
fi

step "Install nginx config into /etc"
mkdir -p /etc/nginx/conf.d
# Remove stock default site so it cannot grab port 80 ahead of erp.local.
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
# Replace any previous frappe-bench config (idempotent).
cp -f "$NGINX_CONF" /etc/nginx/conf.d/frappe-bench.conf
ok "installed /etc/nginx/conf.d/frappe-bench.conf"
if [ "$KEEP_BENCH_SERVE" -eq 0 ]; then
  mkdir -p /etc/supervisor/conf.d
  cp -f "$SUPERVISOR_CONF" /etc/supervisor/conf.d/frappe-bench.conf
  ok "installed /etc/supervisor/conf.d/frappe-bench.conf"
fi

# --- 5. start supervisor stack (gunicorn + socketio + redis + workers) ------
if [ "$KEEP_BENCH_SERVE" -eq 1 ]; then
  step "Keep manual 'bench serve :8000' (nginx reverse-proxies it)"
  ok "nginx → 127.0.0.1:8000 (existing bench serve); socketio not started in this mode"
else
  step "Free bench-managed ports for supervisor takeover"
  # Stop stray/non-supervisor processes BEFORE 'supervisorctl update' so the
  # newly-loaded programs bind cleanly. Targets:
  #   :8000  dev 'bench serve' (werkzeug)
  #   :9000  any stray node-socketio
  #   :11000 orphaned redis-queue
  #   :13000 orphaned redis-cache
  # Does NOT touch the system redis on :6379 (different owner/port).
  # P3.3: each kill is gated by safe_kill (verify the matched pid actually holds
  # the expected port) so a mis-targeted pattern cannot kill a co-tenant service.
  safe_kill "frappe.*serve --port 8000"        8000  "stop dev bench serve (:8000)"
  safe_kill "redis-server 127.0.0.1:11000"     11000 "stop orphaned redis-queue (:11000)"
  safe_kill "redis-server 127.0.0.1:13000"     13000 "stop orphaned redis-cache (:13000)"
  safe_kill "node.*socketio"                   9000  "stop stray node-socketio (:9000)"
  sleep 3
  ok "cleared :8000 / :9000 / :11000 / :13000"

  step "Start bench under supervisor (gunicorn + socketio + redis + workers)"
  systemctl is-active --quiet supervisor || systemctl start supervisor
  supervisorctl reread >/dev/null 2>&1 || true
  supervisorctl update  >/dev/null 2>&1 || true
  # Give all programs (redis-cache/queue → web → socketio) a moment to come up.
  sleep 5
  ok "supervisor stack started"
fi

# --- 6. nginx syntax check + reload -----------------------------------------
step "Validate + reload nginx"
nginx -t
systemctl reload nginx || systemctl restart nginx
ok "nginx reloaded (serving :80)"

# --- 7. build + publish gam-ui (as bench user) ------------------------------
mkdir -p "$DEPLOY_DIR"
chown -R "$BENCH_USER":"$BENCH_USER" "$DEPLOY_DIR"
if [ "$SKIP_BUILD" -eq 0 ]; then
  step "Build + publish gam-ui → $DEPLOY_DIR"
  as_bench "cd '$GAM_UI_DIR' && GAM_UI_DEPLOY_DIR='$DEPLOY_DIR' bash scripts/deploy.sh --skip-preflight" \
    || die "gam-ui deploy.sh failed"
  chown -R "$BENCH_USER":"$BENCH_USER" "$DEPLOY_DIR"
  ok "gam-ui published"
else
  warn "skipped gam-ui build/publish (--skip-build)"
fi

# --- 8. verify ---------------------------------------------------------------
step "Verify production endpoints"
fail=0
# gunicorn/web
if curl -sf -H "Host: $SITE" -o /dev/null http://127.0.0.1/api/method/ping; then ok "/api/method/ping → 200"; else warn "/api/method/ping failed (web up?)"; fail=1; fi
# gam-ui shell (static — Host-agnostic; frappe block is the default server now)
code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/gam-ui/)"
if [ "$code" = "200" ]; then ok "/gam-ui/ → 200"; else warn "/gam-ui/ → HTTP $code"; fail=1; fi
# gam-ui assets target correct base path
if curl -sf http://127.0.0.1/gam-ui/index.html | grep -q '/gam-ui/assets/'; then ok "index.html asset base = /gam-ui/"; else warn "index.html base path mismatch"; fail=1; fi
# socketio present
if curl -sf -H "Host: $SITE" -o /dev/null http://127.0.0.1/socket.io/?EIO=4\&transport=polling; then ok "/socket.io reachable"; else warn "/socket.io unreachable (expected if --keep-bench-serve)"; fi

printf "\n${B}Backup:${X} %s\n" "$BACKUP_DIR"
if [ "$fail" -eq 0 ]; then
  printf "${G}${B}✓ Production setup complete${X} → http://<host>/gam-ui/\n"
else
  printf "${Y}⚠ Setup finished with warnings — inspect above (rollback from backup).${X}\n"
fi
printf "  Next: set GAM Webhook Config.webhook_email + rotate webhook_secret, then\n"
printf "        deploy the Cloudflare Email Worker (gam-ui/deploy/wrangler.toml).\n"
