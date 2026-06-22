# GAM — Implementation Plan: Frappe + Vue (Site riêng)

> **Kiến trúc:** Frappe app `gam` cài trên **site riêng** cùng bench với ERPNext v15. Frontend Vue 3 SPA (frappe-ui) bundle trong app. Frappe chạy local, truy cập từ bên ngoài qua Cloudflare Tunnel.
> **Đọc cùng:** `GAM_Design_Complete_v4.md` (thiết kế v4.0 — Cloudflare Email architecture).
> **Backend:** Python (DocType controllers + whitelisted methods). **Frontend:** Vue 3 + frappe-ui.
> Thực hiện theo thứ tự Phase. Mỗi phase có Objective, Tasks, Verification.

---

## Mục lục
- [Phase 0 — Bench, Site & Frontend Setup](#phase-0)
- [Phase 1 — DocTypes (Data Model)](#phase-1)
- [Phase 2 — Roles & Permissions](#phase-2)
- [Phase 3 — Auth & 2FA](#phase-3)
- [Phase 4 — Password Reveal + Audit](#phase-4)
- [Phase 4A — Email Verification Code Manager](#phase-4a)
- [Phase 5 — Vue Frontend Foundation](#phase-5)
- [Phase 6 — Email Module](#phase-6)
- [Phase 7 — Account Module](#phase-7)
- [Phase 8 — Games, Servers, DLC](#phase-8)
- [Phase 9 — AccountGame & AccountLink](#phase-9)
- [Phase 10 — Dashboard & Search](#phase-10)
- [Phase 11 — Reveal Log & Code Request Log Viewer](#phase-11)
- [Phase 12 — Production Deployment](#phase-12)
- [Phase 12A — QA & Security Hardening](#phase-12a)

---

## Phase 0 — Bench, Site & Frontend Setup {#phase-0}

### Objective
Tạo site GAM riêng trên bench hiện có, tạo app `gam`, dựng frontend Vue.

### Task 0.1 — Tạo site riêng

```bash
cd ~/frappe-bench

# Tạo site mới cho GAM (database riêng)
bench new-site gam.local
# Nhập MySQL root password + đặt Administrator password

# (Tùy chọn) thêm vào hosts để dev
echo "127.0.0.1 gam.local" | sudo tee -a /etc/hosts
```

### Task 0.2 — Tạo app và cài vào site GAM

```bash
# Tạo app gam
bench new-app gam
# Trả lời các câu hỏi: app title=GAM, publisher, etc.

# Cài CHỈ vào site gam.local (KHÔNG cài vào site ERPNext)
bench --site gam.local install-app gam

# KHÔNG cài erpnext vào site này → cách ly hoàn toàn
```

### Task 0.3 — Dựng frontend Vue + frappe-ui

```bash
cd apps/gam
npx degit NagariaHussain/doppio_frappeui_starter frontend
cd frontend
npm install      # project uses npm + package-lock.json (NOT yarn)
```

### Task 0.4 — Cấu hình dev (tránh CSRF error)

Thêm vào `sites/gam.local/site_config.json` (CHỈ môi trường dev):

```json
{
  "ignore_csrf": 1
}
```

Cấu hình `apps/gam/frontend/vite.config.js` proxy về backend port 8000 (starter đã có sẵn, kiểm tra `proxyOptions`).

### Task 0.5 — Chạy dev

```bash
# Terminal 1: Frappe backend
bench start

# Terminal 2: Vite dev server
cd apps/gam/frontend
npm run dev   # http://gam.local:8080   (legacy layout — see gam-ui/ + .ai/current-plan.md co-tenancy)
```

### Verification Phase 0
- Truy cập `http://gam.local:8080` thấy starter UI với nút "ping"
- Click ping → nhận response từ backend (kết nối OK)
- `bench --site gam.local list-apps` chỉ thấy `frappe` và `gam` (KHÔNG có erpnext)

---

## Phase 1 — DocTypes (Data Model) {#phase-1}

### Objective
Tạo toàn bộ DocTypes. Bật Track Changes để audit tự động.

### Cách tạo DocType
Hai cách — chọn một:
- **UI:** Desk (`http://gam.local:8000/app`) > DocType > New. Trực quan, dễ.
- **Code:** File JSON trong `apps/gam/gam/gam/doctype/<name>/`. Version-control tốt hơn.

> Khuyến nghị: tạo bằng UI lần đầu, rồi `bench --site gam.local export-fixtures` hoặc commit doctype JSON để version control.

### Task 1.1 — DocType `GAM Email`

```
Settings: Track Changes = ✅, Module = GAM
Fields:
  address          | Data      | Required, Unique
  email_password   | Password  | (tự mã hóa)
  provider         | Select    | Options: Gmail\nOutlook\nProton\nYahoo\nOther
  notes            | Small Text|
  is_active        | Check     | Default = 1
  recovery_emails  | Table     | Options: GAM Email Recovery
```

### Task 1.2 — DocType `GAM Email Recovery` (Child Table)

```
Settings: Is Child Table = ✅ (istable=1)
Fields:
  address  | Data |
  label    | Data |
```

### Task 1.3 — DocType `GAM Account`

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

### Task 1.4 — DocType `GAM Game`

```
Settings: Track Changes = ✅
Fields:
  game_name | Data  | Required, Unique
  publisher | Data  |
  is_active | Check | Default = 1

Title field: game_name
```

### Task 1.5 — DocType `GAM Game Server`

```
Fields:
  game      | Link   | Options: GAM Game | Required
  region    | Select | Options: AMERICAS\nASIA\nEUROPE\nGLOBAL | Required
  is_active | Check  | Default = 1
  notes     | Data   |

Naming: format {game}-{region} hoặc autoname hash
```

### Task 1.6 — DocType `GAM DLC`

```
Fields:
  game         | Link | Options: GAM Game | Required
  dlc_name     | Data | Required
  release_date | Date |
```

### Task 1.7 — DocType `GAM Account Game` (Child Table)

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

### Task 1.8 — DocType `GAM Account Game DLC` (Child Table)

```
Settings: Is Child Table = ✅
Fields:
  dlc          | Link     | Options: GAM DLC
  purchased_at | Datetime |
```

### Task 1.9 — DocType `GAM Account Link` (DocType riêng, KHÔNG child table)

```
Settings: Track Changes = ✅
Fields:
  source_account | Link     | Options: GAM Account | Required
  target_account | Link     | Options: GAM Account | Required
  link_type      | Data     | (vd: STEAM_TO_BNET)
  status         | Select   | Options: ACTIVE\nEXPIRED\nREVOKED | Default ACTIVE
  expiry_date    | Datetime |
  notes          | Data     |
```

Thêm validation trong controller (Task 1.11) để chặn link trùng.

### Task 1.10 — DocType `GAM Reveal Log`

```
Settings: Read Only sau khi tạo (không cho sửa)
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

### Task 1.11 — Controllers (validation)

`apps/gam/gam/gam/doctype/gam_account_link/gam_account_link.py`:

```python
import frappe
from frappe.model.document import Document
from frappe import _

class GAMAccountLink(Document):
    def validate(self):
        if self.source_account == self.target_account:
            frappe.throw(_("Không thể tự liên kết một account với chính nó"))
        # Chặn link trùng (cùng source, target, type) - kiểm tra cả 2 chiều
        existing = frappe.db.sql("""
            SELECT name FROM `tabGAM Account Link`
            WHERE link_type = %s
            AND ((source_account = %s AND target_account = %s)
              OR (source_account = %s AND target_account = %s))
            AND name != %s
        """, (self.link_type, self.source_account, self.target_account, self.target_account, self.source_account, self.name or ''))
        if existing:
            frappe.throw(_("Liên kết này đã tồn tại (kiểm tra cả 2 chiều)"))
```

### Task 1.12 — Seed data (Games + DLC)

`apps/gam/gam/setup/seed.py`:

```python
import frappe

def seed_games():
    games = [
        ("Diablo IV", "Blizzard Entertainment"),
        ("Path of Exile", "Grinding Gear Games"),
        ("Path of Exile 2", "Grinding Gear Games"),
        ("World of Warcraft", "Blizzard Entertainment"),
        ("Overwatch 2", "Blizzard Entertainment"),
    ]
    for name, publisher in games:
        if not frappe.db.exists("GAM Game", {"game_name": name}):
            game = frappe.get_doc({
                "doctype": "GAM Game", "game_name": name, "publisher": publisher
            }).insert(ignore_permissions=True)
            for region in ["AMERICAS", "ASIA", "EUROPE"]:
                frappe.get_doc({
                    "doctype": "GAM Game Server", "game": game.name, "region": region
                }).insert(ignore_permissions=True)

    # DLC cho Diablo IV
    d4 = frappe.db.get_value("GAM Game", {"game_name": "Diablo IV"}, "name")
    if d4:
        for dlc in ["Vessel of Hatred", "Lord of Hatred"]:
            if not frappe.db.exists("GAM DLC", {"game": d4, "dlc_name": dlc}):
                frappe.get_doc({"doctype": "GAM DLC", "game": d4, "dlc_name": dlc}).insert(ignore_permissions=True)

    frappe.db.commit()
```

Chạy: `bench --site gam.local execute gam.setup.seed.seed_games`

### Verification Phase 1
- Desk > thấy đủ 16 DocTypes module GAM (xem Design §3.3)
- Tạo thử 1 GAM Email với password → lưu được, password hiển thị `*****`
- Chạy seed → Desk > GAM Game thấy 5 games, mỗi game 3 servers
- Sửa 1 record → tab "..." > View Changes thấy Version log (audit tự động)

---

## Phase 2 — Roles & Permissions {#phase-2}

### Objective
Tạo 2 roles và phân quyền chi tiết theo DocType.

### Task 2.1 — Tạo Roles

Desk > Role > New (tạo 2 roles):
```
GAM Admin
GAM Member
```

### Task 2.2 — Phân quyền (Role Permission Manager)

Desk > Role Permissions Manager. Set cho từng DocType:

| DocType | GAM Admin | GAM Member |
|---------|-----------|------------|
| GAM Email | Read/Write/Create/Delete | Read |
| GAM Account | Read/Write/Create/Delete | Read |
| GAM Game | Read/Write/Create/Delete | Read |
| GAM Game Server | Read/Write/Create/Delete | Read |
| GAM DLC | Read/Write/Create/Delete | Read |
| GAM Account Link | Read/Write/Create/Delete | Read |
| GAM Email Code | Read/Write/Create/Delete | (không quyền — bắt buộc lấy qua method `request_code`) |
| GAM Code Request Log | Read | (không quyền — chỉ tạo qua method) |
| GAM Code Pattern | Read/Write/Create/Delete | Read |
| GAM Account Usage | Read/Write/Create/Delete | Read/Create/Write (chỉ check-in/out) |
| GAM Email Inbound Log | Read/Delete | (không quyền) |

> **Lưu ý:** GAM Member có `Read` trên GAM Account/Email → đủ để frontend gọi `reveal_password` (method check `read` permission). Đây là điểm khác Next.js: không cần code `requireAdmin()` thủ công, Frappe enforce tự động khi gọi REST/method.

### Task 2.3 — Định nghĩa roles trong code (để version control)

`apps/gam/gam/hooks.py` — không bắt buộc, nhưng export fixtures để deploy nhất quán:

```bash
bench --site gam.local export-fixtures --app gam
```

### Verification Phase 2
- Tạo user test với role GAM Member → login Desk → KHÔNG thấy nút New/Delete trên GAM Account
- User GAM Member gọi REST `POST /api/resource/GAM Account` → bị từ chối 403
- User GAM Admin → CRUD đầy đủ

---

## Phase 3 — Auth & 2FA {#phase-3}

### Objective
Bật 2FA bắt buộc. Cấu hình login. (Frappe lo phần lớn.)

### Task 3.1 — Bật 2FA

Desk > System Settings:
```
Enable Two Factor Auth = ✅
Two Factor Authentication Method = OTP App
Bypass 2FA for Restricted IP = false
Bypass Restrict IP Check If 2FA Enabled = false
```

Sau khi bật, mọi user login sẽ được yêu cầu setup OTP App (TOTP) lần đầu — Frappe tự sinh QR code.

### Task 3.2 — Login frontend

frappe-ui starter đã có session/login. Xác minh `apps/gam/frontend/src` có:
- Login view gọi `frappe.auth` hoặc `/api/method/login`
- Route guard: redirect về login nếu chưa auth
- 2FA flow do Frappe trả về trong response login → frontend hiển thị input OTP

> Nếu starter chưa có 2FA UI: login API trả `verification` object khi cần 2FA. Frontend hiển thị input mã → gọi lại với `otp`.

### Task 3.3 — Tạo users cho team

Desk > User > New cho từng thành viên:
- Gán role `GAM Admin` (cho bạn) hoặc `GAM Member` (cho team)
- KHÔNG gán role System Manager cho Member (tránh truy cập Desk admin)

### Verification Phase 3
- Login lần đầu → bắt buộc quét QR setup OTP
- Login lần sau → yêu cầu nhập mã OTP
- User Member login → vào được frontend, không vào được Desk admin functions

---

## Phase 4 — Password Reveal + Audit {#phase-4}

### Objective
Method giải mã password kèm log người xem (vì `get_password` không tự log).

### Task 4.1 — Whitelisted method

`apps/gam/gam/api.py`:

```python
import frappe
from frappe import _

@frappe.whitelist()
def reveal_password(doctype, name, fieldname, action="REVEAL"):
    # 1. Permission — Frappe tự kiểm tra theo Role
    #    has_permission cần doc object (không phải name string) để check chính xác.
    if not frappe.has_permission(frappe.get_doc(doctype, name), "read"):
        frappe.throw(_("Không có quyền xem"), frappe.PermissionError)

    # 2. Rate limit (built-in): 20 lần / 60 giây / user.
    #    LƯU Ý (verify trên Frappe v15 đang dùng): API chính thức của Frappe là
    #    decorator @frappe.rate_limiter.apply(...). Form "gọi hàm" bên dưới cần
    #    test thực tế; nếu không hoạt động, chuyển sang decorator hoặc tự đếm
    #    qua bảng GAM Reveal Log (xem Design §6.4).
    frappe.rate_limiter.apply(
        key=f"gam_reveal:{frappe.session.user}", limit=20, seconds=60
    )

    # 3. Whitelist fieldname hợp lệ (tránh đọc field tùy ý)
    allowed = {
        "GAM Account": ["account_password", "totp_secret"],
        "GAM Email": ["email_password"],
    }
    if fieldname not in allowed.get(doctype, []):
        frappe.throw(_("Field không hợp lệ"))

    # 4. Giải mã
    doc = frappe.get_doc(doctype, name)
    password = doc.get_password(fieldname)

    # Lấy IP và User Agent
    ip_address = frappe.local.request_ip
    user_agent = frappe.request.headers.get("User-Agent")

    # 5. Ghi log
    frappe.get_doc({
        "doctype": "GAM Reveal Log",
        "action": action,
        "viewed_by": frappe.session.user,
        "target_doctype": doctype,
        "target_name": name,
        "fieldname": fieldname,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "viewed_at": frappe.utils.now(),
    }).insert(ignore_permissions=True)
    frappe.db.commit()

    return {"password": password}
```

### Task 4.1.2 — Yêu cầu Frontend
- Mật khẩu lấy về chỉ lưu trong biến state (Vue `ref`), KHÔNG lưu localStorage.
- Tự động xóa state sau 60 giây (dùng `setTimeout`).
- Khi user rời khỏi trang (unmount component), phải clear state mật khẩu ngay lập tức.

### Task 4.2 — Backup encryption key (QUAN TRỌNG)

```bash
# Encryption key nằm trong site_config.json — backup ngay
cat sites/gam.local/site_config.json | grep encryption_key
```

Ghi lại key này vào nơi an toàn (password manager). **Mất key = không giải mã được password nào.**

### Verification Phase 4
- Gọi method qua frontend → nhận password đúng
- Sau khi gọi → GAM Reveal Log có record mới (ai, xem gì, lúc nào)
- Gọi >20 lần/phút → nhận lỗi rate limit
- Gọi với fieldname lạ (vd "notes") → bị từ chối

---

## Phase 4A — Email Verification Code System (Cloudflare) {#phase-4a}

### Objective
Tự động nhận verification code từ email game account và phân phối cho team, có audit log đầy đủ.

### Kiến trúc: Cloudflare Email Worker + Tunnel

Tất cả email game **forward về 1 email trên Cloudflare domain** (`gam@yourdomain.com`). Khi email đến, Cloudflare Email Worker chạy tự động, gửi raw data qua webhook về Frappe qua Cloudflare Tunnel.

```
Game Platform → gửi code tới game1@gmail.com
game1@gmail.com → auto-forward tới gam@yourdomain.com (Cloudflare)
CF Email Worker → parse headers + gửi webhook (~100ms)
Cloudflare Tunnel → localhost:8000 (Frappe GAM)
Frappe → extract code (GAM Code Pattern) + lưu DB + push realtime
User → yêu cầu code → Frappe cấp + ghi log → code bị CLAIMED (khoá)
```

Lợi thế so với IMAP polling:
- **Event-driven** — không polling, email đến là xử lý ngay
- **Delay ~5-30 giây** thay vì 30s-2 phút
- **Không host thêm service** — CF Worker là serverless, free
- **Reliability 99.99%** — Cloudflare SLA
- Thêm email mới = **chỉ setup forwarding** (không đổi code)

### Task 4A.1 — DocType `GAM Webhook Config` (Singleton)

```
Settings: Is Single = ✅, Module = GAM
Fields:
  webhook_email     | Data     | Required (VD: gam@yourdomain.com — email CF nhận forward)
  webhook_secret    | Password | (Secret key xác thực webhook từ CF Worker)
  is_active         | Check    | Default = 1
  last_received_at  | Datetime | Read Only
  last_status       | Data     | Read Only (OK / Error: ...)
  total_received    | Int      | Read Only
```

> Singleton = chỉ 1 bản ghi duy nhất, truy cập qua `frappe.get_single("GAM Webhook Config")`.

### Task 4A.2 — Mở rộng DocType `GAM Email` (Phase 1)

Thêm 1 field:
```
  forward_verified | Check | Default = 0 (Admin đánh dấu khi đã setup forwarding tới CF email)
```

> Email game forward tới `gam@yourdomain.com`. Admin xác nhận forwarding hoạt động đúng.

### Task 4A.3 — DocType `GAM Email Code`

```
Settings: Track Changes = ✅, Module = GAM
Fields:
  email            | Link     | Options: GAM Email  (email gốc nhận code — từ webhook payload)
  email_address    | Data     | (fallback nếu không match được GAM Email nào)
  platform         | Select   | Options: STEAM\nBATTLENET\nPOE\nOTHER | Required
  code             | Data     | Required (VD: "A1B2C" hoặc "384756")
  email_subject    | Data     | (subject gốc)
  email_from       | Data     | (sender address)
  received_at      | Datetime | Required (thời điểm email gốc được gửi)
  fetched_at       | Datetime | (thời điểm Frappe nhận webhook)
  expires_at       | Datetime | (received_at + TTL theo platform)
  status           | Select   | Options: AVAILABLE\nCLAIMED\nEXPIRED | Default AVAILABLE
  claimed_by       | Link     | Options: User
  claimed_at       | Datetime |
  raw_snippet      | Small Text | (đoạn text quanh code, debug)
  source_uid       | Data     | Hidden (Message-ID email, tránh xử lý trùng)

Naming: autoname hash
```

> **Khi user lấy code → status chuyển CLAIMED → user khác không lấy được nữa** (verification code thường chỉ dùng 1 lần).

### Task 4A.4 — DocType `GAM Code Request Log`

```
Settings: Read Only sau khi tạo, Module = GAM
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

### Task 4A.5 — DocType `GAM Code Pattern` (cấu hình regex qua UI)

```
Settings: Module = GAM
Fields:
  platform         | Select   | Options: STEAM\nBATTLENET\nPOE\nOTHER
  sender_pattern   | Data     | (regex match sender email)
  subject_keywords | Data     | (comma-separated keywords match subject)
  code_regex       | Data     | (regex extract code từ body, group 1 = code)
  ttl_minutes      | Int      | Default: 15
  is_active        | Check    | Default = 1
  priority         | Int      | Default: 0 (pattern có priority cao hơn match trước)
```

> Admin có thể thêm platform mới qua Desk mà không cần sửa code Python hay CF Worker.

### Task 4A.6 — Seed Code Patterns

`apps/gam/gam/setup/seed.py` — bổ sung:

```python
def seed_code_patterns():
    # QUAN TRỌNG: code_regex phải anchor theo ngữ cảnh (xem Design §7.2).
    # Regex "tham" như \b([A-Z0-9]{5})\b sẽ lấy nhầm URL / order ID.
    # _extract_code_from_text phải lặp qua TẤT CẢ match trong body (không chỉ match đầu).
    patterns = [
        {
            "platform": "STEAM",
            "sender_pattern": r".*@steampowered\.com",
            "subject_keywords": "Steam Guard,access from,login,verify",
            # Steam Guard code: "code is A1B2C" / "Guard code: A1B2C"
            "code_regex": r"(?:code|guard)[^\dA-Z]{0,12}([A-Z0-9]{5})\b",
            "ttl_minutes": 15,
            "priority": 10,
        },
        {
            "platform": "BATTLENET",
            "sender_pattern": r".*@(battle\.net|blizzard\.com)",
            "subject_keywords": "verification,security code,Blizzard,Battle.net",
            "code_regex": r"(?:code|verification)[^\d]{0,15}(\d{6,8})\b",
            "ttl_minutes": 10,
            "priority": 10,
        },
        {
            "platform": "POE",
            "sender_pattern": r".*@grindinggear\.com",
            "subject_keywords": "verify,verification,login,Path of Exile",
            "code_regex": r"(?:code|verification)[^\w]{0,12}([A-Za-z0-9]{5,8})\b",
            "ttl_minutes": 15,
            "priority": 10,
        },
    ]
    for p in patterns:
        if not frappe.db.exists("GAM Code Pattern", {"platform": p["platform"]}):
            frappe.get_doc({"doctype": "GAM Code Pattern", **p}).insert(ignore_permissions=True)
    frappe.db.commit()
```

> **Lưu ý POE:** POE1 và POE2 dùng chung hệ thống account GGG (Grinding Gear Games). Pattern "POE" cover cả hai.

### Task 4A.7 — Cloudflare Email Worker

Worker chạy trên Cloudflare edge, nhận email đến `gam@yourdomain.com`, gửi raw data qua webhook về Frappe. **Không extract code trong Worker** — để Frappe dùng GAM Code Pattern (single source of truth).

`cloudflare-worker/src/index.js`:

```javascript
export default {
  async email(message, env, ctx) {
    const emailFrom = message.from;
    const emailTo = message.to;
    const subject = message.headers.get("subject") || "";
    const messageId = message.headers.get("message-id") || "";

    // Xác định email gốc (forwarded)
    const originalRecipient = getOriginalRecipient(message, env.MASTER_EMAIL);

    // Đọc body
    const rawBody = await readEmailBody(message);

    // Gửi webhook về Frappe
    try {
      const response = await fetch(env.FRAPPE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": env.WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          email_account: originalRecipient || emailTo,
          email_from: emailFrom,
          email_subject: subject,
          email_body: rawBody,
          email_date: message.headers.get("date") || "",
          message_id: messageId,
        }),
      });

      if (!response.ok) {
        console.error(`Webhook failed: ${response.status}`);
        await message.forward(env.BACKUP_EMAIL);
      }
    } catch (error) {
      console.error(`Webhook error: ${error.message}`);
      await message.forward(env.BACKUP_EMAIL);
    }
  },
};

function getOriginalRecipient(message, masterEmail) {
  const master = (masterEmail || "").toLowerCase();

  // 1. X-Gm-Original-To (Gmail forward)
  const xGmOrig = message.headers.get("x-gm-original-to");
  if (xGmOrig && xGmOrig.trim().toLowerCase() !== master)
    return xGmOrig.trim().toLowerCase();

  // 2. Delivered-To
  const deliveredTo = message.headers.get("delivered-to");
  if (deliveredTo) {
    const addr = deliveredTo.trim().toLowerCase();
    if (addr !== master) return addr;
  }

  // 3. Received header — "for <email>"
  const received = message.headers.get("received") || "";
  const match = received.match(/for\s+<([^>]+)>/);
  if (match && match[1].toLowerCase() !== master)
    return match[1].toLowerCase();

  return null;
}

// Đọc raw RFC822 (headers + body) và gửi nguyên về Frappe.
// Frappe sẽ parse MIME (text/plain vs HTML) bằng stdlib `email` — KHÔNG parse
// hay extract code trong Worker (single source of truth = GAM Code Pattern).
async function readEmailBody(message) {
  const reader = message.raw.getReader();
  const chunks = [];
  let totalLength = 0;
  const MAX_SIZE = 100 * 1024; // Giới hạn 100KB để tránh sập webhook

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
    if (totalLength > MAX_SIZE) {
      console.warn("Email body too large, truncating to 100KB");
      break;
    }
  }

  const rawBytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    const lengthToCopy = Math.min(chunk.length, totalLength - offset);
    rawBytes.set(chunk.slice(0, lengthToCopy), offset);
    offset += lengthToCopy;
    if (offset >= totalLength) break;
  }
  return new TextDecoder().decode(rawBytes);
}
```

`cloudflare-worker/wrangler.toml`:

```toml
name = "gam-email-handler"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
FRAPPE_WEBHOOK_URL = "https://gam.yourdomain.com/api/method/gam.api.receive_email_webhook"
MASTER_EMAIL = "gam@yourdomain.com"
BACKUP_EMAIL = "admin@gmail.com"

# Secrets (set via wrangler secret, không commit vào code):
# wrangler secret put WEBHOOK_SECRET
```

Deploy:
```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler deploy
wrangler secret put WEBHOOK_SECRET
# Nhập secret key → encrypted, không lộ trong code
```

### Task 4A.8 — Cloudflare Tunnel (expose Frappe local)

Frappe chạy local, cần Cloudflare Tunnel để CF Worker gửi webhook được.

```bash
# Cài cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Đăng nhập + tạo tunnel
cloudflared tunnel login
cloudflared tunnel create gam-tunnel
cloudflared tunnel route dns gam-tunnel gam.yourdomain.com
```

Cấu hình `~/.cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/user/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: gam.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

Chạy như system service:
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### Task 4A.9 — Webhook Endpoint (Frappe)

`apps/gam/gam/api.py` — bổ sung:

```python
@frappe.whitelist(allow_guest=True)
def receive_email_webhook(**kwargs):
    """CF Email Worker gọi khi email game nhận được email mới.

    Luôn ghi 1 dòng GAM Email Inbound Log (Phase 4C) ở MỌI nhánh
    (DUPLICATE/NO_MATCH/PARSE_ERROR/OK) để dễ debug và có audit đầy đủ.
    """
    import re
    from email.utils import parsedate_to_datetime

    # 1. Xác thực webhook secret
    secret = frappe.request.headers.get("X-Webhook-Secret")
    config = frappe.get_single("GAM Webhook Config")
    expected = config.get_password("webhook_secret")
    if not secret or secret != expected:
        frappe.throw(_("Unauthorized"), frappe.AuthenticationError)

    if not config.is_active:
        return {"status": "inactive"}

    # 2. Parse input
    email_account = (kwargs.get("email_account") or "").strip()
    email_from = kwargs.get("email_from", "")
    email_subject = kwargs.get("email_subject", "")
    email_body = kwargs.get("email_body", "")
    email_date = kwargs.get("email_date", "")
    message_id = kwargs.get("message_id", "")

    # Helper ghi Inbound Log — chạy ở mọi nhánh (Phase 4C)
    def _log_inbound(status, **extra):
        frappe.get_doc({
            "doctype": "GAM Email Inbound Log",
            "email_account": email_account,
            "gam_email": extra.get("gam_email"),
            "email_from": email_from,
            "email_subject": email_subject,
            "message_id": message_id,
            "received_at": extra.get("received_at"),
            "fetched_at": frappe.utils.now(),
            "status": status,
            "matched_platform": extra.get("platform"),
            "matched_pattern": extra.get("pattern"),
            "email_code": extra.get("code_name"),
            "raw_snippet": (email_body or "")[:500],
            "error_message": extra.get("error"),
        }).insert(ignore_permissions=True)
        frappe.db.commit()

    # 3. Parse ngày email RFC 2822 → datetime (CRITICAL)
    #    email_date dạng "Wed, 14 Jun 2026 10:00:00 +0000"
    #    frappe.utils.add_to_date KHÔNG parse được format này.
    received_dt = None
    if email_date:
        try:
            received_dt = parsedate_to_datetime(email_date)
        except Exception:
            received_dt = None
    if received_dt is None:
        received_dt = frappe.utils.now_datetime()
    received_at = received_dt

    # 4. Tìm GAM Email — trực tiếp từ email_account
    gam_email = None
    if email_account:
        gam_email = frappe.db.get_value(
            "GAM Email", {"address": email_account}, "name")

    # 5. Dedup — có Message-ID thì check; không có thì hash fallback
    dedup_key = message_id or _dedup_hash(email_from, email_subject, email_body)
    if dedup_key and frappe.db.exists(
            "GAM Email Code", {"source_uid": dedup_key}):
        config.db_set("last_status", "duplicate")
        config.db_set("last_received_at", frappe.utils.now())
        _log_inbound("DUPLICATE", gam_email=gam_email, received_at=received_at)
        return {"status": "duplicate"}

    # 6. Parse MIME → text thuần (CRITICAL — email thực tế thường multipart/HTML)
    text_body = _email_body_to_text(email_body)

    # 7. Match pattern + extract code
    patterns = frappe.get_all("GAM Code Pattern",
        filters={"is_active": 1},
        fields=["name", "platform", "sender_pattern", "subject_keywords",
                "code_regex", "ttl_minutes"],
        order_by="priority desc")

    try:
        code_info = _extract_code_from_text(
            email_from, email_subject, text_body, patterns)
    except re.error as e:
        config.db_set("last_status", "Error: regex %s" % e)
        _log_inbound("PARSE_ERROR", gam_email=gam_email,
                     received_at=received_at, error=str(e))
        return {"status": "parse_error"}

    if not code_info:
        config.db_set("last_status", "no_match")
        config.db_set("last_received_at", frappe.utils.now())
        _log_inbound("NO_MATCH", gam_email=gam_email, received_at=received_at)
        return {"status": "no_match"}

    # 8. Lưu GAM Email Code
    expires_at = frappe.utils.add_to_date(received_at, minutes=code_info["ttl"])
    code_doc = frappe.get_doc({
        "doctype": "GAM Email Code",
        "email": gam_email,
        "email_address": email_account or "unknown",
        "platform": code_info["platform"],
        "code": code_info["code"],
        "email_subject": email_subject,
        "email_from": email_from,
        "received_at": received_at,
        "fetched_at": frappe.utils.now(),
        "expires_at": expires_at,
        "status": "AVAILABLE",
        "raw_snippet": code_info["snippet"][:500],
        "source_uid": dedup_key,
    }).insert(ignore_permissions=True)

    config.db_set("total_received", (config.total_received or 0) + 1)
    config.db_set("last_status", "OK")
    config.db_set("last_received_at", frappe.utils.now())
    frappe.db.commit()

    _log_inbound("OK", gam_email=gam_email, received_at=received_at,
                 platform=code_info["platform"],
                 pattern=code_info.get("pattern_name"), code_name=code_doc.name)

    # 9. Push realtime
    frappe.publish_realtime(event="gam_new_code", message={
        "email": email_account,
        "platform": code_info["platform"],
        "code_name": code_doc.name,
    })

    return {"status": "ok", "code_name": code_doc.name}


def _dedup_hash(email_from, subject, body):
    """Fallback dedup khi email không có Message-ID."""
    import hashlib
    raw = "%s|%s|%s" % (email_from, subject, (body or "")[:256])
    return "hash:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _email_body_to_text(raw_body):
    """Parse RFC822 body → text thuần (text/plain hoặc strip HTML).

    Email thực tế thường multipart/alternative hoặc text/html, đôi khi
    base64/quoted-printable. Dùng stdlib `email` để parse MIME và lấy
    phần text/plain; nếu chỉ có HTML thì strip tag.
    """
    import email
    from email import policy

    if not raw_body:
        return ""
    # Body thuần (không phải MIME/HTML) → trả về luôn
    low = raw_body.lower()
    if "content-transfer-encoding" not in low and "multipart" not in low \
            and "<html" not in low:
        return raw_body

    try:
        msg = email.message_from_string(raw_body, policy=policy.default)
        text_part = None
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    text_part = part.get_content()
                    break
            if text_part is None:
                for part in msg.walk():
                    if part.get_content_type() == "text/html":
                        text_part = part.get_content()
                        break
        else:
            text_part = msg.get_content()

        if text_part is None:
            return raw_body
        # Strip HTML tag nếu còn
        if "<" in text_part and ">" in text_part:
            text_part = re.sub(r"<[^>]+>", " ", text_part)
            text_part = re.sub(r"\s+", " ", text_part).strip()
        return text_part
    except Exception:
        # Parser fail → dùng raw, ít nhất vẫn có cơ hội match
        return raw_body


def _extract_code_from_text(sender, subject, body, patterns):
    """Extract verification code từ email text dựa trên GAM Code Patterns.

    Regex được anchor theo ngữ cảnh (Design §7.2). Lặp qua TẤT CẢ match
    trong body (finditer), không chỉ match đầu, để giảm lấy nhầm token khác.
    """
    import re
    sender_lower = (sender or "").lower()
    subject_lower = (subject or "").lower()

    for p in patterns:
        try:
            if not re.search(p.sender_pattern, sender_lower, re.IGNORECASE):
                continue
        except re.error:
            continue
        keywords = [k.strip().lower()
                    for k in (p.subject_keywords or "").split(",") if k.strip()]
        if keywords and not any(kw in subject_lower for kw in keywords):
            continue
        for match in re.finditer(p.code_regex, body):
            return {
                "platform": p.platform,
                "pattern_name": p.name,
                "code": match.group(1),
                "ttl": p.ttl_minutes or 15,
                "snippet": body[max(0, match.start() - 50):match.end() + 50],
            }
    return None
```

### Task 4A.10 — API `request_code` (giữ nguyên)

`apps/gam/gam/api.py` — method `request_code` không đổi so với v2:

```python
@frappe.whitelist()
def request_code(email_name=None, account_name=None, platform=None):
    """User yêu cầu code mới nhất cho 1 email (atomic claim)."""
    if account_name:
        if not frappe.has_permission(
            frappe.get_doc("GAM Account", account_name), "read"):
            frappe.throw(_("Không có quyền xem account"), frappe.PermissionError)
        account = frappe.get_doc("GAM Account", account_name)
        email_name = email_name or account.email
        platform = platform or account.platform

    if not email_name:
        frappe.throw(_("Thiếu email_name"))

    if not frappe.has_permission(frappe.get_doc("GAM Email", email_name), "read"):
        frappe.throw(_("Không có quyền xem email"), frappe.PermissionError)

    # Rate limit — xem lưu ý ở reveal_password (form decorator vs function call).
    frappe.rate_limiter.apply(
        key=f"gam_code_request:{frappe.session.user}", limit=30, seconds=60)

    # Tìm code.
    # Lưu ý: filter theo `email` (Link). Code đến từ email CHƯA đăng ký GAM Email
    # (chỉ có email_address fallback, xem Design §3.1.12) sẽ KHÔNG match ở đây.
    # Nếu cần phục vụ cả trường hợp đó, thêm nhánh OR theo `email_address`.
    filters = {
        "email": email_name,
        "status": "AVAILABLE",
        "expires_at": [">", frappe.utils.now()]
    }
    if platform:
        filters["platform"] = platform

    codes = frappe.get_all("GAM Email Code",
        filters=filters,
        fields=["name", "code", "platform", "received_at", "expires_at"],
        order_by="received_at desc",
        limit=1,
        ignore_permissions=True)

    if not codes:
        frappe.get_doc({
            "doctype": "GAM Code Request Log",
            "requested_by": frappe.session.user,
            "target_email": email_name,
            "target_account": account_name,
            "platform": platform,
            "status": "NO_CODE",
            "requested_at": frappe.utils.now(),
        }).insert(ignore_permissions=True)
        frappe.db.commit()
        return {
            "status": "no_code",
            "message": "Chưa có code mới. Vui lòng đợi ~5-30 giây."
        }

    code = codes[0]

    # Atomic claim để chống race condition
    affected_rows = frappe.db.sql("""
        UPDATE `tabGAM Email Code`
        SET status='CLAIMED', claimed_by=%s, claimed_at=%s
        WHERE name=%s AND status='AVAILABLE' AND expires_at > %s
    """, (frappe.session.user, frappe.utils.now(), code.name, frappe.utils.now()))

    if not affected_rows:
        return {
            "status": "no_code",
            "message": "Code đã được user khác lấy. Vui lòng lấy lại."
        }

    frappe.get_doc({
        "doctype": "GAM Code Request Log",
        "requested_by": frappe.session.user,
        "email_code": code.name,
        "target_email": email_name,
        "target_account": account_name,
        "platform": code.platform,
        "code_value": code.code,
        "status": "FULFILLED",
        "requested_at": frappe.utils.now(),
    }).insert(ignore_permissions=True)

    frappe.db.commit()
    return {"status": "ok", **code}
```

### Task 4A.11 — Auto-expire codes

`apps/gam/gam/email_code/cleanup.py`:

```python
import frappe

def expire_old_codes():
    """Đánh dấu code hết hạn (chạy mỗi 5 phút)"""
    frappe.db.sql("""
        UPDATE `tabGAM Email Code`
        SET status = 'EXPIRED'
        WHERE status = 'AVAILABLE'
        AND expires_at < NOW()
    """)
    frappe.db.commit()
```

### Task 4A.12 — Scheduler hooks

`apps/gam/gam/hooks.py` — bổ sung:

```python
scheduler_events = {
    "cron": {
        "*/5 * * * *": [
            "gam.email_code.cleanup.expire_old_codes"
        ]
    }
}
```

> Không còn scheduler `fetch_all_codes` — CF Worker gửi webhook event-driven.

### Task 4A.13 — Permissions

| DocType | GAM Admin | GAM Member |
|---------|-----------|------------|
| GAM Webhook Config | Read/Write | (không quyền) |
| GAM Email Code | Read/Write/Create/Delete | (không quyền — bắt buộc lấy qua method `request_code`) |
| GAM Code Request Log | Read | (không — chỉ tạo qua method) |
| GAM Code Pattern | Read/Write/Create/Delete | Read |

### Task 4A.14 — Setup Guide (1 lần)

**Bước 1 — Cloudflare Email Routing:**
```
1. Domain đã trên Cloudflare → vào Email Routing → Enable
2. Tạo email address: gam@yourdomain.com
3. Route to: Email Worker (“gam-email-handler”)
```

**Bước 2 — Deploy CF Worker:**
```bash
cd cloudflare-worker
wrangler deploy
wrangler secret put WEBHOOK_SECRET   # nhập secret key
```

**Bước 3 — Cloudflare Tunnel:**
```bash
cloudflared tunnel login
cloudflared tunnel create gam-tunnel
cloudflared tunnel route dns gam-tunnel gam.yourdomain.com
# Cấu hình config.yml + chạy như systemd service
sudo cloudflared service install
sudo systemctl enable cloudflared && sudo systemctl start cloudflared
```

**Bước 4 — Frappe Webhook Config:**
```
Trong Frappe Desk: GAM Webhook Config
  → webhook_email: gam@yourdomain.com
  → webhook_secret: [cùng secret đã set trong wrangler]
  → is_active: ✅
```

**Bước 5 — Setup forwarding cho mỗi email game:**
```
Gmail:
  Settings → Forwarding and POP/IMAP
  → Add a forwarding address: gam@yourdomain.com
  → Xác nhận → Chọn "Forward a copy"

Outlook/Hotmail:
  Settings → Mail → Forwarding → Enable forwarding
  → Forward to: gam@yourdomain.com → ✅ Keep a copy
```

**Bước 6 — Verify:**
```
Gửi test email tới game1@gmail.com → forward → CF Worker → webhook → GAM Email Code xuất hiện
Trong Frappe: GAM Email → game1@gmail.com → ✅ forward_verified
```

### Verification Phase 4A
- Cloudflare Email Routing + Worker đã deploy
- Cloudflare Tunnel đã chạy, `curl https://gam.yourdomain.com/api/method/ping` → pong
- Setup forwarding cho 1 email test
- Gửi email test → CF Worker → webhook → GAM Email Code xuất hiện (~5-30 giây)
- Gọi `request_code` → nhận code đúng + log ghi
- Gọi lại `request_code` cùng email → "no_code" (code đã CLAIMED)
- Code pattern cho Steam/BNet/POE hoạt động đúng
- Sau `expires_at` → code tự chuyển EXPIRED
- Push notification realtime khi có code mới
- Webhook với secret sai → bị từ chối 403

---

## Phase 4B — Account Usage Lock & Realtime Status {#phase-4b}

### Objective
Triển khai cơ chế mượn/trả (checkout/check-in) cho Account để tránh đụng độ (nhiều người cùng chơi 1 acc).

### Task 4B.1 — DocType `GAM Account Usage`

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

### Task 4B.2 — Whitelisted method checkout/check-in

`apps/gam/gam/api.py`:

```python
@frappe.whitelist()
def checkout_account(account_name, purpose="LOGIN", hours=2):
    # 1. Kiểm tra account có đang bị ai mượn không (status='IN_USE')
    in_use = frappe.db.exists("GAM Account Usage", {
        "account": account_name,
        "status": "IN_USE",
        "lease_until": [">", frappe.utils.now()]
    })
    if in_use:
        frappe.throw(_("Tài khoản đang được sử dụng bởi người khác"))

    # 2. Tạo record Account Usage mới
    usage = frappe.get_doc({
        "doctype": "GAM Account Usage",
        "account": account_name,
        "status": "IN_USE",
        "used_by": frappe.session.user,
        "purpose": purpose,
        "started_at": frappe.utils.now(),
        "lease_until": frappe.utils.add_to_date(
            frappe.utils.now_datetime(), hours=hours),
    }).insert(ignore_permissions=True)
    frappe.db.commit()

    # 3. Publish realtime event để update UI
    frappe.publish_realtime("gam_account_status_changed", {"account": account_name, "status": "IN_USE"})
    return {"status": "ok"}

@frappe.whitelist()
def checkin_account(account_name):
    # 1. Tìm record usage đang active của user này
    usages = frappe.get_all("GAM Account Usage", filters={
        "account": account_name,
        "status": "IN_USE",
        "used_by": frappe.session.user
    })
    if not usages:
        frappe.throw(_("Bạn không mượn tài khoản này"))

    # 2. Update thành RELEASED
    for u in usages:
        frappe.db.set_value("GAM Account Usage", u.name, {
            "status": "RELEASED",
            "ended_at": frappe.utils.now(),
            "end_reason": "DONE"
        })
    frappe.db.commit()

    # 3. Publish realtime event
    frappe.publish_realtime("gam_account_status_changed", {"account": account_name, "status": "AVAILABLE"})
    return {"status": "ok"}
```

---

## Phase 4C — Email Inbound Log & Reliability {#phase-4c}

### Objective
Lưu trữ mọi payload nhận từ webhook để dễ dàng debug lỗi parse mã xác nhận hoặc spam.

### Task 4C.1 — DocType `GAM Email Inbound Log`

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

### Task 4C.2 — Log webhook requests

Sửa hàm `receive_email_webhook` trong `apps/gam/gam/api.py` để LUÔN insert 1 dòng `GAM Email Inbound Log` ở cuối quá trình xử lý, bất kể kết quả là gì (Duplicate, No match, OK). Truyền các trạng thái tương ứng vào trường `status`.

---

## Phase 5 — Vue Frontend Foundation {#phase-5}

### Objective
Router, layout, navigation, frappe-ui resources setup.

### Task 5.1 — Cấu trúc frontend

```
apps/gam/frontend/src/
├── main.js              ← createApp + FrappeUI plugin
├── router.js            ← Vue Router routes
├── App.vue
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
│   └── CodeRequestLog.vue   ← (Phase 4A) Admin xem log yêu cầu code
├── components/
│   ├── AppSidebar.vue
│   ├── PasswordField.vue
│   ├── CodeRequestButton.vue ← (Phase 4A) Nút lấy verification code
│   ├── StatusBadge.vue
│   ├── PlatformBadge.vue
│   ├── AccountLinkSection.vue
│   ├── AccountGameDialog.vue
│   └── AccountLinkDialog.vue
└── data/
    └── session.js       ← user session state
```

### Task 5.2 — Layout với sidebar

`AppSidebar.vue` — navigation links:
```
Dashboard       → /
Emails          → /emails
Accounts        → /accounts
Games           → /games           (chỉ GAM Admin)
Search          → /search
Reveal Logs     → /reveal-logs     (chỉ GAM Admin)
Code Logs       → /code-logs       (chỉ GAM Admin — Phase 4A)
```

Kiểm tra role: lấy từ `frappe.session` hoặc resource gọi `frappe.client.get_roles`. Ẩn link admin nếu không phải GAM Admin.

### Task 5.3 — PasswordField component (Vue)

`components/PasswordField.vue`:
```
Props: doctype, name, fieldname
State: revealed (ref false), plaintext (ref null)

<template>
  <span class="font-mono">{{ revealed ? plaintext : '••••••••' }}</span>
  <Button variant="ghost" @click="toggleReveal">
    {{ revealed ? 'Ẩn' : 'Hiện' }}
  </Button>
  <Button variant="ghost" @click="copy">Copy</Button>
</template>

toggleReveal():
  - Nếu đã có plaintext → toggle revealed (không gọi lại API)
  - Nếu chưa → gọi reveal resource → lưu plaintext → revealed = true

reveal resource (frappe-ui createResource):
  url: 'gam.api.reveal_password'
  params: { doctype, name, fieldname }
```

### Task 5.4 — CodeRequestButton component (Vue) — Phase 4A

`components/CodeRequestButton.vue`:
```
Props: emailName, accountName (optional)
State: loading (ref false), codeResult (ref null)

<template>
  <Button @click="requestCode" :loading="loading" variant="solid" theme="orange">
    🔑 Lấy Verification Code
  </Button>

  <div v-if="codeResult?.status === 'ok'" class="code-display">
    <span class="code font-mono text-2xl">{{ codeResult.code }}</span>
    <Button @click="copyCode" variant="ghost">📋 Copy</Button>
    <span class="countdown">Hết hạn: {{ timeLeft(codeResult.expires_at) }}</span>
  </div>

  <div v-if="codeResult?.status === 'no_code'" class="no-code">
    ⏳ {{ codeResult.message }}
    <Button @click="requestCode" variant="outline" size="sm">Thử lại</Button>
  </div>
</template>

requestCode resource:
  url: 'gam.api.request_code'
  params: { email_name: emailName, account_name: accountName }
```

### Task 5.5 — Realtime code notification (Vue) — Phase 4A

Trong `App.vue`:
```javascript
// Lắng nghe code mới từ SocketIO
frappe.realtime.on('gam_new_code', (data) => {
  showToast({
    title: `📩 Code mới: ${data.platform}`,
    message: `Email: ${data.email}`,
    type: 'info',
  })
})
```

### Verification Phase 5
- Navigation hiển thị đúng, link admin ẩn với Member
- PasswordField hiện `••••••••` mặc định
- Click Hiện → gọi method → hiện plaintext, log được ghi

---

## Phase 6 — Email Module {#phase-6}

### Objective
CRUD Email bằng frappe-ui resources (không cần Server Actions).

### Task 6.1 — List

`pages/EmailList.vue`:
```javascript
import { createListResource } from 'frappe-ui'

const emails = createListResource({
  doctype: 'GAM Email',
  fields: ['name', 'address', 'provider', 'is_active'],
  filters: { is_active: 1 },   // mặc định chỉ active
  orderBy: 'creation desc',
  pageLength: 20,
  auto: true,
})
```
UI: table address/provider/status + nút Thêm (chỉ Admin) + toggle "Hiện inactive".

### Task 6.2 — Detail + Create/Edit

`pages/EmailDetail.vue`:
```javascript
import { createDocumentResource } from 'frappe-ui'

const email = createDocumentResource({
  doctype: 'GAM Email',
  name: route.params.name,
  auto: true,
})
// email.doc → dữ liệu
// email.setValue.submit({ provider: 'Outlook' }) → update
// email.delete.submit() → xóa
```

Form tạo: `emails.insert.submit({ address, email_password, provider, recovery_emails: [...] })`.

PasswordField dùng cho `email_password`: `<PasswordField doctype="GAM Email" :name="email.doc.name" fieldname="email_password" />`

### Verification Phase 6
- Tạo email → xuất hiện trong list
- Reveal password → đúng + log ghi
- Member không thấy nút tạo/sửa/xóa
- Xóa email đang có account → Frappe báo lỗi link (built-in)

---

## Phase 7 — Account Module {#phase-7}

### Objective
CRUD Account với filter, profile page.

### Task 7.1 — List với filter

```javascript
const accounts = createListResource({
  doctype: 'GAM Account',
  fields: ['name', 'platform', 'username', 'status', 'email'],
  filters: computed(() => buildFilters(platform.value, status.value)),
  pageLength: 20,
  auto: true,
})
```
Filter UI: platform select, status select, search username (filters `['like', '%...%']`).

### Task 7.2 — Account Profile

`pages/AccountDetail.vue` — layout 2 cột:
- Trái: platform, username, status (Admin đổi được), email link, PasswordField, source/dates/notes
- Phải: AccountLinkSection + danh sách games (từ child table `games`)
- Dưới header: **CodeRequestButton** (Phase 4A) — nút lấy verification code cho email liên kết

```html
<!-- Phase 4A: Nút lấy code -->
<CodeRequestButton :emailName="account.doc.email" :accountName="account.doc.name" />

Lấy account kèm child tables:
```javascript
const account = createDocumentResource({ doctype: 'GAM Account', name, auto: true })
// account.doc.games → child rows (AccountGame)
```

### Verification Phase 7
- Tạo account, gán email → hiển thị đúng
- Filter platform/status đúng
- Profile hiển thị games từ child table

---

## Phase 8 — Games, Servers, DLC {#phase-8}

### Objective
UI quản lý danh mục (Admin only).

### Task 8.1 — Trang Games
- List GAM Game + expand xem servers + DLC
- Toggle is_active (game/server)
- Thêm DLC, thêm server region
- Guard: chỉ GAM Admin (ẩn route + backend permission tự chặn)

### Task 8.2 — Resources cho dropdown
Dùng khi tạo AccountGame — chỉ lấy active:
```javascript
const games = createListResource({
  doctype: 'GAM Game', fields: ['name', 'game_name'],
  filters: { is_active: 1 }, auto: true,
})
```

### Verification Phase 8
- Thêm game → có ngay trong dropdown AccountGame
- Game inactive → biến mất khỏi dropdown
- Member vào /games → bị chặn

---

## Phase 9 — AccountGame & AccountLink {#phase-9}

### Objective
Gán game vào account (child table); liên kết account (DocType riêng).

### Task 9.1 — Thêm game vào account
Child table `games` của GAM Account. Dialog:
- Chọn game → load servers + DLC động (filter theo game)
- is_main, ngày mua, notes, chọn DLC
- Update qua `account.doc.games.push(...)` rồi `account.save.submit()` — hoặc dùng child table API của frappe-ui

### Task 9.2 — AccountLink
Resource riêng:
```javascript
const links = createListResource({
  doctype: 'GAM Account Link',
  fields: ['name', 'source_account', 'target_account', 'link_type', 'status', 'expiry_date'],
  filters: computed(() => ({
    source_account: ['in', [currentAccount, ...]],
    status: 'ACTIVE',
  })),
})
```
- Hiển thị Card + Badge: [Platform: username], warning nếu expiry < 7 ngày
- Click badge → navigate sang account đích
- Tạo link: `links.insert.submit(...)`. Revoke: set status = REVOKED.

> **Lấy link 2 chiều:** query cả `source_account = current` VÀ `target_account = current` (2 resource hoặc OR filter).

### Verification Phase 9
- Thêm Diablo IV vào account → hiện trong profile
- Link BNet ↔ Steam → badge xuất hiện, click navigate đúng
- Expiry trong 7 ngày → badge cảnh báo

---

## Phase 10 — Dashboard & Search {#phase-10}

### Objective
Stats + search toàn cục.

### Task 10.1 — Stats method

`apps/gam/gam/api.py`:
```python
@frappe.whitelist()
def get_dashboard_stats():
    return {
        "total_accounts": frappe.db.count("GAM Account"),
        "banned": frappe.db.count("GAM Account", {"status": "BANNED"}),
        "expiring": frappe.db.count("GAM Account Link", {
            "status": "ACTIVE",
            "expiry_date": ["between", [
                frappe.utils.now_datetime(),
                frappe.utils.add_to_date(frappe.utils.now_datetime(), days=7)
            ]],
        }),
        "emails": frappe.db.count("GAM Email", {"is_active": 1}),
        # Phase 4A: codes đang chờ cấp
        "codes_available": frappe.db.count("GAM Email Code", {
            "status": "AVAILABLE",
            "expires_at": [">", frappe.utils.now()]
        }),
    }

@frappe.whitelist()
def global_search(query):
    if len(query) < 2:
        return {"accounts": [], "emails": [], "games": []}
    like = f"%{query}%"
    return {
        "accounts": frappe.get_all("GAM Account",
            filters={"username": ["like", like]},
            fields=["name", "platform", "username", "status"], limit=5),
        "emails": frappe.get_all("GAM Email",
            filters={"address": ["like", like]},
            fields=["name", "address", "provider"], limit=5),
        "games": frappe.get_all("GAM Game",
            filters={"game_name": ["like", like], "is_active": 1},
            fields=["name", "game_name"], limit=5),
    }
```

### Task 10.2 — Dashboard + Search UI
- Dashboard: 5 stat cards (đỏ nếu banned>0, vàng nếu expiring>0, xanh nếu codes_available>0) + bảng sắp hết hạn
- Search: gọi `global_search`, kết quả group 3 loại, click → detail

### Verification Phase 10
- Dashboard số liệu đúng (bao gồm codes_available)
- Search "steam" → ra accounts platform STEAM
- Account link sắp hết hạn → bảng hiện

---

## Phase 11 — Reveal Log & Code Request Log Viewer {#phase-11}

### Objective
Trang xem ai đã reveal password và ai đã yêu cầu verification code (Admin only).

### Task 11.1 — List Reveal Log
```javascript
const logs = createListResource({
  doctype: 'GAM Reveal Log',
  fields: ['viewed_by', 'target_doctype', 'target_name', 'fieldname', 'viewed_at'],
  orderBy: 'viewed_at desc',
  pageLength: 50, auto: true,
})
```
Filter: theo user, theo khoảng thời gian.

### Task 11.2 — List Code Request Log (Phase 4A)

`pages/CodeRequestLog.vue`:
```javascript
const codeLogs = createListResource({
  doctype: 'GAM Code Request Log',
  fields: ['requested_by', 'target_email', 'target_account',
           'platform', 'code_value', 'status', 'requested_at'],
  orderBy: 'requested_at desc',
  pageLength: 50, auto: true,
})
```
Filter: theo user, theo email, theo khoảng thời gian, theo status (FULFILLED/NO_CODE).

UI: bảng audit — ai yêu cầu code nào, cho account nào, lúc nào, kết quả (có code hay không).

> Audit cho CRUD (tạo/sửa/xóa) KHÔNG cần trang này — xem trong Desk > Version, hoặc nút View Changes trên mỗi doc (Track Changes đã bật ở Phase 1).

### Verification Phase 11
- Reveal vài password → log hiển thị đúng
- Request vài code → Code Request Log hiển thị đầy đủ (user, email, code, thời gian, status)
- Member vào /reveal-logs hoặc /code-logs → bị chặn

---

## Phase 12 — Production Deployment {#phase-12}

### Objective
Deploy site GAM lên production an toàn.

### Task 12.1 — Build frontend
```bash
cd apps/gam/frontend
npm run build
# Output vào public/frontend của app, Frappe serve tại /frontend
```

### Task 12.2 — Production config
```bash
# TẮT ignore_csrf (chỉ dùng cho dev)
# Xóa "ignore_csrf": 1 khỏi site_config.json

# Bật scheduler, production mode
bench --site gam.local enable-scheduler
bench setup production [user]   # nginx + supervisor (nếu chưa)
bench --site gam.local set-config maintenance_mode 0
```

### Task 12.3 — Cloudflare setup checklist
```
□ Cloudflare Email Routing bật, gam@yourdomain.com route tới Worker
□ CF Email Worker deployed (wrangler deploy) + WEBHOOK_SECRET set
□ cloudflared đã cài + chạy như systemd service
□ Tunnel trỏ gam.yourdomain.com → localhost:8000
□ GAM Webhook Config: webhook_secret khớp với CF Worker
□ Tất cả email game đã setup forwarding tới gam@yourdomain.com
□ Test: gửi email → CF Worker → webhook → GAM Email Code xuất hiện
```

### Task 12.4 — Security checklist
```
□ ignore_csrf đã TẮT
□ encryption_key đã backup ra nơi an toàn (password manager)
□ 2FA bật và bắt buộc (System Settings)
□ Tất cả Member có role GAM Member, KHÔNG có System Manager
□ Admin có GAM Admin + (tùy chọn) System Manager
□ Backup tự động: bench backup schedule, lưu cả encryption key
□ Cloudflare Access (Zero Trust): giới hạn truy cập endpoint, bypass `/api/method/gam.api.receive_email_webhook`
□ Quy trình Secret Rotation đã được chuẩn bị
```

### Task 12.5 — Backup strategy
```bash
# Backup gồm DB + files. LƯU Ý: backup KHÔNG tự kèm site_config.json
# → encryption_key phải backup riêng, nếu không restore sẽ không giải mã được password
bench --site gam.local backup --with-files
```

### Verification Phase 12
- Truy cập `https://gam.yourdomain.com/frontend` → SPA load
- Login + 2FA hoạt động
- Reveal password sau khi build production → vẫn đúng (CSRF token tự attach)
- Test restore backup trên site tạm với encryption_key → password giải mã đúng
- Cloudflare Tunnel: `systemctl status cloudflared` → active
- Webhook hoạt động end-to-end (email → CF Worker → Frappe → code xuất hiện)

---

## Phase 12A — QA & Security Hardening {#phase-12a}

### Objective
Bảo đảm tính an toàn tối đa và kiểm tra các quy trình vận hành trước khi go-live.

### Task 12A.1 — Phân quyền ngặt nghèo
- Ensure "GAM Member" KHÔNG có quyền truy cập Desk module, chỉ dùng frontend SPA.

### Task 12A.2 — Cloudflare Access Setup
- Đặt Access rule bảo vệ domain, yêu cầu xác thực SSO/Email OTP.
- **Quan trọng:** Tạo bypass rule cho path `/api/method/gam.api.receive_email_webhook` để Cloudflare Email Worker có thể gọi webhook.

### Task 12A.3 — Secret Rotation
- Xây dựng workflow để xoay vòng `webhook_secret` hàng tháng: tạo secret mới → update Frappe Webhook Config → update Cloudflare Worker via `wrangler secret put`.

### Task 12A.4 — Payload size limits test
- Gửi 1 email có nội dung text > 150KB tới webhook, kiểm tra Worker có truncate payload thành công < 100KB và Frappe vẫn parse được code hay không.

## Appendix — Khác biệt cốt lõi so với plan Next.js

| Khái niệm | Next.js plan | Frappe plan |
|-----------|--------------|-------------|
| Schema | Prisma migrate | DocType (UI/JSON) |
| Auth | NextAuth code | Built-in, chỉ tạo user |
| 2FA | otplib code | Bật setting |
| Encryption | AES-256-GCM code | Password fieldtype |
| Permission | `requireAdmin()` mỗi action | Role Permission Manager (tự enforce) |
| Audit CRUD | AuditLog table + code | Version (Track Changes, tự động) |
| Audit reveal | Custom | GAM Reveal Log (tự build — duy nhất) |
| Verification code | ❌ Không có | ✅ Cloudflare Email Worker + webhook |
| CRUD logic | Server Actions | frappe-ui resources + auto REST |
| Custom logic | Server Actions | `@frappe.whitelist()` Python |
| Rate limit | Custom in-memory | `frappe.rate_limiter` |
| Realtime | ❌ Không có | ✅ SocketIO push notifications |
| Deploy | Vercel | bench + nginx + Cloudflare Tunnel |

**Điểm cần tự code nhiều nhất:** Vue frontend (Phase 5-11), webhook endpoint (`receive_email_webhook`), và CF Email Worker (~80 dòng JS). Backend data/auth/permission gần như khai báo, không code.

---

*Sinh từ `GAM_Design_Complete_v3.md` v4.0. Cập nhật 12/06/2026 cho Cloudflare Email Worker + Tunnel architecture.*
*Khi nghi ngờ về quyết định thiết kế, tham chiếu file thiết kế `GAM_Design_Complete_v4.md`.*
