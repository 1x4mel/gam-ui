# Plan — Shift Handoff (bàn giao ca) + Online Session Chain

> **Mục tiêu:** cho phép user A bàn giao trực tiếp một account đang `IN_USE` cho user B
> tiếp tục dùng **mà account không logout giữa chừng**, đồng thời **xâu chuỗi các lease
> liên tiếp lại thành một "online session chain"** để hệ thống biết tổng thời gian online
> liên tục của tài khoản — từ đó cấp quyền handoff tiếp hay **ép nghỉ** (tránh ban do
> online 24/7).
>
> **Bối cảnh:** heartbeat từ game client **không khả thi**; toàn bộ online-time dựa trên
> checkout/checkin thủ công. Nên handoff phải nối lease mới vào lease cũ (`prev_lease` +
> `chain_head`) để không mất dấu phiên online liên tục.
>
> **Principle:** handoff KHÔNG chỉ "đổi user" — nó phải đi kèm **continuous-online cap**
> kiểm soát theo chain. Nếu thiếu cap-chain, tính năng này **tăng** rủi ro ban (giữ account
> online liên tục qua nhiều ca) thay vì giảm.

---

## 0. Decision record (chốt trước khi code)

| Quyết định | Chốt |
|---|---|
| Handoff có gap thời gian? | **Không.** `ended_at(A) == started_at(B)` (phiên online không đứt ở góc nhìn dữ liệu). |
| B có cần accept trước khi A đóng lease? | **Không (handoff ngay).** A bấm bàn giao → A đóng, B mở ngay, B nhận realtime toast. B có thể `decline_handoff` sau (mở lại lease A). Đơn giản, không đứt phiên. |
| Continuous cap áp dụng cho? | **Chain** (tổng online liên tục), KHÔNG phải từng lease đơn lẻ. Cap = `continuous_online_cap_hours` (mặc định 16). |
| Admin bypass cap khi handoff? | **Có** (kèm audit note trong `notes`), vì đôi khi admin cần chạy dài. |
| Per-game override? | **Có** qua field `continuous_online_cap_hours` trên `GAM Game` (null → dùng global). |
| Chain bắt đầu khi nào? | Mỗi `checkout_account` thường (không phải handoff) = **đầu chain mới** (`prev_lease=null`, `chain_head=self`). |
| Chain kết thúc khi nào? | Khi lease bị release `DONE`/`TIMEOUT`/`FORCE_RELEASED` (không handoff) → account vào trạng thái "nghỉ" như hiện tại. |
| Scheduler enforce cap? | **Có** — mở rộng `force_release_leases` để force-release chain quá cap. |

---

## 1. Data model

### 1.1 `GAM Account Usage` — thêm 4 field
File: [`gam/gam/doctype/gam_account_usage/gam_account_usage.json`](../frappe-bench/apps/gam/gam/gam/doctype/gam_account_usage/gam_account_usage.json)

| fieldname | fieldtype | Ý nghĩa |
|---|---|---|
| `chain_head` | Link → `GAM Account Usage` | Lease đầu của chain (self nếu đầu chain). Query nhanh tổng online chain. |
| `prev_lease` | Link → `GAM Account Usage` | Lease ngay trước trong chain (null = đầu chain). |
| `handoff_by` | Link → User | Ai bàn giao (dùng cho lease *mở mới* = người nhận biết ai chuyển). |
| `handoff_at` | Datetime | Thời điểm handoff. |

Thêm giá trị `end_reason`: `HANDED_OFF` (đã bàn giao). `status` giữ nguyên
(`IN_USE`/`RELEASED`/`EXPIRED`/`FORCE_RELEASED`).

### 1.2 `GAM Settings` — thêm 1 field
File: [`gam/gam/doctype/gam_settings/gam_settings.json`](../frappe-bench/apps/gam/gam/gam/doctype/gam_settings/gam_settings.json)

| fieldname | fieldtype | default | Ý nghĩa |
|---|---|---|---|
| `continuous_online_cap_hours` | Int, non_negative | 16 | Hạn cứng online liên tục **của cả chain**. Vượt → không cho handoff + scheduler force-release. |

### 1.3 `GAM Game` — thêm 1 field (per-game override)
File: [`gam/gam/doctype/gam_game/gam_game.json`](../frappe-bench/apps/gam/gam/gam/doctype/gam_game/gam_game.json)

| fieldname | fieldtype | Ý nghĩa |
|---|---|---|
| `continuous_online_cap_hours` | Int, non_negative | Override global cho game này (0/null → dùng global). |

### 1.4 Migration patch
File mới: [`gam/gam/patches/backfill_usage_chain.py`](../frappe-bench/apps/gam/gam/patches/backfill_usage_chain.py)
- Với mỗi `GAM Account Usage` đã có: set `chain_head = name`, `prev_lease = null`
  (mỗi lease cũ là chain riêng — an toàn, không "giả lập" chain quá khứ).
- Đăng ký trong [`patches.txt`](../frappe-bench/apps/gam/gam/patches.txt) `[post_model_sync]`.

---

## 2. Backend logic — `gam/api.py`

### 2.1 Helper: tính chain online
```python
def _resolve_continuous_cap(account):
    """Global cap hoặc override từ main game của account."""
    s = _get_settings()
    cap = cint(s.get("continuous_online_cap_hours")) or 16
    # per-game override
    main_game = frappe.db.get_value(
        "GAM Account Role Game", {"account": account, "is_main": 1}, "game")
    if main_game:
        ov = frappe.db.get_value("GAM Game", main_game, "continuous_online_cap_hours")
        if cint(ov) > 0:
            cap = cint(ov)
    return cap

def _chain_online_seconds(account, now):
    """Tổng giây online liên tục của chain đang IN_USE của account."""
    active = frappe.db.get_value("GAM Account Usage",
        {"account": account, "status": "IN_USE"}, ["name", "chain_head", "started_at"],
        as_dict=True)
    if not active:
        return 0, None
    head = active.chain_head or active.name
    rows = frappe.db.get_all("GAM Account Usage",
        filters={"chain_head": head},
        fields=["started_at", "ended_at"])
    total = 0
    for r in rows:
        s = r.started_at
        e = r.ended_at or now  # lease đang chạy tính tới now
        total += (e - s).total_seconds()
    return total, active
```

### 2.2 `handoff_account(account, to_user, order_ref=None, notes=None, force=None)`
- `@frappe.whitelist()`
- Bước:
  1. `_require_account_access(account)` (A — session — phải có quyền).
  2. Lấy active lease của account; nếu không có → throw "Account không đang checkin".
  3. Nếu active.used_by != session.user **và** không phải admin → throw (chỉ người đang giữ hoặc admin được bàn giao).
  4. `to_user` hợp lệ: enabled + có role GAM. (dùng `get_gam_users` logic).
  5. **L2 cho to_user**: `to_user` phải có quyền tới account. Dùng `_has_any_role_game_grant(_account_grant_keys_for(account))` nhưng **với roles của to_user** → cần helper nhận user tường minh (`_has_any_role_game_grant_for(user, keys)` — tách từ hiện tại).
  6. `to_user == active.used_by` → throw (không bàn giao cho chính mình).
  7. Tính chain online; nếu `>= cap` và **không** admin/`force` → throw "Tài khoản phải nghỉ trước khi bàn giao (quá cap online liên tục)".
  8. **Atomic** trong `frappe.db.savepoint` (hoặc transaction):
     - đóng lease A: `status=RELEASED`, `end_reason=HANDED_OFF`, `ended_at=now`.
     - mở lease B: `used_by=to_user`, `started_at=now` (== ended_at A), `prev_lease=A.name`, `chain_head=A.chain_head or A.name`, kế thừa `order_ref` (B override nếu truyền), `handoff_by=session.user`, `handoff_at=now`. `lease_until = now + hard_cap_online_hours`.
  9. `emit_handoff(account, from_user, to_user)` + `emit_account_changed(account, "handoff")`.
  10. Trả `{new_lease, chain_online_seconds, cap}`.

### 2.3 `get_chain_online(account=None)`
- `@frappe.whitelist()`, `_require_gam_user()`.
- Trả `{chain_online_seconds, cap_seconds, remaining_seconds, over_cap:bool}` cho account (L2 gate).

### 2.4 `decline_handoff(account)`
- `@frappe.whitelist()`. B (session) từ chối ca vừa nhận:
  - Lấy active lease; nếu `handoff_by` trống → throw (không phải lease nhận qua handoff).
  - Đóng lease B (`end_reason=DECLINED`? — thêm vào select hoặc dùng `CANCELLED`), rồi **reopen lease A**: tạo lease mới kế thừa `chain_head`/`prev_lease` cho user cũ với `started_at=now`.
  - `emit_handoff(account, from=B, to=old_user, action="declined")`.
  - > Đơn giản hoá: reopen = checkout thường cho old_user với cùng chain_head.

### 2.5 Sửa `checkout_account` (mở chain mới)
Khi tạo lease mới (không phải handoff): set `chain_head = <new name>`, `prev_lease = null`.
(Đặt sau `usage.insert()` để lấy `name`.)

### 2.6 Sửa `force_release_leases` scheduler
File: [`gam/tasks.py`](../frappe-bench/apps/gam/gam/tasks.py)
- Giữ logic force-release past `lease_until` (đã có).
- **Thêm**: với mỗi lease `IN_USE`, tính `_chain_online_seconds`; nếu `>= cap` → force-release (`end_reason=TIMEOUT`, note "chain cap exceeded").

---

## 3. Realtime — `gam/realtime.py`
```python
def emit_handoff(account, from_user=None, to_user=None, action="handoff"):
    frappe.publish_realtime("gam_handoff",
        {"account": account, "from_user": from_user, "to_user": to_user,
         "action": action, "user": frappe.session.user}, broadcast=True)
```
Import vào `api.py`.

---

## 4. Frontend — `gam-ui`

### 4.1 `useHandoff.js` (composable mới)
- `handoff({account, toUser, orderRef, notes, force})` → `frappeCall('gam.api.handoff_account', …)`.
- `getChainOnline(account)` → `frappeCall('gam.api.get_chain_online', {account})`.
- `declineHandoff({account})`.

### 4.2 `HandoffModal.vue` (component mới, dựa `ForceCheckoutModal.vue`)
- Props: `accountName`, `currentHolder`, `purpose`, `orderRef`.
- Body:
  - User picker (`<select>` từ `get_gam_users` — chỉ admin; member handoff cho member khác cùng scope → cũng dùng `get_gam_users` nhưng endpoint hiện admin-only → **mở rộng** `get_gam_users` cho GAM Member, hoặc thêm `get_handoff_candidates(account)` trả user có grant tới account).
  - Hiển thị `chain_online` + cap + cảnh báo nếu gần cap (gọi `getChainOnline` khi mở modal).
  - `order_ref` (default kế thừa), `notes`.
  - Checkbox "Ép bàn giao dù quá cap" (chỉ admin thấy).
- Submit → `handoff()` → emit `done`.

### 4.3 `get_handoff_candidates(account)` (backend mới, member-friendly)
- `@frappe.whitelist()`, `_require_account_access(account)`.
- Trả các GAM user có `_has_any_role_game_grant_for(user, keys)` với account (loại session user). Cần để member chọn được người nhận hợp lệ.

### 4.4 `ActiveSection.vue`
- Thêm prop `showHandoff` (default true).
- Thêm nút **"🔀 Bàn giao"** khi `isMine(l)` (và cả khi admin trên `other`? — chỉ holder + admin).
- Emit `handoff` với lease.

### 4.5 `ActiveAccountsView.vue`
- Import `HandoffModal` + `useHandoff`.
- State `handoffTarget`; hàm `openHandoff(l)`, `onHandoffDone()` (refresh + toast).
- Bind modal.
- Lắng nghe realtime `gam_handoff`: nếu `to_user == me` → toast "🔀 Account X vừa được bàn giao cho bạn" + refresh; nếu `action=="declined"` && from là người khác → toast.

### 4.6 `useActiveUsage.js`
- Bind thêm `gam_handoff` → `scheduleRefresh()` (đã có cơ chế debounce).

### 4.7 Chain online indicator (optional polish)
- Trong `ActiveSection.vue` card: nếu `l.prev_lease` → badge "🔀 nối ca" + dòng "Online liên tục: Xh / Yh".

---

## 5. Tests

### 5.1 Backend `tests/test_handoff.py` (mới)
- setup: 2 member + admin + account bound role|game, grant cả 2 member.
- **happy path**: member1 checkout → member1 handoff cho member2 → assert lease cũ `HANDED_OFF`, lease mới `IN_USE` by member2, `chain_head` trùng, `started_at(B)==ended_at(A)`, `chain_online` > 0.
- **L2**: member2 (không grant) → handoff bị `PermissionError`.
- **race**: 2 handoff đồng thời → chỉ 1 thành công (dùng savepoint + check active còn IN_USE).
- **cap block**: set cap nhỏ → handoff khi chain >= cap → throw (member); admin + force → OK.
- **self handoff**: to_user == holder → throw.
- **decline**: member2 decline → reopen cho member1 cùng chain.
- **per-game override**: set `GAM Game.continuous_online_cap_hours` → cap thay đổi.

### 5.2 FE e2e `tests/e2e/gam-handoff.spec.js`
- login admin → checkout account → mở handoff modal → chọn user2 → submit → thấy lease chuyển sang user2 → user2 thấy toast/row.

### 5.3 Unit: `useElapsedTimer` không đổi (chain display dùng `formatDuration`).

---

## 6. Checklist triển khai (tick từng bước)

- [ ] **B1** Sửa `gam_account_usage.json` (+4 field) + `gam_settings.json` (+1) + `gam_game.json` (+1).
- [ ] **B2** Patch `backfill_usage_chain.py` + đăng ký `patches.txt`.
- [ ] **B3** `api.py`: helper `_resolve_continuous_cap`, `_chain_online_seconds`, tách `_has_any_role_game_grant_for`.
- [ ] **B4** `api.py`: `handoff_account`, `get_chain_online`, `decline_handoff`, `get_handoff_candidates`.
- [ ] **B5** `api.py`: sửa `checkout_account` set `chain_head`/`prev_lease`.
- [ ] **B6** `realtime.py`: `emit_handoff` + import.
- [ ] **B7** `tasks.py`: mở rộng `force_release_leases` (chain cap).
- [ ] **B8** Backend tests `test_handoff.py` + `bench run-tests`.
- [ ] **B9** FE `useHandoff.js`, `HandoffModal.vue`.
- [ ] **B10** FE `ActiveSection.vue` (nút bàn giao), `ActiveAccountsView.vue` (modal + realtime).
- [ ] **B11** FE `useActiveUsage.js` bind `gam_handoff`.
- [ ] **B12** `migrate` + smoke: checkout → handoff → checkin; chain online hiển thị đúng.
- [ ] **B13** Lint (`npm run lint`) + build (`npm run build`) pass.
- [ ] **B14** E2E `gam-handoff.spec.js` pass.

---

## 7. Rủi ro / rollback

- **Race**: 2 user handoff cùng lúc → savepoint + re-check `status='IN_USE'` trong TX; nếu mất → rollback và throw rõ ràng.
- **Cap quá nhỏ**: admin có thể tạm set cao qua `save_gam_settings`.
- **Handoff cho user nghỉ phép**: B có thể `decline_handoff` → reopen cho A. Cũng có thể admin `force_release`.
- **Leak chain**: nếu B `checkin_account` (release thường) thay vì handoff → chain kết thúc tự nhiên (an toàn).
- **Migration an toàn**: patch chỉ set `chain_head=self`, không giả lập chain cũ.
