<template>
  <div class="w-full flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/queue')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Phiên làm việc</h2>
      <div class="flex-1" />
      <AppButton v-if="!activeSession" variant="primary" size="sm" @click="showStartModal = true">+ Bắt đầu phiên</AppButton>
      <AppButton v-if="activeSession" variant="danger" size="sm" @click="showEndModal = true">Kết thúc phiên</AppButton>
    </div>

    <PaginatedListLayout
      :total-items="historyTotalItems"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-size="pageSize"
      @update:current-page="goToPage"
      @update:page-size="setPageSize"
    >
      <!-- Active Session Card (above the paginated list) -->
      <template #header>
        <div v-if="activeSession" class="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 sm:p-6 mb-4 mx-1">
          <div class="flex items-center gap-3 mb-3">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Đang hoạt động
            </span>
            <span class="text-app-text-muted text-xs">{{ activeSession.name }}</span>
            <div class="flex-1" />
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Kế toán điều phối</p>
              <p class="text-sm font-bold text-app-text-primary">{{ chiefDisplayName(activeSession.chief_user) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Kế toán vận hành</p>
              <p class="text-sm font-bold text-app-text-primary">{{ activeSession.payment_user }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Bắt đầu</p>
              <p class="text-sm text-app-text-primary">{{ formatTime(activeSession.started_at) }}</p>
            </div>
          </div>
          <!-- Bank Account Details by Role -->
          <div v-if="sessionDetails?.bank_accounts?.length" class="space-y-2">
            <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Tài khoản ngân hàng</p>
            <div v-for="acc in sessionDetails.bank_accounts" :key="acc.bank_account + acc.role"
              class="flex items-center gap-4 bg-app-surface/60 border border-app-border/50 rounded-xl px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" :class="roleBadge(acc.role)">{{ roleLabel(acc.role) }}</span>
              <span class="px-2.5 py-0.5 rounded-md text-xs font-bold" :class="acc.currency === 'VND' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'">{{ acc.currency }}</span>
              <div class="flex-1">
                <p class="text-sm font-bold text-app-text-primary">{{ acc.account_number }}</p>
                <p class="text-[10px] text-app-text-muted">Mở: {{ fmtNum(acc.opening_balance) }} → Đóng: {{ fmtNum(acc.closing_balance) }} (Thu {{ fmtNum(acc.total_in) }} / Chi {{ fmtNum(acc.total_out) }})</p>
              </div>
              <span class="text-[10px] font-bold uppercase tracking-wider" :class="acc.bank_bin ? 'text-emerald-600' : 'text-red-400'">
                {{ acc.bank_bin ? 'Sẵn QR' : 'Thiếu BIN' }}
              </span>
            </div>
          </div>
          <!-- Platform Wallet Balances -->
          <div v-if="sessionDetails?.wallets?.length" class="space-y-2 mt-4">
            <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Số dư ví nền tảng</p>
            <div v-for="w in sessionDetails.wallets" :key="w.wallet"
              class="flex items-center gap-4 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
              <span class="px-2.5 py-0.5 rounded-md text-xs font-bold" :class="w.currency === 'VND' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'">{{ w.currency }}</span>
              <div class="flex-1">
                <p class="text-sm font-bold text-app-text-primary">{{ w.channel }}</p>
                <p class="text-[10px] text-app-text-muted">{{ w.wallet_name }}</p>
              </div>
              <span class="text-sm font-black" :class="w.balance > 0 ? 'text-emerald-600' : w.balance < 0 ? 'text-red-500' : 'text-app-text-muted'">
                {{ fmtNum(w.balance) }}
              </span>
            </div>
          </div>
          <!-- Trader Assignments -->
          <div v-if="sessionDetails?.trader_assignments?.length" class="space-y-2 mt-4">
            <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Phân công Trader1</p>
            <div v-for="ta in (sessionDetails.trader_assignments || []).filter(t => t?.trader_user)" :key="ta.trader_user + (ta.game_context || '')"
              class="flex items-center gap-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3">
              <span class="text-sm font-bold text-app-text-primary">{{ ta.trader_user }}</span>
              <span class="text-[10px] text-app-text-muted">→</span>
              <span class="text-xs text-app-text-secondary">{{ ta.game_context }}</span>
              <div class="flex-1" />
              <span class="text-xs text-app-text-muted">Quỹ: {{ fmtNum(ta.allocated_amount) }} {{ ta.currency }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Session History -->
      <EmptyState v-if="!activeSession && historySessions.length === 0" message="Chưa có phiên làm việc nào" />
      <div class="px-1 space-y-3">
        <div v-for="s in paginatedItems" :key="s.name" class="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          <div class="p-4 cursor-pointer hover:bg-app-bg/30 transition" @click="toggleSessionDetail(s.name)">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-app-text-primary">{{ s.name }}</span>
                <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :class="s.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-200/50 text-gray-400'">
                  {{ s.status === 'Active' ? 'Hoạt động' : 'Đã đóng' }}
                </span>
                <span class="text-[10px] text-app-text-muted">{{ expandedSession === s.name ? '▲' : '▼' }}</span>
              </div>
              <span class="text-xs text-app-text-muted">{{ formatTime(s.started_at) }}</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-app-text-muted">
              <span>{{ chiefDisplayName(s.chief_user) }} / {{ s.payment_user }}</span>
              <span v-if="s.ended_at">→ {{ formatTime(s.ended_at) }}</span>
            </div>
          </div>
          <!-- Expanded Detail -->
          <div v-if="expandedSession === s.name && sessionDetailCache[s.name]" class="px-4 pb-4 border-t border-app-border/50 pt-3 space-y-2">
            <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Tài khoản ngân hàng</p>
            <div v-for="acc in sessionDetailCache[s.name].bank_accounts" :key="acc.bank_account + acc.role"
              class="flex items-center gap-4 bg-app-bg/50 border border-app-border/30 rounded-xl px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" :class="roleBadge(acc.role)">{{ roleLabel(acc.role) }}</span>
              <span class="px-2.5 py-0.5 rounded-md text-xs font-bold" :class="acc.currency === 'VND' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'">{{ acc.currency }}</span>
              <div class="flex-1">
                <p class="text-sm font-bold text-app-text-primary">{{ acc.account_number }}</p>
                <p class="text-[10px] text-app-text-muted">Mở: {{ fmtNum(acc.opening_balance) }} → Đóng: {{ fmtNum(acc.closing_balance) }} (Thu {{ fmtNum(acc.total_in) }} / Chi {{ fmtNum(acc.total_out) }})</p>
              </div>
            </div>
          </div>
          <div v-if="expandedSession === s.name && loadingDetail" class="px-4 pb-4 text-xs text-app-text-muted animate-pulse">Đang tải...</div>
        </div>
      </div>
    </PaginatedListLayout>

    <!-- Start Modal -->
    <div v-if="showStartModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="showStartModal = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">Bắt đầu phiên mới</h3>
          <button @click="showStartModal = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">✕</button>
        </div>
        <div class="flex-1 overflow-y-auto p-8 space-y-6">
          <div v-if="startError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ startError }}</div>
          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Kế toán trưởng</label>
            <div class="bg-app-bg border border-app-border rounded-xl px-4 py-3 flex items-center gap-2">
              <span v-for="(u, i) in chiefUsers" :key="u.email" class="flex items-center gap-2">
                <span class="font-bold text-app-text-primary text-sm">{{ u.full_name }}</span>
                <span class="text-app-text-muted text-xs">{{ u.email }}</span>
                <span v-if="i < chiefUsers.length - 1" class="text-app-text-muted text-xs mx-1">&</span>
              </span>
            </div>
          </div>
          <div class="relative">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Kế toán ShiftPayment <span class="text-red-500">*</span></label>
            <input :value="paymentUsers.find(u => u.email === startForm.payment_user)?.full_name || startForm.payment_search || ''"
              @input="startForm.payment_search = $event.target.value; startForm.payment_user = ''"
              @focus="startForm.payment_focus = true" @blur="setTimeout(() => startForm.payment_focus = false, 150)"
              type="text" class="input-field !py-3 text-sm" placeholder="Tìm kế toán payment..." />
            <div v-if="startForm.payment_focus && startForm.payment_search !== undefined && !startForm.payment_user"
              class="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
              <button v-for="u in paymentUsers.filter(u => !startForm.payment_search || (u.full_name || u.email).toLowerCase().includes(startForm.payment_search.toLowerCase()))"
                :key="u.email" @mousedown="startForm.payment_user = u.email; startForm.payment_search = u.full_name || u.email; startForm.payment_focus = false"
                class="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-500/10 transition flex items-center gap-2">
                <span class="font-bold text-app-text-primary">{{ u.full_name }}</span>
                <span class="text-app-text-muted text-xs">{{ u.email }}</span>
              </button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest mb-2 block">Quỹ Chief VND</label>
              <input :value="fmtInput(startForm.chief_amount_vnd)" @input="startForm.chief_amount_vnd = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-3 text-sm" placeholder="0" />
            </div>
            <div>
              <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest mb-2 block">Quỹ Chief USD</label>
              <input :value="fmtInput(startForm.chief_amount_usd)" @input="startForm.chief_amount_usd = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-3 text-sm" placeholder="0" />
            </div>
            <div>
              <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest mb-2 block">Quỹ Chief CNY</label>
              <input :value="fmtInput(startForm.chief_amount_cny)" @input="startForm.chief_amount_cny = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-3 text-sm" placeholder="0" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest mb-2 block">Quỹ ShiftPayment VND</label>
              <input :value="fmtInput(startForm.payment_amount_vnd)" @input="startForm.payment_amount_vnd = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-3 text-sm" placeholder="0" />
            </div>
            <div>
              <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest mb-2 block">Quỹ ShiftPayment USD</label>
              <input :value="fmtInput(startForm.payment_amount_usd)" @input="startForm.payment_amount_usd = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-3 text-sm" placeholder="0" />
            </div>
            <div>
              <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest mb-2 block">Quỹ ShiftPayment CNY</label>
              <input :value="fmtInput(startForm.payment_amount_cny)" @input="startForm.payment_amount_cny = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-3 text-sm" placeholder="0" />
            </div>
          </div>
          <!-- Trader1 Assignments -->
          <div class="border-t border-app-border/50 pt-4 mt-2">
            <p class="text-[11px] font-bold text-app-text-secondary uppercase tracking-wider mb-3">Phân công Trader1</p>
            <div v-for="(ta, idx) in startForm.trader_assignments" :key="idx"
              class="flex items-center gap-2 bg-app-bg/50 border border-app-border/30 rounded-xl px-4 py-2.5 mb-2">
              <span class="text-xs font-bold text-app-text-primary">{{ traderUsers.find(u => u.email === ta.trader_user)?.full_name || ta.trader_user }}</span>
              <span class="text-[10px] text-app-text-muted">→</span>
              <span class="text-xs text-app-text-secondary">{{ gameContexts.find(g => g.name === ta.game_context)?.game_title || ta.game_context }}</span>
              <span class="text-[10px] text-app-text-muted">|</span>
              <span class="text-xs font-bold text-emerald-600">{{ [ta.amount_vnd ? fmtNum(ta.amount_vnd)+'₫' : '', ta.amount_usd ? fmtNum(ta.amount_usd)+'$' : '', ta.amount_cny ? fmtNum(ta.amount_cny)+'¥' : ''].filter(Boolean).join(' / ') || '0' }}</span>
              <div class="flex-1" />
              <button @click="startForm.trader_assignments.splice(idx, 1)" class="text-red-400 hover:text-red-600 text-sm">✕</button>
            </div>
            <div class="space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <div class="relative">
                  <input :value="traderUsers.find(u => u.email === newTrader.trader_user)?.full_name || newTrader.trader_search || ''"
                    @input="newTrader.trader_search = $event.target.value; newTrader.trader_user = ''"
                    @focus="newTrader.trader_focus = true" @blur="setTimeout(() => newTrader.trader_focus = false, 150)"
                    type="text" class="input-field !py-2 text-xs w-full" placeholder="Tìm Trader1..." />
                  <div v-if="newTrader.trader_focus && newTrader.trader_search !== undefined && !newTrader.trader_user"
                    class="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-lg max-h-36 overflow-y-auto text-xs">
                    <button v-for="u in traderUsers.filter(u => !newTrader.trader_search || (u.full_name || u.email).toLowerCase().includes(newTrader.trader_search.toLowerCase()))"
                      :key="u.email" @mousedown="newTrader.trader_user = u.email; newTrader.trader_search = u.full_name || u.email; newTrader.trader_focus = false"
                      class="w-full text-left px-3 py-2 hover:bg-indigo-500/10 transition flex items-center gap-2">
                      <span class="font-bold text-app-text-primary">{{ u.full_name }}</span>
                      <span class="text-app-text-muted">{{ u.email }}</span>
                    </button>
                  </div>
                </div>
                <select v-model="newTrader.game_context" class="input-field !py-2 text-xs">
                  <option value="">-- Game Context --</option>
                  <option v-for="g in gameContexts" :key="g.name" :value="g.name">{{ g.game_title }} {{ g.server ? '- '+g.server : '' }}</option>
                </select>
              </div>
              <div class="grid grid-cols-4 gap-3">
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">VND</label>
                  <input :value="fmtInput(newTrader.amount_vnd)" @input="newTrader.amount_vnd = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-2 text-xs" placeholder="0" />
                </div>
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">USD</label>
                  <input :value="fmtInput(newTrader.amount_usd)" @input="newTrader.amount_usd = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-2 text-xs" placeholder="0" />
                </div>
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">CNY</label>
                  <input :value="fmtInput(newTrader.amount_cny)" @input="newTrader.amount_cny = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-2 text-xs" placeholder="0" />
                </div>
                <div class="flex items-end">
                  <button @click="addTraderAssignment" class="w-full px-2 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 text-xs font-bold hover:bg-indigo-500/20 transition">+ Thêm</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="showStartModal = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <AppButton variant="primary" size="sm" :loading="starting" @click="startSession">Bắt đầu</AppButton>
        </div>
      </div>
    </div>

    <!-- End Modal -->
    <div v-if="showEndModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="showEndModal = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">Kết thúc phiên</h3>
          <button @click="showEndModal = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">✕</button>
        </div>
        <div class="flex-1 overflow-y-auto p-8 space-y-6">
          <div v-if="endError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ endError }}</div>

          <!-- Scenario selection -->
          <div class="space-y-3">
            <button @click="endForm.scenario = 'close_all'"
              class="w-full text-left px-5 py-3.5 rounded-xl border-2 transition"
              :class="endForm.scenario === 'close_all' ? 'border-indigo-500 bg-indigo-500/5' : 'border-app-border hover:border-app-text-muted/30'">
              <p class="text-sm font-bold text-app-text-primary">Thu hồi toàn bộ</p>
              <p class="text-[11px] text-app-text-muted mt-0.5">ShiftPayment → Chief → Master. Đóng phiên, không mở ca mới.</p>
            </button>
            <button @click="endForm.scenario = 'handoff'"
              class="w-full text-left px-5 py-3.5 rounded-xl border-2 transition"
              :class="endForm.scenario === 'handoff' ? 'border-amber-500 bg-amber-500/5' : 'border-app-border hover:border-app-text-muted/30'">
              <p class="text-sm font-bold text-app-text-primary">Bàn giao ca mới</p>
              <p class="text-[11px] text-app-text-muted mt-0.5">ShiftPayment → Chief giữ lại. Mở ca mới với ShiftPayment khác, Chief tiếp tục.</p>
            </button>
          </div>

          <!-- Handoff: select new payment user -->
          <div v-if="endForm.scenario === 'handoff'" class="space-y-3">
            <div>
              <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Kế toán ShiftPayment mới <span class="text-red-500">*</span></label>
              <select v-model="endForm.handoff_to" class="input-field !py-3 text-sm">
                <option value="">-- Chọn --</option>
                <option v-for="u in paymentUsers.filter(u => !(activeSession?.chief_user || '').split(',').map(s=>s.trim()).includes(u.email))" :key="u.email" :value="u.email">{{ u.full_name || u.email }}</option>
              </select>
            </div>
            <label class="flex items-center gap-3 text-sm text-app-text-primary font-medium cursor-pointer">
              <input type="checkbox" v-model="endForm.deposit_sell" class="accent-indigo-600 w-4 h-4" />
              <span>Nộp tiền bán <span class="text-app-text-muted">(Receiving → ShiftPayment)</span></span>
            </label>
          </div>

          <!-- Handoff: Trader Assignments for new session -->
          <div v-if="endForm.scenario === 'handoff'" class="border-t border-app-border/50 pt-4">
            <p class="text-[11px] font-bold text-app-text-secondary uppercase tracking-wider mb-3">Phân công Trader1 cho ca mới</p>
            <div v-for="(ta, idx) in (endForm.trader_assignments || []).filter(t => t?.trader_user)" :key="idx"
              class="flex items-center gap-2 bg-app-bg/50 border border-app-border/30 rounded-xl px-4 py-2.5 mb-2">
              <span class="text-xs font-bold text-app-text-primary">{{ traderUsers.find(u => u.email === ta.trader_user)?.full_name || ta.trader_user }}</span>
              <span class="text-[10px] text-app-text-muted">→</span>
              <span class="text-xs text-app-text-secondary">{{ gameContexts.find(g => g.name === ta.game_context)?.game_title || ta.game_context }}</span>
              <span class="text-[10px] text-app-text-muted">|</span>
              <span class="text-xs font-bold text-emerald-600">{{ [ta.amount_vnd ? fmtNum(ta.amount_vnd)+'₫' : '', ta.amount_usd ? fmtNum(ta.amount_usd)+'$' : '', ta.amount_cny ? fmtNum(ta.amount_cny)+'¥' : ''].filter(Boolean).join(' / ') || '0' }}</span>
              <div class="flex-1" />
              <button @click="endForm.trader_assignments.splice(idx, 1)" class="text-red-400 hover:text-red-600 text-sm">✕</button>
            </div>
            <div class="space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <select v-model="endNewTrader.trader_user" class="input-field !py-2 text-xs">
                  <option value="">-- Trader1 --</option>
                  <option v-for="u in traderUsers" :key="u.email" :value="u.email">{{ u.full_name || u.email }}</option>
                </select>
                <select v-model="endNewTrader.game_context" class="input-field !py-2 text-xs">
                  <option value="">-- Game Context --</option>
                  <option v-for="g in gameContexts" :key="g.name" :value="g.name">{{ g.game_title }} {{ g.server ? '- '+g.server : '' }}</option>
                </select>
              </div>
              <div class="grid grid-cols-4 gap-3">
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">VND</label>
                  <input :value="fmtInput(endNewTrader.amount_vnd)" @input="endNewTrader.amount_vnd = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-2 text-xs" placeholder="0" />
                </div>
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">USD</label>
                  <input :value="fmtInput(endNewTrader.amount_usd)" @input="endNewTrader.amount_usd = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-2 text-xs" placeholder="0" />
                </div>
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">CNY</label>
                  <input :value="fmtInput(endNewTrader.amount_cny)" @input="endNewTrader.amount_cny = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-2 text-xs" placeholder="0" />
                </div>
                <div class="flex items-end">
                  <button @click="addEndTraderAssignment" class="w-full px-2 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 text-xs font-bold hover:bg-indigo-500/20 transition">+ Thêm</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Flow summary -->
          <div class="bg-app-bg rounded-xl p-4 space-y-2">
            <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Luồng tiền</p>
            <template v-if="endForm.scenario === 'close_all'">
              <p class="text-xs text-app-text-secondary"><span class="text-blue-500 font-bold">ShiftPayment</span> → <span class="text-amber-500 font-bold">Chief</span> → <span class="text-emerald-500 font-bold">Master</span></p>
              <p class="text-xs text-app-text-secondary"><span class="text-rose-500 font-bold">Purchasing</span> → <span class="text-blue-500 font-bold">ShiftPayment</span> → <span class="text-amber-500 font-bold">Chief</span> → <span class="text-emerald-500 font-bold">Master</span></p>
              <p class="text-xs text-app-text-secondary"><span class="text-emerald-500 font-bold">Receiving</span> giữ nguyên (không nộp)</p>
            </template>
            <template v-else>
              <p class="text-xs text-app-text-secondary"><span class="text-blue-500 font-bold">ShiftPayment</span> → <span class="text-amber-500 font-bold">Chief</span> <span class="text-app-text-muted">(giữ lại cho ca mới)</span></p>
              <p class="text-xs text-app-text-secondary"><span class="text-amber-500 font-bold">Chief</span> tiếp tục ở ca mới</p>
              <p v-if="endForm.deposit_sell" class="text-xs text-app-text-secondary"><span class="text-emerald-500 font-bold">Receiving</span> → <span class="text-emerald-500 font-bold">Master</span></p>
              <p v-else class="text-xs text-app-text-secondary"><span class="text-emerald-500 font-bold">Receiving</span> giữ nguyên</p>
              <p v-if="endForm.handoff_to" class="text-xs font-bold text-indigo-600 mt-1">Ca mới: {{ paymentUsers.find(u => u.email === endForm.handoff_to)?.full_name || endForm.handoff_to }} làm Payment</p>
            </template>
          </div>
        </div>
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="showEndModal = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <AppButton variant="danger" size="sm" :loading="ending" @click="endSession" :disabled="endForm.scenario === 'handoff' && !endForm.handoff_to">
            {{ endForm.scenario === 'handoff' ? 'Bàn giao & Kết thúc' : 'Kết thúc' }}
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getList } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import { frappeCall } from '../api/index.js'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import AppButton from '../components/AppButton.vue'
import BackButton from '../components/BackButton.vue'
import EmptyState from '../components/EmptyState.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'

defineOptions({ name: 'CashierSessionView' })

const { success, error: notifyError } = useNotify()
const allSessions = ref([])
const historyTotalItems = ref(0)
const loading = ref(false)
const activeSession = ref(null)
const chiefUsers = ref([])
const paymentUsers = ref([])
const traderUsers = ref([])
const gameContexts = ref([])
const newTrader = ref({ trader_user: '', trader_search: '', trader_focus: false, game_context: '', amount_vnd: '', amount_usd: '', amount_cny: '' })

const showStartModal = ref(false)
const showEndModal = ref(false)
const starting = ref(false)
const ending = ref(false)
const startError = ref('')
const endError = ref('')

const sessionDetails = ref(null)
const expandedSession = ref(null)
const sessionDetailCache = ref({})
const loadingDetail = ref(false)

const startForm = ref({ chief_user: '', chief_search: '', chief_focus: false, payment_user: '', payment_search: '', payment_focus: false, chief_amount_vnd: '', chief_amount_usd: '', chief_amount_cny: '', payment_amount_vnd: '', payment_amount_usd: '', payment_amount_cny: '', trader_assignments: [] })
const endForm = ref({ scenario: 'close_all', handoff_to: '', deposit_sell: false, trader_assignments: [] })
const endNewTrader = ref({ trader_user: '', game_context: '', amount_vnd: '', amount_usd: '', amount_cny: '' })

// Prefill trader assignments from current session when opening end modal
watch(showEndModal, (open) => {
  if (open) {
    const tas = sessionDetails.value?.trader_assignments
    if (tas && tas.length) {
      endForm.value.trader_assignments = tas.filter(ta => ta && ta.trader_user).map(ta => ({
        trader_user: ta.trader_user,
        game_context: ta.game_context || '',
        amount_vnd: ta.amount_vnd || '', amount_usd: ta.amount_usd || '', amount_cny: ta.amount_cny || '',
      }))
    } else {
      endForm.value.trader_assignments = []
    }
  }
})

// History = all sessions except active
const historySessions = computed(() => allSessions.value.filter(s => s.status !== 'Active'))

const { pageSize, setPageSize } = usePageSize('sessions', 10)
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(historyTotalItems.value / pageSize.value)))
const paginatedItems = computed(() => historySessions.value)

function goToPage(page) {
  const p = Math.max(1, Math.min(page, totalPages.value))
  if (p !== currentPage.value) currentPage.value = p
}

function roleBadge(role) {
  const map = {
    Chief: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    Payment: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    Receiving: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    Purchasing: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
  }
  return map[role] || 'bg-gray-200/50 text-gray-400'
}

function roleLabel(role) {
  const map = { Chief: 'Trưởng', Payment: 'ShiftPayment', Receiving: 'Thu', Purchasing: 'Chi' }
  return map[role] || role || '—'
}

function chiefDisplayName(chiefUser) {
  if (!chiefUser) return '—'
  return chiefUser.split(',').map(email => {
    const u = chiefUsers.value.find(c => c.email === email.trim())
    return u ? u.full_name : email.trim()
  }).join(' & ')
}

let fetchId = 0
async function loadData() {
  const id = ++fetchId
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const historyFilters = [['status', '!=', 'Active']]
    const sessionFields = ['name', 'started_at', 'ended_at', 'status', 'chief_user', 'payment_user']

    const [historyList, historyCount, activeList, gcList, usersWithRoles] = await Promise.all([
      getList('Cashier Session', { fields: sessionFields, filters: historyFilters, limit: pageSize.value, offset, order_by: 'started_at desc' }),
      frappeCall('frappe.client.get_count', { doctype: 'Cashier Session', filters: historyFilters }),
      getList('Cashier Session', { fields: sessionFields, filters: [['status', '=', 'Active']], limit: 1 }),
      getList('Game Context', { fields: ['name', 'game_title', 'server'], filters: [['is_active', '=', 1]], limit: 200 }),
      frappeCall('gege_custom.gege_custom.utils.get_users_with_roles'),
    ])
    allSessions.value = historyList
    historyTotalItems.value = historyCount || 0
    activeSession.value = activeList[0] || null

    if (activeSession.value) {
      try {
        sessionDetails.value = await frappeCall('gege_custom.gege_custom.doctype.cashier_session.cashier_session.get_active_session_details')
      } catch (e) { /* ignore */ }
    }

    const withName = u => ({ email: u.email, full_name: u.full_name || u.email })
    chiefUsers.value = usersWithRoles.filter(u => u.roles.includes('Chief Accountant')).map(withName)
    // Auto-set chief_user to comma-separated list of all Chief Accountants
    startForm.value.chief_user = chiefUsers.value.map(u => u.email).join(', ')
    paymentUsers.value = usersWithRoles.filter(u => u.roles.some(r => ['Payment Accountant', 'Management Accountant', 'Chief Accountant'].includes(r))).map(withName)
    traderUsers.value = usersWithRoles.filter(u => u.roles.some(r => ['Trader1', 'Trader2'].includes(r))).map(withName)
    gameContexts.value = gcList
  } catch (e) {
    if (fetchId !== id) return
    console.error('Failed to load:', e)
  } finally {
    if (fetchId !== id) return
    loading.value = false
  }
}

function addTraderAssignment() {
  if (!newTrader.value.trader_user || !newTrader.value.game_context) return
  if (!newTrader.value.amount_vnd && !newTrader.value.amount_usd && !newTrader.value.amount_cny) return
  // Check duplicate
  const exists = startForm.value.trader_assignments.find(
    ta => ta.trader_user === newTrader.value.trader_user && ta.game_context === newTrader.value.game_context
  )
  if (exists) return
  startForm.value.trader_assignments.push({ trader_user: newTrader.value.trader_user, game_context: newTrader.value.game_context, amount_vnd: newTrader.value.amount_vnd, amount_usd: newTrader.value.amount_usd, amount_cny: newTrader.value.amount_cny })
  newTrader.value = { trader_user: '', trader_search: '', trader_focus: false, game_context: '', amount_vnd: '', amount_usd: '', amount_cny: '' }
}

function addEndTraderAssignment() {
  if (!endNewTrader.value.trader_user || !endNewTrader.value.game_context) return
  const exists = endForm.value.trader_assignments.find(
    ta => ta.trader_user === endNewTrader.value.trader_user && ta.game_context === endNewTrader.value.game_context
  )
  if (exists) return
  endForm.value.trader_assignments.push({ trader_user: endNewTrader.value.trader_user, game_context: endNewTrader.value.game_context, amount_vnd: endNewTrader.value.amount_vnd, amount_usd: endNewTrader.value.amount_usd, amount_cny: endNewTrader.value.amount_cny })
  endNewTrader.value = { trader_user: '', game_context: '', amount_vnd: '', amount_usd: '', amount_cny: '' }
}

async function startSession() {
  startError.value = ''
  if (!startForm.value.payment_user) {
    startError.value = 'Vui lòng chọn Kế toán payment'
    return
  }
  if (startForm.value.chief_user.split(',').map(s => s.trim()).includes(startForm.value.payment_user)) {
    startError.value = 'Kế toán trưởng và Kế toán payment phải là 2 người khác nhau'
    return
  }
  // Validate trader assignments have amounts
  for (const ta of startForm.value.trader_assignments) {
    const total = Number(ta.amount_vnd || 0) + Number(ta.amount_usd || 0) + Number(ta.amount_cny || 0)
    if (!total) {
      startError.value = `Trader ${ta.trader_user} chưa nhập số tiền cho game context ${ta.game_context}`
      return
    }
  }
  starting.value = true
  try {
    await frappeCall('gege_custom.gege_custom.doctype.cashier_session.cashier_session.start_session', {
      chief_user: startForm.value.chief_user,
      payment_user: startForm.value.payment_user,
      chief_amount_vnd: startForm.value.chief_amount_vnd || 0,
      chief_amount_usd: startForm.value.chief_amount_usd || 0,
      chief_amount_cny: startForm.value.chief_amount_cny || 0,
      payment_amount_vnd: startForm.value.payment_amount_vnd || 0,
      payment_amount_usd: startForm.value.payment_amount_usd || 0,
      payment_amount_cny: startForm.value.payment_amount_cny || 0,
      trader_assignments: startForm.value.trader_assignments.length > 0 ? JSON.stringify(startForm.value.trader_assignments) : null,
    })
    success('Đã bắt đầu phiên')
    showStartModal.value = false
    const chiefUserValue = startForm.value.chief_user
    startForm.value = { chief_user: chiefUserValue, chief_search: '', chief_focus: false, payment_user: '', payment_search: '', payment_focus: false, chief_amount_vnd: '', chief_amount_usd: '', chief_amount_cny: '', payment_amount_vnd: '', payment_amount_usd: '', payment_amount_cny: '', trader_assignments: [] }
    await loadData()
  } catch (e) {
    startError.value = (e.message || 'Có lỗi xảy ra, vui lòng thử lại').replace(/<[^>]*>/g, '').trim()
  } finally {
    starting.value = false
  }
}

async function endSession() {
  endError.value = ''
  const scenario = endForm.value.scenario
  if (scenario === 'handoff' && !endForm.value.handoff_to) {
    endError.value = 'Vui lòng chọn Kế toán ShiftPayment mới cho ca tiếp theo'
    return
  }
  // Validate handoff trader assignments have amounts
  if (scenario === 'handoff') {
    for (const ta of endForm.value.trader_assignments) {
      const total = Number(ta.amount_vnd || 0) + Number(ta.amount_usd || 0) + Number(ta.amount_cny || 0)
      if (!total) {
        endError.value = `Trader ${ta.trader_user} chưa nhập số tiền cho game context ${ta.game_context}`
        return
      }
    }
  }
  ending.value = true
  try {
    const params = {
      session_name: activeSession.value.name,
    }
    if (scenario === 'close_all') {
      params.return_payment = 1
      params.return_chief = 1
      params.deposit_sell = 0
    } else {
      params.return_payment = 1
      params.return_chief = 0
      params.deposit_sell = endForm.value.deposit_sell ? 1 : 0
      params.handoff_to = endForm.value.handoff_to
      if (endForm.value.trader_assignments.length > 0) {
        params.trader_assignments = JSON.stringify(endForm.value.trader_assignments)
      }
    }
    await frappeCall('gege_custom.gege_custom.doctype.cashier_session.cashier_session.end_session', params)
    success(scenario === 'handoff' ? 'Đã bàn giao & kết thúc phiên' : 'Đã kết thúc phiên')
    showEndModal.value = false
    endForm.value = { scenario: 'close_all', handoff_to: '', deposit_sell: false, trader_assignments: [] }
    await loadData()
  } catch (e) {
    endError.value = (e.message || 'Có lỗi xảy ra, vui lòng thử lại').replace(/<[^>]*>/g, '').trim()
  } finally {
    ending.value = false
  }
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN')
}

function fmtInput(v) {
  if (!v && v !== 0) return ''
  return Number(v).toLocaleString('vi-VN')
}

function parseAmount(val) {
  const num = Number(String(val).replace(/\D/g, ''))
  return num || ''
}

async function toggleSessionDetail(name) {
  if (expandedSession.value === name) {
    expandedSession.value = null
    return
  }
  expandedSession.value = name
  if (sessionDetailCache.value[name]) return
  loadingDetail.value = true
  try {
    sessionDetailCache.value[name] = await frappeCall('gege_custom.gege_custom.doctype.cashier_session.cashier_session.get_session_details', { session_name: name })
  } catch (e) {
    console.error('Failed to load session detail:', e)
  } finally {
    loadingDetail.value = false
  }
}

onMounted(loadData)

watch([currentPage, pageSize], () => loadData())
</script>
