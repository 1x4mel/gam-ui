<template>
  <div class="h-full">
  <PaginatedListLayout self-scroll :total-items="0">
    <template #header>
    <!-- Header -->
    <PageHeader
      title="Tồn kho"
      subtitle="Tổng quan tồn kho theo Item / Tài khoản"
      :connected="connected"
      @refresh="loadData"
    >
      <template #actions>
        <AppButton variant="neutral" size="md" @click="openAdjustment">+ Điều chỉnh</AppButton>
        <AppButton variant="primary" size="md" @click="openTransfer">+ Chuyển kho</AppButton>
        <AppButton variant="warning-ghost" size="md" @click="openConversion">Conversion</AppButton>
      </template>
    </PageHeader>
    </template>
    <template #filters>
      <div class="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-hidden">
        <!-- Search -->
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm tài khoản, item hoặc context..."
          class="px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary placeholder-app-text-muted/80 outline-none focus:border-indigo-500 transition w-full sm:w-64 shadow-sm"
        />

        <!-- Context Filter -->
        <select
          v-model="searchContext"
          class="px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
        >
          <option value="">Tất cả Context</option>
          <option v-for="ctx in contextOptions" :key="ctx" :value="ctx">{{ ctx }}</option>
        </select>

        <!-- Game Tabs (Underline Style) -->
        <UnderlineTab
          v-model="activeGame"
          :tabs="gameTabs"
          class="mb-2"
        />
      </div>
    </template>
    <div class="h-full overflow-auto custom-scrollbar">
      <!-- No data -->
      <EmptyState v-if="currentItems.length === 0" icon="📦" text="Chưa có dữ liệu tồn kho" />

      <template v-else>
        <!-- Summary Stats (only show when no game filter) -->
        <div v-if="!activeGame" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div class="bg-app-surface border border-app-border rounded-xl px-4 py-3">
            <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest opacity-60 mb-1">Loại item</p>
            <p class="text-app-text-primary font-black text-lg font-mono">{{ summary.totalItemTypes }}</p>
          </div>
          <div class="bg-app-surface border border-app-border rounded-xl px-4 py-3">
            <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest opacity-60 mb-1">Tài khoản</p>
            <p class="text-app-text-primary font-black text-lg font-mono">{{ summary.totalAccounts }}</p>
          </div>
          <div class="bg-app-surface border border-app-border rounded-xl px-4 py-3">
            <p class="text-[9px] font-black text-emerald-600 uppercase tracking-widest opacity-80 mb-1">Sẵn sàng</p>
            <p class="text-emerald-600 font-black text-lg font-mono">{{ formatQty(summary.totalAvailable) }}</p>
          </div>
          <div class="bg-app-surface border border-app-border rounded-xl px-4 py-3">
            <p class="text-[9px] font-black text-yellow-600 uppercase tracking-widest opacity-80 mb-1">Đang giữ</p>
            <p class="text-yellow-600 font-black text-lg font-mono">{{ formatQty(summary.totalLocked) }}</p>
          </div>
        </div>

        <!-- When game is selected: list items directly -->
        <div v-if="activeGame" class="space-y-2">
          <div
            v-for="item in currentItems"
            :key="item.currency_item"
            :class="['bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden', expandedItems.has(item.currency_item) ? 'border-indigo-500/30' : '']"
          >
            <button
              @click="toggleItem(item.currency_item)"
              class="w-full px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-3 text-left hover:bg-indigo-600/[0.02] transition-colors"
            >
              <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                <span :class="['text-[10px] text-app-text-muted transition-transform duration-200', expandedItems.has(item.currency_item) ? 'rotate-90' : '']">&#9654;</span>
                <span class="text-app-text-primary font-black text-sm tracking-tight truncate">{{ item.item_name }}</span>
                <span class="text-[9px] font-black text-app-text-muted uppercase tracking-widest bg-app-bg/50 px-2 py-0.5 rounded-full border border-app-border shrink-0">{{ item.game_title }}</span>
              </div>
              <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                <span class="text-[10px] font-black font-mono bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-lg">{{ formatQty(item.total_available) }}</span>
                <span v-if="item.total_locked > 0" class="text-[10px] font-black font-mono bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-lg">{{ formatQty(item.total_locked) }}</span>
                <span v-if="avgCost[item.currency_item]" class="text-[10px] font-black font-mono text-indigo-600 bg-indigo-500/5 px-2 py-0.5 rounded-lg">{{ formatMoney(avgCost[item.currency_item], 'VND') }}</span>
                <span class="text-[10px] text-app-text-muted font-bold">{{ item.accounts.length }} TK</span>
              </div>
            </button>
            <div v-if="expandedItems.has(item.currency_item)" class="border-t border-app-border/50">
              <!-- Mobile Cards -->
              <div class="md:hidden divide-y divide-app-border/30">
                <div v-for="acc in item.accounts" :key="acc.game_account" class="px-4 py-3 pl-10">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-app-text-primary font-bold text-sm">{{ resolveAccount(acc.game_account) }}</span>
                    <span class="text-app-text-muted text-[10px] font-mono">{{ acc.lotCount }} lots</span>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <p class="text-[8px] text-app-text-muted font-black uppercase tracking-widest opacity-40 mb-0.5">Sẵn sàng</p>
                      <span :class="['font-mono font-bold text-sm', acc.qty_available > 0 ? 'text-emerald-600' : 'text-app-text-muted opacity-60']">{{ formatQty(acc.qty_available) }}</span>
                    </div>
                    <div>
                      <p class="text-[8px] text-app-text-muted font-black uppercase tracking-widest opacity-40 mb-0.5">Đang giữ</p>
                      <span :class="['font-mono font-bold text-sm', acc.qty_locked > 0 ? 'text-yellow-600' : 'text-app-text-muted opacity-50']">{{ formatQty(acc.qty_locked) }}</span>
                    </div>
                    <div>
                      <p class="text-[8px] text-app-text-muted font-black uppercase tracking-widest opacity-40 mb-0.5">Tổng</p>
                      <span class="font-mono font-bold text-sm text-app-text-primary">{{ formatQty(acc.qty_available + acc.qty_locked) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Desktop Table -->
              <table class="hidden md:table w-full text-sm">
                <thead>
                  <tr class="text-app-text-muted text-[9px] font-black uppercase tracking-[0.2em] bg-app-bg/10">
                    <th class="text-left px-4 sm:px-6 py-2">Tài khoản</th>
                    <th class="text-right px-4 py-2 w-28">Sẵn sàng</th>
                    <th class="text-right px-4 py-2 w-28">Đang giữ</th>
                    <th class="text-right px-4 py-2 w-28">Tổng</th>
                    <th class="text-right px-4 py-2 w-20">Lots</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-app-border/30">
                  <tr
                    v-for="acc in item.accounts"
                    :key="acc.game_account"
                    class="hover:bg-indigo-600/[0.02] transition-colors"
                  >
                    <td class="px-4 sm:px-6 py-2.5">
                      <span class="text-app-text-primary font-bold">{{ resolveAccount(acc.game_account) }}</span>
                    </td>
                    <td class="text-right px-4 py-2.5 font-mono">
                      <span :class="acc.qty_available > 0 ? 'text-emerald-600 font-black' : 'text-app-text-muted opacity-60'">{{ formatQty(acc.qty_available) }}</span>
                    </td>
                    <td class="text-right px-4 py-2.5 font-mono">
                      <span :class="acc.qty_locked > 0 ? 'text-yellow-600 font-bold' : 'text-app-text-muted opacity-50'">{{ formatQty(acc.qty_locked) }}</span>
                    </td>
                    <td class="text-right px-4 py-2.5 font-mono text-app-text-primary font-bold">{{ formatQty(acc.qty_available + acc.qty_locked) }}</td>
                    <td class="text-right px-4 py-2.5 text-app-text-muted font-bold font-mono opacity-60">{{ acc.lotCount }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="item.accounts.length === 0" class="px-4 sm:px-8 py-4 text-center text-app-text-muted text-sm">
                Không có tài khoản nào
              </div>
            </div>
          </div>
        </div>

        <!-- When no game selected: group by game title -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            v-for="game in gameSummary"
            :key="game.title"
            class="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden"
          >
            <div class="px-4 py-3 bg-app-bg/30 border-b border-app-border flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm">{{ game.icon }}</span>
                <span class="text-app-text-primary font-black text-sm tracking-tight">{{ game.title }}</span>
              </div>
              <div class="flex items-center gap-2 text-[10px] font-black">
                <span class="text-emerald-600 font-mono">{{ formatQty(game.totalAvailable) }}</span>
                <span v-if="game.totalLocked > 0" class="text-yellow-600 font-mono">{{ formatQty(game.totalLocked) }}</span>
                <span class="text-app-text-muted opacity-60">{{ game.totalItemTypes }} items / {{ game.totalAccounts }} TK</span>
              </div>
            </div>
            <div class="divide-y divide-app-border/30 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div v-for="item in game.items" :key="item.currency_item">
                <button
                  @click="toggleItem(item.currency_item)"
                  class="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-indigo-600/[0.02] transition-colors"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span :class="['text-[9px] text-app-text-muted transition-transform duration-200', expandedItems.has(item.currency_item) ? 'rotate-90' : '']">&#9654;</span>
                    <span class="text-app-text-primary font-bold text-xs truncate">{{ item.item_name }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[10px] font-black font-mono text-emerald-600">{{ formatQty(item.total_available) }}</span>
                    <span class="text-[9px] text-app-text-muted opacity-60">{{ item.accounts.length }}TK</span>
                    <span v-if="avgCost[item.currency_item]" class="text-[10px] font-black font-mono text-indigo-600">{{ formatMoney(avgCost[item.currency_item], 'VND') }}</span>
                  </div>
                </button>
                <div v-if="expandedItems.has(item.currency_item)" class="border-t border-app-border/30 bg-app-bg/20">
                  <div v-for="acc in item.accounts" :key="acc.game_account" class="px-4 py-2 pl-8 flex items-center justify-between text-xs">
                    <span class="text-app-text-primary font-bold">{{ resolveAccount(acc.game_account) }}</span>
                    <div class="flex items-center gap-2 font-mono">
                      <span :class="acc.qty_available > 0 ? 'text-emerald-600 font-bold' : 'text-app-text-muted opacity-50'">{{ formatQty(acc.qty_available) }}</span>
                      <span v-if="acc.qty_locked > 0" class="text-yellow-600 font-bold">{{ formatQty(acc.qty_locked) }}</span>
                      <span class="text-app-text-muted opacity-40 text-[10px]">{{ acc.lotCount }}L</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </PaginatedListLayout>

  <!-- Adjustment Modal -->
      <ModalWrapper v-model="showAdjustment" size="md" radius="2xl sm:[2.5rem]" :z-index="50">
        <div class="p-4 sm:p-10 max-h-[90vh] overflow-y-auto">
          <h3 class="text-app-text-primary font-black mb-4 sm:mb-8 text-base sm:text-xl flex items-center gap-3 sm:gap-4 uppercase tracking-tight">
            <span class="p-2 sm:p-3 bg-indigo-500/10 rounded-xl sm:rounded-2xl">&#9878;&#65039;</span>
            <span>Điều chỉnh tồn kho</span>
          </h3>
          <div class="space-y-6">
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Ngữ cảnh Game</label>
              <select v-model="adjForm.game_context" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer">
                <option value="">Chọn Context</option>
                <option v-for="ctx in distinctContexts" :key="ctx" :value="ctx">{{ contextLabel(ctx) }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Tài khoản game</label>
              <select v-model="adjForm.game_account" :disabled="!adjForm.game_context" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer disabled:opacity-40">
                <option value="">Chọn Account</option>
                <option v-for="acc in adjAccounts" :key="acc" :value="acc">{{ acc }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Mặt hàng</label>
              <select v-model="adjForm.currency_item" :disabled="!adjForm.game_account" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer disabled:opacity-40">
                <option value="">Chọn Item</option>
                <option v-for="ci in adjItems" :key="ci" :value="ci">{{ currencyItemMap[ci]?.item_name || ci }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Số lượng (+ thêm, - bớt)</label>
              <input type="number" v-model="adjForm.qty" placeholder="Ví dụ: -500 hoặc 1000" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-black" />
              <p v-if="adjAvailable !== null" class="text-xs text-app-text-muted mt-1 ml-1">Hiện có: <span class="text-indigo-400 font-bold">{{ adjAvailable }}</span></p>
            </div>
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Ghi chú (Bắt buộc)</label>
              <textarea v-model="adjForm.note" placeholder="Lý do điều chỉnh..." rows="3" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm resize-none outline-none focus:border-indigo-600 transition-all font-medium leading-relaxed"></textarea>
            </div>
          </div>
          <div class="flex flex-wrap justify-end gap-3 mt-4 sm:mt-10">
            <AppButton variant="neutral" size="md" @click="showAdjustment = false">Huỷ</AppButton>
            <AppButton variant="primary" size="lg" :loading="submitting" :disabled="submitting" @click="submitAdjustment">Áp dụng điều chỉnh</AppButton>
          </div>
        </div>
      </ModalWrapper>

      <!-- Transfer Modal -->
      <ModalWrapper v-model="showTransfer" size="md" radius="2xl sm:[2.5rem]" :z-index="50">
        <div class="p-4 sm:p-10 max-h-[90vh] overflow-y-auto">
          <h3 class="text-app-text-primary font-black mb-4 sm:mb-8 text-base sm:text-xl flex items-center gap-3 sm:gap-4 uppercase tracking-tight">
            <span class="p-2 sm:p-3 bg-emerald-500/10 rounded-xl sm:rounded-2xl">&#128260;</span>
            <span>Chuyển kho</span>
          </h3>
          <div class="space-y-6">
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Ngữ cảnh Game</label>
              <select v-model="tfForm.game_context" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer">
                <option value="">Chọn Context trước</option>
                <option v-for="ctx in distinctContexts" :key="ctx" :value="ctx">{{ contextLabel(ctx) }}</option>
              </select>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Từ Account</label>
                <select v-model="tfForm.source_account" :disabled="!tfForm.game_context" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer disabled:opacity-40">
                  <option value="">Nguồn</option>
                  <option v-for="acc in tfAccounts.filter(a => a !== tfForm.target_account)" :key="acc" :value="acc">{{ acc }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Đến Account</label>
                <select v-model="tfForm.target_account" :disabled="!tfForm.game_context" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer disabled:opacity-40">
                  <option value="">Đích</option>
                  <option v-for="acc in tfAccounts.filter(a => a !== tfForm.source_account)" :key="acc" :value="acc">{{ acc }}</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Mặt hàng</label>
              <select v-model="tfForm.currency_item" :disabled="!tfForm.source_account" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer disabled:opacity-40">
                <option value="">Chọn Item</option>
                <option v-for="ci in tfItems" :key="ci" :value="ci">{{ currencyItemMap[ci]?.item_name || ci }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Số lượng chuyển</label>
              <input type="number" v-model="tfForm.qty" placeholder="Ví dụ: 1000" min="0" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-black" />
              <p v-if="tfAvailable !== null" class="text-xs text-app-text-muted mt-1 ml-1">Hiện có: <span class="text-indigo-400 font-bold">{{ tfAvailable }}</span></p>
            </div>
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Ghi chú (Tùy chọn)</label>
              <textarea v-model="tfForm.note" placeholder="Thêm lý do chuyển kho..." rows="1" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm resize-none outline-none focus:border-indigo-600 transition-all font-medium"></textarea>
            </div>
          </div>
          <div class="flex flex-wrap justify-end gap-3 mt-4 sm:mt-10">
            <AppButton variant="neutral" size="md" @click="showTransfer = false">Huỷ</AppButton>
            <AppButton variant="success" size="lg" :loading="submitting" :disabled="submitting" @click="submitTransfer">Xác nhận chuyển</AppButton>
          </div>
        </div>
      </ModalWrapper>

      <!-- Conversion Modal -->
      <ModalWrapper v-model="showConversion" size="md" radius="2xl sm:[2.5rem]" :z-index="50">
        <div class="p-4 sm:p-10 max-h-[90vh] overflow-y-auto">
          <h3 class="text-app-text-primary font-black mb-4 sm:mb-8 text-base sm:text-xl flex items-center gap-3 sm:gap-4 uppercase tracking-tight">
            <span class="p-2 sm:p-3 bg-amber-500/10 rounded-xl sm:rounded-2xl">&#128260;</span>
            <span>Conversion (Đổi Currency)</span>
          </h3>
          <div class="space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Ngữ cảnh Game</label>
                <SearchableSelect
                  v-model="cvForm.game_context"
                  :options="cvContextOptions"
                  placeholder="Chọn Context"
                />
              </div>
              <div>
                <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Tài khoản game</label>
                <SearchableSelect
                  v-model="cvForm.game_account"
                  :options="cvAccountOptions"
                  placeholder="Chọn Account"
                  :disabled="!cvForm.game_context"
                />
              </div>
            </div>

            <!-- Consumed Items -->
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Tiêu hao (Từ)</label>
              <div class="space-y-2">
                <div v-for="(row, idx) in cvForm.consumed" :key="idx" class="flex items-center gap-2">
                  <SearchableSelect
                    v-model="row.currency_item"
                    :options="cvConsumedItemOptions"
                    placeholder="Chọn Item"
                    compact
                    class="flex-1"
                  />
                  <input type="number" v-model="row.qty" placeholder="SL" min="1" class="w-24 bg-app-surface border border-app-border rounded-xl px-3 py-2 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-black" />
                  <span v-if="row.currency_item && cvAvailable[row.currency_item] !== undefined" class="text-xs text-app-text-muted whitespace-nowrap">có <span class="text-indigo-400 font-bold">{{ cvAvailable[row.currency_item] }}</span></span>
                  <button v-if="cvForm.consumed.length > 1" @click="cvForm.consumed.splice(idx, 1)" class="text-red-400 hover:text-red-600 text-lg font-bold px-1">&times;</button>
                </div>
                <button @click="cvForm.consumed.push({ currency_item: '', qty: '' })" class="text-indigo-500 text-xs font-bold hover:underline">+ Thêm item tiêu hao</button>
              </div>
            </div>

            <!-- Arrow -->
            <div class="flex justify-center text-app-text-muted text-2xl">&#11015;</div>

            <!-- Output Items -->
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Kết quả (Đến)</label>
              <div class="space-y-2">
                <div v-for="(row, idx) in cvForm.output" :key="idx" class="flex items-center gap-2">
                  <SearchableSelect
                    v-model="row.currency_item"
                    :options="cvOutputItemOptions"
                    placeholder="Chọn Item đích"
                    compact
                    class="flex-1"
                  />
                  <input type="number" v-model="row.qty" placeholder="SL" min="1" class="w-24 bg-app-surface border border-app-border rounded-xl px-3 py-2 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-black" />
                  <button v-if="cvForm.output.length > 1" @click="cvForm.output.splice(idx, 1)" class="text-red-400 hover:text-red-600 text-lg font-bold px-1">&times;</button>
                </div>
                <button @click="cvForm.output.push({ currency_item: '', qty: '' })" class="text-indigo-500 text-xs font-bold hover:underline">+ Thêm item kết quả</button>
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Ghi chú (Tùy chọn)</label>
              <textarea v-model="cvForm.note" placeholder="Ghi chú..." rows="2" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm resize-none outline-none focus:border-indigo-600 transition-all font-medium leading-relaxed"></textarea>
            </div>
          </div>
          <div class="flex flex-wrap justify-end gap-3 mt-4 sm:mt-10">
            <AppButton variant="neutral" size="md" @click="showConversion = false">Huỷ</AppButton>
            <AppButton variant="primary" size="lg" :loading="submitting" :disabled="submitting" @click="submitConversion">Xác nhận Conversion</AppButton>
          </div>
        </div>
      </ModalWrapper>
  </div>
</template>

<script setup>
defineOptions({ name: 'InventoryView' })
import { ref, computed, watch, onActivated } from 'vue'
import { getList, createDoc, frappeCall } from '../api/index.js'
import PageHeader from '../components/PageHeader.vue'
import AppButton from '../components/AppButton.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import EmptyState from '../components/EmptyState.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { formatQty, formatMoney, gameIcon, GAME_TITLES } from '../utils/format.js'
import { useUrlSync } from '../composables/useOrderUrlSync.js'
import { syncArray } from '../utils/sync.js'
import { useNotify } from '../composables/useNotify.js'
import { useMetadata } from '../composables/useMetadata.js'
import { debounce } from 'lodash-es'

const { success, error, warn } = useNotify()
const {
  gameAccounts,
  fetchMetadata,
  currencyItemMap,
  contextMap,
} = useMetadata()

const loading = ref(false)
const activeGame = ref('')
const expandedItems = ref(new Set())
const positions = ref([])
const avgCost = ref({})
const searchContext = ref('')
const searchQuery = ref('')

useUrlSync({
  routeNames: ['InventoryView'],
  params: { activeGame, searchContext, searchQuery },
  queryMap: { activeGame: 'game', searchContext: 'ctx', searchQuery: 'q' },
  defaults: { activeGame: '' },
})

const showAdjustment = ref(false)
const showTransfer = ref(false)
const showConversion = ref(false)
const submitting = ref(false)
const adjForm = ref({ game_context: '', game_account: '', currency_item: '', qty: '', note: '' })
const tfForm = ref({ source_account: '', target_account: '', game_context: '', currency_item: '', qty: '', note: '' })
const cvForm = ref({ game_context: '', game_account: '', consumed: [{ currency_item: '', qty: '' }], output: [{ currency_item: '', qty: '' }], note: '' })

// Account name resolver
const accountNameMap = computed(() => {
  const map = {}
  for (const acc of gameAccounts.value) {
    map[acc.name] = acc.account_name || acc.name
  }
  return map
})

function resolveAccount(name) {
  return accountNameMap.value[name] || name
}

// Game tabs: first item is "Tổng quan" (empty key = show all)
const gameTabs = computed(() => [
  { key: '', label: 'Tổng quan' },
  ...GAME_TITLES.map(g => ({ key: g, label: g, icon: gameIcon(g) })),
])

const contextOptions = computed(() => {
  const labels = new Set()
  for (const pos of positions.value) {
    const ci = currencyItemMap.value[pos.currency_item]
    if (ci && !(activeGame.value && ci.game_title !== activeGame.value) && pos.game_context) {
      labels.add(contextLabel(pos.game_context))
    }
  }
  return [...labels].sort()
})

// Main data: group by currency_item -> accounts
const currentItems = computed(() => {
  const filtered = positions.value.filter(p => {
    const ci = currencyItemMap.value[p.currency_item]
    if (!ci || (activeGame.value && ci.game_title !== activeGame.value)) return false
    if (searchContext.value) {
      if (contextLabel(p.game_context) !== searchContext.value) return false
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const searchParts = [ci.item_name || p.currency_item, accountNameMap.value[p.game_account] || p.game_account, String(p.qty_available || 0), String(p.qty_locked || 0)]
      if (!searchParts.join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  const itemGroups = {}
  for (const pos of filtered) {
    const key = pos.currency_item
    if (!itemGroups[key]) {
      const ci = currencyItemMap.value[key] || {}
      itemGroups[key] = {
        currency_item: key,
        item_name: ci.item_name || key,
        game_title: ci.game_title || '',
        accounts: [],
        total_available: 0,
        total_locked: 0,
      }
    }
    const group = itemGroups[key]
    let accEntry = group.accounts.find(a => a.game_account === pos.game_account)
    if (!accEntry) {
      accEntry = { game_account: pos.game_account, qty_available: 0, qty_locked: 0, lotCount: 0 }
      group.accounts.push(accEntry)
    }
    accEntry.qty_available += Number(pos.qty_available || 0)
    accEntry.qty_locked += Number(pos.qty_locked || 0)
    accEntry.lotCount += 1
    group.total_available += Number(pos.qty_available || 0)
    group.total_locked += Number(pos.qty_locked || 0)
  }

  return Object.values(itemGroups).sort((a, b) => {
    if (a.game_title === b.game_title) return a.item_name.localeCompare(b.item_name)
    return a.game_title.localeCompare(b.game_title)
  })
})

function toggleItem(key) {
  if (expandedItems.value.has(key)) {
    expandedItems.value.delete(key)
  } else {
    expandedItems.value.add(key)
  }
  expandedItems.value = new Set(expandedItems.value)
}

watch(activeGame, () => {
  expandedItems.value = new Set()
})

const summary = computed(() => {
  let totalAccounts = 0
  let totalItemTypes = 0
  let totalAvailable = 0
  let totalLocked = 0
  const seenAccounts = new Set()
  for (const item of currentItems.value) {
    totalItemTypes++
    totalAvailable += item.total_available
    totalLocked += item.total_locked
    for (const acc of item.accounts) {
      if (!seenAccounts.has(acc.game_account)) {
        seenAccounts.add(acc.game_account)
        totalAccounts++
      }
    }
  }
  return { totalAccounts, totalItemTypes, totalAvailable, totalLocked }
})

// Game summary for non-filtered view
const gameSummary = computed(() => {
  return GAME_TITLES.map(title => {
    const items = currentItems.value.filter(i => i.game_title === title)
    let totalAvailable = 0
    let totalLocked = 0
    const seenAccounts = new Set()
    for (const item of items) {
      totalAvailable += item.total_available
      totalLocked += item.total_locked
      for (const acc of item.accounts) seenAccounts.add(acc.game_account)
    }
    return {
      title,
      icon: gameIcon(title),
      items,
      totalAvailable,
      totalLocked,
      totalItemTypes: items.length,
      totalAccounts: seenAccounts.size,
    }
  }).filter(g => g.items.length > 0)
})

function contextLabel(ctx) {
  const info = contextMap.value[ctx] || {}
  if (info.game_title && info.season_or_league) {
    return `${info.game_title} - ${info.season_or_league}`
  }
  if (info.game_title) return info.game_title
  if (info.season_or_league) return info.season_or_league
  return ctx
}

const distinctContexts = computed(() => {
  const set = new Set()
  positions.value.forEach(p => {
    const ci = currencyItemMap.value[p.currency_item]
    if (ci && (!activeGame.value || ci.game_title === activeGame.value) && p.game_context) set.add(p.game_context)
  })
  return Array.from(set).sort()
})

function getQtyAvailable(context, account, currencyItem) {
  return positions.value
    .filter(p => p.game_context === context && p.game_account === account && p.currency_item === currencyItem)
    .reduce((sum, p) => sum + Number(p.qty_available || 0), 0)
}

const adjAvailable = computed(() => {
  const { game_context, game_account, currency_item } = adjForm.value
  if (!game_context || !game_account || !currency_item) return null
  return getQtyAvailable(game_context, game_account, currency_item)
})
const tfAvailable = computed(() => {
  const { game_context, source_account, currency_item } = tfForm.value
  if (!game_context || !source_account || !currency_item) return null
  return getQtyAvailable(game_context, source_account, currency_item)
})
const cvAvailable = computed(() => {
  const { game_context, game_account } = cvForm.value
  if (!game_context || !game_account) return {}
  const map = {}
  positions.value.forEach(p => {
    if (p.game_context === game_context && p.game_account === game_account && p.currency_item) {
      map[p.currency_item] = (map[p.currency_item] || 0) + Number(p.qty_available || 0)
    }
  })
  return map
})

const adjItems = computed(() => {
  if (!adjForm.value.game_context || !adjForm.value.game_account) return []
  const set = new Set()
  positions.value.forEach(p => {
    if (p.game_context === adjForm.value.game_context && p.game_account === adjForm.value.game_account && p.currency_item) set.add(p.currency_item)
  })
  return Array.from(set).sort()
})
const adjAccounts = computed(() => {
  if (!adjForm.value.game_context) return []
  const set = new Set()
  positions.value.forEach(p => {
    if (p.game_context === adjForm.value.game_context && p.game_account) set.add(p.game_account)
  })
  return Array.from(set).sort()
})
const tfItems = computed(() => {
  if (!tfForm.value.game_context || !tfForm.value.source_account) return []
  const set = new Set()
  positions.value.forEach(p => {
    if (p.game_context === tfForm.value.game_context && p.game_account === tfForm.value.source_account && p.currency_item) set.add(p.currency_item)
  })
  return Array.from(set).sort()
})
const tfAccounts = computed(() => {
  if (!tfForm.value.game_context) return []
  const set = new Set()
  positions.value.forEach(p => {
    if (p.game_context === tfForm.value.game_context && p.game_account) set.add(p.game_account)
  })
  return Array.from(set).sort()
})

watch(() => adjForm.value.game_context, () => {
  adjForm.value.currency_item = ''
  adjForm.value.game_account = ''
})
watch(() => adjForm.value.game_account, () => {
  adjForm.value.currency_item = ''
})
watch(() => tfForm.value.game_context, () => {
  tfForm.value.currency_item = ''
  tfForm.value.source_account = ''
  tfForm.value.target_account = ''
})
watch(() => tfForm.value.source_account, () => {
  tfForm.value.currency_item = ''
})

// Conversion computed — SearchableSelect expects [{ label, value }]
const cvContextOptions = computed(() =>
  distinctContexts.value.map(ctx => ({
    label: contextLabel(ctx),
    value: ctx,
  }))
)
const cvAccountOptions = computed(() => {
  if (!cvForm.value.game_context) return []
  const set = new Set()
  positions.value.forEach(p => {
    if (p.game_context === cvForm.value.game_context && p.game_account) set.add(p.game_account)
  })
  return Array.from(set).sort().map(a => ({ label: resolveAccount(a), value: a }))
})
const cvConsumedItemOptions = computed(() => {
  if (!cvForm.value.game_context || !cvForm.value.game_account) return []
  const set = new Set()
  positions.value.forEach(p => {
    if (p.game_context === cvForm.value.game_context && p.game_account === cvForm.value.game_account && p.currency_item && Number(p.qty_available || 0) > 0) set.add(p.currency_item)
  })
  return Array.from(set).sort().map(ci => ({
    label: currencyItemMap.value[ci]?.item_name || ci,
    value: ci,
    description: `${formatQty(positions.value.filter(p => p.game_context === cvForm.value.game_context && p.game_account === cvForm.value.game_account && p.currency_item === ci).reduce((s, p) => s + Number(p.qty_available || 0), 0))} sẵn sàng`,
  }))
})
const cvOutputItemOptions = computed(() => {
  if (!cvForm.value.game_context) return []
  const set = new Set()
  const ctxCi = currencyItemMap.value
  positions.value.forEach(p => {
    if (p.game_context === cvForm.value.game_context && p.currency_item) set.add(p.currency_item)
  })
  Object.entries(ctxCi).forEach(([key, ci]) => {
    if (ci.game_context === cvForm.value.game_context) set.add(key)
  })
  return Array.from(set).sort().map(ci => ({
    label: currencyItemMap.value[ci]?.item_name || ci,
    value: ci,
  }))
})
watch(() => cvForm.value.game_context, () => {
  cvForm.value.game_account = ''
  cvForm.value.consumed = [{ currency_item: '', qty: '' }]
  cvForm.value.output = [{ currency_item: '', qty: '' }]
})
watch(() => cvForm.value.game_account, () => {
  cvForm.value.consumed = [{ currency_item: '', qty: '' }]
})

function openConversion() {
  cvForm.value = { game_context: '', game_account: '', consumed: [{ currency_item: '', qty: '' }], output: [{ currency_item: '', qty: '' }], note: '' }
  showConversion.value = true
}

async function submitConversion() {
  const f = cvForm.value
  if (!f.game_context || !f.game_account) {
    return warn('Chọn Context và Account.')
  }
  const validConsumed = f.consumed.filter(r => r.currency_item && Number(r.qty) > 0)
  const validOutput = f.output.filter(r => r.currency_item && Number(r.qty) > 0)
  if (validConsumed.length === 0) {
    return warn('Phải có ít nhất 1 item tiêu hao với số lượng > 0.')
  }
  if (validOutput.length === 0) {
    return warn('Phải có ít nhất 1 item kết quả với số lượng > 0.')
  }
  for (const row of validConsumed) {
    const avail = positions.value
      .filter(p => p.game_context === f.game_context && p.game_account === f.game_account && p.currency_item === row.currency_item)
      .reduce((sum, p) => sum + Number(p.qty_available || 0), 0)
    if (Number(row.qty) > avail) {
      return warn(`Item ${currencyItemMap.value[row.currency_item]?.item_name || row.currency_item}: số lượng (${row.qty}) vượt tồn kho (${avail}).`)
    }
  }
  submitting.value = true
  try {
    const items_in_consumed = validConsumed.map(r => ({
      doctype: 'Trade Conversion Item',
      side: 'in_consumed',
      currency_item: r.currency_item,
      qty: Number(r.qty),
    }))
    const items_out_final = validOutput.map(r => ({
      doctype: 'Trade Conversion Item',
      side: 'out_final',
      currency_item: r.currency_item,
      qty: Number(r.qty),
    }))
    const doc = await createDoc('Trade Conversion', {
      conversion_type: 'Currency Exchange',
      conversion_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      game_account: f.game_account,
      game_context: f.game_context,
      items_in_consumed,
      items_out_final,
      note: f.note || '',
    })
    await frappeCall('gege_custom.gege_custom.utils.submit_trade_conversion', { name: doc.name })
    showConversion.value = false
    loadData()
    success('Conversion thành công!')
  } catch (e) {
    error('Lỗi: ' + e.message)
  } finally {
    submitting.value = false
  }
}

async function loadData(isBackground = false) {
  if (!isBackground && positions.value.length === 0) {
    loading.value = true
  }
  try {
    const [posData, avgCostData] = await Promise.all([
      getList('Inventory Position', {
        fields: [
          'name', 'game_account', 'currency_item', 'game_context',
          'qty_available', 'qty_locked', 'total_qty', 'last_updated',
        ],
        filters: [['is_active', '=', 1]],
        limit: 0,
      }),
      frappeCall('gege_custom.gege_custom.utils.get_inventory_item_avg_cost').catch(() => ({})),
      fetchMetadata()
    ])

    syncArray(positions.value, posData)
    avgCost.value = avgCostData || {}
  } finally {
    loading.value = false
  }
}

function openAdjustment() {
  adjForm.value = { game_context: '', game_account: '', currency_item: '', qty: '', note: '' }
  showAdjustment.value = true
}

function openTransfer() {
  tfForm.value = { source_account: '', target_account: '', game_context: '', currency_item: '', qty: '', note: '' }
  showTransfer.value = true
}

async function submitAdjustment() {
  const f = adjForm.value
  if (!f.game_context || !f.game_account || !f.currency_item || !f.qty || !f.note) {
    return warn('Vui lòng điền đủ thông tin (kể cả ghi chú).')
  }
  submitting.value = true
  try {
    await createDoc('Inventory Movement', {
      movement_type: 'Adjustment',
      game_context: f.game_context,
      game_account: f.game_account,
      currency_item: f.currency_item,
      qty: Number(f.qty),
      note: f.note
    })
    showAdjustment.value = false
    loadData()
    success('Tạo Adjustment thành công!')
  } catch (e) {
    error('Lỗi: ' + e.message)
  } finally {
    submitting.value = false
  }
}

async function submitTransfer() {
  const f = tfForm.value
  if (!f.source_account || !f.target_account || f.source_account === f.target_account) {
    return warn('Account chuyển và nhận phải khác nhau.')
  }
  if (!f.game_context || !f.currency_item || !f.qty || Number(f.qty) <= 0) {
    return warn('Điền đủ thông tin và số lượng phải lớn hơn 0.')
  }
  const sourceQty = positions.value
    .filter(p => p.game_context === f.game_context && p.game_account === f.source_account && p.currency_item === f.currency_item)
    .reduce((sum, p) => sum + Number(p.qty_available || 0), 0)
  if (Number(f.qty) > sourceQty) {
    return warn(`Số lượng chuyển (${Number(f.qty)}) vượt quá tồn kho nguồn (${sourceQty}).`)
  }
  submitting.value = true
  try {
    await createDoc('Inventory Movement', {
      movement_type: 'Transfer Out',
      game_context: f.game_context,
      game_account: f.source_account,
      currency_item: f.currency_item,
      qty: -Number(f.qty),
      note: f.note ? 'Transfer To ' + f.target_account + ': ' + f.note : 'Transfer To ' + f.target_account
    })
    await createDoc('Inventory Movement', {
      movement_type: 'Transfer In',
      game_context: f.game_context,
      game_account: f.target_account,
      currency_item: f.currency_item,
      qty: Number(f.qty),
      note: f.note ? 'Transfer From ' + f.source_account + ': ' + f.note : 'Transfer From ' + f.source_account
    })
    showTransfer.value = false
    loadData()
    success('Chuyển kho thành công!')
  } catch (e) {
    error('Lỗi: ' + e.message)
  } finally {
    submitting.value = false
  }
}

const debouncedLoadData = debounce(loadData, 2000)

const { connected } = useRealtimeSubscriptions(
  {
    'Inventory Movement': debouncedLoadData,
    'Inventory Position': debouncedLoadData,
  },
  { onMount: loadData }
)

onActivated(async () => {
  loadData(true)
})
</script>
