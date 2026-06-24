# Agent Rules — GAM (Game Account Manager)

> Thiết lập theo `DAILY-WORKFLOW.md` (mục 1). Co-tenancy: app `gam` + SPA `gam-ui` chạy cùng site `erp.local` với erpnext + trader-ui. Xem `.ai/current-plan.md`.

## 📚 Documentation map (đọc theo thứ tự khi onboard)

- [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) — bối cảnh: workspace gồm gì, 2 sản phẩm (GAM vs Trader-UI), stack, DocType, điểm vào nhanh.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — kiến trúc + luồng dữ liệu (reveal/code/ingest/lease) + vùng nhạy cảm.
- [`FEATURES.md`](FEATURES.md) — inventory tính năng đã có + endpoint/view tương ứng.
- [`GAM_Design_Complete_v4.md`](GAM_Design_Complete_v4.md) — thiết kế gốc v4 (spec đầy đủ).
- [`GAM_Implementation_Frappe_Vue_v4.md`](GAM_Implementation_Frappe_Vue_v4.md) — chi tiết triển khai.
- `../plans/*.md` — kế hoạch từng feature (architect plan).
- `../.ai/current-plan.md` — plan của task đang làm (nếu có).

## Commands

Lưu ý: lệnh `bench` chạy trong `~/frappe-bench` (site **`erp.local`**, IP `192.168.2.111`); lệnh frontend chạy trong `/home/frappe/gam/gam-ui`.

- Install app vào site:  `bench --site erp.local install-app gam`
- Install FE deps:       `cd /home/frappe/gam/gam-ui && npm ci`     # (npm, NOT yarn — project uses package-lock.json)
- Dev backend:           `bench start`
- Dev frontend:          `cd /home/frappe/gam/gam-ui && npm run dev`   # Vite proxy /api + /socket.io → erp.local
- Build frontend:        `cd /home/frappe/gam/gam-ui && npm run build` # dist/ → nginx serve /gam-ui/ (VITE_BASE_URL=/gam-ui/)
- Deploy frontend:       `cd /home/frappe/gam/gam-ui && npm run deploy` # build → publish (flat copy default; GAM_UI_DEPLOY_MODE=symlink for atomic swap)
- Migrate (sau khi đổi DocType):  `bench --site erp.local migrate`
- Run tests (app):       `bench --site erp.local run-tests --app gam`
- Run tests (1 doctype): `bench --site erp.local run-tests --doctype "GAM Account"`
- Seed data:             `bench --site erp.local execute gam.setup.seed.seed_games`
- Seed code patterns:    `bench --site erp.local execute gam.setup.seed.seed_code_patterns`
- Export fixtures:       `bench --site erp.local export-fixtures --app gam`
- Lint frontend:         `cd /home/frappe/gam/gam-ui && npm run lint`
- Backup (có files):     `bench --site erp.local backup --with-files`

## Rules (áp dụng mọi session)

- Không sửa file ngoài scope được giao trong `.ai/current-plan.md`.
- Luôn đọc pattern hiện có (và `.ai/coding-standards.md`) trước khi viết code.
- Task phức tạp: Architect lập plan trong `.ai/current-plan.md` TRƯỚC khi sửa code.
- Sau khi sửa: chạy migrate / run-tests / npm run build / npm run lint liên quan. Báo lỗi chính xác (file:line + output) nếu fail.
- Commit nhỏ, mỗi commit một mục đích rõ (conventional commit: `<type>(<scope>): <subject>`).
- Reviewer (GLM hoặc Opus) chỉ đọc `git diff --staged`, KHÔNG viết lại code.
- Model mặc định glm-4.7. Chỉ dùng glm-5.1 cho plan/task khó, ưu tiên off-peak (ngoài 13:00–17:00 giờ VN).
- Khi không chắc, hỏi lại thay vì đoán.

## GAM-specific rules (BẢO MẬT — bắt buộc)

- **Không bao giờ** log, in, hay commit plaintext của: mật khẩu, `totp_secret`, `webhook_secret`, `encryption_key`. Dùng Frappe `Password` fieldtype (tự mã hóa); chỉ đọc qua `doc.get_password(fieldname)`.
- Mọi thao tác reveal/copy password **bắt buộc** ghi `GAM Reveal Log` (ai, xem gì, IP, User-Agent, thời gian).
- Truy cập verification code **chỉ** qua `gam.api.request_code` (atomic claim + ghi `GAM Code Request Log`). Không đọc `GAM Email Code` trực tiếp trong frontend.
- Regex trích code phải **anchor theo ngữ cảnh** (vd `(?:code|guard)[^\dA-Z]{0,12}([A-Z0-9]{5})`), không dùng regex "tham". Regex là **data** trong `GAM Code Pattern`, KHÔNG hardcode trong Python/Worker.
- Trước khi regex, phải parse MIME (`email` stdlib) để lấy `text/plain` (hoặc strip HTML). Phải parse ngày RFC 2822 qua `email.utils.parsedate_to_datetime`.
- Webhook `receive_email_webhook` dùng `allow_guest=True` + verify `X-Webhook-Secret`; `webhook_secret` lưu bằng fieldtype `Password`.
- **KHÔNG bật `ignore_csrf` trên erp.local** (cùng site prod/trader-ui). Dùng CSRF token chuẩn qua `gam.utils.get_session_csrf_token`.

## Co-tenancy rules (MỚI — cấp app)

- **Role isolation bắt buộc:** GAM Member **KHÔNG** có role erpnext/trader-ui + **KHÔNG** `System Manager`. Kiểm tra/trước khi go-live: Member login → không truy cập Desk erpnext/trader-ui, REST erpnext trả 403.
- **KHÔNG sửa/đụng** app `erpnext` + app `gege_custom` (trader-ui). Không đổi shared `site_config` ngoài scope.
- DocType luôn prefix `GAM *`; method namespace `gam.*`; realtime event prefix `gam_*` (tránh đụng trader-ui).
- `get_current_user_roles` trả TOÀN BỘ roles — mỗi SPA tự filter role của mình.

## Out of scope (không đụng nếu chưa được duyệt)

- `encryption_key` trong `site_config.json` (site erp.local dùng chung prod) — mọi secret/credential production.
- App erpnext + app `gege_custom` (trader-ui) — code/config/data.
- Cấu hình production (nginx/supervisor/Let's Encrypt), CI/CD pipeline.
- Migration DB trên site production; backup/restore thật.
- `wrangler`/Cloudflare Worker secrets (`WEBHOOK_SECRET`), tunnel credentials.
- Tắt 2FA, thay đổi Role Permission đã chốt trong Design §6.1 mà chưa qua Opus review.
