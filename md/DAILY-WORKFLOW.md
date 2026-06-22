# Bộ khung vận hành dự án — Roo Code + GLM + Claude Opus

*Tài liệu khung dùng hằng ngày. Áp dụng cho cả repo mới và repo dang dở. Gồm: cấu trúc file cần tạo, template từng file, quy trình từng bước, và thư viện prompt mẫu để copy.*

---

## 0. Bản đồ công cụ (nhắc nhanh)

| Việc | Công cụ | Model |
|---|---|---|
| Lập plan, task dài, code khó | Roo Code — **Architect** | `glm-5.1` (chạy off-peak) |
| Implement chính | Roo Code — **Code** | `glm-4.7` |
| Fix bug | Roo Code — **Debug** | `glm-4.7` → `glm-5-turbo` khi khó |
| Hỏi đáp, scout, docs, commit msg | Roo Code — **Ask** | `glm-4.5-air` |
| Soát diff rẻ (first-pass) | Roo Code — **Reviewer** (custom, read-only) | `glm-5.1` |
| Review cuối, khác họ model | **Claude Code** (`/ultrareview`) | **Opus (Pro)** |

**Off-peak** = ngoài khung **13:00–17:00 giờ VN** (giờ cao điểm Z.AI). Dồn glm-5.1 vào off-peak để tốn ít quota.

---

## 1. Cấu trúc file cần tạo trong mọi repo

```
<repo>/
├── AGENTS.md              # Luật cho agent (commands + rules)
└── .ai/
    ├── project-context.md # Dự án là gì, mục tiêu, stack
    ├── architecture.md    # Kiến trúc, module chính, luồng dữ liệu
    ├── coding-standards.md# Quy ước code của dự án
    ├── test-commands.md    # Lệnh test/lint/build chính xác
    ├── current-plan.md    # Plan của task đang làm (Architect ghi)
    ├── task-log.md         # Nhật ký việc đã làm
    ├── decisions.md        # Quyết định kỹ thuật quan trọng + lý do
    └── handoff.md          # Tóm tắt khi đóng session, để session sau đọc
```

> Roo Code đọc `AGENTS.md` và thư mục `.roo/rules/` tự động. Bạn có thể đặt luật trong `AGENTS.md` (như dưới) hoặc copy vào `.roo/rules/`. `.ai/` là context để agent đọc khi cần.

### Template: `AGENTS.md`
```markdown
# Agent Rules

## Commands
- Install:   <pnpm install / npm i / pip install -r requirements.txt>
- Dev:       <pnpm dev>
- Test:      <pnpm test>
- Typecheck: <pnpm typecheck>
- Lint:      <pnpm lint>
- Build:     <pnpm build>

## Rules
- Không sửa file ngoài scope được giao trong plan.
- Luôn đọc pattern hiện có (và .ai/coding-standards.md) trước khi viết code.
- Task phức tạp: tạo plan trong .ai/current-plan.md TRƯỚC khi sửa code.
- Sau khi sửa: chạy test/typecheck/lint liên quan. Báo lỗi chính xác nếu fail.
- Commit nhỏ, mỗi commit một mục đích rõ.
- Reviewer chỉ đọc git diff, KHÔNG viết lại code.
- Model mặc định glm-4.7. Chỉ dùng glm-5.1 cho plan/task khó.
- Khi không chắc, hỏi lại thay vì đoán.

## Out of scope (không được đụng nếu chưa được duyệt)
- <secrets, config production, migration DB, file CI/CD...>
```

### Template: `.ai/project-context.md`
```markdown
# Project Context
- Tên dự án:
- Mục tiêu (1–2 câu):
- Người dùng/khách hàng:
- Stack: <ngôn ngữ, framework, DB, hạ tầng>
- Trạng thái hiện tại:
- Ưu tiên: <vd cheap + reliable>
- Ràng buộc: <deadline, không đổi API public, v.v.>
```

### Template: `.ai/architecture.md`
```markdown
# Architecture
- Sơ đồ module chính:
- Luồng dữ liệu chính:
- Điểm vào (entry points):
- Vùng nhạy cảm (auth/payment/DB) — cần review kỹ:
- Phụ thuộc ngoài quan trọng:
```

### Template: `.ai/coding-standards.md`
```markdown
# Coding Standards
- Style/format: <Prettier? Black? rule chính>
- Quy ước đặt tên:
- Cấu trúc thư mục:
- Pattern bắt buộc: <error handling, logging, validation...>
- Cấm: <vd không dùng any, không console.log trong prod>
- Quy ước test: <đặt ở đâu, framework gì>
```

### Template: `.ai/test-commands.md`
```markdown
# Test & Verify Commands
- Test toàn bộ:   <pnpm test>
- Test 1 file:     <pnpm test path/to/file>
- Typecheck:       <pnpm typecheck>
- Lint:            <pnpm lint>
- Build:           <pnpm build>
- Definition of done: test xanh + typecheck xanh + build pass
```

### Template: `.ai/current-plan.md` (Architect sẽ ghi đè mỗi task)
```markdown
# Current Plan — <tên task>
## Goal
## Allowed files
## Do not touch
## Steps (todo)
- [ ] ...
## Acceptance criteria
## Risks / cần review Opus?
```

### Template: `.ai/handoff.md`
```markdown
# Handoff — <ngày>
## Đã làm xong
## Đang dở (file + dòng)
## Quyết định quan trọng
## Việc tiếp theo
## Lưu ý / cạm bẫy
```

---

## 2. Quy trình REPO MỚI

### Bước 0 — Khởi tạo
```bash
mkdir <project> && cd <project>
git init
mkdir .ai
```
Tạo sẵn file rỗng theo cấu trúc mục 1 (hoặc để Architect soạn ở bước 1).

### Bước 1 — Architect soạn khung (mode Architect, glm-5.1, off-peak)
Prompt mẫu:
```
You are setting up a NEW project. Based on this description, create the project
scaffolding docs ONLY (do not write application code yet):

Project description:
<mô tả dự án: làm gì, cho ai, stack mong muốn, ràng buộc>

Tasks:
1. Write AGENTS.md with concrete commands and rules.
2. Write .ai/project-context.md, .ai/architecture.md,
   .ai/coding-standards.md, .ai/test-commands.md.
3. Propose the initial folder structure as a plan in .ai/current-plan.md.
4. Do NOT create source code files. Output markdown docs only.
Stop after writing the docs and summarize what you created.
```
→ Bạn đọc lại, sửa commands cho khớp thực tế, rồi `git add . && git commit -m "chore: project scaffolding"`.

### Bước 2 — Vào vòng lặp task (xem mục 4).

---

## 3. Quy trình REPO DANG DỞ (đã có code)

### Bước 1 — Scout codebase (mode Ask hoặc Architect, read-only)
Prompt mẫu:
```
You are onboarding to an EXISTING codebase. Read-only. Do NOT modify any code.

Tasks:
1. Scan the repository structure and key files.
2. Infer the architecture and main data flows -> write .ai/architecture.md
3. Infer the existing coding conventions from the current code
   -> write .ai/coding-standards.md
4. Find the test/lint/build commands (package.json scripts, Makefile, CI config)
   -> write .ai/test-commands.md
5. Identify sensitive areas (auth, payments, database, security) and list them.
Only write markdown files under .ai/. Summarize findings at the end.
```
> Architect chỉ ghi được file Markdown nên an toàn cho bước này. Nếu dùng Ask thì nó chỉ đọc, bạn tự lưu output.

### Bước 2 — Viết `AGENTS.md` với commands thật
Dựa trên `.ai/test-commands.md` vừa tạo, điền `AGENTS.md` theo template mục 1. Commit phần `.ai/` + `AGENTS.md`:
```bash
git add AGENTS.md .ai && git commit -m "chore: add agent context docs"
```

### Bước 3 — Vào vòng lặp task (mục 4).

---

## 4. Vòng lặp task HẰNG NGÀY

**Nguyên tắc: một session = một mục tiêu.**

### Bước 1 — PLAN (mode Architect, glm-5.1, off-peak)
```
Task:
<mô tả task cụ thể>

Read context from .ai/ and the relevant source files. Then:
1. Produce a step-by-step plan and write it to .ai/current-plan.md
   using the template (Goal / Allowed files / Do not touch / Steps /
   Acceptance criteria / Risks).
2. List the exact files you intend to change.
3. Flag whether this touches sensitive areas (auth/payment/DB) -> needs Opus review.
Do NOT write code. Stop after the plan for my approval.
```
→ Bạn đọc plan trong `.ai/current-plan.md`, duyệt hoặc chỉnh.

### Bước 2 — IMPLEMENT (mode Code, glm-4.7)
```
Implement the APPROVED plan in .ai/current-plan.md.

Rules:
- Only edit files listed under "Allowed files". Do not touch anything else.
- Follow .ai/coding-standards.md.
- After implementing, run the test/typecheck/build commands from
  .ai/test-commands.md and report results.
- If a test fails, report the exact failure before attempting a fix.
- Keep changes minimal and within scope.
```

### Bước 3 — DEBUG nếu fail (mode Debug, glm-4.7 → nâng nếu khó)
```
The following command failed:
<dán lệnh + output lỗi>

Diagnose the root cause first and explain it in 1-2 sentences.
Then fix ONLY the failing issue, within the current scope.
Re-run the failing command to confirm it passes. Do not refactor unrelated code.
```

### Bước 4 — COMMIT
```bash
git add <files trong scope>
git commit -m "<type>: <mô tả ngắn>"
```
Nhờ Ask (glm-4.5-air) viết commit message nếu muốn:
```
Write a concise conventional-commit message for this staged diff:
<dán `git diff --staged --stat` hoặc tóm tắt>
Format: <type>(<scope>): <subject>. One line, under 72 chars.
```

### Bước 5 — GHI LOG
Cập nhật `.ai/task-log.md` (1–2 dòng) và `.ai/decisions.md` nếu có quyết định quan trọng.

### Bước 6 — ĐÓNG SESSION (nếu dài)
Nếu session đã dài/context phình:
```
Summarize this session into .ai/handoff.md using the handoff template:
what is done, what is in-progress (file + line), key decisions, next steps,
and any gotchas. Be concise.
```
→ Mở session mới, bảo Architect/Code đọc `.ai/handoff.md` trước.

---

## 5. REVIEW — khi nào và làm thế nào

### 5.1 Khi nào dùng GLM Reviewer (rẻ, first-pass)
Diff vừa, không nhạy cảm → chạy mode **Reviewer** (glm-5.1, read-only) trước khi commit.
```
Review ONLY the staged git diff (run `git diff --staged`). Read-only.
Output:
- Verdict: APPROVE or REJECT
- Blocking issues (bugs/security/regressions) with file:line
- Non-blocking suggestions
- If REJECT, list specific reasons.
Do not edit code. Describe fixes in words; let Code mode implement them.
```

### 5.2 Khi nào LEO LÊN Claude Opus (review cuối)
Chỉ dùng Opus khi diff **đáng tiền**:
- Diff **lớn** (nhiều file / vài trăm dòng+).
- Đụng **auth / payment / database / migration / quyền / mã hóa / tính toán tiền**.
- **Trước khi merge vào main** hoặc **trước khi deploy**.
- Bug khó GLM **sửa mãi không xong** → cần ý kiến khác họ model.
- Vừa thêm **dependency ngoài** mới.

**Bỏ qua Opus** với: sửa lặt vặt, chỉ docs, chỉ test, refactor mà test xanh, code thử nghiệm.

Mục tiêu tỷ lệ: ~95% GLM / 5% Opus.

### 5.3 Cách chạy review Opus (chuyển môi trường)
1. Trong Roo Code làm xong → `git add` phần thay đổi.
2. Mở **Claude Code** (bản sạch đăng nhập Pro), trong repo:
```
/ultrareview
```
hoặc:
```
Review the STAGED git diff only. Read-only, do not edit any files.
Check for bugs, security issues, regressions, and deviations from
.ai/coding-standards.md.
Output:
- Verdict: APPROVE or REJECT
- Blocking issues with file:line
- Non-blocking suggestions
- If REJECT: exact reasons and the fix described in words (do not write code).
```
3. Opus trả APPROVE/REJECT + lý do. **Opus không sửa code.**
4. Nếu REJECT → quay lại Roo Code **Code** mode, dán lý do, để GLM sửa:
```
The reviewer rejected the change with these reasons:
<dán lý do từ Opus>
Fix only these issues, within scope. Re-run tests. Do not change anything else.
```
5. Review lại tới khi APPROVE → merge/deploy.

---

## 6. Orchestrator — dùng khi nào

Chỉ bật mode **Orchestrator** cho task **lớn, nhiều nhánh độc lập** (vì mỗi subtask = context mới = tốn quota). Task thường ngày thì tự chuyển mode bằng tay (Architect → Code → Debug) sẽ rẻ hơn.

Prompt mẫu Orchestrator:
```
Break this large task into independent subtasks and delegate:
<mô tả task lớn>

For each subtask specify: goal, allowed files, acceptance criteria.
Use Architect to plan, Code to implement, Debug to fix.
Do not run more than one subtask editing the same files in parallel.
Report progress after each subtask.
```

---

## 7. Checklist kỷ luật quota (dán lên tường)

- [ ] glm-4.7 là mặc định. glm-5.1 chỉ cho plan/task khó.
- [ ] glm-5.1 chạy **off-peak** (ngoài 13:00–17:00 giờ VN).
- [ ] Một session = một mục tiêu. Dài quá → `handoff.md` + session mới.
- [ ] Gửi 1 prompt đầy đủ context thay vì nhiều prompt nhỏ.
- [ ] Không nhiều agent cùng sửa một file (cần song song → `git worktree`).
- [ ] Reviewer (GLM hoặc Opus) chỉ đọc diff, không tự sửa code.
- [ ] Theo dõi cả quota **tuần**, không chỉ 5 giờ.
- [ ] Opus chỉ cho diff lớn/nhạy cảm/pre-merge. ~95% GLM / 5% Opus.
- [ ] Commit nhỏ, test xanh trước khi đi tiếp.

---

## 8. Tóm tắt một dòng

Repo mới: Architect soạn khung `.ai/` + `AGENTS.md` → code. Repo dang dở: scout sinh `.ai/` từ code có sẵn → code. Mỗi task: **Plan (5.1, off-peak) → Code (4.7) → Debug → commit → log**. Review: GLM soát rẻ cho diff vừa, **Opus chỉ cho diff lớn/nhạy cảm/pre-merge**, và Opus chỉ báo lỗi — GLM mới là người sửa.
