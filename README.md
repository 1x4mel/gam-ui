# GAM — Game Account Manager (Frontend)

Vue 3 SPA for **GAM** (Game Account Manager): centralized management of game
accounts + automated verification-code distribution via Cloudflare Email Worker.

This repository contains **only the frontend** (`gam-ui/`). The Frappe backend is
a separate custom app (`gam`) maintained in its own repository.

> **Repo layout**
>
> | Path        | What                                              |
> |-------------|---------------------------------------------------|
> | `gam-ui/`   | Vue 3 + Vue Router 4 + Tailwind v4 SPA (this repo) |
> | `md/`       | Architecture, design & rules docs                 |
> | `plans/`    | Feature plans (architect notes)                   |
> | `.github/`  | CI (`gam-ci.yml`: lint, unit, TOTP, build)        |

---

## Prerequisites

| Tool   | Version          |
|--------|------------------|
| Node   | 20 (see `.nvmrc`)|
| npm    | 10+              |
| Frappe | v15 (backend)    |
| Python | 3.11+ (backend)  |

---

## Local development

```bash
cd gam-ui
nvm use                  # pins Node 20 via ../.nvmrc
npm ci                   # install from lockfile
npm run dev              # Vite dev server (proxies /api + /socket.io to bench)
```

Env defaults are committed and secret-free:

- [`gam-ui/.env.development`](gam-ui/.env.development) — dev targets
- [`gam-ui/.env.production`](gam-ui/.env.production) — prod base path `/gam-ui/`

Override locally with `.env.local` (gitignored) — never commit real secrets.

---

## Tests

```bash
npm run lint          # eslint
npm run test:unit     # vitest
npm run test:totp     # RFC-6238 TOTP vectors
npm run test:e2e      # Playwright (needs a live bench — run on dev server)
```

---

## Production build & deploy

```bash
npm run build         # vite build (uses .env.production)
npm run deploy        # preflight gate → build → publish → verify
```

See [`gam-ui/deploy/README.md`](gam-ui/deploy/README.md) for the full nginx +
Cloudflare Email Worker deployment guide.

---

## Fresh server setup (GAM full stack)

1. **Backend** — clone the `gam` Frappe app repo, then in a Frappe v15 bench:
   ```bash
   bench get-app gam <path-or-url-to-backend-repo>
   bench --site <site> install-app gam
   bench --site <site> migrate
   ```
2. **Frontend** — clone this repo:
   ```bash
   cd gam-ui && npm ci && npm run build
   ```
3. Serve `dist/` behind nginx at `/gam-ui/`, proxying `/api` + `/socket.io` to bench.

See [`md/PROJECT_OVERVIEW.md`](md/PROJECT_OVERVIEW.md) and
[`md/ARCHITECTURE.md`](md/ARCHITECTURE.md) for the full system design.

---

## CI

[`.github/workflows/gam-ci.yml`](.github/workflows/gam-ci.yml) runs lint, unit
tests, TOTP vectors and a production build on every PR / push to `main`.
