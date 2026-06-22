#!/usr/bin/env bash
# =============================================================================
# gam-ui — build & publish the SPA for same-origin serving at /gam-ui/.
#
#   cd /home/frappe/gam/gam-ui
#   npm run deploy                 # build → publish → verify
#   npm run deploy -- --skip-preflight   # skip the readiness gate
#   GAM_UI_DEPLOY_DIR=/srv/gam-ui npm run deploy
#
# Deploy modes (GAM_UI_DEPLOY_MODE):
#   flat (default)    dist/* copied directly into $DEPLOY_DIR (nginx alias
#                     points at $DEPLOY_DIR/). Zero-behavior-change default,
#                     safe for the currently-deployed nginx block.
#   symlink           build into $DEPLOY_DIR/releases/<ts>, then atomically
#                     repoint $DEPLOY_DIR/current at it (keep N releases).
#                     nginx alias must point at $DEPLOY_DIR/current/ — see
#                     deploy/nginx-gam-ui.conf note. Rollback = one symlink
#                     swap (--rollback), no rebuild.
#
#   npm run deploy -- --rollback      # symlink mode: repoint current to previous
#   npm run deploy -- --list-releases # show available releases
#
# Steps:
#   1. (optional) preflight — gate on go-live readiness (warnings ok, fails abort)
#   2. build:prod — vite build with .env.production (VITE_BASE_URL=/gam-ui/)
#   3. sanity-check the built index.html actually targets /gam-ui/
#   4. publish dist/* (flat copy OR atomic symlink swap, per mode)
#   5. verify index.html + assets landed and are reachable
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

DEPLOY_DIR="${GAM_UI_DEPLOY_DIR:-/var/www/gam-ui}"
DEPLOY_MODE="${GAM_UI_DEPLOY_MODE:-flat}"
KEEP_RELEASES="${GAM_UI_KEEP_RELEASES:-5}"
SKIP_PREFLIGHT=0
ROLLBACK=0
LIST_RELEASES=0
for arg in "$@"; do
  case "$arg" in
    --skip-preflight) SKIP_PREFLIGHT=1 ;;
    --rollback) ROLLBACK=1 ;;
    --list-releases) LIST_RELEASES=1 ;;
    --help|-h)
      sed -n '2,28p' "$0"; exit 0 ;;
    *)
      echo "deploy.sh: unknown argument: $arg" >&2; exit 2 ;;
  esac
done
# Validate mode once, up front.
case "$DEPLOY_MODE" in
  flat|symlink) ;;
  *) echo "deploy.sh: GAM_UI_DEPLOY_MODE must be 'flat' or 'symlink' (got: $DEPLOY_MODE)" >&2; exit 2 ;;
esac
if [ "$LIST_RELEASES" -eq 1 ]; then
  RELEASES_DIR="$DEPLOY_DIR/releases"
  if [ -d "$RELEASES_DIR" ]; then
    printf 'Releases under %s (newest first):\n' "$RELEASES_DIR"
    # Release names are timestamps (YYYYMMDD-HHMMSS) so lexical reverse sort =
    # chronological newest-first; do NOT rely on mtime (same-second ties).
    ls -1d "$RELEASES_DIR"/*/ 2>/dev/null | sort -r || true
    [ -L "$DEPLOY_DIR/current" ] && printf 'current → %s\n' "$(readlink "$DEPLOY_DIR/current")"
  else
    printf 'No releases dir (%s) — nothing deployed in symlink mode yet.\n' "$RELEASES_DIR"
  fi
  exit 0
fi
if [ "$ROLLBACK" -eq 1 ]; then
  CURRENT_LINK="$DEPLOY_DIR/current"
  RELEASES_DIR="$DEPLOY_DIR/releases"
  [ -L "$CURRENT_LINK" ] || { printf '  ✗ no current symlink at %s (not symlink mode?)\n' "$CURRENT_LINK" >&2; exit 1; }
  [ -d "$RELEASES_DIR" ] || { printf '  ✗ no releases dir %s\n' "$RELEASES_DIR" >&2; exit 1; }
  CUR_TARGET="$(basename "$(readlink -f "$CURRENT_LINK")")"
  # Releases newest-first (name-sort, deterministic); skip the active one and
  # pick the next-most-recent.
  PREV="$(ls -1d "$RELEASES_DIR"/*/ 2>/dev/null | sort -r | sed "s#$RELEASES_DIR/##; s#/\$##" | grep -vxF "$CUR_TARGET" | head -n1 || true)"
  if [ -z "$PREV" ]; then
    printf '  ✗ no previous release to roll back to (only current %s exists)\n' "$CUR_TARGET" >&2; exit 1
  fi
  ln -sfn "$RELEASES_DIR/$PREV" "$CURRENT_LINK"
  printf '  ✓ rolled back current → %s (was %s)\n' "$PREV" "$CUR_TARGET"
  printf '  (%s reload nginx if its alias resolves the symlink at request time)\n' "${Y:-}sudo nginx -t && sudo systemctl reload nginx${X:-}"
  exit 0
fi

# Colors (best-effort, no-op when not a TTY).
if [ -t 1 ]; then
  G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[1m'; X='\033[0m'
else
  G=''; Y=''; R=''; B=''; X=''
fi
step() { printf "\n${B}▶ %s${X}\n" "$1"; }
ok()   { printf "  ${G}✓${X} %s\n" "$1"; }
die()  { printf "  ${R}✗ %s${X}\n" "$1" >&2; exit 1; }

# --- Node ≥ 20 (Tailwind v4 needs it; bench's system Node is 18) -------------
USE_NODE="${USE_NODE:-20}"
if [ -f "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  if ! nvm use "$USE_NODE" >/dev/null 2>&1; then
    die "could not activate Node $USE_NODE via nvm (install it: nvm install $USE_NODE)"
  fi
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node >= 20 required (have $(node -v 2>/dev/null || 'none')); Tailwind v4 needs it."
fi
ok "Node $(node -v) active"

# --- npm install if node_modules is missing ----------------------------------
if [ ! -d node_modules ]; then
  step "Installing dependencies"
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  ok "dependencies installed"
fi

# --- 1. Preflight gate -------------------------------------------------------
if [ "$SKIP_PREFLIGHT" -eq 0 ]; then
  step "Preflight (go-live readiness)"
  if node scripts/preflight.mjs; then
    ok "preflight passed"
  else
    die "preflight reported blocking failures — resolve before deploy (or --skip-preflight)"
  fi
else
  printf "  ${Y}⚠${X} preflight skipped (--skip-preflight)\n"
fi

# --- 2. Build ----------------------------------------------------------------
step "Production build (vite build --mode production)"
npm run build:prod
[ -f dist/index.html ] || die "dist/index.html missing after build"
ok "build complete"

# --- 3. Sanity-check the base path ------------------------------------------
# .env.production sets VITE_BASE_URL=/gam-ui/; the built index.html must reference
# assets under /gam-ui/assets so they resolve behind nginx's /gam-ui/ alias.
if grep -q '/gam-ui/assets/' dist/index.html; then
  ok "index.html targets /gam-ui/ (asset paths OK)"
else
  die "index.html does NOT target /gam-ui/ — check .env.production VITE_BASE_URL=/gam-ui/"
fi

# --- 3b. Strip hidden sourcemaps from the published bundle -------------------
# vite.config.js emits sourcemap:'hidden' for local/error-tracking debugging,
# but the .map files must NOT ship to the public serve dir (source exposure).
# 'hidden' only suppresses the `//# sourceMappingURL=` comment — the files
# themselves would still be reachable if left in $DEPLOY_DIR. Drop them here
# unless GAM_UI_KEEP_SOURCEMAPS=1 (e.g. upload them to Sentry before deploy).
if [ "${GAM_UI_KEEP_SOURCEMAPS:-0}" != "1" ]; then
  map_count=$(find dist -name '*.map' -type f | wc -l | tr -d ' ')
  if [ "$map_count" -gt 0 ]; then
    find dist -name '*.map' -type f -delete
    ok "stripped $map_count sourcemap file(s) from dist (set GAM_UI_KEEP_SOURCEMAPS=1 to retain)"
  fi
fi

# --- 4. Publish --------------------------------------------------------------
step "Publish → ${DEPLOY_DIR} (mode: ${DEPLOY_MODE})"
if [ ! -d "$DEPLOY_DIR" ]; then
  mkdir -p "$DEPLOY_DIR" 2>/dev/null || die "cannot create $DEPLOY_DIR (need write permission; e.g. sudo chown -R \$USER $DEPLOY_DIR)"
fi
if [ ! -w "$DEPLOY_DIR" ]; then
  die "no write permission on $DEPLOY_DIR (e.g. sudo chown -R \$USER $DEPLOY_DIR)"
fi

if [ "$DEPLOY_MODE" = "symlink" ]; then
  # --- Atomic release + symlink swap (P4.1) -------------------------------
  # Build into a timestamped release dir, then atomically repoint `current`
  # with a single `ln -sfn`. If the copy fails midway, `current` still points
  # at the previous release — the live site never goes blank.
  RELEASES_DIR="$DEPLOY_DIR/releases"
  mkdir -p "$RELEASES_DIR"
  TS="$(date -u +%Y%m%d-%H%M%S)"
  RELEASE_DIR="$RELEASES_DIR/$TS"
  # Avoid release-dir collisions when two deploys land in the same second.
  while [ -e "$RELEASE_DIR" ]; do
    TS="${TS}-$RANDOM"
    RELEASE_DIR="$RELEASES_DIR/$TS"
  done
  cp -r dist/. "$RELEASE_DIR"/ || { rm -rf "$RELEASE_DIR"; die "copy to $RELEASE_DIR failed; current symlink left untouched"; }
  ok "built release $TS"
  ln -sfn "$RELEASE_DIR" "$DEPLOY_DIR/current"
  ok "current → $TS (atomic swap)"
  # Keep only the N most-recent releases; the live `current` target is never
  # deleted even if it falls outside the window (guard).
  CURRENT_TARGET="$(readlink -f "$DEPLOY_DIR/current" || true)"
  printf '%s\n' "$RELEASES_DIR"/*/ | sort -r | tail -n +"$((KEEP_RELEASES + 1))" \
    | while read -r old; do
        [ -n "$old" ] || continue
        [ "$(readlink -f "$old")" = "$CURRENT_TARGET" ] && continue
        rm -rf "$old"
      done
  KEPT="$(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  ok "kept $KEPT release(s) (GAM_UI_KEEP_RELEASES=$KEEP_RELEASES)"
  SERVE_ROOT="$RELEASE_DIR"
else
  # --- Flat copy (legacy default) -----------------------------------------
  # Clear the old deploy (stale fingerprinted assets would otherwise linger).
  find "$DEPLOY_DIR" -mindepth 1 ! -name releases -delete 2>/dev/null || find "$DEPLOY_DIR" -mindepth 1 -delete
  cp -r dist/. "$DEPLOY_DIR"/
  ok "published $(find "$DEPLOY_DIR" -type f | wc -l | tr -d ' ') file(s)"
  SERVE_ROOT="$DEPLOY_DIR"
fi

# --- 5. Verify ---------------------------------------------------------------
[ -f "$SERVE_ROOT/index.html" ] || die "$SERVE_ROOT/index.html missing after copy"
[ -d "$SERVE_ROOT/assets" ] || die "$SERVE_ROOT/assets missing after copy"
ok "verified index.html + assets present"

printf "\n${G}${B}✓ gam-ui deployed${X} → %s (mode: %s)\n" "$SERVE_ROOT" "$DEPLOY_MODE"
printf "  Serve at ${B}/gam-ui/${X} via the nginx block in deploy/nginx-gam-ui.conf\n"
if [ "$DEPLOY_MODE" = "symlink" ]; then
  printf "  nginx alias MUST resolve ${B}%s/current/${X} (see conf note).\n" "$DEPLOY_DIR"
  printf "  ${B}rollback:${X} npm run deploy -- --rollback   (${B}list:${X} --list-releases)\n"
fi
printf "  (${Y}reload:${X} sudo nginx -t && sudo systemctl reload nginx)\n"
