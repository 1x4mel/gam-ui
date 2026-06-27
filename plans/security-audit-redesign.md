# Plan: Security Audit Redesign — Unified Activity Timeline

## Goal

Transform GAM's three fragmented audit logs (Code Request, Reveal, Account Usage) into a
**security-grade investigation surface** that answers:

> *"User A mượn tài khoản B lúc 10:00, lấy code lúc 10:05, xem mật khẩu lúc 10:06, từ IP/device nào, bàn giao lúc几, trả lúc几"*

So when a game account has a problem, the admin can trace **who touched it, what they
did (login/code/reveal/handoff), from where, for how long** — and assign responsibility.

## Current state (gap analysis)

| Log | Has IP/UA | Has account/game | Has session link | Notes |
|---|---|---|---|---|
| GAM Code Request Log | ❌ | partial (email, platform; **no game**, no denormalized account username) | ❌ | `[requested_by, email_code, target_email, target_account, platform, code_value, status, requested_at, notes]` |
| GAM Reveal Log | ✅ (`X-Forwarded-For`, UA) | target doctype/name, fieldname | ❌ | `[action, viewed_by, target_doctype, target_name, fieldname, ip_address, user_agent, viewed_at]` |
| GAM Account Usage (checkout/login) | ❌ | account, used_by, purpose, lease, handoff, **chain** | self (it IS the session) | `[account, status, used_by, purpose, order_ref, started_at, lease_until, ended_at, end_reason, chain_head, prev_lease, handoff_by, handoff_at, notes]` |

**Root problem:** no shared key to merge the three streams into one session view.

## Architecture

```mermaid
flowchart TD
  REQ[request_code / reveal_password / checkout_account] --> CTX[_capture_request_context<br/>IP, UA, device]
  CTX --> CRL[GAM Code Request Log<br/>+ip +ua +game +usage_lease +denormalized account]
  CTX --> RL[GAM Reveal Log<br/>+account/game/usage_lease via target]
  CTX --> AU[GAM Account Usage<br/>+ip +ua at checkout]
  AU -.usage_lease link.-> CRL
  AU -.usage_lease link.-> RL

  AU & CRL & RL --> MERGE[get_audit_timeline<br/>UNION by time, join usage_lease]
  MERGE --> V1[/admin/audit timeline view]
  MERGE --> V2[AccountDetailView timeline tab]
  MERGE --> V3[/admin/audit/user profile]
```

### Session correlation key

`usage_lease` (Link → GAM Account Usage):
- `checkout_account` creates the lease; records its own name as the session id.
- `request_code` / `reveal_password` look up the **active lease** for (user, account) and
  stamp `usage_lease` on the log row → every code/reveal in that login session is tied to
  the checkout that authorized it.
- The Account Usage `chain_head` + `prev_lease` already model continuous-online chains, so
  handoff causality is preserved.

---

## Phase 1 — Data Model enrichment (backend)

### 1.1 Reusable request-context helper
New `_capture_request_context()` in `api.py` — refactor the IP/UA logic already in
`_log_reveal` (api.py:139) into a shared helper returning `{ip, user_agent, device}`.
- Prefer `CF-Connecting-IP` (Cloudflare tunnel) → `X-Forwarded-For` (first hop) → `remote_addr`.
- `device` = parsed UA short label (e.g. "Chrome / Windows") via a tiny helper (avoid heavy dep).

### 1.2 GAM Code Request Log — add fields
File: `gam/gam/doctype/gam_code_request_log/gam_code_request_log.json`
- `ip_address` (Data, 140)
- `user_agent` (Small Text)
- `game` (Link → GAM Game)
- `account_username` (Data) + `account_email_address` (Data) — denormalized so the log is
  self-contained (no N+1 doc-name resolution like today).
- `usage_lease` (Link → GAM Account Usage)
- `code_expires_at` (Datetime) — the code's expiry at claim time.

### 1.3 GAM Account Usage — add fields
File: `gam/gam/doctype/gam_account_usage/gam_account_usage.json`
- `ip_address` (Data, 140), `user_agent` (Small Text), `device` (Data) — captured at checkout.

### 1.4 GAM Reveal Log — add session link (optional enrichment)
File: `gam/gam/doctype/gam_reveal_log/gam_reveal_log.json`
- `usage_lease` (Link → GAM Account Usage) — resolved from the target account + active lease
  of `viewed_by`. Keeps reveal rows joinable into a session.

### 1.5 Wire capture into the endpoints
- `request_code` (api.py:174) → resolve game (already via `_resolve_account_game`), active
  lease (new `_active_lease(user, account)`), denormalized account fields; call
  `_capture_request_context()` and pass to `_log_code_request`.
- `checkout_account` → capture IP/UA/device into the new Usage fields.
- `reveal_password` / `_log_reveal` → resolve `usage_lease` from target.

### 1.6 Backfill
Patch `gam/patches/backfill_audit_context.py`:
- For Code Request Log rows lacking `ip_address`: leave blank (historical; can't reconstruct).
- Denormalize `account_username`/`account_email_address`/`game` from existing account/role-game.
- For Usage rows lacking `ip_address`: leave blank.
Idempotent; only fills NULL/empty.

---

## Phase 2 — Unified Audit Timeline view

### 2.1 Backend `get_audit_timeline`
New whitelisted method (admin-only) in `api.py` — UNION of the three sources into one
time-ordered cursor with a normalized schema:

```
event_time, user, role, action, account_name, account_username, game, platform,
email_address, detail(code/field/purpose), ip_address, device, status, duration,
usage_lease, source_doctype, source_name
```
- `action` normalized: `LOGIN`(usage IN_USE), `RELEASE`(usage ended), `CODE_REQUEST`,
  `REVEAL`, `COPY`, `HANDOFF`.
- Filters: `user`, `account`, `game`, `platform`, `ip`, `action`, `date_from`, `date_to`.
- Joins denormalized labels via the new self-contained fields (no N+1).
- Paginated server-side (mirror `useServerPaginatedList`).
- Returns `summary` block: total events, top user, top account, counts by action,
  anomalies count.

### 2.2 Frontend `AuditTimelineView.vue`
New view at `/admin/audit`:
- Filters bar: user, account, game, platform, IP, action-multiselect, date range.
- Summary cards row (total / login / code / reveal / anomalies).
- Timeline list (`ResponsiveTable`): dense columns per the normalized schema; click row →
  drawer showing all events sharing the same `usage_lease` (reconstruct session).
- Export CSV (client-side from current filtered page; server export for large ranges later).

### 2.3 Sidebar nav
Add "🛡️ Audit Timeline" under 🛠️ Quản trị in `AppLayout.vue` / sidebar config.

---

## Phase 3 — Contextual timelines (account + user)

### 3.1 AccountDetailView — "Hoạt động" tab
Add an Activity timeline section on `AccountDetailView.vue` scoped to that account:
calls `get_audit_timeline(account=<name>)`. Shows login/code/reveal/handoff for THIS
account → "mở tài khoản gặp vấn đề là thấy ngay lịch sử".

### 3.2 User profile page `/admin/audit/user/:name`
New lightweight view: per-booster dossier — accounts touched, codes taken, reveals,
total online hours, last IP/device, anomaly flags. Derived from the same endpoint
filtered by `user`.

---

## Phase 4 — Anomaly detection, export, retention

### 4.1 Anomaly flags (computed in `get_audit_timeline`)
- `dual_ip`: same account online from 2 distinct IPs in overlapping windows.
- `code_without_checkout`: code requested with no active lease.
- `reveal_outside_session`: reveal with no `usage_lease`.
- `high_reveal_freq`: > N reveals of password in a window (configurable).
- `checkout_overlap`: same account checked out by 2 users overlapping.
Flags returned in each event row + surfaced in summary + a dedicated filter `anomaly=true`.

### 4.2 Export
- CSV export of current filtered timeline (Phase 2) — admin-only endpoint
  `export_audit_timeline` streaming rows.
- Excel optional later.

### 4.3 Retention policy
- Add `GAM Settings` fields: `audit_log_retention_days` (default 365), `audit_archive_after_days`.
- Scheduler job `archive_audit_logs` compresses/logs older than threshold into an archive
  table (or cold storage) — keeps the hot tables fast.
- Never auto-delete (security); archive only.

### 4.4 Tamper-evidence (stretch)
- Optional hash-chain on audit rows (`prev_hash`, `row_hash`) to detect post-hoc edits.
- Document that DB-level admin edits remain possible (defense-in-depth, not absolute).

---

## File change summary

| File | Change |
|---|---|
| `gam/gam/doctype/gam_code_request_log/gam_code_request_log.json` | + ip, ua, game, account_username, account_email_address, usage_lease, code_expires_at |
| `gam/gam/doctype/gam_account_usage/gam_account_usage.json` | + ip, ua, device |
| `gam/gam/doctype/gam_reveal_log/gam_reveal_log.json` | + usage_lease |
| `gam/api.py` | `_capture_request_context`, `_active_lease`, enrich `request_code`/`checkout_account`/`_log_reveal`, `get_audit_timeline`, `export_audit_timeline` |
| `gam/patches/backfill_audit_context.py` | denormalize + fill historical rows |
| `gam/gam/doctype/gam_settings/gam_settings.json` | retention fields |
| `gam/tasks.py` | `archive_audit_logs` scheduler |
| `gam-ui/src/views/AuditTimelineView.vue` | new unified timeline |
| `gam-ui/src/views/AuditUserView.vue` | new user profile |
| `gam-ui/src/views/AccountDetailView.vue` | Activity tab (scoped timeline) |
| `gam-ui/src/router/index.js` | `/admin/audit`, `/admin/audit/user/:name` |
| `gam-ui/src/components/AppLayout.vue` | sidebar nav entry |
| `gam-ui/src/components/SessionDrawer.vue` | session reconstruct drawer |
| `gam-ui/src/views/CodeRequestLogView.vue` | enrich columns (IP/game/account/export) |
| `gam-ui/src/views/RevealLogView.vue` | enrich columns (account/game/session/export) |
| `gam-ui/tests/e2e/gam-audit-timeline.spec.js` | new e2e |
| `gam/tests/test_api.py` | tests for capture, session link, timeline |

## Risks & rollback
- All new fields nullable → backward compatible; old logs simply lack IP/session.
- UNION endpoint performance: add indexes on `requested_at`/`viewed_at`/`started_at` +
  `usage_lease`; cap page size.
- Anomaly heuristics are advisory (false positives possible) — flagged, never blocking.

## Test strategy
- Unit: `_capture_request_context` (header priority), `_active_lease`, denormalization,
  timeline UNION shape, anomaly flags (dual_ip, code_without_checkout).
- E2E `gam-audit-timeline.spec.js`: checkout → request_code → reveal → release; assert all
  three appear in one timeline scoped by `usage_lease`; assert filters + CSV export; assert
  the AccountDetailView activity tab shows the same events.
