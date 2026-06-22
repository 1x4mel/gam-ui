# Plan — Fix phantom account in Booster / role-game sidebar sections

> Status: **IMPLEMENTED & VERIFIED** (2026-06-19). Root cause turned out to be a
> missing doctype field, not stale data — see below.

## Symptom
Account `qoc81qrj46` appeared in the **Booster → Path Of Exile 2** list even
though it had no role/game. More fundamentally: the user's requirement was that
the **Booster / Trader / Item** sidebar sections render **dynamically** from
whatever accounts in the DB carry that role, **categorised by game** — and that
assigning/clearing a role or game in the UI is reflected **live, without F5**.

## Root cause (proven)

### 1. PRIMARY — `role` was an orphan column (the data-layer bug)
[`tabGAM Account`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.json)
**had no `role` field in its doctype JSON**, yet `role` existed as a real
`varchar(140)` column in the DB (not a Custom Field — confirmed empty result on
`tabCustom Field WHERE dt='GAM Account'`). It was populated only out-of-band.

Because Frappe only persists fields declared in doctype meta,
[`save_account`](../frappe-bench/apps/gam/gam/api.py:2032) did
`doc.role = _normalize_role_value(...)` in **memory** but `doc.save()` never
wrote it — the column stayed `NULL` for every account saved through the UI. So
role assignment was a silent no-op: the sidebar's role sections could never
reflect UI edits, and the data that *did* exist (e.g. `efquhacv6m` → `BOOSTER`)
came from manual/legacy writes.

`get_games_by_role` / `get_accounts_list` both filter on `a.role`, so a NULL role
means the account is invisible to every role section — and any cached sidebar
state (the original "phantom" report) was simply stale.

### 2. No live refresh of the sidebar cache
`save_account` / `add_account_game` / `delete_account` never emitted
`gam_account_changed`, and [`AppLayout`](gam-ui/src/components/AppLayout.vue)
loaded [`gamesByRole`](gam-ui/src/composables/useGamMetadata.js:129) **once** on
mount and never reloaded it. Any legitimate edit therefore left the sidebar stale
until a hard reload.

### 3. No granular remove-game path
Only a full child-table replace existed (and only when the `games` key was sent);
there was no `remove_account_game` and no per-game remove button in the UI.

## Fix (implemented)

### Backend — [`gam/api.py`](../frappe-bench/apps/gam/gam/api.py)
- **[`_normalize_role_value`](../frappe-bench/apps/gam/gam/api.py:2003)** —
  canonicalize role input (value or label, case-insensitive) to the GAM List
  Option *value*. `save_account` now stores `doc.role` via it.
- **`emit_account_changed(...)`** now fired from `save_account` (`"save"`),
  `add_account_game` (`"add_game"`), the new
  [`remove_account_game`](../frappe-bench/apps/gam/gam/api.py:2112)
  (`"remove_game"`), and `delete_account` (`"delete"`, before the delete).
- **`remove_account_game(account, game=None, row_name=None)`** — admin-only,
  removes a single `GAM Account Game` row (by row_name or first game match),
  re-picks `is_main`, saves, emits.

### Doctype — [`gam_account.json`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.json)
- Added the **`role`** field (`Data`, `in_list_view` + `in_standard_filter`).
  The column already existed as `varchar(140)`, so the new `Data` field is
  byte-compatible; **existing data (e.g. `efquhacv6m` = `BOOSTER`) is preserved**.
  Ran `bench --site erp.local migrate` to register the field in meta — now
  `doc.save()` actually persists `role`.

### Frontend — `gam-ui`
- [`AppLayout.vue`](gam-ui/src/components/AppLayout.vue) subscribes to the
  `gam_account_changed` realtime event → `loadGamesByRole(true)` (mount/umount).
- [`AccountListView.vue`](gam-ui/src/views/AccountListView.vue) and
  [`AccountDetailView.vue`](gam-ui/src/views/AccountDetailView.vue) call
  `loadGamesByRole(true)` on create/edit/delete/add-game/remove-game.
- `AccountDetailView.vue`: per-game **"✕ Gỡ"** button → `ConfirmDialog` →
  `gam.api.remove_account_game` → reload + `loadGamesByRole(true)`.
- [`AccountFormModal.vue`](gam-ui/src/components/AccountFormModal.vue) already
  binds the role `<select>` to the List Option **value** and sends it — so with
  the field now declared, role selection actually persists.

## Tests — [`test_api.py`](../frappe-bench/apps/gam/gam/tests/test_api.py)
New `TestAccountRoleGameReflow` (13 tests) covering: role label↔value
canonicalization, `save_account` persisting the canonical role, the realtime
emit on save/add-game/remove-game (mocked), `remove_account_game` by row_name
and by game, is_main re-pick, and the not-found error.

## Verification
| Check | Result |
|------|--------|
| `python3 -m py_compile api.py test_api.py` | `PY_COMPILE_OK` |
| `cd gam-ui && npm run build` | ✓ built in 2.73s |
| `bench --site erp.local migrate` | ✓ (registered `role` field) |
| `bench --site erp.local run-tests --module gam.tests.test_api` | 44 OK |
| `bench --site erp.local run-tests --app gam` | **70 OK** |

## Follow-ups (not blocking)
- e2e (Playwright) for the live sidebar reflow: assign role+game → section
  appears without F5; remove → disappears. Needs the dev server + TOTP harness.
- Reconcile the backend generator (`.gen_api.py`) with the hand-edited `api.py`.

## Files touched
| Area | File |
|------|------|
| Doctype | [`gam_account.json`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.json) — added `role` field |
| Backend | [`gam/api.py`](../frappe-bench/apps/gam/gam/api.py) — normalize, emit, `remove_account_game` |
| Backend tests | [`test_api.py`](../frappe-bench/apps/gam/gam/tests/test_api.py) — `TestAccountRoleGameReflow` |
| Sidebar | [`AppLayout.vue`](gam-ui/src/components/AppLayout.vue) |
| List view | [`AccountListView.vue`](gam-ui/src/views/AccountListView.vue) |
| Detail view | [`AccountDetailView.vue`](gam-ui/src/views/AccountDetailView.vue) |
