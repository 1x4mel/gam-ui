<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader
      title="Tài khoản Game"
      subtitle="Tài khoản cấp Cành — gắn role / game / server / DLC"
      icon="🎮"
      :connected="connected"
      @refresh="load"
    />

    <div class="flex-1 overflow-y-auto custom-scrollbar max-w-4xl mx-auto w-full pb-8">
      <!-- Filters -->
      <div class="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <!-- Platform chips -->
        <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1 flex-wrap">
          <button
            v-for="p in PLATFORM_FILTERS" :key="p.value" @click="platformFilter = p.value"
            class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
            :class="platformFilter === p.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
          >
            {{ p.label }}
          </button>
        </div>
        <!-- Mode chips: all / on-platform / standalone -->
        <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1 flex-wrap">
          <button
            v-for="m in MODE_FILTERS" :key="m.value" @click="modeFilter = m.value"
            class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
            :class="modeFilter === m.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
          >
            {{ m.label }}
          </button>
        </div>
        <!-- Status chips -->
        <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1 flex-wrap">
          <button
            v-for="s in STATUS_FILTERS" :key="s.value" @click="statusFilter = s.value"
            class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
            :class="statusFilter === s.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
          >
            {{ s.label }}
          </button>
        </div>
        <!-- Renewal due toggle -->
        <button
          @click="renewalDueOnly = !renewalDueOnly"
          class="px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5"
          :class="renewalDueOnly ? 'bg-red-500/15 text-red-400 border-red-500/40' : 'bg-app-surface text-app-text-muted border-app-border hover:text-app-text-primary'"
        >
          🔥 Sắp hết hạn
        </button>
        <!-- Search -->
        <div class="flex-1 min-w-[140px] relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">🔍</span>
          <input
            v-model="searchQuery" type="text" placeholder="Tìm username / email..."
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 text-sm"
          />
        </div>
        <!-- Add -->
        <button
          @click="openCreate"
          class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition shrink-0"
        >
          + Thêm
        </button>
      </div>

      <!-- Active game deep-link banner -->
      <div
        v-if="gameQuery"
        class="mb-3 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between"
      >
        <span class="text-xs font-black text-indigo-300">
          🎯 Lọc theo game: <span class="text-indigo-200">{{ activeGameLabel }}</span>
        </span>
        <button @click="clearGameFilter" class="text-[10px] font-black text-indigo-300 hover:text-white px-2 py-0.5 rounded-lg hover:bg-indigo-500/30 transition">Bỏ lọc ✕</button>
      </div>

      <LoadingSpinner v-if="loading" size="md" />
      <EmptyState v-else-if="!filtered.length" icon="🎮" text="Chưa có tài khoản Game" subtext="Thêm node Game (trên Platform hoặc standalone) để gán role / game." />
      <div v-else class="space-y-2">
        <div
          v-for="g in filtered" :key="g.name"
          class="bg-app-surface border border-app-border rounded-2xl p-4"
        >
          <div class="flex items-center gap-3">
            <span class="text-lg">{{ platformIcon(g.platform) }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-black text-app-text-primary text-sm truncate">{{ cardTitle(g) }}</span>
                <span class="text-[9px] uppercase font-black text-app-text-muted bg-app-bg px-1.5 py-0.5 rounded">{{ g.platform || '?' }}</span>
                <StatusBadge :status="g.status" />
                <span
                  v-if="g.standalone"
                  class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400"
                >📧 Standalone</span>
                <span
                  v-else-if="g.parent_username"
                  class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400"
                >↳ {{ g.parent_username }}</span>
                <span
                  v-if="renewalBadge(g).label"
                  class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded"
                  :class="renewalBadge(g).cls"
                >{{ renewalBadge(g).label }}</span>
              </div>
              <div
                v-if="gameTags(g).length || roleLabels(g).length"
                class="flex items-center gap-1 flex-wrap mt-1"
              >
                <span
                  v-for="tag in gameTags(g)" :key="'game-' + tag"
                  class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400"
                >🎯 {{ tag }}</span>
                <span
                  v-for="r in roleLabels(g)" :key="'role-' + r"
                  class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400"
                >🏅 {{ r }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                v-if="g.standalone && g.billing_type && g.billing_type !== 'ONE_TIME'"
                @click="openRenew(g)"
                class="text-[10px] text-amber-500 hover:text-amber-400 font-bold px-2 py-1 rounded-lg hover:bg-amber-500/10 transition"
              >Gia hạn</button>
              <router-link
                :to="`/accounts/${g.name}`"
                class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition"
              >Chi tiết</router-link>
              <button @click="openEdit(g)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
              <button @click="askDelete(g)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
            </div>
          </div>

          <!-- Active-usage lease: holder badge + realtime elapsed timer + lock state -->
          <div
            v-if="leaseOf(g)"
            class="mt-3 flex items-center gap-2 flex-wrap text-[10px] px-2.5 py-1.5 rounded-xl"
            :class="leaseIsLockedByOther(leaseOf(g)) ? 'bg-red-500/10 border border-red-500/20' : 'bg-blue-500/10 border border-blue-500/20'"
          >
            <span class="flex items-center gap-1 font-black">
              <span class="w-2 h-2 rounded-full" :class="leaseDotClass(leaseOf(g))"></span>
              <span :class="leaseTextClass(leaseOf(g))">{{ leaseTier(leaseOf(g)).label }}</span>
            </span>
            <span v-if="leaseIsMine(leaseOf(g))" class="font-black text-blue-600">👤 Bạn đang giữ</span>
            <span v-else class="font-black text-red-500">🔒 {{ leaseHolder(leaseOf(g)) }}</span>
            <span class="font-mono font-bold" :class="leaseTextClass(leaseOf(g))">⏱ {{ leaseElapsedLabel(leaseOf(g)) }}</span>
            <span v-if="leaseTier(leaseOf(g)).remainingMs > 0" class="font-mono text-app-text-muted">
              ⏳ còn {{ formatDuration(leaseTier(leaseOf(g)).remainingMs) }}
            </span>
            <span v-else class="font-black text-tier-over">QUÁ GIỜ</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit modal -->
    <ModalWrapper :model-value="formOpen" @update:model-value="closeForm">
      <template #header>
        <div class="px-8 pt-6 pb-2">
          <h2 class="text-base font-black text-app-text-primary">{{ editing ? 'Sửa tài khoản Game' : 'Thêm tài khoản Game' }}</h2>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <!-- Mode toggle: on-platform / standalone -->
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Kiểu node</label>
          <div class="flex gap-1.5 mt-1.5">
            <button
              v-for="m in MODE_OPTS" :key="m.value" @click="setMode(m.value)"
              class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition flex items-center gap-1.5"
              :class="form.mode === m.value ? 'border-indigo-600 bg-indigo-600/10 text-indigo-400' : 'border-app-border text-app-text-muted hover:text-app-text-primary'"
            >
              <span>{{ m.icon }}</span>{{ m.label }}
            </button>
          </div>
        </div>

        <!-- On-platform: parent picker -->
        <div v-if="form.mode === 'PLATFORM'">
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Tài khoản Platform (cha) *</label>
          <div class="mt-1.5">
            <SearchableSelect
              v-model="form.parent_account" :options="parentOptions" placeholder="Chọn Platform cha" clearable
              @change="onParentChange"
            />
          </div>
          <p v-if="!parentOptions.length" class="text-[10px] text-amber-400 font-bold mt-1">Chưa có Platform nào. Tạo Platform trước ở tab Tài khoản Platform.</p>
          <p v-if="parentSelected" class="text-[10px] text-app-text-muted mt-1">
            Email kế thừa: <span class="font-bold text-app-text-secondary">{{ parentSelected.email_address || parentSelected.email || '—' }}</span>
          </p>
        </div>

        <!-- Standalone owns its own identity (no platform picker); on-platform inherits from parent -->
        <div v-if="form.mode === 'STANDALONE'" class="flex items-center gap-2">
          <span class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Standalone</span>
          <span class="text-[10px] font-black text-app-text-secondary">🖥️ Không thuộc Platform</span>
        </div>
        <div v-else-if="parentSelected" class="flex items-center gap-2">
          <span class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Platform kế thừa</span>
          <span class="text-[10px] font-black text-app-text-secondary">{{ platformIcon(form.platform) }} {{ form.platform }}</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">
              Username <span v-if="form.mode === 'STANDALONE'" class="text-red-400">*</span>
              <span v-else class="normal-case font-medium opacity-50">(để trống ⇒ kế thừa từ cha)</span>
            </label>
            <input v-model="form.username" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Status</label>
            <select v-model="form.status" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50">
              <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Password</label>
            <input v-model="form.account_password" type="password" :placeholder="editing ? '(để trống giữ nguyên)' : '(kế thừa từ cha nếu trống)'" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">TOTP secret</label>
            <input v-model="form.totp_secret" type="password" :placeholder="editing ? '(để trống giữ nguyên)' : '(kế thừa từ cha nếu trống)'" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
        </div>
        <!-- Email: standalone picks, on-platform is inherited read-only -->
        <div v-if="form.mode === 'STANDALONE'">
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Email liên kết *</label>
          <div class="mt-1.5">
            <SearchableSelect v-model="form.email" :options="emailOptions" placeholder="Chọn email" clearable />
          </div>
        </div>
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Nguồn (Source)</label>
          <input v-model="form.source" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
        </div>

        <!-- Role-game binding rows -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Role / Game</label>
            <button
              type="button" @click="addGameRow"
              class="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/20 transition"
            >＋ Game</button>
          </div>
          <div class="space-y-3">
            <div
              v-for="(row, idx) in form.games" :key="idx"
              class="rounded-xl border border-app-border bg-app-bg p-3 space-y-2.5"
            >
              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <span class="block text-[10px] text-app-text-muted font-bold mb-1">Game</span>
                  <SearchableSelect
                    v-model="row.game" :options="gameOptions" placeholder="Chọn game"
                    compact @update:model-value="onGameChange(row)"
                  />
                </div>
                <div>
                  <span class="block text-[10px] text-app-text-muted font-bold mb-1">Role *</span>
                  <select v-model="row.role" class="w-full input-field px-3 py-2 text-sm">
                    <option value="">— Chọn role —</option>
                    <option v-for="r in roleOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
                  </select>
                </div>
              </div>
              <div v-if="row.game">
                <span class="block text-[10px] text-app-text-muted font-bold mb-1">Server</span>
                <SearchableSelect v-model="row.server" :options="serverOptionsFor(row)" placeholder="(optional)" clearable compact />
              </div>
              <div v-if="dlcOptionsFor(row).length" class="flex flex-wrap gap-1.5">
                <label
                  v-for="d in dlcOptionsFor(row)" :key="d.value"
                  class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition"
                  :class="row.dlcs.includes(d.value) ? 'bg-indigo-600/15 border-indigo-600/40 text-indigo-400' : 'border-app-border text-app-text-secondary hover:border-indigo-600/30'"
                >
                  <input type="checkbox" :value="d.value" v-model="row.dlcs" class="w-3 h-3 accent-indigo-600" />
                  {{ d.label }}
                </label>
              </div>
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" :checked="!!row.is_main" @change="setMain(idx, $event.target.checked)" class="w-3.5 h-3.5 accent-indigo-600" />
                  <span class="text-[10px] font-black text-app-text-secondary">★ MAIN</span>
                </label>
                <input v-model="row.notes" type="text" class="flex-1 input-field px-2.5 py-1.5 text-xs" placeholder="Ghi chú game (optional)" />
                <button
                  type="button" @click="removeGameRow(idx)"
                  class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-1.5 py-1 rounded-lg hover:bg-red-500/10 transition"
                >✕</button>
              </div>
            </div>
            <p v-if="!form.games.length" class="text-[11px] text-app-text-muted italic">Chưa có game. Bấm “＋ Game” để gán game / role / server / DLC.</p>
          </div>
        </div>

        <!-- Billing (standalone only; on-platform nodes inherit billing from parent) -->
        <div v-if="form.mode === 'STANDALONE'" class="border-t border-app-border pt-3 space-y-3">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">💳 Thanh toán / gia hạn</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Loại phí</label>
              <select v-model="form.billing_type" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50">
                <option value="ONE_TIME">Một lần (ONE_TIME)</option>
                <option value="RENTAL">Thuê (RENTAL)</option>
                <option value="SUBSCRIPTION">Định kỳ (SUBSCRIPTION)</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Hiệu lực đến</label>
              <input v-model="form.active_until" type="date" :disabled="form.billing_type === 'ONE_TIME'" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50 disabled:opacity-50" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3" v-if="form.billing_type !== 'ONE_TIME'">
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Cảnh báo trước (ngày)</label>
              <input v-model.number="form.renewal_lead_days" type="number" min="0" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
            </div>
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Chi phí gia hạn</label>
              <input v-model.number="form.renewal_cost" type="number" min="0" step="1000" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
            </div>
            <div class="flex items-end">
              <label class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-app-text-muted pb-2 cursor-pointer">
                <input v-model="form.auto_renew" type="checkbox" class="accent-indigo-600 w-4 h-4" /> Tự động
              </label>
            </div>
          </div>
        </div>

        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Ghi chú</label>
          <textarea v-model="form.notes" rows="2" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50"></textarea>
        </div>
        <p v-if="formError" class="text-[11px] font-bold text-red-400">{{ formError }}</p>
      </div>
      <template #footer>
        <div class="px-8 py-4 flex justify-end gap-2">
          <button @click="closeForm" class="px-4 py-2 rounded-xl bg-app-bg text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
          <button @click="submitForm" :disabled="formSaving" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 inline-flex items-center gap-2">
            <span v-if="formSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ editing ? 'Cập nhật' : 'Thêm' }}
          </button>
        </div>
      </template>
    </ModalWrapper>

    <!-- Renewal modal -->
    <ModalWrapper :model-value="renewOpen" @update:model-value="closeRenew">
      <template #header>
        <div class="px-8 pt-6 pb-2">
          <h2 class="text-base font-black text-app-text-primary">Gia hạn {{ renewTarget?.username }}</h2>
          <p v-if="renewTarget?.active_until" class="text-[11px] text-app-text-muted italic mt-1">Hiệu lực hiện tại đến {{ formatDate(renewTarget.active_until) }}</p>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-4">
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Gia hạn theo</label>
          <div class="flex gap-1.5 mt-1.5">
            <button
              v-for="opt in RENEW_PERIODS" :key="opt.days" @click="applyRenewPeriod(opt.days)"
              class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition"
              :class="renewPeriodSel === opt.days ? 'border-indigo-600 bg-indigo-600/10 text-indigo-400' : 'border-app-border text-app-text-muted hover:text-app-text-primary'"
            >+{{ opt.days }} ngày</button>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Hiệu lực đến (mới)</label>
          <input v-model="renewForm.new_active_until" type="date" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Chi phí</label>
            <input v-model.number="renewForm.renewal_cost" type="number" min="0" step="1000" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-app-text-muted pb-2 cursor-pointer">
              <input v-model="renewForm.auto_renew" type="checkbox" class="accent-indigo-600 w-4 h-4" /> Tự động
            </label>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Ghi chú</label>
          <textarea v-model="renewForm.notes" rows="2" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50"></textarea>
        </div>
        <p v-if="renewError" class="text-[11px] font-bold text-red-400">{{ renewError }}</p>
      </div>
      <template #footer>
        <div class="px-8 py-4 flex justify-end gap-2">
          <button @click="closeRenew" class="px-4 py-2 rounded-xl bg-app-bg text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
          <button @click="submitRenew" :disabled="renewSaving" class="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 inline-flex items-center gap-2">
            <span v-if="renewSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Gia hạn
          </button>
        </div>
      </template>
    </ModalWrapper>

    <!-- Delete confirm -->
    <ModalWrapper :model-value="!!deleteTarget" @update:model-value="deleteTarget = null">
      <template #header>
        <div class="px-8 pt-6 pb-2">
          <h2 class="text-base font-black text-app-text-primary">Xoá tài khoản Game</h2>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-3">
        <p class="text-sm text-app-text-secondary">
          Xoá <span class="font-black text-app-text-primary">{{ deleteTarget?.username || deleteTarget?.name }}</span>?
        </p>
        <p v-if="deleteError" class="text-[11px] font-bold text-red-400">{{ deleteError }}</p>
      </div>
      <template #footer>
        <div class="px-8 py-4 flex justify-end gap-2">
          <button @click="deleteTarget = null" class="px-4 py-2 rounded-xl bg-app-bg text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
          <button @click="confirmDelete" :disabled="deleting" class="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 inline-flex items-center gap-2">
            <span v-if="deleting" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Xoá
          </button>
        </div>
      </template>
    </ModalWrapper>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useElapsedTimer, elapsedTier, formatDuration, startedMsOf, tierTextClass, tierDotClass } from '../composables/useElapsedTimer.js'
import { useAuth } from '../composables/useAuth.js'
import { userName } from '../utils/format.js'
import { frappeCall } from '../api/index.js'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'GameAccountsView' })

const route = useRoute()
const router = useRouter()
const { connected, on: onRt, off: offRt } = useRealtime()
const { success, error: notifyError } = useNotify()
const {
  platformOptions, statusOptions, roleOptions, emails, games,
  serversForGame, dlcsForGame, platformMeta, load: loadMeta,
} = useGamMetadata()

// ---- Active usage (shared singleton) + elapsed timer for card lock state ----
const { leaseFor, allActive, settings: activeSettings, serverTimeMs: activeServerMs, refresh: refreshActive } = useActiveUsage()
const { user: authUser } = useAuth()
const { serverNow, syncClock, start: startTimer, stop: stopTimer } = useElapsedTimer()
const meId = computed(() => authUser.value || '')

// Re-anchor the client→server clock offset whenever a fresh server sample lands.
watch(activeServerMs, (ms) => { if (Number.isFinite(ms)) syncClock(ms) }, { immediate: true })

// Per-card helpers (template-bound).
function leaseOf(g) { return leaseFor(g.name) }
function leaseElapsedMs(l) {
  if (!l) return 0
  const started = startedMsOf(l)
  return started == null ? 0 : Math.max(0, serverNow.value - started)
}
function leaseTier(l) { return elapsedTier(leaseElapsedMs(l), activeSettings.value) }
function leaseHolder(l) { return l ? userName(l.used_by) : '' }
function leaseIsMine(l) { return !!(l && meId.value && l.used_by === meId.value) }
function leaseIsLockedByOther(l) { return !!(l && l.used_by && meId.value && l.used_by !== meId.value) }
function leaseElapsedLabel(l) { return formatDuration(leaseElapsedMs(l)) }
function leaseTextClass(l) { return tierTextClass(leaseTier(l).tier) }
function leaseDotClass(l) {
  const r = leaseTier(l)
  return `${tierDotClass(r.tier)} ${r.dotAnim || ''}`
}

// ---- List ----
const items = ref([])
const loading = ref(false)

const PLATFORM_FILTERS = computed(() => [{ value: '', label: 'Tất cả' }, ...platformOptions.value.map(o => ({ value: o.value, label: o.label }))])
const STATUS_FILTERS = computed(() => [{ value: '', label: 'Tất cả' }, ...statusOptions.value.map(o => ({ value: o.value, label: o.label }))])
const MODE_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'PLATFORM', label: 'Trên Platform' },
  { value: 'STANDALONE', label: 'Standalone' },
]

const platformFilter = ref('')
const modeFilter = ref('')
const statusFilter = ref('')
const renewalDueOnly = ref(false)
const searchQuery = ref('')

// Deep-linked game filter (e.g. ?game=<GAM Game name>) — coming from SearchView.
const gameQuery = computed(() => (route.query.game ? String(route.query.game) : ''))
const activeGameLabel = computed(() => {
  const g = gameQuery.value
  if (!g) return ''
  return games.value.find((x) => x.name === g)?.game_name || g
})
function clearGameFilter() {
  const { game, ...rest } = route.query
  router.replace({ query: rest })
}

const filtered = computed(() => {
  let list = items.value
  if (gameQuery.value) list = list.filter((g) => Array.isArray(g.games) && g.games.includes(gameQuery.value))
  if (platformFilter.value) list = list.filter((g) => g.platform === platformFilter.value)
  if (modeFilter.value === 'STANDALONE') list = list.filter((g) => g.standalone)
  else if (modeFilter.value === 'PLATFORM') list = list.filter((g) => !g.standalone && g.parent_account)
  if (statusFilter.value) list = list.filter((g) => g.status === statusFilter.value)
  if (renewalDueOnly.value) list = list.filter((g) => g.renewal_state === 'DUE' || g.renewal_state === 'OVERDUE')
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((g) => (g.username || '').toLowerCase().includes(q) || (g.email_address || '').toLowerCase().includes(q))
  }
  return list
})

async function load() {
  loading.value = true
  try {
    items.value = await frappeCall('gam.api.get_game_accounts')
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

// ---- Helpers ----
function platformIcon(platform) {
  return platformMeta(platform)?.icon || '🎮'
}
function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s.endsWith('Z') ? s : s + 'T00:00:00')
  return d.toLocaleDateString('vi-VN')
}
function renewalBadge(g) {
  const st = g.renewal_state
  if (st === 'OVERDUE') return { label: '🔴 Quá hạn', cls: 'bg-red-500/15 text-red-400' }
  if (st === 'DUE') return { label: '🟠 Sắp hết hạn', cls: 'bg-amber-500/15 text-amber-400' }
  if (st === 'OK') return { label: '🟢 Còn hạn', cls: 'bg-emerald-500/15 text-emerald-400' }
  return { label: '', cls: '' }
}
function roleLabels(g) {
  return (g.roles || []).map((rv) => {
    const o = roleOptions.value.find((r) => r.value === rv)
    return o ? o.label : rv
  })
}
// Resolve a bound game doctype name -> pretty game_name.
function gameNameOf(name) {
  return games.value.find((x) => x.name === name)?.game_name || ''
}
// Pretty game names bound to this account (e.g. ["Diablo 4"]).
function gameTags(g) {
  return (g.games || []).map(gameNameOf).filter(Boolean)
}
// Card title fallback chain — never reveal the raw Frappe random ID.
function cardTitle(g) {
  return g.username || gameTags(g)[0] || g.platform || '—'
}

// ---- Parent platform list (for on-platform picker) ----
const parentAccounts = ref([])
const parentOptions = computed(() => parentAccounts.value.map((p) => ({
  value: p.name,
  label: `${p.username || p.name} (${p.platform || '?'})`,
  description: p.email_address || p.email || '',
})))
const parentSelected = computed(() => parentAccounts.value.find((p) => p.name === form.value.parent_account) || null)
async function loadParents() {
  try {
    parentAccounts.value = await frappeCall('gam.api.get_platform_accounts')
  } catch {
    parentAccounts.value = []
  }
}
function onParentChange() {
  const p = parentSelected.value
  if (p) {
    form.value.platform = p.platform || form.value.platform
    form.value.email = p.email || ''
  }
}

// ---- Email / game option helpers ----
const emailOptions = computed(() => emails.value.map((e) => ({ value: e.name, label: e.address })))
const gameOptions = computed(() => games.value.map((g) => ({ value: g.name, label: g.game_name, description: g.publisher })))
function serverOptionsFor(row) {
  if (!row.game) return []
  return serversForGame(row.game).map((s) => ({ value: s.name, label: s.server_name || s.name }))
}
function dlcOptionsFor(row) {
  if (!row.game) return []
  return dlcsForGame(row.game).map((d) => ({ value: d.name, label: d.dlc_name }))
}
function addGameRow() {
  form.value.games.push({ game: '', role: '', server: '', is_main: 0, notes: '', dlcs: [] })
}
function removeGameRow(idx) {
  form.value.games.splice(idx, 1)
}
function setMain(idx, checked) {
  form.value.games.forEach((r, i) => { r.is_main = (i === idx && checked) ? 1 : 0 })
}
function onGameChange(row) {
  row.server = ''
  const valid = new Set(dlcsForGame(row.game).map((d) => d.name))
  row.dlcs = row.dlcs.filter((d) => valid.has(d))
}

// ---- Create / edit form ----
const MODE_OPTS = [
  { value: 'PLATFORM', label: 'Trên Platform', icon: '🔗' },
  { value: 'STANDALONE', label: 'Standalone', icon: '📧' },
]

const formOpen = ref(false)
const editing = ref(null)
const form = ref({})
const formSaving = ref(false)
const formError = ref('')

function emptyForm() {
  return {
    mode: 'PLATFORM',
    parent_account: '',
    platform: 'STANDALONE',
    username: '',
    account_password: '',
    totp_secret: '',
    email: '',
    source: '',
    status: 'ACTIVE',
    notes: '',
    games: [],
    billing_type: 'ONE_TIME',
    active_until: '',
    renewal_lead_days: 3,
    auto_renew: false,
    renewal_cost: null,
  }
}
function setMode(m) {
  form.value.mode = m
  // Reset mode-specific fields so stale data doesn't leak across.
  if (m === 'PLATFORM') {
    form.value.username = ''
    form.value.email = ''
    form.value.parent_account = ''
  } else {
    // Standalone owns its own identity — no platform selection needed.
    form.value.parent_account = ''
    form.value.platform = 'STANDALONE'
  }
}
function openCreate() {
  editing.value = null
  formError.value = ''
  form.value = emptyForm()
  loadParents()
  formOpen.value = true
}
async function openEdit(g) {
  editing.value = g.name
  formError.value = ''
  await loadParents()
  // Existing GAME node bindings aren't in the list row — fetch them so the
  // role/game editor shows the current state instead of an empty block.
  let roleGames = []
  try {
    roleGames = await frappeCall('gam.api.get_account_role_games', { account: g.name })
  } catch {
    roleGames = []
  }
  form.value = {
    mode: g.standalone ? 'STANDALONE' : 'PLATFORM',
    parent_account: g.parent_account || '',
    platform: g.platform || 'STEAM',
    username: g.username || '',
    account_password: '',
    totp_secret: '',
    email: g.email || '',
    source: g.source || '',
    status: g.status || 'ACTIVE',
    notes: g.notes || '',
    games: (roleGames || []).map((r) => ({
      game: r.game || '',
      role: r.role || '',
      server: r.server || '',
      is_main: r.is_main ? 1 : 0,
      notes: r.notes || '',
      dlcs: (r.dlcs || []).map((d) => d.dlc).filter(Boolean),
    })),
    billing_type: g.billing_type || 'ONE_TIME',
    active_until: g.active_until ? g.active_until.slice(0, 10) : '',
    renewal_lead_days: g.renewal_lead_days ?? 3,
    auto_renew: !!g.auto_renew,
    renewal_cost: g.renewal_cost ?? null,
  }
  formOpen.value = true
}
function closeForm() {
  if (formSaving.value) return
  formOpen.value = false
}
function toBackendBool(v) {
  if (v === true) return 1
  if (v === false) return 0
  return v
}
async function submitForm() {
  const isStandalone = form.value.mode === 'STANDALONE'
  // Validation: standalone needs platform+username+email; on-platform needs parent.
  if (!isStandalone && !form.value.parent_account) {
    formError.value = 'Chọn tài khoản Platform cha'
    return
  }
  if (isStandalone && (!form.value.username || !form.value.email)) {
    formError.value = 'Vui lòng điền username và email'
    return
  }
  if (
    isStandalone &&
    form.value.billing_type !== 'ONE_TIME' &&
    !form.value.active_until
  ) {
    formError.value = 'Vui lòng chọn ngày hết hạn cho loại phí định kỳ'
    return
  }
  // one role per (account, game): every game row must carry a role
  const rows = (form.value.games || []).filter((r) => r.game)
  const missingRole = rows.find((r) => !r.role)
  if (missingRole) {
    formError.value = 'Mỗi game phải được gán role'
    return
  }
  formSaving.value = true
  formError.value = ''
  try {
    const payload = {
      account_level: 'GAME',
      parent_account: isStandalone ? '' : form.value.parent_account,
      platform: isStandalone ? form.value.platform : form.value.platform,
      username: form.value.username || undefined,
      email: form.value.email || undefined,
      source: form.value.source || undefined,
      status: form.value.status,
      notes: form.value.notes || undefined,
    }
    if (form.value.account_password) payload.account_password = form.value.account_password
    if (form.value.totp_secret) payload.totp_secret = form.value.totp_secret
    // Billing only applies to standalone GAME nodes.
    if (isStandalone) {
      payload.billing_type = form.value.billing_type
      if (form.value.billing_type !== 'ONE_TIME') {
        payload.active_until = form.value.active_until || undefined
        payload.renewal_lead_days = form.value.renewal_lead_days
        payload.auto_renew = toBackendBool(form.value.auto_renew)
        payload.renewal_cost = form.value.renewal_cost
      }
    } else {
      // Explicitly reset billing for on-platform nodes (inherit from parent).
      payload.billing_type = 'ONE_TIME'
    }
    // Build first-class (role, game) binding payload.
    const roleGamesPayload = rows.map((r) => ({
      game: r.game,
      role: r.role,
      server: r.server || undefined,
      is_main: r.is_main ? 1 : 0,
      notes: r.notes || undefined,
      dlcs: (r.dlcs || []).filter(Boolean),
    }))
    // edit => always send (replace/clear); create => only when non-empty.
    if (editing.value || roleGamesPayload.length) payload.role_games = roleGamesPayload
    else delete payload.role_games

    const args = { values: JSON.stringify(payload) }
    if (editing.value) args.name = editing.value
    await frappeCall('gam.api.save_account', args)
    success(editing.value ? 'Đã cập nhật tài khoản Game' : 'Đã tạo tài khoản Game')
    formOpen.value = false
    await load()
  } catch (e) {
    formError.value = e.message || 'Lưu thất bại'
    notifyError(formError.value)
  } finally {
    formSaving.value = false
  }
}

// ---- Renewal ----
const RENEW_PERIODS = [{ days: 7 }, { days: 30 }, { days: 90 }, { days: 180 }, { days: 365 }]
const renewOpen = ref(false)
const renewTarget = ref(null)
const renewPeriodSel = ref(null)
const renewForm = ref({})
const renewSaving = ref(false)
const renewError = ref('')

function openRenew(g) {
  renewTarget.value = g
  renewPeriodSel.value = null
  renewError.value = ''
  renewForm.value = {
    new_active_until: g.active_until ? g.active_until.slice(0, 10) : new Date().toISOString().slice(0, 10),
    renewal_cost: g.renewal_cost ?? null,
    auto_renew: !!g.auto_renew,
    notes: '',
  }
  renewOpen.value = true
}
function closeRenew() {
  if (renewSaving.value) return
  renewOpen.value = false
}
function applyRenewPeriod(days) {
  renewPeriodSel.value = days
  const base = renewTarget.value?.active_until
    ? new Date(base.endsWith('Z') ? base : base + 'T00:00:00')
    : new Date()
  const next = new Date(base.getTime() + days * 86400000)
  renewForm.value.new_active_until = next.toISOString().slice(0, 10)
}
async function submitRenew() {
  if (!renewForm.value.new_active_until) {
    renewError.value = 'Chọn ngày hiệu lực mới'
    return
  }
  renewSaving.value = true
  renewError.value = ''
  try {
    await frappeCall('gam.api.renew_account', {
      account: renewTarget.value.name,
      new_active_until: renewForm.value.new_active_until,
      renewal_cost: renewForm.value.renewal_cost ?? undefined,
      auto_renew: toBackendBool(renewForm.value.auto_renew),
      notes: renewForm.value.notes || undefined,
    })
    success('Đã gia hạn')
    renewOpen.value = false
    await load()
  } catch (e) {
    renewError.value = e.message || 'Gia hạn thất bại'
    notifyError(renewError.value)
  } finally {
    renewSaving.value = false
  }
}

// ---- Delete ----
const deleteTarget = ref(null)
const deleting = ref(false)
const deleteError = ref('')
function askDelete(g) {
  deleteTarget.value = g
  deleteError.value = ''
}
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await frappeCall('gam.api.delete_account', { name: deleteTarget.value.name })
    success('Đã xoá')
    deleteTarget.value = null
    await load()
  } catch (e) {
    deleteError.value = e.message || 'Xoá thất bại'
  } finally {
    deleting.value = false
  }
}

// ---- Realtime live refresh ----
function onRenewalsChanged() {
  load()
}
function onAccountChanged(payload) {
  if (!payload || !payload.account || items.value.some((g) => g.name === payload.account)) load()
}

onMounted(() => {
  loadMeta(true)
  load()
  // Keep card lock/timer state live (singleton; safe to refresh from here too).
  refreshActive()
  startTimer()
  onRt('gam_renewals_changed', onRenewalsChanged)
  onRt('gam_account_changed', onAccountChanged)
})
onUnmounted(() => {
  stopTimer()
  offRt('gam_renewals_changed', onRenewalsChanged)
  offRt('gam_account_changed', onAccountChanged)
})
</script>
