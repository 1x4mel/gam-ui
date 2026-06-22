# Plan — First-class `GAM Account Role Game` binding (dynamic, realtime, permission-aligned role/game sections)

> Status: **DESIGN — awaiting user approval before code.**
> Mode: Architect. After approval, switch to `code` mode to implement.
> Scope: gam-ui SPA + backend `gam/api.py` + new doctype + one-time data migration.
> Supersedes: [`plans/sidebar-role-game-sections.md`](sidebar-role-game-sections.md) and
> [`plans/fix-booster-phantom-account.md`](fix-booster-phantom-account.md) (which patched the
> *derived* model; this plan replaces it with a *first-class* model).

---

## 1. Problem statement (why the current design is unsuitable)

The Trader / Booster / Item sidebar **sections** must render **dynamically and in realtime**
based on which accounts carry which `(role, game)` combination, and the sections must be
**permission-driven** (admin grants a user a `(role, game)` → the user sees that section + the
accounts under it).

Today the sections are a *derived, read-time side-effect* of admin account CRUD:

- [`get_games_by_role()`](../frappe-bench/apps/gam/gam/api.py:590) runs a 3-table JOIN
  (`tabGAM Account ⋈ tabGAM Account Game ⋈ tabGAM Game`) every render, row-filtered by
  `has_access`.
- The binding is **split across two places**: [`GAM Account.role`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.json:55)
  (account-level) and the [`GAM Account Game`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account_game/gam_account_game.json:1)
  child table (game-level). The permission unit `role|game` therefore does **not** correspond
  to any single row.
- Realtime reuses the generic [`gam_account_changed`](gam-ui/src/components/AppLayout.vue:387)
  event (also fired on password/status/usage edits) → full JOIN re-run on every edit.
- The `role` column was literally an orphan until the last fix ([`fix-booster-phantom-account.md`](fix-booster-phantom-account.md)) —
  proof that the derived model has no integrity and is hard to reason about.
- A single account can only carry **one** role for **all** its games, which blocks the real
  business model (an account can be a *Trader* for game A and a *Booster* for game B).

## 2. Decided design (confirmed with user)

| Decision | Choice |
|----------|--------|
| Decoupling model | **Phương án B — First-class Binding** |
| 1 account → nhiều role theo game? | **CÓ** (each `(account, game)` row has its own role) |
| Field `role` trên `GAM Account` | **GỠ BỎ** hoàn toàn sau migrate (account = identity/credentials only) |
| Child table `GAM Account Game` | **NÂNG CẤP** lên top-level doctype `GAM Account Role Game`, thêm `account` + `role`; **xóa** child table cũ |
| Row có role rỗng | **KHÔNG** — `role` is `reqd: 1`; migration reports (not silently creates) accounts lacking a role |
| UX form account | **Role select per game row** (form gửi list `{game, role, server, is_main, notes, dlcs}`) |
| Permission unit | `ROLE_GAME\|role\|game` — already implemented in [`GAM Access Grant`](../frappe-bench/apps/gam/gam/gam/doctype/gam_access_grant/gam_access_grant.json); now 1:1 with a binding row |
| Section realtime event | **NEW** `gam_role_sections_changed` (dedicated; decoupled from `gam_account_changed`) |

## 3. Architecture (after)

```mermaid
flowchart LR
  subgraph Identity
    ACC[GAM Account: platform/username/email/password/totp/status/notes]
  end
  subgraph Binding["Binding — 1 nguồn sự thật"]
    ARG[GAM Account Role Game: account + role + game + server + is_main + notes]
    ARG --> DLC[GAM Account Game DLC child]
  end
  subgraph Sections["Section subsystem — read path tách riêng"]
    API1[get_role_game_sections: aggregate ARG, gated by has_access]
    API2[get_accounts_list: filter by role+game via ARG]
    RT[gam_role_sections_changed realtime event]
  end
  ACC -.1:n.-> ARG
  ARG --> API1
  ARG --> API2
  ARG --> RT
  GRANT[GAM Access Grant: ROLE_GAME|role|game] -.gates.-> API1
  GRANT -.gates.-> API2
  API1 --> SB[AppLayout sidebar sections]
  RT --> SB
```

**Why this fixes every problem in §1:**
- Section = aggregate of one table, **1:1 with the permission key** → symmetric, auditable.
- Read path is a single indexed query (no 3-table JOIN), gated identically for sections + list.
- Realtime event is dedicated → editing a password/status/usage does **not** reflow the sidebar.
- No orphan/phantom risk: every binding row carries an explicit `(account, role, game)`.
- Multiple roles per account are first-class (different rows, different roles).

## 4. Data model changes

### 4.1 NEW doctype: `GAM Account Role Game` (top-level)
Path: [`gam/gam/doctype/gam_account_role_game/`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account_role_game/)
Fields (mirror the old child table + 2 additions):

| field | type | notes |
|-------|------|-------|
| `account` | Link → `GAM Account`, **reqd**, `in_list_view` | the parent identity |
| `role` | Data, **reqd**, `in_list_view`, `in_standard_filter` | canonicalized value (via `_normalize_role_value`) |
| `game` | Link → `GAM Game`, **reqd**, `in_list_view` | |
| `server` | Link → `GAM Game Server` | |
| `is_main` | Check, `in_list_view` | at most one per `account` (enforced in API) |
| `notes` | Data | |
| `dlcs` | Table → `GAM Account Game DLC` | child (re-parented from the old child table) |
| `account_created_at` / `purchased_at` | Datetime | carried from old rows where present |

- Indexes: `(account)`, `(role, game)`, `(account, game)` (unique-ish; one role per (account, game) — see §6 Q1).
- Permissions: `GAM Admin` full CRUD; `GAM Member` read-only; `System Manager` full.
- Title field: `game` (or computed `role · game`). `track_changes = 1`.
- `naming_rule`: default hash (current behavior) is fine.

### 4.2 NEW child table (or reuse): `GAM Account Game DLC`
The existing [`GAM Account Game DLC`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account_game_dlc/) child
points at `parenttype = GAM Account Game`. We **repurpose** it to `parenttype = GAM Account Role Game`
(no schema change needed — Frappe child tables are parenttype-agnostic; the migration just rewrites
`parent`/`parenttype`). If cleaner, create `GAM Account Role Game DLC` as a copy; decision left to the
implementer (recommend repurpose to avoid a second migration).

### 4.3 `GAM Account` — remove `role` + `games`
After migration:
- Delete field `role` ([current json line 55–61](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.json:55)).
- Delete field `games` (Table → `GAM Account Game`) ([current json line 78–82](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.json:78)).
- Update [`generateAccount`](.gen_doctypes.py:1) / generator to stop emitting these.
- The DB columns stay (Frappe doesn't drop columns) → safe rollback; doctype meta simply ignores them.

### 4.4 `GAM Account Game` — retire
The old child doctype is no longer referenced by `GAM Account` after §4.3. Keep the doctype file for
migration rollback safety, but it becomes dead. Optionally remove in a follow-up.

## 5. Migration patch (one-time, post_model_sync)

File: [`gam/gam/patches/migrate_account_role_game.py`](../frappe-bench/apps/gam/gam/gam/patches/migrate_account_role_game.py)
Register in [`gam/gam/patches.txt`](../frappe-bench/apps/gam/gam/gam/patches.txt) under `[post_model_sync]`
(**after** `seed_list_options` so role values exist).

`execute()`:
1. Guard: skip if `tabGAM Account Role Game` already has rows (idempotent).
2. For each `GAM Account` row, read `role` (current) and its `GAM Account Game` child rows.
3. For each child row with a non-empty account `role`:
   - Create a `GAM Account Role Game` doc: `account`, `role` (normalized), `game`, `server`,
     `is_main`, `notes`, plus re-parent its DLC child rows (rewrite `parent`/`parenttype`).
4. **Report** (log + return summary, do NOT silently create) accounts that have:
   - `role` set but **no** game rows → no binding possible; admin must add games with roles post-migrate.
   - game rows but **no** account `role` → cannot infer role; **do not** create role-less rows
     (violates `reqd`). Collect names into a report.
5. Commit. Print `{"migrated": n, "skipped_no_role": [...], "skipped_no_game": [...]}`.

**Safety:**
- Run `bench --site <site> migrate` to register the new doctype **before** this patch.
- Wrap in try/except + `frappe.log_error`; never partial-commit (single transaction).
- Keep `GAM Account.role` column until §4.3 lands (read source here), then remove field from doctype.

## 6. Backend (`gam/api.py`) rewrites

> All edits reconcile into the deployed [`gam/api.py`](../frappe-bench/apps/gam/gam/api.py). The
> generator [`.gen_api.py`](.gen_api.py) is updated in parallel to stay in sync.

### 6.1 `save_account(values, name=None)` — remove `role`; accept `role_games`
- Remove `doc.role = _normalize_role_value(...)` ([line 2057](../frappe-bench/apps/gam/gam/api.py:2057)).
- Remove `_apply_account_games(doc, ...)` call ([line 2068–2069](../frappe-bench/apps/gam/gam/api.py:2068)).
- Accept new optional `values["role_games"]` = list of
  `{game, role, server?, is_main?, notes?, dlcs?}`. **Validation:** each row requires `game` AND `role`
  (`frappe.throw` otherwise). On save:
  - Build the set of incoming `(game, role)` keys.
  - Delete existing `GAM Account Role Game` rows for this account whose `(game, role)` is not in the set.
  - Upsert (update existing, insert new) rows for the incoming set; enforce **single `is_main` per account**.
  - Re-parent DLC child rows per row.
- After save: `emit_account_changed(doc.name, "save")` (keep, for list/detail lock state) **AND**
  `emit_role_sections_changed()` (new — see §7).

### 6.2 Replace `add_account_game` / `remove_account_game`
Rename intent to `add_account_role_game(account, role, game, server, is_main, notes, dlcs)` /
`remove_account_role_game(account, role=None, game=None, row_name=None)`. Keep the
`_require_gam_admin()` guard, the single-`is_main` enforcement, DLC validation, and the realtime
emits (now both events). Provide thin deprecated aliases forwarding to the new names for one release
(optional).

### 6.3 `get_games_by_role()` → `get_role_game_sections()`
Rewrite to aggregate the new table:
```python
SELECT arg.role AS role, arg.game AS game, gg.game_name AS game_name,
       COUNT(DISTINCT arg.account) AS count
FROM `tabGAM Account Role Game` arg
LEFT JOIN `tabGAM Game` gg ON gg.name = arg.game
WHERE IFNULL(arg.role, '') != ''
GROUP BY arg.role, arg.game, gg.game_name
ORDER BY arg.role, gg.game_name
```
Then row-filter by `has_access(user, "GAM", "ROLE_GAME", f"{role}|{game}")` exactly as today.
Same return shape `{role: [{game, game_name, count}]}`. (Keep the old name as an alias for one release.)

### 6.4 `get_accounts_list(filters)` — join via the new table
- Replace `a.role = %s` ([line 974](../frappe-bench/apps/gam/gam/api.py:974)) with an
  `EXISTS (SELECT 1 FROM tabGAM Account Role Game x WHERE x.account = a.name AND x.role = %s)`.
- Replace the game `EXISTS` ([line 988–993](../frappe-bench/apps/gam/gam/api.py:988)) to target the new table.
- When **both** `role` and `game` are present, collapse to a single `EXISTS ... x.role=%s AND x.game=%s`
  (this is the exact permission key — server-side guard at [line 963–966](../frappe-bench/apps/gam/gam/api.py:963) is unchanged).
- Inline game expansion ([line 1016–1039](../frappe-bench/apps/gam/gam/api.py:1016)) now reads from
  `tabGAM Account Role Game` (include `role` per game so cards can show it).
- Remove `a.role` from the SELECT list ([line 1000](../frappe-bench/apps/gam/gam/api.py:1000)).

### 6.5 `get_account_stats()` — by_role from the new table
`by_role` ([line 571–580](../frappe-bench/apps/gam/gam/api.py:571)) becomes a `COUNT(DISTINCT account)`
grouped by `role` over `tabGAM Account Role Game` (an account with two roles counts in both). Document
this semantic change.

### 6.6 `resolve_doc_names()` + any other reader of `tabGAM Account Game`
Audit and redirect: [`resolve_doc_names`](../frappe-bench/apps/gam/gam/api.py:1111) `main_game_name`
subquery ([line 1114–1118](../frappe-bench/apps/gam/gam/api.py:1114)), `get_account_names_for_game`
([line 912](../frappe-bench/apps/gam/gam/api.py:912)), activity timeline, etc. Grep
`tabGAM Account Game` across the app and redirect each to the new table.

## 7. Realtime — dedicated section event

File: [`gam/gam/realtime.py`](../frappe-bench/apps/gam/gam/realtime.py)
Add:
```python
def emit_role_sections_changed():
    """Broadcast that the (role, game) section catalog changed.
    Dedicated to the sidebar section subsystem so it does NOT piggyback on
    gam_account_changed (which also fires for password/status/usage edits)."""
    try:
        frappe.publish_realtime("gam_role_sections_changed", {}, broadcast=True)
    except Exception:
        frappe.log_error("gam: emit_role_sections_changed failed")
```
Fire it from: `save_account` (when `role_games` present), `add_account_role_game`,
`remove_account_role_game`, `delete_account`. **Do not** fire from password/status/usage/notes edits.

## 8. Frontend (`gam-ui`)

### 8.1 [`AccountFormModal.vue`](gam-ui/src/components/AccountFormModal.vue)
- Remove the account-level Role `<select>` ([line 67–71](gam-ui/src/components/AccountFormModal.vue:67)) and
  `form.role` ([line 173](gam-ui/src/components/AccountFormModal.vue:173)).
- In each game row ([line 95+](gam-ui/src/components/AccountFormModal.vue:95)) add a Role `<select>`
  (binds `row.role`, options from `roleOptions`). Validation: a row with `game` but no `role` blocks
  submit with a clear error.
- `addGameRow()` ([line 201](gam-ui/src/components/AccountFormModal.vue:201)) now seeds `{ game: '', role: '', server: '', is_main: 0, notes: '', dlcs: [] }`.
- Payload build ([line 230+](gam-ui/src/components/AccountFormModal.vue:230)): send `role_games` instead
  of `games`; include `role` per row.
- Seed existing rows from `account.role_games` (new field returned by `get_accounts_list` /
  detail API) instead of `account.games`.

### 8.2 [`AppLayout.vue`](gam-ui/src/components/AppLayout.vue) — dedicated realtime
- Keep `roleSections` + `visibleGamesForRole` logic ([line 323–329](gam-ui/src/components/AppLayout.vue:323)) —
  unchanged (it already reads `gamesByRole` + `hasRoleGame`).
- **Swap** the subscription: replace
  `realtime.on('gam_account_changed', onAccountSidebarRefresh)` ([line 387](gam-ui/src/components/AppLayout.vue:387))
  with `realtime.on('gam_role_sections_changed', onAccountSidebarRefresh)`; update the `off` ([line 392](gam-ui/src/components/AppLayout.vue:392)).
- `onAccountSidebarRefresh` → `loadGamesByRole(true)` (rename internal label if desired; keep function name for diff clarity).

### 8.3 [`AccountListView.vue`](gam-ui/src/views/AccountListView.vue)
- The existing `onAccountChanged` ([line 228, 246, 275](gam-ui/src/views/AccountListView.vue:228))
  calls `loadGamesByRole(true)` on `gam_account_changed`. Split: keep list refresh on
  `gam_account_changed`, but move the **section** reflow to `gam_role_sections_changed`.
- `gameFilter` / `roleFilter` behavior is unchanged (server now filters via the new table).

### 8.4 [`AccountDetailView.vue`](gam-ui/src/views/AccountDetailView.vue)
- "Add Game" dialog now requires `role`; calls `add_account_role_game`.
- Per-game "✕ Gỡ" button calls `remove_account_role_game`.
- Both refresh the view **and** `loadGamesByRole(true)` (the latter can be dropped now that
  `AppLayout` listens to the dedicated event — keep only if detail view is opened standalone).

### 8.5 [`useGamMetadata.js`](gam-ui/src/composables/useGamMetadata.js)
- `loadGamesByRole` now calls `gam.api.get_role_game_sections` (keep the function name for diff clarity).
- No other change.

## 9. Tests

### 9.1 Backend — [`gam/tests/test_api.py`](../frappe-bench/apps/gam/gam/tests/test_api.py)
Add `TestAccountRoleGameBinding`:
- `save_account` with `role_games` creates/updates `GAM Account Role Game` rows; rejects row missing `role`.
- Multiple roles for the same account on different games round-trip.
- Single `is_main` per account enforced.
- `add_account_role_game` / `remove_account_role_game` emit **both** `gam_account_changed` (mocked) and
  `gam_role_sections_changed` (mocked).
- `get_role_game_sections` returns only `(role, game)` the session user can access (admin bypass + grant).
- `get_accounts_list({role, game})` filters via the new table and respects the L2 gate.
- Update the existing `TestAccountRoleGameReflow` ([`fix-booster-phantom-account.md`](fix-booster-phantom-account.md))
  to the new API surface (rename calls).
- Migration patch unit test: seed legacy `GAM Account.role` + child rows → run `execute()` → assert
  `GAM Account Role Game` rows + the no-role/no-game report.

### 9.2 e2e — Playwright (new spec)
[`gam-ui/tests/e2e/gam-role-game-sections.spec.js`](gam-ui/tests/e2e/gam-role-game-sections.spec.js):
- Sidebar section appears after assigning `(role, game)` to an account **without F5** (validates the
  dedicated realtime event).
- Section disappears after removing the last `(role, game)` row.
- Clicking a section filters `/accounts?role=..&game=..` to that combo.
- Account form requires a role per game row (submit blocked when missing).
- A user granted `(BOOSTER, POE2)` sees only that section; a user with no grants sees none.

## 10. Files touched

| Area | File |
|------|------|
| Doctype (new) | [`gam/gam/doctype/gam_account_role_game/`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account_role_game/) (json + py) |
| Doctype (edit) | [`gam_account.json`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account/gam_account.json) — drop `role`, `games` |
| Doctype (retire) | [`gam_account_game/`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account_game/) — keep file, no longer referenced |
| Migration | [`gam/gam/patches/migrate_account_role_game.py`](../frappe-bench/apps/gam/gam/gam/patches/migrate_account_role_game.py) + [`patches.txt`](../frappe-bench/apps/gam/gam/gam/patches.txt) |
| Backend | [`gam/api.py`](../frappe-bench/apps/gam/gam/api.py) — §6 rewrites |
| Realtime | [`gam/realtime.py`](../frappe-bench/apps/gam/gam/realtime.py) — `emit_role_sections_changed` |
| Generator | [`.gen_doctypes.py`](.gen_doctypes.py), [`.gen_api.py`](.gen_api.py) — reconcile |
| Backend tests | [`gam/tests/test_api.py`](../frappe-bench/apps/gam/gam/tests/test_api.py) |
| Form | [`gam-ui/src/components/AccountFormModal.vue`](gam-ui/src/components/AccountFormModal.vue) |
| Sidebar | [`gam-ui/src/components/AppLayout.vue`](gam-ui/src/components/AppLayout.vue) |
| List view | [`gam-ui/src/views/AccountListView.vue`](gam-ui/src/views/AccountListView.vue) |
| Detail view | [`gam-ui/src/views/AccountDetailView.vue`](gam-ui/src/views/AccountDetailView.vue) |
| Composable | [`gam-ui/src/composables/useGamMetadata.js`](gam-ui/src/composables/useGamMetadata.js) |
| e2e | [`gam-ui/tests/e2e/gam-role-game-sections.spec.js`](gam-ui/tests/e2e/gam-role-game-sections.spec.js) |

## 11. Verify
- `bench --site <site> migrate` (registers new doctype + runs patch).
- `bench --site <site> run-tests --app gam` — all green (existing 70 + new tests).
- `cd gam-ui && npm run build` — no errors.
- `npm run test:e2e` — new spec green; existing nav/role specs updated.
- Manual: assign `(BOOSTER, POE2)` to an account in the form → Booster section + POE2 entry appears
  **without F5**; remove it → disappears; grant a member `(TRADER, D4)` → they see only that section.

## 12. Rollback
- Revert doctype JSON + api.py + frontend.
- The migration patch is additive (creates rows in a new table); rollback does **not** delete
  `GAM Account.role` (column preserved). Re-running `bench migrate` after revert restores prior state.
- DB columns for the retired child table are retained (Frappe never drops) → zero data loss.

## 13. Open questions for the user (answer before/during code)
1. **Uniqueness:** should `(account, game)` be unique (one role per game per account), or allow the
   same game under two roles on one account? *Default: unique — enforce one role per (account, game).*
2. **`is_main` semantics:** with multiple roles, is "main" still per-account (one row) or should it
   become per-`(account, role)`? *Default: keep per-account (one main game overall).*
3. **Retire `GAM Account Game` now or in a follow-up?** *Default: keep the file this PR, retire next.*
4. **Deprecate aliases** (`add_account_game`, `get_games_by_role`) for one release, or hard-rename?
   *Default: hard-rename (gam-ui is the only caller).*
