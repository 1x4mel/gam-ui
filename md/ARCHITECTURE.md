# Architecture — GAM

> Kiến trúc kỹ thuật & luồng dữ liệu chính của GAM. Bổ sung cho `GAM_Design_Complete_v4.md`
> (thiết kế gốc) bằng góc nhìn "đã triển khai". Nguồn: `gam/api.py`, `gam/realtime.py`,
> `gam-ui/src/`.

---

## 1. Thành phần & ranh giới

```
gam-ui (Vue SPA)  ──HTTP /api/method/gam.*──►  app Frappe `gam`  ──► MariaDB
        │                                            │
        └──── Socket.IO (gam_* events) ◄──realtime──┘
                                                     │
                          webhook (allow_guest) ◄────┤
                                                     ▲
                                     Cloudflare Email Routing + Worker + Tunnel
```

- **gam-ui**: SPA độc lập, build bằng Vite, serve tại `/gam-ui/`. **Không phụ thuộc frappe-ui**
  (không resource/createResource). Toàn bộ data qua `fetch` trong [`api/index.js`](gam-ui/src/api/index.js:1).
- **app gam**: Frappe app chuẩn. Logic tập trung ở [`gam/api.py`](../frappe-bench/apps/gam/gam/api.py) (~4100 dòng, ~80 whitelist).
  Hỗ trợ: [`realtime.py`](../frappe-bench/apps/gam/gam/realtime.py) (emit_*), [`utils.py`](../frappe-bench/apps/gam/gam/utils.py)
  (CSRF), [`permission.py`](../frappe-bench/apps/gam/gam/permission.py), [`tasks.py`](../frappe-bench/apps/gam/gam/tasks.py),
  [`setup.py`](../frappe-bench/apps/gam/gam/setup.py) + [`patches/`](../frappe-bench/apps/gam/gam/patches) (seed).

## 2. Mô hình phân quyền 2 lớp (L1 role + L2 grant)

- **L1 — Frappe role:** `GAM Admin` (toàn quyền) / `GAM Member` (read-only theo grant). Co-tenancy:
  các SPA tự filter role của mình; `get_current_user_roles` trả toàn bộ roles.
- **L2 — Access Grant** (`GAM Access Grant`, scope|key):
  - `ROLE_GAME|<role>|<game>` — member chỉ thấy account thuộc (role,game) được cấp.
  - `SECTION|<name>` — gate section nav (vd `active`).
  - Default policy `match_role`: fallback theo Frappe role khớp LABEL của role option ([`_frappe_role_matches_role_value`](../frappe-bench/apps/gam/gam/api.py:877)).
  - Admin bypass (`_is_access_admin`). Gate helper: [`_require_account_access`](../frappe-bench/apps/gam/gam/api.py:979),
    [`_require_email_access`](../frappe-bench/apps/gam/gam/api.py:1031), [`has_access`](../frappe-bench/apps/gam/gam/api.py:899).

## 3. Mô hình dữ liệu account (Thân / Cành)

- **PLATFORM (Thân)** = `GAM Account` gốc, giữ credentials thật (`account_password`, `totp_secret`).
- **GAME node (Cành)** = `GAM Account` con, kế thừa credentials từ parent qua [`resolve_account_credentials`](../frappe-bench/apps/gam/gam/api.py:3126).
- Binding **(account ↔ role ↔ game)** là first-class trong `GAM Account Role Game` (có server + is_main + DLC child).
- → Detail view tách 2 route: `/platform-accounts/:name` vs `/accounts/:name`.

## 4. Luồng dữ liệu chính

### 4.1 Reveal password
```
UI reveal button → reveal_password(doctype,name,field,action)
  → field ∈ REVEALABLE_FIELDS?  → L2 gate (_require_account/email_access)
  → doc.get_password(field)     → _log_reveal (GAM Reveal Log: user, ip, ua, time)
  → trả plaintext
```
- Rate limit 20/60s. Không bao giờ log plaintext.

### 4.2 Request verification code
```
UI → request_code(email_name|account_name, platform)
  → _resolve_request_target → _claim_latest_code (SELECT...FOR UPDATE, freshest AVAILABLE)
  → mark CLAIMED + expiry     → _log_code_request (GAM Code Request Log)
  → emit_new_code (realtime)  → trả {code, platform, expires_at} | {status:"no_code"}
```
- Atomic claim chống race. Code chỉ đọc qua API này (không đọc `GAM Email Code` trực tiếp ở FE).

### 4.3 Email ingest (webhook)
```
Cloudflare Worker → receive_email_webhook() [allow_guest, X-Webhook-Secret]
  → _verify_webhook_secret → _webhook_payload → _ingest_email_payload
     → parse MIME (email stdlib) → strip HTML → parsedate_to_datetime
     → _resolve_gam_email (sender/to/forwarded) → _match_pattern (forward-aware)
        → hit? tạo GAM Email Code + emit_new_code ; miss? GAM Email Inbound Log (NO_MATCH)
     → duplicate? log DUPLICATE ; lỗi? DLQ (drain_email_dlq re-ingest)
  → _update_webhook_status (counters)
```
- Regex là DATA (`GAM Code Pattern`), anchor context, forward-aware (`_extract_forwarded_senders`).

### 4.4 Active lease (checkout/checkin)
```
checkout_account(account, purpose, lease_minutes) → tạo GAM Account Usage IN_USE (+ emit)
checkin_account(account, end_reason)              → DONE (+ _auto_release_expired sweep)
get_active_usage / get_my_active_usage            → client timer dùng server epoch ms
admin_force_release(account)                      → admin ép release
```

## 5. Realtime events (prefix `gam_*`)
- `emit_new_code` — code mới tới (chi tiết qua [`realtime.py`](../frappe-bench/apps/gam/gam/realtime.py)).
- `emit_account_changed`, `emit_role_sections_changed`, `emit_renewals_changed`.
- FE lắng nghe qua `socket.io-client` trong composables (vd `useActiveUsage`, `useRequestCode`).

## 6. Vùng nhạy cảm (cần review kỹ khi đụng)
- **Secret fields:** `account_password`, `email_password`, `totp_secret`, `webhook_secret`,
  `encryption_key` (site_config) — luôn `Password` fieldtype + `doc.get_password()`.
- **Code pipeline:** atomic claim, regex DATA, MIME parse, forward detection.
- **Webhook endpoint:** guest + secret verify + SSRF guard (`_is_safe_host`/`_is_public_ip`).
- **L2 gates:** mọi list/detail/reveal phải qua `_require_*_access` / `has_access`.
- **CSRF:** không bật `ignore_csrf`; token qua `gam.utils.get_session_csrf_token`.
- **Co-tenancy:** không đụng erpnext / `gege_custom` / shared site_config.

## 7. Quy ước code (tóm tắt)
- Python: tab indent (Frappe), `@frappe.whitelist()`, `frappe.throw(_(...))`, guard helpers `_require_*`.
- Vue: `<script setup>`, composables `use*.js`, không frappe-ui resources, Tailwind v4 tokens (`src/style.css`).
- FE data layer `api/index.js`: `authedFetch` (CSRF header + retry 403 + session-expiry notify).
- Tests: Vitest (unit), Playwright (e2e `gam-ui/tests/e2e/`), `test:totp` (RFC6238), `test:smoke`.
- Commit: conventional `<type>(<scope>): <subject>`, nhỏ, một mục đích.
