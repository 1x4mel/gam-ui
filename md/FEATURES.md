# Features Inventory — GAM

> Liệt kê các tính năng đã có của GAM (app Frappe `gam` + SPA `gam-ui`), kèm endpoint API và
> view/composable tương ứng. Dùng để AI session mới nhanh chóng biết "đã có gì" trước khi thêm mới.
> Nguồn: `gam/api.py`, `gam-ui/src/router/index.js`, `gam-ui/src/views/`, `plans/`.

> Ký hiệu quyền: **A** = GAM Admin, **M** = GAM Member (L2-scoped), **G** = guest (webhook).

---

## F1. Auth & Session
- Login Frappe (session + 2FA TOTP built-in). SPA tự quản CSRF qua [`initCsrfToken()`](gam-ui/src/api/index.js:40).
- Co-tenancy gate: chỉ role GAM / Administrator / System Manager được vào gam-ui.
- Session-expiry → clear auth → về `/login` ([`onSessionExpired`](gam-ui/src/api/index.js:27)).
- `get_role_audit(user)` (A) — audit role isolation.

## F2. Dashboard & Search
- `/` dashboard: [`get_dashboard_stats()`](../frappe-bench/apps/gam/gam/api.py:696), [`get_account_stats()`](../frappe-bench/apps/gam/gam/api.py:731).
- Sidebar động role|game: [`get_role_game_sections()`](../frappe-bench/apps/gam/gam/api.py:781) (+ alias `get_games_by_role`).
- `/search` global: [`global_search(query)`](../frappe-bench/apps/gam/gam/api.py:1807) → accounts/emails/games.

## F3. Email Module
- `/admin/emails` (A): CRUD [`save_email_account`](../frappe-bench/apps/gam/gam/api.py:2454), [`delete_email_account`](../frappe-bench/apps/gam/gam/api.py:2504), [`get_email_detail`](../frappe-bench/apps/gam/gam/api.py:2557), [`get_email_dependencies`](../frappe-bench/apps/gam/gam/api.py:2609).
- `/admin/emails/:name` (A): reveal `email_password` (audit) qua `reveal_password`.
- `/emails` (A) + `/emails/:name`: danh sách/chi tiết **code** — [`get_email_codes`](../frappe-bench/apps/gam/gam/api.py:1734).
- Unrecognized inbound panel: [`get_unrecognized_emails`](../frappe-bench/apps/gam/gam/api.py:2344), [`ignore_unrecognized_email`](../frappe-bench/apps/gam/gam/api.py:2374), [`add_email_from_inbound`](../frappe-bench/apps/gam/gam/api.py:2418).
- Inbound log (A): [`get_email_inbound_logs`](../frappe-bench/apps/gam/gam/api.py:1769).

## F4. Accounts Module (core)
- **List L2-scoped:** [`get_accounts_list`](../frappe-bench/apps/gam/gam/api.py:1257).
- **Operational role|game view** (`/role/:role`, `/role/:role/game/:game`): member chỉ thấy scope được cấp.
- **Detail 2-tier:** `/accounts/:name` (GAME node) + `/platform-accounts/:name` (PLATFORM Thân).
  - [`resolve_account_credentials`](../frappe-bench/apps/gam/gam/api.py:3126) (GAME kế thừa credentials PLATFORM).
  - [`get_platform_children`](../frappe-bench/apps/gam/gam/api.py:3232) (Thân→Cành).
- **Admin lists:** [`get_platform_accounts`](../frappe-bench/apps/gam/gam/api.py:3193), [`get_game_accounts`](../frappe-bench/apps/gam/gam/api.py:3288).
- **CRUD:** [`save_account`](../frappe-bench/apps/gam/gam/api.py:2842), [`delete_account`](../frappe-bench/apps/gam/gam/api.py:3071).
- **Role-game binding first-class:** [`add_account_role_game`](../frappe-bench/apps/gam/gam/api.py:2977), [`remove_account_role_game`](../frappe-bench/apps/gam/gam/api.py:3029), [`get_account_role_games`](../frappe-bench/apps/gam/gam/api.py:1451).
- **Activity & notes:** [`get_account_activity`](../frappe-bench/apps/gam/gam/api.py:1553), [`get_account_notes`](../frappe-bench/apps/gam/gam/api.py:1655), [`add_account_note`](../frappe-bench/apps/gam/gam/api.py:1676), [`delete_account_note`](../frappe-bench/apps/gam/gam/api.py:1710).
- **Label resolve:** [`resolve_doc_names`](../frappe-bench/apps/gam/gam/api.py:1497).
- **Reveal password (audit):** [`reveal_password`](../frappe-bench/apps/gam/gam/api.py:98) (`account_password`/`totp_secret`/`email_password`).

## F5. Verification Code System
- [`request_code`](../frappe-bench/apps/gam/gam/api.py:173) — atomic claim code mới nhất (`SELECT...FOR UPDATE`), realtime `emit_new_code`.
- [`test_code_pattern`](../frappe-bench/apps/gam/gam/api.py:2300) — dry-run regex matcher.
- Code patterns là DATA trong `GAM Code Pattern` (regex anchor theo context, forward-aware).
- Platform mapping: `GAM List Option.code_platform` (fallback [`PLATFORM_TO_CODE_PLATFORM`](../frappe-bench/apps/gam/gam/api.py:47)).
- Code-request log (A): `/admin/code-request-log`.

## F6. Active Usage / Lease ("Đang hoạt động")
- `/active` (gate `grant:active`): [`get_active_usage`](../frappe-bench/apps/gam/gam/api.py:614), [`get_my_active_usage`](../frappe-bench/apps/gam/gam/api.py:642), [`get_resting_usage`](../frappe-bench/apps/gam/gam/api.py:625).
- [`checkout_account`](../frappe-bench/apps/gam/gam/api.py:308) / [`checkin_account`](../frappe-bench/apps/gam/gam/api.py:363).
- [`admin_force_release`](../frappe-bench/apps/gam/gam/api.py:651) (A) — force-release lease.
- Realtime timer dùng server epoch (`_server_epoch_now_ms`) để client đếm chính xác.

## F7. Access Grant Matrix (L2 scoping)
- `/admin/access` (A): [`get_access_grants`](../frappe-bench/apps/gam/gam/api.py:1067), [`save_access_grants`](../frappe-bench/apps/gam/gam/api.py:1086), [`get_grantable_role_games`](../frappe-bench/apps/gam/gam/api.py:1151), [`get_grantable_sections`](../frappe-bench/apps/gam/gam/api.py:1190), [`get_gam_users`](../frappe-bench/apps/gam/gam/api.py:1199).
- Member self: [`get_my_access_grants`](../frappe-bench/apps/gam/gam/api.py:1046).
- Public check server-side: [`has_access`](../frappe-bench/apps/gam/gam/api.py:899).
- Default policy: `match_role` (configurable trong GAM Settings).

## F8. Renewal / Cost Dashboard
- [`renew_account`](../frappe-bench/apps/gam/gam/api.py:3391), [`get_renewals`](../frappe-bench/apps/gam/gam/api.py:3456).
- Trạng thái renewal buckets (`_renewal_state`).

## F9. Admin Settings & List Options
- `/admin/settings` (A): [`get_gam_settings`](../frappe-bench/apps/gam/gam/api.py:425), [`save_gam_settings`](../frappe-bench/apps/gam/gam/api.py:435).
- List options config: [`get_list_options`](../frappe-bench/apps/gam/gam/api.py:3540), [`save_list_option`](../frappe-bench/apps/gam/gam/api.py:3584), [`delete_list_option`](../frappe-bench/apps/gam/gam/api.py:3617) (+ auto tạo Frappe Role cho role mới).
- `/admin/code-patterns` (A): CRUD Code Pattern + `test_code_pattern`.

## F10. Email Webhook Pipeline (Cloudflare)
- [`receive_email_webhook`](../frappe-bench/apps/gam/gam/api.py:1874) (G, `X-Webhook-Secret`) → ingest → resolve owner → match pattern.
- DLQ: [`drain_email_dlq`](../frappe-bench/apps/gam/gam/api.py:1985) (A).
- [`reveal_webhook_secret`](../frappe-bench/apps/gam/gam/api.py:2050) (A, audit).
- MIME parse (email stdlib) + RFC2822 date parse (`parsedate_to_datetime`).
- Forwarded-sender detection (`_extract_forwarded_senders`).

## F11. Cloudflare Tunnel + Setup Wizard
- `/admin/webhook` (A): [`install_cloudflare_tunnel`](../frappe-bench/apps/gam/gam/api.py:3816), [`get_tunnel_status`](../frappe-bench/apps/gam/gam/api.py:3888).
- Wizard: [`verify_public_host`](../frappe-bench/apps/gam/gam/api.py:3969) (SSRF guard), [`setup_frappe_domain`](../frappe-bench/apps/gam/gam/api.py:4004), [`get_webhook_setup_state`](../frappe-bench/apps/gam/gam/api.py:4072), [`set_webhook_setup_step`](../frappe-bench/apps/gam/gam/api.py:4113).
- [`get_cloudflare_worker_source`](../frappe-bench/apps/gam/gam/api.py:4134) — worker bundle (postal-mime inlined).

## F12. Auditing / Logs (Admin)
- `/admin/reveal-log`, `/admin/code-request-log`, `/admin/email-inbound-log`, `/admin/account-usage`, `/admin/role-audit`.

## F13. Frontend infra (gam-ui)
- **Không dùng frappe-ui resources** — data layer riêng [`api/index.js`](gam-ui/src/api/index.js:1) (authedFetch + CSRF retry + session-expiry).
- Composables: `useAuth`, `useAccessGrants`, `useGamMetadata`, `useActiveUsage`, `useRevealPassword`, `useRequestCode`, `useCheckout`, `useOnlineWatcher`, `useElapsedTimer`, `useScrollMemory`, `useTheme`, `usePaginatedList`, `usePagination`.
- Utils: `format.js`, `totp.js` (RFC6238, có test `tests/totp-rfc6238.mjs`).
- E2E: Playwright `tests/e2e/` (xem §9 PROJECT_OVERVIEW).

---

## Ghi chú mở rộng (đề xuất tính năng mới)
Khi thêm tính năng mới, tuân thủ:
1. Prefix DocType `GAM *`; method `gam.api.*`; realtime `gam_*`.
2. Secret luôn `Password` fieldtype + reveal qua `reveal_password` (ghi Reveal Log).
3. Regex code là DATA (`GAM Code Pattern`), anchor context, parse MIME trước.
4. L2 gate mọi endpoint nhạy cảm (`_require_account_access` / `has_access`).
5. Thêm Playwright spec trong `gam-ui/tests/e2e/` + plan trong `plans/`.
