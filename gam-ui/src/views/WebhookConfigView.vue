<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Cấu hình Webhook" subtitle="Thiết lập 5 bước — Cloudflare Tunnel → nhận email" icon="⚙️" :connected="connected" @refresh="load" />

    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div class="max-w-3xl mx-auto w-full space-y-5 pb-8">
        <LoadingSpinner v-if="loading" size="md" />

        <template v-else>
          <!-- ───────────────── Summary + master toggle ───────────────── -->
          <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Tổng quan pipeline</h3>
                <p class="text-app-text-muted text-[11px] mt-0.5">Làm lần lượt 5 bước. Xong bước nào mở khóa bước kế tiếp.</p>
              </div>
              <label class="flex items-center gap-2.5 cursor-pointer select-none">
                <span class="text-[10px] uppercase font-black tracking-widest" :class="form.is_active ? 'text-emerald-500' : 'text-app-text-muted'">
                  {{ form.is_active ? 'Webhook BẬT' : 'Webhook TẮT' }}
                </span>
                <span class="relative inline-flex">
                  <input type="checkbox" :checked="!!form.is_active" @change="toggleActive" class="sr-only peer" />
                  <span class="w-10 h-5 rounded-full bg-app-bg border border-app-border peer-checked:bg-emerald-500 transition" :class="form.is_active ? 'border-emerald-500' : ''"></span>
                  <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" :class="form.is_active ? 'translate-x-5' : ''"></span>
                </span>
              </label>
            </div>

            <!-- progress bar -->
            <div class="mt-4">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] text-app-text-muted uppercase font-black tracking-widest">Tiến độ</span>
                <span class="text-[11px] font-black text-app-text-secondary">{{ doneCount }} / 5 bước</span>
              </div>
              <div class="h-2 rounded-full bg-app-bg border border-app-border overflow-hidden">
                <div class="h-full bg-emerald-500 transition-all duration-500" :style="{ width: (doneCount / 5 * 100) + '%' }"></div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
              <InfoRow label="Trạng thái cuối">
                <template #default>
                  <span v-if="state.last_status" class="inline-flex items-center gap-1.5 text-sm font-black" :class="lastStatusClass">
                    <span class="w-1.5 h-1.5 rounded-full" :class="state.last_status === 'OK' ? 'bg-emerald-500' : 'bg-red-500'"></span>
                    {{ state.last_status }}
                  </span>
                  <span v-else class="text-app-text-muted">—</span>
                </template>
              </InfoRow>
              <InfoRow label="Tổng email nhận" :value="formatQty(state.total_received || 0)" />
              <InfoRow label="Lần nhận cuối" :value="formatDateFull(lastReceivedAt) || '—'" />
            </div>
          </div>

          <!-- ═══════════════════════ STEP 1 — Tunnel ═══════════════════════ -->
          <section class="bg-app-surface border rounded-3xl p-6 shadow-sm transition" :class="cardBorder(1)">
            <header class="flex items-start gap-3 mb-4">
              <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px]" :class="badgeClass(1)">{{ badgeIcon(1) }}</span>
              <div class="flex-1 min-w-0">
                <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Bước 1 — Cài đặt Cloudflare Tunnel</h3>
                <p class="text-app-text-muted text-[11px] mt-0.5">Tạo đường hầm từ máy chủ ra Internet. Dán <strong class="text-app-text-secondary">Tunnel token</strong> rồi bấm <em>Thiết lập</em>.</p>
              </div>
              <span class="shrink-0 text-[10px] font-black uppercase tracking-widest" :class="statusTextClass(1)">{{ statusText(1) }}</span>
            </header>

            <div v-if="!stepOpen(1)" class="rounded-xl border border-app-border bg-app-bg/40 px-4 py-3 text-[11px] text-app-text-muted leading-relaxed">🔒 Hoàn thành các bước trước để mở khóa.</div>

            <div v-else class="space-y-4">
              <!-- live status -->
              <div class="rounded-xl border border-app-border bg-app-bg/40 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p class="text-[9px] text-app-text-muted uppercase font-black tracking-widest mb-1">cloudflared</p>
                  <p class="text-xs font-black" :class="state.cloudflared_installed ? 'text-emerald-500' : 'text-red-500'">
                    {{ state.cloudflared_installed ? '✓ đã cài' : '✗ chưa cài' }}
                  </p>
                </div>
                <div>
                  <p class="text-[9px] text-app-text-muted uppercase font-black tracking-widest mb-1">service</p>
                  <p class="text-xs font-black" :class="state.tunnel_active ? 'text-emerald-500' : 'text-app-text-muted'">
                    {{ state.tunnel_active ? '✓ đang chạy' : '○ chưa active' }}
                  </p>
                </div>
                <div>
                  <p class="text-[9px] text-app-text-muted uppercase font-black tracking-widest mb-1">tunnel id</p>
                  <p class="text-[11px] font-mono text-app-text-secondary break-all">{{ state.tunnel_id || (state.token_saved ? '(đã lưu token)' : '—') }}</p>
                </div>
              </div>

              <!-- how-to -->
              <ol class="space-y-1.5 text-[11px] text-app-text-secondary leading-relaxed list-decimal list-inside">
                <li>Vào <a href="https://one.dash.cloudflare.com/" target="_blank" class="text-indigo-600 hover:underline">Cloudflare Zero Trust</a> → <em>Networks → Tunnels → Create a tunnel</em>.</li>
                <li>Đặt tên tunnel → copy <strong>Tunnel token</strong> (chuỗi <code class="font-mono">eyJ...</code> ở mục <em>Install connector</em>).</li>
                <li>Dán token vào ô dưới, bấm <em>Thiết lập</em>. Backend tự chạy <code class="font-mono">cloudflared service install</code>.</li>
              </ol>

              <div>
                <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Cloudflare Tunnel Token</label>
                <div class="relative">
                  <input v-model="form.cloudflare_tunnel_token" :type="showTunnelToken ? 'text' : 'password'" class="w-full input-field px-3 py-2.5 pr-10 text-sm font-mono" placeholder="eyJhIjoi..." autocomplete="new-password" />
                  <button type="button" @click="showTunnelToken = !showTunnelToken" class="absolute right-2 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-primary p-1 text-sm">{{ showTunnelToken ? '🙈' : '👁' }}</button>
                </div>
              </div>

              <div class="flex flex-wrap gap-3">
                <button @click="installTunnel" :disabled="tunnelInstalling" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
                  <span v-if="tunnelInstalling" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Thiết lập
                </button>
              </div>

              <p v-if="tunnelError" class="text-xs text-red-500 font-medium">{{ tunnelError }}</p>

              <!-- install result -->
              <div v-if="tunnelResult" class="rounded-xl border p-4 space-y-2" :class="tunnelResult.error ? 'border-red-500/30 bg-red-500/5' : (tunnelResult.service_active ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5')">
                <p class="text-xs font-black" :class="tunnelResult.error ? 'text-red-500' : 'text-emerald-600'">{{ tunnelResult.message }}</p>
                <div v-if="tunnelResult.command && !tunnelResult.cloudflared_installed" class="space-y-2">
                  <div class="flex items-center justify-between">
                    <p class="text-[11px] text-app-text-muted">Server chưa cài cloudflared. Chạy lệnh sau trong terminal (cần sudo), rồi bấm <strong>Thiết lập</strong> lại:</p>
                    <CopyButton :text="tunnelResult.command" />
                  </div>
                  <pre class="max-h-56 overflow-auto rounded-xl bg-app-bg border border-app-border p-3 text-[11px] leading-relaxed text-app-text-secondary font-mono whitespace-pre">{{ tunnelResult.command }}</pre>
                </div>
                <div v-if="tunnelResult.error" class="text-[11px] text-red-500 font-mono break-all">{{ tunnelResult.error }}</div>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════ STEP 2 — Public Hostname ═══════════════════════ -->
          <section class="bg-app-surface border rounded-3xl p-6 shadow-sm transition" :class="cardBorder(2)">
            <header class="flex items-start gap-3 mb-4">
              <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px]" :class="badgeClass(2)">{{ badgeIcon(2) }}</span>
              <div class="flex-1 min-w-0">
                <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Bước 2 — Trỏ Public Hostname & ghi nhận site</h3>
                <p class="text-app-text-muted text-[11px] mt-0.5">Đăng ký tên miền công khai trỏ về máy chủ, rồi bấm <em>Thiết lập domain</em> để xác nhận đã thông.</p>
              </div>
              <span class="shrink-0 text-[10px] font-black uppercase tracking-widest" :class="statusTextClass(2)">{{ statusText(2) }}</span>
            </header>

            <div v-if="!stepOpen(2)" class="rounded-xl border border-app-border bg-app-bg/40 px-4 py-3 text-[11px] text-app-text-muted leading-relaxed flex items-center justify-between gap-3">
              <span>🔒 Hoàn thành <strong>Bước 1</strong> (tunnel đang chạy) để mở khóa.</span>
              <button type="button" @click="unlockStep(2)" class="shrink-0 text-[10px] text-app-text-muted/70 hover:text-indigo-600 underline underline-offset-2 whitespace-nowrap">🔓 Bỏ qua</button>
            </div>

            <div v-else class="space-y-4">
              <ol class="space-y-1.5 text-[11px] text-app-text-secondary leading-relaxed list-decimal list-inside">
                <li>Cloudflare Zero Trust → <em>Networks → Tunnels</em> → tunnel của bạn → tab <em>Public Hostname</em> → <em>Add a public hostname</em>.</li>
                <li>Nhập <strong>Subdomain</strong> + <strong>Domain</strong> (ví dụ <code class="font-mono">gam.gegeteam.xyz</code>), <strong>Type</strong> = <code class="font-mono">HTTP</code>, <strong>URL</strong> = <code class="font-mono">localhost:80</code> → Save.</li>
                <li>Điền 2 ô dưới (hostname + email nhận) rồi bấm <em>Thiết lập domain</em>. Hệ thống tự ghi nhận & kiểm tra host đã thông về Frappe.</li>
              </ol>
              <div class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-600 leading-relaxed">
                ⚠️ <strong>Service phải là <code class="font-mono">http://localhost:80</code></strong> (KHÔNG phải <code class="font-mono">https</code>). Máy chủ chỉ chạy HTTP ở cổng 80; nếu đặt HTTPS cloudflared sẽ bắt tay TLS thất bại.
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Public Host *</label>
                  <input v-model="form.public_host" type="text" class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="gam.gegeteam.xyz" />
                </div>
                <div>
                  <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Email nhận (Cloudflare forward) *</label>
                  <input v-model="form.webhook_email" type="email" class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="gam@gegeteam.xyz" />
                </div>
              </div>

              <div class="flex flex-wrap gap-3 items-center">
                <button @click="setupDomain" :disabled="domainBusy" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
                  <span v-if="domainBusy" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Thiết lập domain
                </button>
                <button v-if="state.public_host" @click="recheckHost" :disabled="domainBusy" class="px-4 py-2.5 rounded-xl border border-app-border bg-app-bg/50 text-app-text-secondary hover:text-indigo-600 hover:border-indigo-500/30 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50">↻ Kiểm tra lại</button>
              </div>

              <p v-if="domainError" class="text-xs text-red-500 font-medium">{{ domainError }}</p>

              <!-- host verdict -->
              <div v-if="domainResult" class="rounded-xl border p-4" :class="domainResult.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'">
                <p class="text-xs font-black" :class="domainResult.ok ? 'text-emerald-600' : 'text-red-500'">{{ domainResult.message }}</p>
                <p v-if="!domainResult.ok" class="text-[11px] text-app-text-muted mt-1.5">Chi tiết: <span class="font-mono break-all">{{ domainResult.detail }}</span></p>
              </div>
              <div v-else-if="state.host_reachable" class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p class="text-xs font-black text-emerald-600">✓ Host <span class="font-mono">{{ state.public_host }}</span> đã kết nối về Frappe (HTTP 200 pong).</p>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════ STEP 3 — Deploy Worker ═══════════════════════ -->
          <section class="bg-app-surface border rounded-3xl p-6 shadow-sm transition" :class="cardBorder(3)">
            <header class="flex items-start gap-3 mb-4">
              <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px]" :class="badgeClass(3)">{{ badgeIcon(3) }}</span>
              <div class="flex-1 min-w-0">
                <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Bước 3 — Triển khai Cloudflare Worker</h3>
                <p class="text-app-text-muted text-[11px] mt-0.5">Worker nhận email từ Email Routing, forward về webhook URL dưới.</p>
              </div>
              <span class="shrink-0 text-[10px] font-black uppercase tracking-widest" :class="statusTextClass(3)">{{ statusText(3) }}</span>
            </header>

            <div v-if="!stepOpen(3)" class="rounded-xl border border-app-border bg-app-bg/40 px-4 py-3 text-[11px] text-app-text-muted leading-relaxed flex items-center justify-between gap-3">
              <span>🔒 Hoàn thành <strong>Bước 2</strong> (host đã kết nối) để mở khóa — cần hostname để sinh <code class="font-mono">GAM_WEBHOOK_URL</code> đúng.</span>
              <button type="button" @click="unlockStep(3)" class="shrink-0 text-[10px] text-app-text-muted/70 hover:text-indigo-600 underline underline-offset-2 whitespace-nowrap">🔓 Bỏ qua</button>
            </div>

            <div v-else class="space-y-4">
              <!-- 2 secrets to copy -->
              <div class="space-y-3">
                <div>
                  <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Secret 1 — <code class="font-mono">GAM_WEBHOOK_URL</code></p>
                  <div class="flex items-center gap-2">
                    <code class="flex-1 text-xs font-mono text-emerald-500 bg-app-bg border border-app-border rounded-xl px-3 py-2.5 break-all select-all">{{ state.worker_url }}</code>
                    <CopyButton :text="state.worker_url" />
                  </div>
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest">Secret 2 — <code class="font-mono">GAM_WEBHOOK_SECRET</code></p>
                    <button @click="regenerateSecret" type="button" class="text-[10px] text-indigo-600 hover:text-indigo-500 font-black uppercase tracking-widest">↻ Tạo secret mới</button>
                  </div>
                  <div class="flex items-center gap-2">
                    <code class="flex-1 text-xs font-mono text-emerald-500 bg-app-bg border border-app-border rounded-xl px-3 py-2.5 break-all select-all">{{ secretDisplay }}</code>
                    <button v-if="state.webhook_secret_set" type="button" @click="toggleRevealSecret" :disabled="revealing" class="px-3 py-2.5 rounded-xl border border-app-border bg-app-bg/50 text-app-text-secondary hover:text-indigo-600 hover:border-indigo-500/30 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50">
                      {{ revealing ? '…' : (secretShown ? 'Ẩn' : 'Hiện') }}
                    </button>
                    <CopyButton v-if="state.webhook_secret_set && secretShown" :text="revealedSecret" />
                  </div>
                  <p v-if="state.webhook_secret_set && !secretShown" class="text-[10px] text-app-text-muted mt-1.5 leading-relaxed">🔒 Secret ẩn mặc định (P1.3). Bấm <em>Hiện</em> để xem — mỗi lần xem được ghi vào Reveal Log.</p>
                </div>
              </div>

              <ol class="space-y-1.5 text-[11px] text-app-text-secondary leading-relaxed list-decimal list-inside">
                <li>Cloudflare Dashboard → <strong>Workers & Pages</strong> → <em>Create</em> → <em>Hello World</em> → xóa code mẫu.</li>
                <li>Bấm <em>Hiện code</em> dưới đây, copy toàn bộ → dán vào editor Worker → <strong>Deploy</strong>.</li>
                <li>Vào <strong>Settings → Variables → Add variable</strong> → chế độ <em>Encrypt</em> thêm 2 secret <code class="font-mono">GAM_WEBHOOK_URL</code> + <code class="font-mono">GAM_WEBHOOK_SECRET</code> (giá trị ở 2 ô trên) → <strong>Deploy</strong>.</li>
              </ol>

              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <CopyButton :text="workerSource" />
                  <button @click="showWorkerSource = !showWorkerSource" class="px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border border-app-border bg-app-bg/50 text-app-text-secondary hover:text-indigo-600 hover:border-indigo-500/30 transition">
                    {{ showWorkerSource ? 'Ẩn code' : 'Hiện code' }}
                  </button>
                </div>
              </div>
              <div v-if="showWorkerSource" class="relative">
                <pre class="max-h-80 overflow-auto rounded-xl bg-app-bg border border-app-border p-4 text-[11px] leading-relaxed text-app-text-secondary font-mono whitespace-pre">{{ workerSourceLoading ? 'Đang tải...' : workerSource }}</pre>
              </div>

              <button @click="confirmStep('worker')" :disabled="confirming === 'worker'" class="px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
                <span v-if="confirming === 'worker'" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ✓ Tôi đã Deploy Worker & đặt 2 secret
              </button>
            </div>
          </section>

          <!-- ═══════════════════════ STEP 4 — Email Routing ═══════════════════════ -->
          <section class="bg-app-surface border rounded-3xl p-6 shadow-sm transition" :class="cardBorder(4)">
            <header class="flex items-start gap-3 mb-4">
              <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px]" :class="badgeClass(4)">{{ badgeIcon(4) }}</span>
              <div class="flex-1 min-w-0">
                <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Bước 4 — Định tuyến Email Routing → Worker</h3>
                <p class="text-app-text-muted text-[11px] mt-0.5">Bảo Cloudflare forward mail tới địa chỉ <code class="font-mono">{{ state.webhook_email || 'gam@…' }}</code> sang Worker vừa tạo.</p>
              </div>
              <span class="shrink-0 text-[10px] font-black uppercase tracking-widest" :class="statusTextClass(4)">{{ statusText(4) }}</span>
            </header>

            <div v-if="!stepOpen(4)" class="rounded-xl border border-app-border bg-app-bg/40 px-4 py-3 text-[11px] text-app-text-muted leading-relaxed flex items-center justify-between gap-3">
              <span>🔒 Hoàn thành <strong>Bước 3</strong> (đã deploy Worker) để mở khóa.</span>
              <button type="button" @click="unlockStep(4)" class="shrink-0 text-[10px] text-app-text-muted/70 hover:text-indigo-600 underline underline-offset-2 whitespace-nowrap">🔓 Bỏ qua</button>
            </div>

            <div v-else class="space-y-4">
              <ol class="space-y-1.5 text-[11px] text-app-text-secondary leading-relaxed list-decimal list-inside">
                <li>Cloudflare Dashboard → <strong>Email → Email Routing</strong> → chọn domain sở hữu hộp thư (ví dụ <code class="font-mono">gegeteam.xyz</code>) → <em>Get started / Enable</em>.</li>
                <li>
                  Tab <em>Routing rules</em> → <em>Catch-all address</em> → <strong>Edit → Send to a Worker</strong> → chọn Worker ở Bước 3 → Save.
                  <span class="block text-app-text-muted mt-0.5">(hoặc tạo <em>Custom address</em> riêng cho <code class="font-mono">{{ state.webhook_email || 'gam@gegeteam.xyz' }}</code> → Send to a Worker).</span>
                </li>
                <li>Kiểm tra mục <em>DNS records</em> đã tự thêm đầy đủ MX/TXT (Cloudflare tự làm, nhưng đôi khi cần bấm <em>Add records automatically</em>).</li>
              </ol>
              <button @click="confirmStep('routing')" :disabled="confirming === 'routing'" class="px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
                <span v-if="confirming === 'routing'" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ✓ Tôi đã tạo rule Email Routing
              </button>
            </div>
          </section>

          <!-- ═══════════════════════ STEP 5 — Test ═══════════════════════ -->
          <section class="bg-app-surface border rounded-3xl p-6 shadow-sm transition" :class="cardBorder(5)">
            <header class="flex items-start gap-3 mb-4">
              <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px]" :class="badgeClass(5)">{{ badgeIcon(5) }}</span>
              <div class="flex-1 min-w-0">
                <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Bước 5 — Gửi email thử & kiểm tra</h3>
                <p class="text-app-text-muted text-[11px] mt-0.5">Xác nhận pipeline đầu-cuối chạy thật.</p>
              </div>
              <span class="shrink-0 text-[10px] font-black uppercase tracking-widest" :class="statusTextClass(5)">{{ statusText(5) }}</span>
            </header>

            <div v-if="!stepOpen(5)" class="rounded-xl border border-app-border bg-app-bg/40 px-4 py-3 text-[11px] text-app-text-muted leading-relaxed flex items-center justify-between gap-3">
              <span>🔒 Hoàn thành <strong>Bước 4</strong> (đã tạo rule Email Routing) để mở khóa.</span>
              <button type="button" @click="unlockStep(5)" class="shrink-0 text-[10px] text-app-text-muted/70 hover:text-indigo-600 underline underline-offset-2 whitespace-nowrap">🔓 Bỏ qua</button>
            </div>

            <div v-else class="space-y-4">
              <ol class="space-y-1.5 text-[11px] text-app-text-secondary leading-relaxed list-decimal list-inside">
                <li>Gửi 1 email thử từ bất kỳ hộp thư nào tới <code class="font-mono">{{ state.webhook_email || 'gam@gegeteam.xyz' }}</code>.</li>
                <li>Đợi ~10–30 giây rồi mở <strong>GAM Email Inbound Log</strong> để xem email đã vào.</li>
                <li>Nếu log trống: kiểm tra <em>Email Routing → Logs</em> trên Cloudflare + trạng thái cuối ở card Tổng quan.</li>
              </ol>
              <div class="rounded-xl border p-4" :class="(state.total_received > 0) ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-app-border bg-app-bg/40'">
                <p class="text-xs font-black" :class="(state.total_received > 0) ? 'text-emerald-600' : 'text-app-text-muted'">
                  {{ (state.total_received > 0) ? `✓ Đã nhận ${formatQty(state.total_received)} email qua webhook.` : 'Chưa có email nào được nhận. Gửi thử rồi bấm làm mới.' }}
                </p>
              </div>
              <div class="flex flex-wrap gap-3">
                <button @click="load" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2">↻ Làm mới trạng thái</button>
                <router-link to="/admin/email-inbound-log" class="px-5 py-2.5 rounded-xl border border-app-border bg-app-bg/50 text-app-text-secondary hover:text-indigo-600 hover:border-indigo-500/30 text-[10px] font-black uppercase tracking-widest transition">Mở Email Inbound Log →</router-link>
              </div>
            </div>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import InfoRow from '../components/InfoRow.vue'
import CopyButton from '../components/CopyButton.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { getDoc, updateDoc, frappeCall } from '../api/index.js'
import { formatDateFull, formatQty } from '../utils/format.js'

defineOptions({ name: 'WebhookConfigView' })

const { connected } = useRealtime()
const { success, error: notifyError } = useNotify()

const DOCTYPE = 'GAM Webhook Config'
const SINGLETON_NAME = DOCTYPE

const loading = ref(true)
const lastReceivedAt = ref('')

// ── Wizard state (from gam.api.get_webhook_setup_state) ──
const state = ref({
  public_host: '', webhook_email: '', webhook_secret: '', webhook_secret_set: false,
  tunnel_active: false, tunnel_id: '', token_saved: false, cloudflared_installed: false,
  host_reachable: false, worker_url: '', worker_deployed: false, email_routing_done: false,
  last_status: '', total_received: 0, is_active: 1,
})
const form = ref({
  cloudflare_tunnel_token: '',
  public_host: '',
  webhook_email: '',
  is_active: 1,
})

// ── Step gating ──
// Power-user override (§B): a locked step can be force-opened locally so the
// admin isn't hard-blocked while debugging a mid-pipeline issue. This is a
// client-side unlock only — it does NOT mark the step done, so the progress bar
// / badge reflect the real backend state. Cleared on next load().
const forceUnlock = reactive(new Set())
function unlockStep(n) {
  forceUnlock.add(n)
}
function stepDone(n) {
  const s = state.value
  if (n === 1) return !!(s.tunnel_active && s.token_saved)
  if (n === 2) return !!s.host_reachable
  if (n === 3) return !!s.worker_deployed
  if (n === 4) return !!s.email_routing_done
  if (n === 5) return !!(s.email_routing_done && (s.total_received || 0) > 0)
  return false
}
function stepOpen(n) { return n === 1 || stepDone(n - 1) || forceUnlock.has(n) }
const doneCount = computed(() => [1, 2, 3, 4, 5].filter(stepDone).length)

function badgeIcon(n) { return stepDone(n) ? '✓' : (stepOpen(n) ? n : '🔒') }
function badgeClass(n) {
  if (stepDone(n)) return 'bg-emerald-500 text-white'
  if (stepOpen(n)) return 'bg-indigo-500/15 text-indigo-600'
  return 'bg-app-bg text-app-text-muted border border-app-border'
}
function cardBorder(n) {
  if (stepDone(n)) return 'border-emerald-500/40'
  if (stepOpen(n)) return 'border-app-border'
  return 'border-app-border opacity-60'
}
function statusText(n) {
  if (stepDone(n)) return '✓ Xong'
  if (stepOpen(n)) return 'Đang làm'
  return 'Khoá'
}
function statusTextClass(n) {
  if (stepDone(n)) return 'text-emerald-500'
  if (stepOpen(n)) return 'text-indigo-600'
  return 'text-app-text-muted'
}

// ── Tunnel (step 1) ──
const showTunnelToken = ref(false)
const tunnelInstalling = ref(false)
const tunnelResult = ref(null)
const tunnelError = ref('')

// ── Domain (step 2) ──
const domainBusy = ref(false)
const domainError = ref('')
const domainResult = ref(null)

// ── Worker source (step 3) ──
const workerSource = ref('')
const workerSourceLoading = ref(true)
const showWorkerSource = ref(false)

// ── Webhook secret reveal (P1.3: plaintext never ships in setup state) ──
const revealedSecret = ref('')
const secretShown = ref(false)
const revealing = ref(false)
const secretDisplay = computed(() => {
  if (!state.value.webhook_secret_set) return '(chưa đặt)'
  return secretShown.value ? revealedSecret.value : '••••••••••••••••••••••••'
})

// ── self-confirm (steps 3 & 4) ──
const confirming = ref('')

const lastStatusClass = computed(() =>
  state.value.last_status === 'OK' ? 'text-emerald-500'
    : state.value.last_status ? 'text-red-500' : 'text-app-text-muted'
)

// ─────────────────────── data loading ───────────────────────
async function load() {
  loading.value = true
  // Reset client-side overrides so the rendered gating follows the real
  // backend state (the power-user "Bỏ qua" unlock is only a debugging aid).
  forceUnlock.clear()
  // The setup state no longer ships the plaintext secret (P1.3), so any
  // previously-revealed value is stale after a refresh / regenerate.
  secretShown.value = false
  revealedSecret.value = ''
  try {
    const [setup, doc] = await Promise.all([
      frappeCall('gam.api.get_webhook_setup_state', {}),
      getDoc(DOCTYPE, SINGLETON_NAME).catch(() => ({})),
    ])
    state.value = { ...state.value, ...(setup || {}) }
    form.value.is_active = (setup?.is_active ?? doc?.is_active) ? 1 : 0
    form.value.public_host = setup?.public_host || doc?.public_host || ''
    form.value.webhook_email = setup?.webhook_email || doc?.webhook_email || ''
    lastReceivedAt.value = doc?.last_received_at || ''
  } catch {
    // backend not ready — keep defaults
  } finally {
    loading.value = false
  }
}

async function loadWorkerSource() {
  workerSourceLoading.value = true
  try {
    const result = await frappeCall('gam.api.get_cloudflare_worker_source', {})
    workerSource.value = result?.source || ''
  } catch {
    workerSource.value = ''
  } finally {
    workerSourceLoading.value = false
  }
}

// ─────────────────────── actions ───────────────────────
async function toggleActive() {
  const val = form.value.is_active ? 0 : 1
  try {
    await updateDoc(DOCTYPE, SINGLETON_NAME, { is_active: val })
    form.value.is_active = val
    state.value.is_active = val
    success(val ? 'Đã bật webhook' : 'Đã tắt webhook')
  } catch (e) {
    notifyError(e.message || 'Lưu thất bại')
  }
}

async function installTunnel() {
  if (!form.value.cloudflare_tunnel_token || !form.value.cloudflare_tunnel_token.trim()) {
    tunnelError.value = 'Dán Cloudflare Tunnel Token để thiết lập'
    return
  }
  tunnelInstalling.value = true
  tunnelError.value = ''
  tunnelResult.value = null
  try {
    const result = await frappeCall('gam.api.install_cloudflare_tunnel', {
      tunnel_token: form.value.cloudflare_tunnel_token.trim(),
    })
    tunnelResult.value = result
    if (result && !result.error) form.value.cloudflare_tunnel_token = ''
    await load()
  } catch (e) {
    tunnelError.value = e.message || 'Thiết lập thất bại'
    notifyError(tunnelError.value)
  } finally {
    tunnelInstalling.value = false
  }
}

async function setupDomain() {
  if (!form.value.public_host || !form.value.public_host.trim()) {
    domainError.value = 'Nhập Public Host (ví dụ gam.gegeteam.xyz)'
    return
  }
  domainBusy.value = true
  domainError.value = ''
  domainResult.value = null
  try {
    const result = await frappeCall('gam.api.setup_frappe_domain', {
      host: form.value.public_host.trim(),
      webhook_email: (form.value.webhook_email || '').trim(),
    })
    domainResult.value = result
    if (result?.ok) success('Host đã kết nối về Frappe')
    else notifyError(result?.message || 'Host chưa tới được — kiểm tra tunnel Service')
    await load()
  } catch (e) {
    domainError.value = e.message || 'Thiết lập thất bại'
    notifyError(domainError.value)
  } finally {
    domainBusy.value = false
  }
}

async function recheckHost() {
  domainBusy.value = true
  domainError.value = ''
  domainResult.value = null
  try {
    const result = await frappeCall('gam.api.verify_public_host', { host: state.value.public_host })
    domainResult.value = { ...result, ok: !!result.ok, message: result.ok ? `✓ Host ${state.value.public_host} phản hồi (HTTP ${result.status}).` : `Host chưa tới được (HTTP ${result.status}).` }
    await load()
  } catch (e) {
    domainError.value = e.message || 'Kiểm tra thất bại'
  } finally {
    domainBusy.value = false
  }
}

async function toggleRevealSecret() {
  if (secretShown.value) {
    secretShown.value = false
    revealedSecret.value = ''
    return
  }
  revealing.value = true
  try {
    // On-demand disclosure via the audit-logged endpoint (P1.3); each reveal
    // is recorded in the GAM Reveal Log on the server.
    const res = await frappeCall('gam.api.reveal_webhook_secret', {})
    revealedSecret.value = res?.webhook_secret || ''
    secretShown.value = true
  } catch (e) {
    notifyError(e.message || 'Không xem được secret')
  } finally {
    revealing.value = false
  }
}

async function regenerateSecret() {
  if (!confirm('Tạo webhook secret mới? Bạn phải cập nhật lại GAM_WEBHOOK_SECRET trong Cloudflare Worker, nếu không email sẽ bị từ chối.')) return
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  try {
    await updateDoc(DOCTYPE, SINGLETON_NAME, { webhook_secret: hex })
    success('Đã tạo webhook secret mới — cập nhật lại trong Worker')
    await load()
  } catch (e) {
    notifyError(e.message || 'Tạo secret thất bại')
  }
}

async function confirmStep(step) {
  confirming.value = step
  try {
    await frappeCall('gam.api.set_webhook_setup_step', { step, done: true })
    success(step === 'worker' ? 'Đã xác nhận Worker' : 'Đã xác nhận Email Routing')
    await load()
  } catch (e) {
    notifyError(e.message || 'Xác nhận thất bại')
  } finally {
    confirming.value = ''
  }
}

onMounted(() => {
  load()
  loadWorkerSource()
})
</script>
