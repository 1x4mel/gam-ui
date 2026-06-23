# Plan — Account Hierarchy (Gốc→Thân→Cành) + Admin Tabs + Settings Merge

> Status: **DESIGN — awaiting approval before implementation.**
> Mode: produced in `ask` mode. After approval, switch to `code` mode.
> Scope: backend doctype `GAM Account` (tree + billing) · backend `gam/api.py` · gam-ui admin views + router + sidebar.
> Related/supersedes partial overlap in [`account-role-game-first-class-binding.md`](account-role-game-first-class-binding.md).

---

## 0. Recap of the decided model

Three-level tree the admin manages, while the member side keeps its existing flat `(role, game)` logic.

```
GỐC   GAM Email                  (email + password + recovery + Cloudflare inbox)
 │
THÂN  GAM Account  level=PLATFORM (Steam / Battle.net / Xbox … OR a rented/one-time identity)
 │        billing_type + active_until + renewal fields
 │
CÀNH  GAM Account  level=GAME     (created ON a platform, OR standalone directly on an email)
```

- **One** doctype `GAM Account` with `account_level` + self-referential `parent_account` (Frappe handles self-Link fine).
- `email` is denormalized on EVERY node → login-code resolution never walks the tree.
- Credentials may live on the PLATFORM node OR on a standalone GAME node → a small `resolve_account_credentials()` helper picks the right one.
- Member-facing layer [`GAM Account Role Game`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account_role_game/gam_account_role_game.json) is **unchanged in role**; its `account` field now points to the GAME-level node.

---

## 1. DocType changes

### 1.1 `GAM Account` — add tree + billing fields
Path: [`gam/gam/doctype/gam_account/gam_account.json`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.json)

| field | fieldtype | notes |
|---|---|---|
| `account_level` | Select `PLATFORM\nGAME` | reqd, default `GAME` |
| `parent_account` | Link → `GAM Account` | set only when `level=GAME` and created on a platform |
| `standalone` | Check | 1 when a GAME node is created directly on an email (no platform) |
| `billing_type` | Select `ONE_TIME\nRENTAL\nSUBSCRIPTION` | default `ONE_TIME` |
| `active_until` | Datetime | expiry; reqd when `billing_type != ONE_TIME` |
| `renewal_lead_days` | Int | default 3 — days before expiry to flag |
| `auto_renew` | Check | default 0 |
| `renewal_cost` | Currency | optional |
| `last_renewed_at` | Datetime | optional audit |

Keep all existing fields (`platform`, `username`, `account_password`, `totp_secret`, `email`, `status`, `notes`, `purchased_at`, …).

**Remove (after migration):** the `games` child-table field on `GAM Account` (the old `GAM Account Game` child). Each game is now a GAME-level node. The child doctype `GAM Account Game` is retired.

### 1.2 Controller validations — [`gam_account.py`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.py)
`validate()`:
- `PLATFORM` ⇒ `parent_account` must be blank, `standalone` = 0.
- `GAME` + `parent_account` set ⇒ `standalone` = 0; parent must be a `PLATFORM` account and share the same `email` (or email auto-inherited from parent).
- `GAME` + no `parent_account` ⇒ `standalone` = 1 (created directly on email).
- `billing_type != ONE_TIME` ⇒ `active_until` required.
- Prevent `parent_account` cycle (a node cannot be its own ancestor).

### 1.3 `GAM Account Role Game` (member layer) — minimal alignment
Path: [`gam/gam/doctype/gam_account_role_game/gam_account_role_game.json`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account_role_game/gam_account_role_game.json)
No structural change. Add a `description` note that `account` should reference a GAME-level node (the entity the member reveals/requests code for). Optionally add `game_account` Link alias for clarity — keep `account` to avoid breaking existing rows.

---

## 2. Backend `gam/api.py` changes

### 2.1 `save_account(values, name=None)` — extend
Path: [`gam.api.save_account`](../frappe-bench/apps/gam/gam/api.py:2664)
- Read new keys: `account_level`, `parent_account`, `standalone`, `billing_type`, `active_until`, `renewal_lead_days`, `auto_renew`, `renewal_cost`.
- Branch on `account_level`:
  - `PLATFORM`: platform-identity fields (platform/username/password/totp/email) + billing.
  - `GAME`: `parent_account` (or `standalone`); if standalone, username/password/totp/email are required here; if under a platform, credentials may be empty (resolved from parent).
- Keep the existing `role_games` binding flow (`_apply_account_role_games`) — bindings attach to the GAME node.

### 2.2 New `get_accounts_list` filter keys
Path: [`gam.api.get_accounts_list`](../frappe-bench/apps/gam/gam/api.py:1242)
Add optional filters: `account_level` (PLATFORM/GAME), `parent_account`, `billing_type`, `renewal_due` (bool → `active_until BETWEEN now AND now + renewal_lead_days` AND `billing_type != ONE_TIME`). When `account_level` not given, default to `GAME` for the operational account list (so the member view keeps showing game nodes).

### 2.3 New helpers
- `resolve_account_credentials(game_account_name)` → returns `{"username","account_password","totp_secret","email"}` from the GAME node if it has its own, else from its `parent_account`, else None.
- `get_platform_accounts()` — admin-only list of `account_level=PLATFORM` with computed `children_count` and `renewal_state`.
- `get_game_accounts(filters)` — admin-only list of `account_level=GAME` with `parent_username` + `email_address` joined.

### 2.4 Renewal scheduler
New file `gam/tasks.py` (or extend `gam/api.py`):
```python
def flag_expiring_accounts():
    # WHERE account_level IN (PLATFORM,GAME) AND billing_type != 'ONE_TIME'
    #   AND status='ACTIVE' AND active_until <= NOW() + INTERVAL renewal_lead_days DAY
    # → publish_realtime('gam_renewals_changed')
```
Register in `hooks.py` → `scheduler_events.daily`.

### 2.5 Retire legacy code (after migration)
`get_games_by_role()` alias and any 3-table JOIN over the old child table → already replaced by `get_role_game_sections()` aggregating `GAM Account Role Game`. Confirm no leftover callers, then delete.

---

## 3. gam-ui — new admin tabs + settings merge

### 3.1 Router ([`gam-ui/src/router/index.js`](gam-ui/src/router/index.js))
Add/replace admin routes:
```
{ path: 'admin/platforms', component: () => import('../views/PlatformAccountsView.vue'), name: 'PlatformAccountsView', meta: { roles: ['GAM Admin'] } },
{ path: 'admin/game-accounts', component: () => import('../views/GameAccountsView.vue'), name: 'GameAccountsView', meta: { roles: ['GAM Admin'] } },
{ path: 'admin/settings', component: () => import('../views/AdminSettingsView.vue'), name: 'AdminSettingsView', meta: { roles: ['GAM Admin'] } },
```
**Remove** `admin/games` route. The old [`GamesView.vue`](gam-ui/src/views/GamesView.vue) content (Games / Servers / DLC / List Options tabs) is folded into `AdminSettingsView.vue` as tabs.

### 3.2 Sidebar ([`AppLayout.vue`](gam-ui/src/components/AppLayout.vue) `adminNav`)
Replace the `Tài khoản` + `Game & DLC` + `Cài đặt GAM` entries with:
```
{ to: '/admin/platforms', icon: '🖥️', label: 'Tài khoản Platform' },
{ to: '/admin/game-accounts', icon: '🎮', label: 'Tài khoản Game' },
{ to: '/admin/settings', icon: '🛠️', label: 'Cài đặt' },
```
Keep other admin entries (Quản lý Email, Code Patterns, Webhook, logs, access).

### 3.3 New view `PlatformAccountsView.vue` (THÂN)
- PageHeader "Tài khoản Platform".
- Filters: platform chips (reuse `platformOptions`), status, `renewal_due` toggle, search by username.
- "+ Thêm" → `PlatformFormModal.vue` (fields: platform, username, password, totp, email Link, status, source, notes, **billing_type**, **active_until**, **renewal_lead_days**, **auto_renew**, **renewal_cost**).
- Card shows platform icon, username, email, status, billing_type, `active_until` countdown badge (red when `renewal_due`), child game-accounts count, edit/delete + a "Gia hạn" action (extends `active_until` by a period).
- Calls `gam.api.get_platform_accounts` (paginated).

### 3.4 New view `GameAccountsView.vue` (CÀNH)
- PageHeader "Tài khoản Game".
- Filters: parent-platform chips, standalone toggle (Game-on-platform vs Game-on-email), role chips, game, status, search by username.
- "+ Thêm" → `GameAccountFormModal.vue`:
  - Toggle "Trên Platform" / "Standalone".
    - On-platform ⇒ `parent_account` SearchableSelect (PLATFORM list) + optional own username/password/totp (blank ⇒ resolve from parent). `email` auto-filled from parent (read-only).
    - Standalone ⇒ email Link + username/password/totp required.
  - Role-game binding rows (reuse the existing `AccountFormModal` games block: game + role + server + is_main + notes + dlcs) — these become `GAM Account Role Game` rows on this GAME node.
- Card shows game(s), parent platform (or "📧 Standalone"), email, status, role badges, reveal/credentials actions.
- Calls `gam.api.get_game_accounts`.

### 3.5 Merge `GamesView.vue` + `AdminSettingsView.vue` → single `AdminSettingsView.vue`
Tabs inside one view:
1. **Game & DLC** — Games / Servers / DLC management (moved verbatim from [`GamesView.vue`](gam-ui/src/views/GamesView.vue)).
2. **Tuỳ chọn** — Platform / Role / Status list options (the existing configurable list-option tabs).
3. **Ngưỡng** — the governance thresholds currently in [`AdminSettingsView.vue`](gam-ui/src/views/AdminSettingsView.vue) (max_online_hours, min_rested_hours, hard_cap_online_hours, block_logout_with_active_lease).
Delete `GamesView.vue`.

### 3.6 Member side — no logic change
[`RoleGameAccountsView.vue`](gam-ui/src/views/RoleGameAccountsView.vue), [`AccountDetailView.vue`](gam-ui/src/views/AccountDetailView.vue) keep working. Only ensure reveal/login-code paths call `resolve_account_credentials()` so credentials resolve up the tree. The sidebar role|game sections (driven by `GAM Account Role Game` + `get_role_game_sections`) are unchanged.

---

## 4. Data migration (one patch)

New patch `gam/patches/migrate_account_hierarchy.py`:
1. Add new fields to `GAM Account` JSON + run `bench --site gam.local migrate` (creates columns).
2. For each existing `GAM Account`:
   - If it represents a platform identity (has platform credentials) → set `account_level=PLATFORM`, `standalone=0`. Heuristic: accounts whose old `games` child was non-empty become PLATFORM; the games become children. (Confirm heuristic with user before running.)
   - For each row in the old `GAM Account Game` child table → create a `GAM Account (account_level=GAME, parent_account=<platform>, email=<inherited>)`, copying `purchased_at`/`notes`/`dlcs`.
3. Repoint `GAM Account Role Game.account` from the old platform doc to the new GAME-level doc (match by game). Log unmatched rows (don't silently drop).
4. Set `active_until`/`billing_type` defaults: existing accounts → `ONE_TIME` (no expiry). Admin backfills rentals afterward.
5. After verification: drop the `games` child-table field on `GAM Account` and remove the `GAM Account Game` doctype.
6. `emit_role_sections_changed()` after re-pointing so the sidebar re-aggregates.

Add the patch to [`gam/patches.txt`](../frappe-bench/apps/gam/gam/patches.txt).

---

## 5. Permission model (unchanged philosophy)

| | Admin | Member |
|---|---|---|
| Tree (Email/Platform/Game) | full CRUD via new views | not exposed |
| Renewals dashboard | yes | no |
| `(role, game)` list + reveal + code | yes (bypass) | gated by `GAM Access Grant` key `ROLE_GAME\|role\|game` |
| Source of truth for member view | — | `GAM Account Role Game` |

Admin owns the tree + billing; member consumes the binding. The two are decoupled.

---

## 6. Renewals dashboard detail

- In `PlatformAccountsView` and (optionally) a top-level "Sắp hết hạn" filter: `billing_type != ONE_TIME` AND `active_until <= now + lead`.
- Badge states: 🟢 active / 🟡 expiring soon / 🔴 expired.
- "Gia hạn" action: modal → pick period (days) → updates `active_until`, sets `last_renewed_at=now`, optional `renewal_cost`. Fires `gam_renewals_changed`.
- Realtime event `gam_renewals_changed` refreshes the lists.

---

## 7. Rollout order

1. Backend: extend `GAM Account` JSON + controller validations.
2. Migration patch (with dry-run report) → run on a backup.
3. `api.py`: new endpoints + `resolve_account_credentials`.
4. gam-ui: `PlatformAccountsView` + `GameAccountsView` + modals.
5. gam-ui: merge `GamesView` into `AdminSettingsView`; update router + sidebar.
6. Scheduler `flag_expiring_accounts` + `hooks.py`.
7. Retire `GAM Account Game` child + legacy `get_games_by_role` alias.
8. E2E: extend [`gam-admin-settings.spec.js`](gam-ui/tests/e2e/gam-admin-settings.spec.js) + [`gam-role-game-view.spec.js`](gam-ui/tests/e2e/gam-role-game-view.spec.js); add `gam-platform-accounts.spec.js` and `gam-game-accounts.spec.js`.

---

## 8. Open questions for user (before code)

1. Migration heuristic for PLATFORM vs GAME split — is "account with games = PLATFORM, each game = GAME child" correct, or are existing accounts already mostly standalone?
2. Should billing/renewal also apply to standalone GAME accounts, or only PLATFORM-level?
3. Renewal action: just extend `active_until`, or also keep a `GAM Renewal Log` for cost reporting?
