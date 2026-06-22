# Tài liệu Thiết kế Hệ thống Quản lý Tài khoản Game
## Game Account Manager (GAM) — v4.0

> **Phiên bản:** 4.0 | **Ngày cập nhật:** 12/06/2026
> **Stack đã xác nhận:** Frappe Framework v15 · Vue 3 + frappe-ui · MariaDB · Python · Cloudflare (Email Routing + Workers + Tunnel) · bench + nginx
> **Đọc cùng:** `GAM_Implementation_Frappe_Vue_v4.md` (chi tiết triển khai)

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Tech Stack](#2-tech-stack)
3. [Kiến trúc Dữ liệu (DocTypes)](#3-kiến-trúc-dữ-liệu)
4. [Thiết kế API](#4-thiết-kế-api)
5. [Thiết kế Giao diện (UI/UX)](#5-thiết-kế-giao-diện)
6. [Bảo mật & Phân quyền](#6-bảo-mật--phân-quyền)
7. [Email Verification Code System](#7-email-verification-code-system)
8. [Luồng vận hành](#8-luồng-vận-hành)
9. [Lộ trình triển khai](#9-lộ-trình-triển-khai)
10. [Checklist Production](#10-checklist-production)

---

## 1. Tổng quan hệ thống

### 1.1. Mục tiêu
GAM là hệ thống quản lý tập trung thông tin tài khoản game cho team nội bộ. Hệ thống giải quyết các bài toán cốt lõi:
- **Quản lý account liên kết:** Một game (ví dụ Diablo 4 trên Battle.net) có thể yêu cầu nhiều account liên kết với nhau (Battle.net + Steam + Xbox), và thành viên team cần biết chính xác account nào dùng để đăng nhập.
- **Phân phối verification code tự động:** Khi login game account từ thiết bị mới, platform gửi mã xác minh về email. GAM tự động thu thập và phân phối mã này cho team mà không cần truy cập email trực tiếp.

### 1.2. Đối tượng người dùng

| Role | Mô tả | Số lượng dự kiến |
|------|--------|-----------------|
| **GAM Admin** | Người quản lý toàn hệ thống, toàn quyền CRUD, cấu hình email, quản lý code patterns | 1–2 người |
| **GAM Member** | Thành viên team, chỉ xem thông tin, reveal password, và yêu cầu verification code | 3–10 người |

### 1.3. Các thực thể chính và quan hệ

```
Email (1) ──────── (N) Account
   │                     │
   │                Platform Enum
   │           (STEAM/BATTLENET/XBOX/EPIC/STANDALONE)
   │                     │
   │            Account (N) ──── (N) Game  ←── qua bảng AccountGame
   │                 │                │
   │                 │           GameServer (N)
   │                 │
   │                 └── (1:N) AccountUsage (track checkout/checkin)
   │
   │            Account ←── AccountLink ──→ Account   (mạng lưới liên kết)
   │
   │            DLC (N) ────── (N) AccountGame   ←── qua bảng AccountGameDLC
   │
    └── EmailCode (N)  ←── verification codes nhận từ Cloudflare Email webhook
          │
          └── CodeRequestLog (N)  ←── audit ai đã yêu cầu code

Webhook Config (Singleton) ←── cấu hình webhook secret cho Cloudflare Worker
Email Inbound Log (N) ←── audit webhook payload (OK, NO_MATCH, DUPLICATE)
Code Pattern (N) ←── regex patterns nhận diện code từng platform
```

---

## 2. Tech Stack

### 2.1. Danh sách công nghệ

| Nhóm | Công nghệ | Lý do chọn |
|------|-----------|------------|
| **Framework** | Frappe Framework v15 | Full-stack Python framework, built-in ORM/REST/permissions/audit |
| **Frontend** | Vue 3 + frappe-ui (SPA) | Reactive UI, tích hợp sâu với Frappe backend |
| **Database** | MariaDB | Frappe default, tự quản lý trên bench |
| **Backend** | Python 3.11+ | DocType controllers + `@frappe.whitelist()` methods |
| **Auth** | Frappe built-in | Session-based auth, 2FA TOTP built-in |
| **Encryption** | Frappe Password fieldtype | Tự mã hóa/giải mã, key lưu trong `site_config.json` |
| **Realtime** | Frappe SocketIO | Push notification qua `frappe.publish_realtime` |
| **Email Routing** | Cloudflare Email Routing + Workers | Event-driven: email đến → Worker chạy → webhook về Frappe |
| **Tunnel** | Cloudflare Tunnel (`cloudflared`) | Expose Frappe local ra internet an toàn, không cần public IP |
| **Deployment** | bench + nginx + supervisor | Production-ready với Let's Encrypt SSL |
| **Audit** | Frappe Track Changes (Version) | Tự động log mọi CRUD thay đổi |

### 2.2. Quyết định kiến trúc quan trọng

**Frappe site riêng:** GAM chạy trên site riêng (`gam.local`), cùng bench với ERPNext nhưng hoàn toàn cách ly — KHÔNG cài ERPNext vào site GAM. Frappe chạy local, truy cập từ bên ngoài qua Cloudflare Tunnel.

**Encryption key:** Frappe tự quản lý encryption key trong `site_config.json`. Khi dùng field type `Password`, dữ liệu tự mã hóa khi lưu và chỉ giải mã qua `doc.get_password()` — không cần implement `encrypt()`/`decrypt()` thủ công.

**Cloudflare Email architecture:** Tất cả email game forward về 1 email trên Cloudflare domain (`gam@yourdomain.com`). Khi email đến, Cloudflare Email Worker tự động chạy → parse email → gửi webhook về Frappe qua Cloudflare Tunnel. Event-driven, không polling, gần real-time (~5-30 giây).

---

## 3. Kiến trúc Dữ liệu

### 3.1. DocTypes — Data Model

Tất cả DocTypes thuộc module `GAM`, bật `Track Changes` để audit tự động.

#### 3.1.1. GAM Email
```
Settings: Track Changes = ✅
Fields:
  address          | Data      | Required, Unique
  email_password   | Password  | (Frappe tự mã hóa)
  provider         | Select    | Options: Gmail\nOutlook\nProton\nYahoo\nOther
  notes            | Small Text|
  is_active        | Check     | Default = 1
  forward_verified | Check     | Default = 0 (Admin đánh dấu khi đã setup forwarding)
  recovery_emails  | Table     | Options: GAM Email Recovery
```

#### 3.1.2. GAM Email Recovery (Child Table)
```
Settings: Is Child Table = ✅
Fields:
  address  | Data |
  label    | Data |
```

#### 3.1.3. GAM Account
```
Settings: Track Changes = ✅
Fields:
  platform          | Select    | Options: STEAM\nBATTLENET\nXBOX\nEPIC\nSTANDALONE | Required
  username          | Data      | Required
  account_password  | Password  |
  totp_secret       | Password  | (Secret key cho 2FA App / Authenticator)
  email             | Link      | Options: GAM Email | Required
  source            | Data      |
  status            | Select    | Options: ACTIVE\nBANNED\nINACTIVE\nSUSPENDED | Default ACTIVE
  notes             | Small Text|
  account_created_at| Datetime  |
  purchased_at      | Datetime  |
  games             | Table     | Options: GAM Account Game

Title field: username
```

#### 3.1.4. GAM Game
```
Settings: Track Changes = ✅
Fields:
  game_name | Data  | Required, Unique
  publisher | Data  |
  is_active | Check | Default = 1

Title field: game_name
```

#### 3.1.5. GAM Game Server
```
Fields:
  game      | Link   | Options: GAM Game | Required
  region    | Select | Options: AMERICAS\nASIA\nEUROPE\nGLOBAL | Required
  is_active | Check  | Default = 1
  notes     | Data   |
```

#### 3.1.6. GAM DLC
```
Fields:
  game         | Link | Options: GAM Game | Required
  dlc_name     | Data | Required
  release_date | Date |
```

#### 3.1.7. GAM Account Game (Child Table)
```
Settings: Is Child Table = ✅
Fields:
  game         | Link  | Options: GAM Game | Required
  server       | Link  | Options: GAM Game Server
  is_main      | Check |
  purchased_at | Datetime |
  notes        | Data  |
  dlcs         | Table | Options: GAM Account Game DLC
```

#### 3.1.8. GAM Account Game DLC (Child Table)
```
Settings: Is Child Table = ✅
Fields:
  dlc          | Link     | Options: GAM DLC
  purchased_at | Datetime |
```

#### 3.1.9. GAM Account Link (DocType riêng)
```
Settings: Track Changes = ✅
Fields:
  source_account | Link     | Options: GAM Account | Required
  target_account | Link     | Options: GAM Account | Required
  link_type      | Data     | (vd: STEAM_TO_BNET)
  status         | Select   | Options: ACTIVE\nEXPIRED\nREVOKED | Default ACTIVE
  expiry_date    | Datetime |
  notes          | Data     |

Validation: chặn tự link + chặn link trùng (controller Python kiểm tra unique cả 2 chiều)
```

#### 3.1.10. GAM Reveal Log
```
Settings: Read Only sau khi tạo
Fields:
  action          | Select   | Options: REVEAL\nCOPY | Default: REVEAL
  viewed_by       | Link     | Options: User
  target_doctype  | Data     |
  target_name     | Data     |
  fieldname       | Data     |
  ip_address      | Data     |
  user_agent      | Small Text|
  viewed_at       | Datetime | Default: now
```

#### 3.1.11. GAM Webhook Config (Singleton)
```
Settings: Is Single = ✅
Fields:
  webhook_email     | Data     | Required (VD: gam@yourdomain.com — email Cloudflare nhận forward)
  webhook_secret    | Password | (Secret key xác thực webhook từ CF Worker)
  is_active         | Check    | Default = 1
  last_received_at  | Datetime | Read Only
  last_status       | Data     | Read Only (OK / Error)
  total_received    | Int      | Read Only
```

#### 3.1.12. GAM Email Code
```
Settings: Track Changes = ✅
Fields:
  email            | Link     | Options: GAM Email
  email_address    | Data     | (fallback nếu không match GAM Email)
  platform         | Select   | Options: STEAM\nBATTLENET\nPOE\nOTHER | Required
  code             | Data     | Required
  email_subject    | Data     |
  email_from       | Data     |
  received_at      | Datetime | Required
  fetched_at       | Datetime |
  expires_at       | Datetime |
  status           | Select   | Options: AVAILABLE\nCLAIMED\nEXPIRED | Default AVAILABLE
  claimed_by       | Link     | Options: User
  claimed_at       | Datetime |
  raw_snippet      | Small Text |
  source_uid       | Data     | Hidden
```

#### 3.1.13. GAM Code Request Log
```
Settings: Read Only sau khi tạo
Fields:
  requested_by     | Link     | Options: User | Required
  email_code       | Link     | Options: GAM Email Code
  target_email     | Link     | Options: GAM Email | Required
  target_account   | Link     | Options: GAM Account
  platform         | Data     |
  code_value       | Data     | (snapshot code đã cấp)
  status           | Select   | Options: FULFILLED\nNO_CODE\nEXPIRED | Required
  requested_at     | Datetime | Default: now | Required
  notes            | Small Text |
```

#### 3.1.14. GAM Code Pattern
```
Fields:
  platform         | Select   | Options: STEAM\nBATTLENET\nPOE\nOTHER
  sender_pattern   | Data     | (regex match sender email)
  subject_keywords | Data     | (comma-separated)
  code_regex       | Data     | (regex, group 1 = code)
  ttl_minutes      | Int      | Default: 15
  is_active        | Check    | Default = 1
  priority         | Int      | Default: 0
```

#### 3.1.15. GAM Account Usage
```
Settings: Track Changes = ✅
Fields:
  account              | Link      | Options: GAM Account | Required
  status               | Select    | Options: IN_USE\nRELEASED\nEXPIRED\nFORCE_RELEASED | Required
  used_by              | Link      | Options: User | Required
  purpose              | Select    | Options: LOGIN\nLEVELING\nBUILD\nFARMING\nTESTING\nDELIVERY\nOTHER
  order_ref            | Data      |
  started_at           | Datetime  | Required
  lease_until          | Datetime  | Required
  ended_at             | Datetime  |
  end_reason           | Select    | Options: DONE\nCANCELLED\nTIMEOUT\nFORCE_RELEASED\nERROR
  notes                | Small Text|
```

#### 3.1.16. GAM Email Inbound Log
```
Settings: Read Only sau khi tạo
Fields:
  email_account       | Data     |
  gam_email           | Link     | Options: GAM Email
  email_from          | Data     |
  email_subject       | Data     |
  message_id          | Data     |
  received_at         | Datetime |
  fetched_at          | Datetime |
  status              | Select   | Options: OK\nNO_MATCH\nDUPLICATE\nPARSE_ERROR\nINACTIVE\nPAYLOAD_TRUNCATED
  matched_platform    | Data     |
  matched_pattern     | Link     | Options: GAM Code Pattern
  email_code          | Link     | Options: GAM Email Code
  raw_snippet         | Small Text|
  error_message       | Small Text|
```

### 3.2. Sơ đồ quan hệ (ERD tóm tắt)

```
┌──────────────────┐     ┌──────────────────┐
│ Webhook Config   │     │  Code Pattern    │
│ (Singleton)      │     │  (per platform)  │
└────────┬─────────┘     └────────┬─────────┘
         │ CF webhook             │ regex rules
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│  GAM Email Code  │─────│  Code Request    │
│  (extracted)     │     │  Log (audit)     │
└────────┬─────────┘     └──────────────────┘
         │ belongs to
┌────────▼─────────┐     ┌──────────────────┐     ┌──────────────────┐
│    GAM Email     │────▶│  Email Recovery  │     │ Email Inbound Log│
└────────┬─────────┘     └──────────────────┘     └──────────────────┘
         │ 1:N
┌────────▼─────────┐     ┌──────────────────┐     ┌──────────┐
│   GAM Account    │◀────│  Account Link    │────▶│ Account  │
└────────┬─────────┘     └──────────────────┘     └──────────┘
         │ N:M (qua AccountGame)
┌────────▼─────────┐     ┌──────────────────┐
│    GAM Game      │────▶│   Game Server    │
└────────┬─────────┘     └──────────────────┘
         │
┌────────▼─────────┐
│     GAM DLC      │
└──────────────────┘
         ▲
         │ N:M (qua AccountGameDLC)
┌────────┴─────────┐     ┌──────────────────┐
│  Account Game    │     │  Account Usage   │ (IN_USE / EXPIRED)
└──────────────────┘     └──────────────────┘

┌──────────────────┐
│  GAM Reveal Log  │  ← audit password reveal
└──────────────────┘
```

### 3.3. Tổng số DocTypes: 16

| # | DocType | Loại |
|---|---------|------|
| 1 | GAM Email | Standard |
| 2 | GAM Email Recovery | Child Table |
| 3 | GAM Account | Standard |
| 4 | GAM Game | Standard |
| 5 | GAM Game Server | Standard |
| 6 | GAM DLC | Standard |
| 7 | GAM Account Game | Child Table |
| 8 | GAM Account Game DLC | Child Table |
| 9 | GAM Account Link | Standard |
| 10 | GAM Reveal Log | Standard (Read Only) |
| 11 | GAM Webhook Config | Singleton |
| 12 | GAM Email Code | Standard |
| 13 | GAM Code Request Log | Standard (Read Only) |
| 14 | GAM Code Pattern | Standard |
| 15 | GAM Account Usage | Standard |
| 16 | GAM Email Inbound Log | Standard (Read Only) |

### 3.4. Quy tắc `is_active` trong queries

| Ngữ cảnh | Hành vi |
|----------|---------|
| Dropdown / Select khi tạo/sửa form | Chỉ lấy `is_active = 1` |
| Danh sách chính — MEMBER | Chỉ hiện `is_active = 1` |
| Danh sách chính — ADMIN | Hiện tất cả, record `is_active = 0` hiển thị mờ + badge "Inactive" |
| ADMIN toggle on/off | Nút bật/tắt trực tiếp trên từng record |
| Query liên quan (VD: Account.email) | Vẫn hiện data dù email đã `is_active = 0` — không ẩn data lịch sử |

---

## 4. Thiết kế API

### 4.1. Frappe Auto REST API

Frappe tự cung cấp REST API cho mọi DocType — **không cần viết code**:

```
GET    /api/resource/GAM Account                    → List
GET    /api/resource/GAM Account/{name}             → Get one
POST   /api/resource/GAM Account                    → Create
PUT    /api/resource/GAM Account/{name}             → Update
DELETE /api/resource/GAM Account/{name}             → Delete
```

Quyền truy cập tự động enforce theo Role Permission Manager.

### 4.2. Frontend dùng frappe-ui resources

```javascript
// List
const accounts = createListResource({
  doctype: 'GAM Account',
  fields: ['name', 'platform', 'username', 'status', 'email'],
  filters: { status: 'ACTIVE' },
  pageLength: 20,
  auto: true,
})

// Document (detail)
const account = createDocumentResource({
  doctype: 'GAM Account',
  name: route.params.name,
  auto: true,
})
// account.doc → data
// account.setValue.submit({ status: 'BANNED' }) → update
// account.delete.submit() → delete
```

### 4.3. Custom Whitelisted Methods

Chỉ cần viết code cho logic đặc biệt:

| Method | Mô tả | Quyền |
|--------|--------|-------|
| `gam.api.reveal_password` | Giải mã password + ghi Reveal Log | GAM Member (read) |
| `gam.api.request_code` | Lấy verification code mới nhất + ghi Code Request Log + CLAIMED | GAM Member (read) |
| `gam.api.receive_email_webhook` | Nhận webhook từ Cloudflare Email Worker, extract code, lưu DB | allow_guest + webhook secret |
| `gam.api.get_dashboard_stats` | Thống kê tổng hợp cho Dashboard | GAM Member (read) |
| `gam.api.global_search` | Tìm kiếm toàn cục (accounts, emails, games) | GAM Member (read) |

### 4.4. API Reveal Password (chi tiết)

```python
@frappe.whitelist()
def reveal_password(doctype, name, fieldname, action="REVEAL"):
    # 1. Check permission (Frappe enforce theo Role)
    # 2. Rate limit: 20 lần / 60 giây / user
    # 3. Whitelist fieldname: account_password, email_password, totp_secret
    # 4. Giải mã: doc.get_password(fieldname)
    # 5. Lấy ip_address, user_agent từ request
    # 6. Ghi GAM Reveal Log (với action REVEAL hoặc COPY)
    # 7. Return { password: plaintext }
```

### 4.5. API Request Code (chi tiết)

```python
@frappe.whitelist()
def request_code(email_name=None, account_name=None, platform=None):
    # 1. Check permission trên email/account đích
    # 2. Rate limit: 30 lần / 60 giây / user
    # 3. Filter theo email_name, và platform (nếu có)
    # 4. Atomic claim: UPDATE `GAM Email Code` SET status='CLAIMED' WHERE status='AVAILABLE' AND expires_at > NOW() LIMIT 1
    # 5. Ghi GAM Code Request Log (BẤT KỂ có code hay không)
    # 6. Return { status: ok, code, platform, expires_at } hoặc { status: no_code }
```

---

## 5. Thiết kế Giao diện

### 5.1. Cấu trúc Frontend (Vue 3 SPA)

```
apps/gam/frontend/src/
├── main.js              ← createApp + FrappeUI plugin
├── router.js            ← Vue Router routes
├── App.vue              ← Layout + realtime listeners
├── pages/
│   ├── Login.vue
│   ├── Dashboard.vue
│   ├── EmailList.vue
│   ├── EmailDetail.vue
│   ├── AccountList.vue
│   ├── AccountDetail.vue
│   ├── Games.vue
│   ├── Search.vue
│   ├── RevealLog.vue
│   └── CodeRequestLog.vue    ← Admin: audit log yêu cầu code
├── components/
│   ├── AppSidebar.vue
│   ├── PasswordField.vue
│   ├── CodeRequestButton.vue  ← Nút lấy verification code
│   ├── StatusBadge.vue
│   ├── PlatformBadge.vue
│   ├── AccountLinkSection.vue
│   ├── AccountGameDialog.vue
│   └── AccountLinkDialog.vue
└── data/
    └── session.js       ← user session state
```

### 5.2. Navigation (Sidebar)

```
Dashboard       → /
Emails          → /emails
Accounts        → /accounts
Games           → /games           (chỉ GAM Admin)
Search          → /search
Reveal Logs     → /reveal-logs     (chỉ GAM Admin)
Code Logs       → /code-logs       (chỉ GAM Admin)
```

### 5.3. Dashboard (Trang chủ)

**Stat Cards hàng đầu:**

| Card | Dữ liệu | Màu cảnh báo |
|------|---------|-------------|
| Tổng số Account | `frappe.db.count("GAM Account")` | — |
| Đang bị Ban | `status = BANNED` | Đỏ nếu > 0 |
| Sắp hết hạn Link | `expiry_date <= NOW() + 7 days` | Vàng nếu > 0 |
| Tổng số Email | `is_active = 1` | — |
| Codes đang chờ | `status = AVAILABLE, expires_at > NOW()` | Xanh nếu > 0 |

**Bảng "Sắp hết hạn" (nếu có):**
- Account Link có `expiry_date` trong 7 ngày tới
- Cột: Account, Email, Ngày hết hạn, Còn lại

**Realtime notification:**
- SocketIO listener `gam_new_code` → toast notification khi có verification code mới

### 5.4. Trang Accounts

**Filter bar:**
- Platform: All / Steam / Battle.net / Xbox / Epic / Standalone
- Status: All / Active / Banned / Inactive / Suspended
- Search username: `['like', '%...%']`

**Bảng danh sách:**

| Cột | Hiển thị |
|-----|---------|
| Platform | Icon + tên platform |
| Username | Text |
| Email | address email liên kết |
| Status | Badge màu (xanh/đỏ/xám) |
| Games | Danh sách badge tên game |
| Hành động | Xem / Sửa / Xóa (ADMIN) |

**Phân trang:** 20 items/trang, load thêm khi scroll.

### 5.5. Trang Chi tiết Account (Account Profile Page)

Layout chia 2 cột trên desktop:

**Cột trái — Thông tin cơ bản:**
```
┌─────────────────────────────────────┐
│  [STEAM]  user_abc123               │
│  Status: ● ACTIVE                   │
│                                     │
│  Email: example@gmail.com     [→]   │
│  Mật khẩu: ••••••••    [👁] [📋]   │
│  2FA App (TOTP): •••••• [👁] [📋]   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🔑 Lấy Verification Code   │    │  ← CodeRequestButton (Phase 4A)
│  └─────────────────────────────┘    │
│  Code: A1B2C  📋  Hết hạn: 12 phút │  ← hiển thị khi có code từ email
│                                     │
│  Nguồn: Shop A                      │
│  Ngày tạo account: 01/01/2024       │
│  Ngày mua: 15/03/2024               │
│  Ghi chú: ...                       │
└─────────────────────────────────────┘
```

**Cột phải — Liên kết (Account Link Map):**
```
┌─────────────────────────────────────┐
│  Liên kết với account khác          │
│                                     │
│  [BNet: BlizzUser#1234]  ──────→    │  ← click để xem chi tiết
│  [Xbox: mail_xyz@outlook.com        │
│   ⚠️ Hết hạn: 15/06/2025]          │
│                                     │
│  [+ Thêm liên kết]  (ADMIN only)   │
└─────────────────────────────────────┘
```

**Dưới cùng — Games đang sở hữu:**
```
┌─────────────────────────────────────────────────┐
│  Games                                [+ Thêm]  │
│                                                  │
│  🎮 Diablo 4              [Server: Asia]  ★ Main │
│     DLC: Vessel of Hatred, Lord of Hatred        │
│     Mua: 05/06/2023                              │
│                                                  │
│  🎮 Path of Exile 2       [Server: Americas]     │
│     DLC: —                                       │
└──────────────────────────────────────────────────┘
```

### 5.6. Quy tắc Ẩn/Hiện Mật khẩu

- Mặc định: `••••••••` (không gọi API)
- Nhấn icon 👁: gọi `gam.api.reveal_password` với `action="REVEAL"` → hiển thị plaintext
- Nhấn lại 👁: ẩn đi (không gọi API lần 2 — cache plaintext trong local state, tự xóa sau 60s hoặc khi unmount)
- Nhấn icon 📋: gọi `gam.api.reveal_password` với `action="COPY"` → copy plaintext vào clipboard
- **Tất cả hành động reveal/copy đều ghi GAM Reveal Log (kèm IP, User-Agent)**
- Component sinh mã TOTP 2FA App: Tự động chạy và lấy 6 số trên client nếu có `totp_secret` (vẫn cần gọi API giải mã `totp_secret` 1 lần).

### 5.7. Component CodeRequestButton

- Nhấn "🔑 Lấy Verification Code" → gọi `gam.api.request_code`
- Nếu có code: hiện code lớn (font-mono), nút Copy, countdown hết hạn
- Nếu không có code: thông báo "Chưa có code, đợi 1-2 phút", nút Thử lại
- Code được CLAIMED sau khi lấy → user khác yêu cầu cùng email sẽ không thấy code đó

### 5.8. Trang Admin — Reveal Log

| Cột | Hiển thị |
|-----|---------|
| Thời gian | DD/MM/YYYY HH:mm:ss |
| Người dùng | Tên thành viên |
| DocType | GAM Account / GAM Email |
| Record | Tên record |
| Field | account_password / email_password |

Filter: theo user, theo khoảng thời gian.

### 5.9. Trang Admin — Code Request Log

| Cột | Hiển thị |
|-----|---------|
| Thời gian | DD/MM/YYYY HH:mm:ss |
| Người dùng | Tên thành viên |
| Email | Email gốc |
| Account | Account liên kết (nếu có) |
| Platform | Steam / BNet / POE |
| Code | Mã đã cấp |
| Kết quả | FULFILLED / NO_CODE badge |

Filter: theo user, theo email, theo khoảng thời gian, theo status.

---

## 6. Bảo mật & Phân quyền

### 6.1. Phân quyền (Frappe Role Permission Manager)

| DocType | GAM Admin | GAM Member |
|---------|-----------|------------|
| GAM Email | Read/Write/Create/Delete | Read |
| GAM Email Recovery | Read/Write/Create/Delete | Read |
| GAM Account | Read/Write/Create/Delete | Read |
| GAM Game | Read/Write/Create/Delete | Read |
| GAM Game Server | Read/Write/Create/Delete | Read |
| GAM DLC | Read/Write/Create/Delete | Read |
| GAM Account Game | Read/Write/Create/Delete | Read |
| GAM Account Game DLC | Read/Write/Create/Delete | Read |
| GAM Account Link | Read/Write/Create/Delete | Read |
| GAM Reveal Log | Read | (không quyền — chỉ tạo qua method) |
| GAM Webhook Config | Read/Write | (không quyền) |
| GAM Email Code | Read/Write/Create/Delete | (không quyền — bắt buộc lấy qua method `request_code`) |
| GAM Code Request Log | Read | (không quyền — chỉ tạo qua method) |
| GAM Code Pattern | Read/Write/Create/Delete | Read |
| GAM Account Usage | Read/Write/Create/Delete | Read/Create/Write (chỉ check-in/out) |
| GAM Email Inbound Log | Read/Delete | (không quyền) |

> **Lưu ý:** Frappe enforce quyền tự động khi gọi REST API hoặc whitelisted method. Không cần code `requireRole()` thủ công như Next.js — backend tự chặn nếu user không có permission.

> **Quyền "chỉ check-in/out" trên GAM Account Usage:** Role Permission Manager chỉ kiểm soát CRUD ở mức DocType, **không ràng buộc field-level**. Để thực sự giới hạn Member chỉ checkout/check-in (không sửa field khác qua REST), áp dụng **một trong hai cách:**
> - **Cách A (khuyến nghị):** KHÔNG cấp Create/Write trên `GAM Account Usage` cho GAM Member. Checkout/check-in CHỈ đi qua whitelisted method (`checkout_account` / `checkin_account`) — method tự ghi record với `ignore_permissions=True` sau khi validate.
> - **Cách B:** Cấp Create/Write nhưng bật **Field-Level Permission** (Permlevel) trên các field nhạy cảm (purpose, lease_until, ...) để Member không tự sửa.

### 6.2. Mã hóa Mật khẩu

Frappe dùng field type `Password` — tự mã hóa khi lưu, chỉ giải mã qua `doc.get_password(fieldname)`.

- **Encryption key:** Tự sinh trong `site_config.json` khi tạo site
- **Backup key:** PHẢI backup `encryption_key` ra nơi an toàn — **mất key = không giải mã được**
- `get_password()` không tự ghi log → cần GAM Reveal Log để audit

### 6.3. Two-Factor Authentication (TOTP)

Frappe built-in — chỉ cần bật trong System Settings:
```
Enable Two Factor Auth = ✅
Two Factor Authentication Method = OTP App
```

- Login lần đầu → bắt buộc quét QR setup OTP
- Login lần sau → nhập mã OTP 6 số
- Frappe tự quản lý TOTP secret, QR generation, verify

### 6.4. Rate Limiting

```python
frappe.rate_limiter.apply(
    key=f"gam_reveal:{frappe.session.user}",
    limit=20, seconds=60
)
```

- Reveal password: 20 lần / phút / user
- Request code: 30 lần / phút / user

### 6.5. Webhook Security (Cloudflare Email)

- Webhook endpoint `receive_email_webhook` dùng `allow_guest=True` (CF Worker không có Frappe session)
- Xác thực qua **Shared Secret**: CF Worker gửi header `X-Webhook-Secret`, Frappe verify
- `webhook_secret` lưu bằng Frappe Password fieldtype (mã hóa) trong GAM Webhook Config
- Cloudflare Tunnel mã hóa toàn bộ traffic giữa CF edge và Frappe local
- Có thể bổ sung Cloudflare Access (Zero Trust) để giới hạn quyền truy cập endpoint

---

## 7. Email Verification Code System

### 7.1. Kiến trúc Cloudflare Email

```
Game Platform (Steam/BNet/POE)
    │
    ▼ gửi verification code
Email game (game1@gmail.com, game2@outlook.com, ...)
    │
    ▼ auto-forward
gam@yourdomain.com (Cloudflare Email Routing)
    │
    ▼ route to Email Worker (event-driven, instant)
Cloudflare Email Worker
    │
    ├── Parse email headers → xác định email gốc
    ├── Gửi raw data qua webhook
    ▼
Frappe GAM (qua Cloudflare Tunnel)
    │
    ├── Match Code Pattern → xác định platform
    ├── Regex extract → lấy verification code
    ├── Lưu GAM Email Code (status: AVAILABLE)
    └── Push notification (SocketIO)
```

### 7.2. Verification Code Formats

| Platform | Sender | Code Format | TTL |
|----------|--------|-------------|-----|
| **Steam** | `*@steampowered.com` | 5 ký tự chữ+số hoa (VD: `A1B2C`) | 15 phút |
| **Battle.net** | `*@battle.net`, `*@blizzard.com` | 6-8 chữ số | 10 phút |
| **POE** (1 & 2) | `*@grindinggear.com` | 5-8 ký tự chữ+số | 15 phút |

> POE1 và POE2 dùng chung hệ thống account GGG (Grinding Gear Games). Pattern "POE" cover cả hai.

> **Reliability của code extraction (QUAN TRỌNG):**
> - **Code regex phải anchor theo ngữ cảnh**, không chỉ match word đơn lẻ — ví dụ Steam dùng `r"(?:code|guard)[:\s]+([A-Z0-9]{5})\b"` thay vì `r"\b([A-Z0-9]{5})\b"`, vì regex đơn giản sẽ lấy nhím URL/order ID. Nếu match đầu tiên không khớp, lặp qua tất cả match trong body.
> - **Email body phải được parse MIME** trước khi regex. Email thực tế thường là `multipart/alternative` hoặc `text/html`, và phần text có thể bị mã hoá base64/quoted-printable. CF Worker (hoặc Frappe) phải trích xuất phần `text/plain` (hoặc strip HTML) trước khi apply `code_regex`.
> - **Ngày email phải parse RFC 2822**: header `Date` có dạng `"Wed, 14 Jun 2026 10:00:00 +0000"`. Phải parse bằng `email.utils.parsedate_to_datetime` trước khi tính `expires_at = received_at + TTL` — `frappe.utils.add_to_date` không tự parse format này.

### 7.3. Xác định email gốc từ forwarded email

Khi email được forward tới Cloudflare, headers chứa thông tin gốc. CF Worker parse theo thứ tự ưu tiên:

1. `X-Gm-Original-To` (Gmail forward)
2. `Delivered-To` chain (loại bỏ email Cloudflare)
3. `Received` headers — tìm `for <email>` clause
4. `To` header (fallback)

CF Worker gửi `email_account` (email gốc đã parse) trong webhook payload → Frappe map trực tiếp với GAM Email.

### 7.4. Lifecycle của Verification Code

```
AVAILABLE → (user lấy code) → CLAIMED
AVAILABLE → (quá expires_at) → EXPIRED
```

- Code bị **CLAIMED** sau khi 1 user lấy → user khác không lấy được (verification code chỉ dùng 1 lần)
- Auto-expire chạy mỗi 5 phút, đánh dấu code quá hạn thành EXPIRED

### 7.5. Timeline thực tế

```
T+0s     : User login game → Platform gửi code
T+1-5s   : Email game nhận code
T+5-30s  : Auto-forward tới gam@yourdomain.com (Cloudflare)
T+30-31s : CF Email Worker chạy + gửi webhook (~100ms)
T+31s    : Frappe nhận webhook, extract code, lưu DB, push SocketIO
───────────────────────────────────────────
Tổng: ~5 giây đến ~30 giây (worst case)
Code hết hạn: 10-15 phút → DƯ thời gian
```

---

## 8. Luồng vận hành

### 8.1. Luồng thêm tài khoản game mới (ADMIN)

```
1. Vào /emails → Tạo email mới
   → Điền address, password, provider, recovery emails
   → Submit → Frappe encrypt password tự động

2. Setup forwarding cho email vừa tạo
   → Gmail: Settings → Forwarding → gam@yourdomain.com
   → Outlook: Settings → Mail → Forwarding → gam@yourdomain.com
   → Đánh dấu forward_verified = ✅ trong GAM

3. Vào /accounts → Tạo account mới
   → Chọn Platform, điền username, password
   → Chọn Email đã tạo ở bước 1
   → Submit → password mã hóa tự động

4. Trong trang Account vừa tạo
   → Click "Thêm game" → chọn game, server, DLC
   → Submit → lưu vào child table AccountGame

5. Nếu cần liên kết account (VD: BNet ↔ Steam)
   → Click "Thêm liên kết" → chọn account đích
   → Nhập loại link, expiry (nếu có)
```

### 8.2. Luồng member lấy thông tin đăng nhập

```
1. Vào Dashboard → Search: gõ "Diablo 4"
   → Thấy danh sách accounts có Diablo 4

2. Click vào account Battle.net cần dùng
   → Thấy trang Account Profile

3. Copy username
   → Click 📋 bên cạnh username

4. Checkout Account (Bắt buộc)
   → Click "Checkout" để khóa account (thông báo cho team biết bạn đang dùng)
   → Status đổi thành IN_USE (màu đỏ/cam)

5. Reveal mật khẩu / TOTP
   → Click 👁 → API call → giải mã → hiển thị
   → Click 📋 Copy
   → (Reveal Log ghi lại: ai, lúc nào, xem gì, IP)
   → Nếu có 2FA App (TOTP): Xem mã 6 số thay đổi mỗi 30s.

6. Nhìn section Account Link
   → Thấy badge [Steam: user_abc]
   → Click → sang trang Steam account → lấy thông tin tương tự

7. Đăng nhập game
   → Chơi game xong: Click "Check-in" để trả account về AVAILABLE.
```

### 8.3. Luồng lấy verification code (MỚI)

```
1. Member login game account từ thiết bị mới
   → Platform gửi verification code tới email

2. Đợi ~5-30 giây (forwarding + CF Worker webhook)
   → Hoặc nhận toast notification "📩 Code mới: STEAM"

3. Trong trang Account Profile
   → Click "🔑 Lấy Verification Code"
   → GAM tìm code AVAILABLE mới nhất cho email liên kết
   → Hiện: A1B2C  📋  Hết hạn: 12 phút
   → Click 📋 Copy → nhập code vào game

4. Code được CLAIMED → user khác yêu cầu sẽ thấy "Chưa có code"

5. Log ghi lại: ai yêu cầu, code nào, lúc nào, kết quả
```

### 8.4. Luồng kiểm tra account link sắp hết hạn

```
1. Vào Dashboard
   → Thấy card "Sắp hết hạn: 2 links" (màu vàng cảnh báo)
   → Thấy bảng danh sách chi tiết

2. Click vào account → gia hạn subscription thủ công
   → ADMIN vào Edit account → cập nhật expiryDate trong AccountLink
```

---

## 9. Lộ trình triển khai

### 9.1. Roadmap theo Phases

| Phase | Nội dung | Thời gian ước tính |
|-------|---------|-------------------|
| **0** | Bench, Site & Frontend Setup | 0.5 ngày |
| **1** | DocTypes (16 DocTypes — xem §3.3) | 1-2 ngày |
| **2** | Roles & Permissions | 0.5 ngày |
| **3** | Auth & 2FA | 0.5 ngày |
| **4** | Password Reveal + Audit | 0.5 ngày |
| **4A** | Email Verification Code Manager | 2-3 ngày |
| **4B** | Account Usage Lock + Realtime Status | 1-2 ngày |
| **4C** | Email Inbound Log & Reliability | 0.5 ngày |
| **5** | Vue Frontend Foundation | 1-2 ngày |
| **6** | Email Module (CRUD) | 1 ngày |
| **7** | Account Module | 1-2 ngày |
| **8** | Games, Servers, DLC | 1 ngày |
| **9** | AccountGame & AccountLink | 1-2 ngày |
| **10** | Dashboard & Search | 1 ngày |
| **11** | Reveal Log & Code Request Log | 1 ngày |
| **12** | Production Deployment | 1 ngày |
| | **Tổng ước tính** | **~2-3 tuần** |

### 9.2. Thứ tự dependency

```
Site Setup → DocTypes → Permissions → Auth/2FA
                                        ↓
                                  Reveal Password → Email Code System
                                        ↓
                                  Vue Frontend → Email CRUD → Account CRUD
                                                                ↓
                                                          Games/DLC → AccountGame/Link
                                                                ↓
                                                          Dashboard + Search → Admin Logs
                                                                ↓
                                                          Production Deploy
```

### 9.3. So sánh với plan Next.js cũ

| Khái niệm | Next.js plan (cũ) | Frappe plan (hiện tại) |
|-----------|-------------------|----------------------|
| Schema | Prisma migrate | DocType (UI/JSON) |
| Auth | NextAuth code | Built-in, chỉ tạo user |
| 2FA | otplib code | Bật setting |
| Encryption | AES-256-GCM code | Password fieldtype |
| Permission | `requireAdmin()` mỗi action | Role Permission Manager (tự enforce) |
| Audit CRUD | AuditLog table + code | Version (Track Changes, tự động) |
| Audit reveal | Custom | GAM Reveal Log |
| Verification code | ❌ Không có | ✅ Cloudflare Email Worker + webhook |
| CRUD logic | Server Actions | frappe-ui resources + auto REST |
| Custom logic | Server Actions | `@frappe.whitelist()` Python |
| Rate limit | Custom in-memory | `frappe.rate_limiter` |
| Realtime | ❌ Không có | ✅ SocketIO push notifications |
| Deploy | Vercel | bench + nginx |

---

## 10. Checklist Production

### 10.1. Trước khi deploy lần đầu

**Frappe Configuration:**
- [ ] `ignore_csrf` đã TẮT (chỉ dùng cho dev)
- [ ] `encryption_key` từ `site_config.json` đã backup ra password manager
- [ ] HTTPS bật (Let's Encrypt: `bench setup lets-encrypt gam.local`)
- [ ] 2FA bật và bắt buộc (System Settings)
- [ ] Scheduler enabled: `bench --site gam.local enable-scheduler`

**Users & Roles:**
- [ ] Tất cả Member có role GAM Member, KHÔNG có System Manager
- [ ] Admin có GAM Admin + (tùy chọn) System Manager
- [ ] Tất cả members đã setup 2FA

**Cloudflare Email & Tunnel:**
- [ ] Domain đã trên Cloudflare, Email Routing đã bật
- [ ] Email address `gam@yourdomain.com` đã tạo, route tới Email Worker
- [ ] CF Email Worker đã deploy (`wrangler deploy`) + secret đã set (Code payload truncate <100KB)
- [ ] `cloudflared` đã cài và chạy như systemd service
- [ ] Tunnel đã trỏ `gam.yourdomain.com` → `localhost:8000`
- [ ] **[Khuyến nghị]** Cloudflare Access (Zero Trust) đã thiết lập để bảo vệ endpoint UI, bypass endpoint webhook `/api/method/gam.api.receive_email_webhook`
- [ ] Tất cả email game đã setup forwarding tới `gam@yourdomain.com`
- [ ] Đã test: gửi email → forward → CF Worker → webhook → code xuất hiện
- [ ] Code Patterns đã seed (Steam, Battle.net, POE)
- [ ] GAM Webhook Config đã set `webhook_secret` (khớp với CF Worker)
- [ ] Xây dựng quy trình luân chuyển Secret (Secret Rotation) nội bộ

**Build Frontend:**
- [ ] `cd gam-ui && npm run build:prod`   (legacy `apps/gam/frontend` layout superseded — see .ai/current-plan.md)
- [ ] Truy cập `https://gam.yourdomain.com/frontend` → SPA load

### 10.2. Sau khi deploy

- [ ] Login + 2FA hoạt động
- [ ] Reveal password → kiểm tra Reveal Log được ghi
- [ ] Request code → kiểm tra Code Request Log được ghi
- [ ] Rate limiting: call reveal API > 20 lần/phút → bị chặn
- [ ] Member không thể tạo/sửa/xóa account
- [ ] CSRF token tự attach (không bị 403 sau build production)
- [ ] Restore backup trên site tạm với encryption_key → password giải mã đúng

### 10.3. Bảo trì định kỳ

| Tần suất | Việc cần làm |
|----------|-------------|
| Hàng tuần | Xem Dashboard kiểm tra links sắp hết hạn |
| Hàng tuần | Review Code Request Logs xem hoạt động team |
| Hàng tháng | Review Reveal Logs xem có hoạt động bất thường |
| Hàng tháng | Kiểm tra Cloudflare Tunnel status + Worker analytics |
| Hàng quý | Backup database + encryption_key |
| Khi có thành viên nghỉ | Disable User trong Frappe (giữ audit history) |
| Khi thêm email mới | Setup forwarding tới `gam@yourdomain.com` → đánh dấu forward_verified |
| Khi thêm platform mới | Tạo GAM Code Pattern mới qua Desk |

---

*Tài liệu này được tạo ngày 14/05/2026, cập nhật ngày 12/06/2026 cho Cloudflare Email Worker + Tunnel architecture.*
*Khi nghi ngờ về quyết định thiết kế, tham chiếu file triển khai `GAM_Implementation_Frappe_Vue_v4.md`.*
