# Project Overview — GAM workspace (`/home/frappe/gam`)

> **Mục đích tài liệu:** Cung cấp bối cảnh (context) đầy đủ cho các phiên làm việc AI tiếp theo
> nắm nhanh: dự án làm gì, gồm những phần nào, kiến trúc ra sao, đã có tính năng gì, và tiếp
> theo phát triển tính năng mới ở đâu. Đọc cùng `AGENTS.md` (luật) và `GAM_Design_Complete_v4.md`
> (thiết kế). Cập nhật lần cuối: 2026-06-24.

---

## 1. Workspace là gì

Thư mục `/home/frappe/gam` là **workspace trung tâm** chứa mã nguồn frontend của 2 SPA Vue 3,
cùng tài liệu thiết kế (`md/`), kế hoạch (`plans/`) và các script sinh code (`gen.py`, `.gen_*.py`).
Backend (app Frappe `gam`) nằm ngoài workspace, tại `../frappe-bench/apps/gam`.

```
/home/frappe/gam/                      ← workspace này
├── gam-ui/        ← SPA #1: GAM (Game Account Manager)      → app Frappe `gam`
├── src/           ← SPA #2: Trader-UI (game currency)       → app Frappe `gege_custom`
├── md/            ← tài liệu thiết kế + luật + tài liệu này
├── plans/         ← kế hoạch từng feature (architect plan)
├── gen.py, .gen_*.py  ← script sinh code boilerplate
└── .github/       ← CI/CD (nếu có)
```

> ⚠️ **Lưu ý phân biệt:** `src/` KHÔNG phải GAM. Nó là **Trader-UI** (bán/nhận tiền tệ game),
> gọi tới app `gege_custom` (cũng gọi là trader-ui). Hai SPA này **co-tenant** trên cùng site
> Frappe `erp.local` nhưng là hai sản phẩm khác nhau. GAM Member **không** được dùng Trader-UI
> và ngược lại (role isolation — xem `AGENTS.md` mục "Co-tenancy rules").

---

## 2. Hai sản phẩm

### 2.1. GAM — Game Account Manager (`gam-ui/` + app Frappe `gam`)
Quản lý tập trung **thông tin tài khoản game** cho team nội bộ. Giải 2 bài toán cốt lõi:
1. **Quản lý account liên kết:** một game (vd Diablo 4) cần nhiều platform account (Battle.net +
   Steam + Xbox...); team cần biết đăng nhập bằng cái nào. Mô hình PLATFORM (Thân) → GAME node (Cành).
2. **Phân phối verification code tự động:** khi login từ thiết bị mới, platform gửi mã về email;
   GAM thu thập qua Cloudflare Email Worker → webhook → trích bằng regex → cấp cho member.

**Roles:** `GAM Admin` (toàn quyền CRUD/config), `GAM Member` (chỉ xem, reveal password, xin code).

### 2.2. Trader-UI — Game Currency Trading (`src/` + app Frappe `gege_custom`)
Hệ thống giao dịch tiền tệ game (mua/bán, thu chi kế toán, ví nhân viên, công nợ, flip session...).
**Roles:** `Trader1`, `Trader2`, `Market Leader`, `Payment/Management/Chief Accountant`,
`Ops Manager`, `Game Currency Admin`...

> **Phạm vi tài liệu này tập trung GAM** (vì đây là sản phẩm đang phát triển tích cực, có đầy đủ
> `md/`, `plans/`, backend `gam`). Trader-UI (`src/` → `gege_custom`) được liệt kê ngắn gọn ở
> §5 để tránh nhầm lẫn; chi tiết luật "out of scope" xem `AGENTS.md`.

---

## 3. Stack công nghệ (GAM)

| Nhóm | Công nghệ |
|------|-----------|
| Framework backend | Frappe Framework v15 (Python 3.11+) |
| Frontend | Vue 3 + Vue Router 4 (SPA riêng, **KHÔNG dùng frappe-ui resources**) — Tailwind CSS v4 |
| Build FE | Vite 5 (`npm`, **không phải yarn** — có `package-lock.json`) |
| DB | MariaDB |
| Auth | Frappe session + 2FA TOTP built-in |
| Encryption | Frappe `Password` fieldtype (tự mã hoá, key trong `site_config.json`) |
| Realtime | Frappe SocketIO (`frappe.publish_realtime`, prefix sự kiện `gam_*`) |
| Email ingestion | Cloudflare Email Routing + Workers + Tunnel (`cloudflared`) |
| Test FE | Vitest (unit) + Playwright (e2e, `gam-ui/tests/e2e/`) |
| Deploy FE | `npm run build` → `dist/`; nginx serve `/gam-ui/` (`VITE_BASE_URL=/gam-ui/`) |

**Mô hình co-tenancy:** GAM + Trader-UI + ERPNext cùng chạy trên **một site** `erp.local`
(IP `192.168.2.111`), cách ly bằng **role**, không cách ly bằng site. DocType luôn prefix `GAM *`,
method namespace `gam.*`, realtime event prefix `gam_*`.

---

## 4. Kiến trúc GAM (sơ đồ cấp cao)

```
┌───────────────────────────── gam-ui (Vue SPA) ─────────────────────────────┐
│  views/* ── composables/* ── api/index.js (fetch + CSRF + session) ──────────┤
│                          │                                                   │
│        Socket.IO (gam_* events) ←──── realtime push ────┐                   │
└──────────────────────────┼──────────────────────────────────────────────────┘
                           │ /api/method/gam.*  +  /api/resource/GAM *
┌──────────────────────────▼────── app Frappe `gam` ──────────────────────────┐
│  api.py        ← toàn bộ @frappe.whitelist() (4100+ dòng, ~80 endpoint)     │
│  realtime.py   ← emit_* helpers                                             │
│  utils.py      ← get_session_csrf_token, helpers                           │
│  permission.py ← role/perms scripted                                        │
│  tasks.py / ops.py ← background / ops                                       │
│  setup.py, patches/  ← seed + migration                                     │
│  cloudflare_worker_*.js/mjs ← Worker bundle (postal-mime inlined)           │
│  gam/doctype/  ← 21 DocType (xem §6)                                        │
└──────────────────────────┬──────────────────────────────────────────────────┘
                           │ webhook (allow_guest + X-Webhook-Secret)
                ┌──────────▼──────────┐
                │ Cloudflare Email    │  email đến → Worker → POST /api/method/
                │ Routing + Workers   │       gam.api.receive_email_webhook
                │ + Tunnel            │
                └─────────────────────┘
```

**Luồng dữ liệu chính (xem chi tiết `GAM_Design_Complete_v4.md`):**
- **Reveal password:** UI → `reveal_password()` → L2 gate → `doc.get_password()` → ghi `GAM Reveal Log`.
- **Request code:** UI → `request_code()` → atomic claim (`SELECT...FOR UPDATE`) code mới nhất → ghi `GAM Code Request Log` → realtime `emit_new_code`.
- **Email ingest:** Worker → `receive_email_webhook()` → resolve owner → match pattern → tạo `GAM Email Code` (hoặc `GAM Email Inbound Log` với NO_MATCH/DUPLICATE).

---

## 5. Trader-UI (`src/` → `gege_custom`) — tóm tắt

SPA game currency trading. Gọi `gege_custom.gege_custom.utils.*`. Các module chính (theo `src/router/index.js`):
- **Orders:** queue / my-orders / history / issues, detail (`OrderDetailView`), tạo đơn (`CreateOrderView`).
- **T1 orders** (Trader1): attention / active / history.
- **Inventory / Lots / Inventory logs / Prices / ML negotiation.**
- **Flip sessions** (list/create/detail).
- **Kế toán:** payments, platform-wallet, customers, suppliers, debts, statements, party-statement, ledger, profit, fund-transfer.
- **Wallet** nhân viên (`WalletView` — QR VietQR, adjust balance).
- **Admin:** users, game-data, bank-accounts.
- Composables: `useOrdersPaginated`, `useBuyPresets`, `useDebts`, `useQrPayment`, `useRealtimeSubscriptions`, `useFavorites`, `usePartyStatement`...
- Utils nổi bật: `vietqr.js` (EMVCo encode/decode QR NAPAS), `parseOrderText.js` (parse đơn dán từ Discord), `format.js`.

> Out of scope cho hầu hết task GAM (xem `AGENTS.md`). Chỉ liệt kê để không nhầm `src/` là GAM.

---

## 6. DocType GAM (backend `gam/gam/doctype/`)

| DocType | Vai trò |
|---------|---------|
| `GAM Account` | Tài khoản game (PLATFORM Thân / GAME Cành). Lưu identity + credentials. |
| `GAM Account Role Game` | Binding first-class (account ↔ role ↔ game), có server + main + DLC child. |
| `GAM Account Game` | (legacy/rel) account–game. |
| `GAM Account Game DLC` | DLC child của binding. |
| `GAM Account Link` | Mạng lưới liên kết account↔account. |
| `GAM Account Note` | Note cộng tác trên account. |
| `GAM Account Usage` | Track checkout/checkin (lease) — "Đang hoạt động". |
| `GAM Access Grant` | Cấp quyền L2 (scope|key) cho user. |
| `GAM Game` / `GAM Game Server` / `GAM DLC` | Metadata game/server/DLC. |
| `GAM Email` | Email inbox được quản lý (có `email_password` Password). |
| `GAM Email Code` | Verification code trích được từ email. |
| `GAM Email Inbound Log` | Audit payload webhook (OK / NO_MATCH / DUPLICATE / DLQ). |
| `GAM Email Recovery` | (recovery) account recovery email. |
| `GAM Code Pattern` | Regex nhận diện code theo platform/sender (là DATA, không hardcode). |
| `GAM Code Request Log` | Audit ai xin code. |
| `GAM Reveal Log` | Audit reveal password. |
| `GAM Renewal Log` | Gia hạn account + chi phí. |
| `GAM List Option` | Cấu hình danh sách (Platform / Role / Status...) + `code_platform`. |
| `GAM Settings` | Singleton ngưỡng (max_online_hours, rested...), grant default policy. |
| `GAM Webhook Config` | Singleton cấu hình webhook secret + tunnel + counters. |

---

## 7. API surface GAM (`gam/api.py`) — nhóm chức năng

> Đây là các `@frappe.whitelist()` chính. Chi tiết signature từng hàm xem
> [`ARCHITECTURE.md`](ARCHITECTURE.md) và [`FEATURES.md`](FEATURES.md).

- **Bảo mật / audit:** `reveal_password`, `request_code`, `drain_email_dlq`, `reveal_webhook_secret`.
- **Active usage / lease:** `checkout_account`, `checkin_account`, `get_active_usage`,
  `get_resting_usage`, `get_my_active_usage`, `admin_force_release`.
- **Settings:** `get_gam_settings`, `save_gam_settings`.
- **Dashboard / catalog:** `get_dashboard_stats`, `get_account_stats`, `get_role_game_sections`,
  `get_games_by_role`.
- **Access grant (L2):** `get_my_access_grants`, `get_access_grants`, `save_access_grants`,
  `get_grantable_role_games`, `get_grantable_sections`, `get_gam_users`, `has_access`.
- **Account CRUD + binding:** `get_accounts_list`, `get_account_role_games`, `resolve_doc_names`,
  `save_account`, `delete_account`, `add_account_role_game`, `remove_account_role_game`,
  `get_account_activity`, `get_account_notes`, `add_account_note`, `delete_account_note`.
- **Hierarchy (Thân/Cành):** `resolve_account_credentials`, `get_platform_accounts`,
  `get_platform_children`, `get_game_accounts`.
- **Renewal:** `renew_account`, `get_renewals`.
- **List options:** `get_list_options`, `save_list_option`, `delete_list_option`.
- **Audit roles:** `get_role_audit`.
- **Email pipeline:** `receive_email_webhook` (allow_guest), `get_unrecognized_emails`,
  `ignore_unrecognized_email`, `add_email_from_inbound`, `save_email_account`,
  `delete_email_account`, `get_email_detail`, `get_email_dependencies`, `get_email_codes`,
  `get_email_inbound_logs`, `test_code_pattern`.
- **Cloudflare tunnel/wizard:** `install_cloudflare_tunnel`, `get_tunnel_status`,
  `verify_public_host`, `setup_frappe_domain`, `get_webhook_setup_state`,
  `set_webhook_setup_step`, `get_cloudflare_worker_source`.
- **Search:** `global_search`.

---

## 8. gam-ui routes (`gam-ui/src/router/index.js`)

- **Public:** `/login`.
- **Main:** `/` (dashboard), `/search`, `/account` (self-service settings).
- **Operational (member):** `/role/:role`, `/role/:role/game/:game` (RoleGameAccountsView),
  `/accounts/:name` + `/platform-accounts/:name` (detail, 2 tier), `/active` (sessions, gate `grant:active`).
- **Back-compat:** `/accounts` redirect → `/role/...` hoặc `/admin/game-accounts`.
- **Admin (`meta.roles:['GAM Admin']`):** `/admin/platforms`, `/admin/game-accounts`,
  `/admin/reveal-log`, `/admin/code-request-log`, `/admin/email-inbound-log`,
  `/admin/account-usage`, `/admin/role-audit`, `/admin/webhook`, `/admin/code-patterns`,
  `/admin/emails`, `/admin/emails/:name`, `/admin/settings`, `/admin/access`.

Router guard: `fetchUser` → co-tenancy gate (chỉ GAM roles) → per-route role gate → per-route
`grant` gate (L2 via `useAccessGrants`) → role|game scope gate (`hasRoleGame`).

---

## 9. Trạng thái hiện tại & hướng phát triển tiếp

- **Đã hoàn thành (dựa trên `plans/` + code):** hierarchy Thân/Cành, role|game first-class
  binding, sidebar role|game sections, email redesign + content display + game classification,
  active view realtime timer, access-grant matrix, code-pattern test, webhook setup wizard,
  Cloudflare tunnel install UI, governance/admin settings, list-options config, logs &
  filters, forwarded-code matching, role audit.
- **E2E coverage** (`gam-ui/tests/e2e/`): 2fa, active-timer, admin crud/email/links/listoptions/
  log-filters/nav-roles/role-game-sidebar/settings, cloudflare-tunnel, email-account-detail,
  email-content, forwarded-code, governance-settings, role-game-view, smoke, webhook-wizard.
- **Test scripts npm:** `test:totp`, `test:smoke`, `test:unit` (vitest), `test:e2e` (playwright).
- **Khi phát triển tính năng mới:** lập plan trong `plans/<feature>.md` (xem `DAILY-WORKFLOW.md`),
  sửa theo `AGENTS.md`, chạy migrate/test/build/lint liên quan, giữ nguyên các quy tắc bảo mật.

---

## 10. Điểm vào nhanh cho AI session mới

1. Đọc `AGENTS.md` (luật + commands) → tài liệu này (bối cảnh) → `FEATURES.md` (tính năng chi tiết)
   → `ARCHITECTURE.md` (kiến trúc/luồng).
2. Kiểm tra `plans/` xem feature định làm đã có plan chưa; `.ai/current-plan.md` nếu tồn tại.
3. Backend: `../frappe-bench/apps/gam/gam/` (api.py là tâm điểm). Frontend GAM: `gam-ui/src/`.
4. Quy ước FE: không frappe-ui resources — data layer riêng `gam-ui/src/api/index.js`
   (CSRF + retry 403 + session-expiry). Composables trong `gam-ui/src/composables/`.
5. **Bảo mật tuyệt đối:** xem `AGENTS.md` "GAM-specific rules" trước khi đụng secret/code/regex.
