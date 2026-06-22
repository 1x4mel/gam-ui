<template>
  <div class="w-full flex flex-col h-full">
    <!-- Header (Fixed height) -->
    <div class="flex flex-col gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shrink-0 shadow-sm mx-2 mt-2">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 sm:gap-4 min-w-0">
          <BackButton @click="goBack" />
          <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight whitespace-nowrap">Tạo đơn hàng</h2>
        </div>
        <div class="flex items-center gap-2 sm:gap-4 shrink-0">
          <p v-if="error" class="hidden sm:block text-red-500 text-[9px] font-black uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/10 mb-0">{{ error }}</p>
          <!-- Quick Fill buttons (buy tab only) -->
          <template v-if="tab === 'buy'">
            <AppButton type="button" variant="warning-ghost" size="sm sm:lg"
              :disabled="!defaultPreset"
              @click="applyQuickFill"
              :title="defaultPreset ? 'Quick Fill: ' + defaultPreset.name : 'Chưa có profile Quick Fill'">
              ⚡
            </AppButton>
            <AppButton type="button" variant="ghost" size="sm sm:lg"
              @click="presetModalOpen = true"
              title="Cài đặt Quick Fill">
              ⚙
            </AppButton>
          </template>
          <AppButton type="submit" form="order-form"
            :variant="tab === 'buy' ? 'primary' : 'orange'" size="sm sm:lg"
            :loading="submitting" :disabled="submitting">
            <span class="hidden sm:inline">{{ tab === 'buy' ? '🚀 Tạo đơn nhập' : '🚀 Tạo đơn bán' }}</span>
            <span class="sm:hidden">{{ tab === 'buy' ? '🚀 Nhập' : '🚀 Bán' }}</span>
          </AppButton>
        </div>
      </div>
      <div class="flex items-center gap-2 sm:gap-3">
        <button @click="switchTab('buy')"
          class="flex-1 sm:flex-none px-3 sm:px-5 py-2 sm:py-2.5 text-[9px] sm:text-[10px] rounded-xl font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all flex items-center justify-center sm:justify-start gap-2"
          :class="tab === 'buy' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-app-bg text-app-text-muted hover:text-app-text-primary hover:bg-app-surface border border-app-border'">
          <span class="text-sm sm:text-base leading-none">🛒</span> Đơn nhập hàng
        </button>
        <button @click="switchTab('sell')"
          class="flex-1 sm:flex-none px-3 sm:px-5 py-2 sm:py-2.5 text-[9px] sm:text-[10px] rounded-xl font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all flex items-center justify-center sm:justify-start gap-2"
          :class="tab === 'sell' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-app-bg text-app-text-muted hover:text-app-text-primary hover:bg-app-surface border border-app-border'">
          <span class="text-sm sm:text-base leading-none">📦</span> Đơn bán hàng
        </button>
      </div>
      <p v-if="error" class="sm:hidden text-red-500 text-[9px] font-black uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/10">{{ error }}</p>
    </div>

    <!-- Main Grid Form -->
    <form id="order-form" @submit.prevent="handleSubmit" class="flex-1 min-h-0 overflow-hidden px-2 pb-2">

      <!-- ================= BUY ORDER LAYOUT ================= -->
      <div v-if="tab === 'buy' && activeBuyTab" class="flex flex-col h-full">
        <BuyTabBar
          :tabs="buyTabs" :active-tab-id="activeTabId"
          @select="switchBuyTab" @close="handleCloseBuyTab" @add="handleAddBuyTab"
        />
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1 overflow-y-auto custom-scrollbar">

          <!-- Cột Trái (3): Thong tin don hang -->
          <div class="col-span-1 lg:col-span-3 flex flex-col gap-3 sm:gap-4 lg:overflow-y-auto lg:pr-1 lg:custom-scrollbar">
            <div class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm space-y-4">
              <h3 class="text-app-text-primary text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
                <span class="p-1 bg-indigo-600/10 rounded text-indigo-600">📌</span> Thông tin đơn hàng
              </h3>
              <!-- Buy Channel -->
              <div>
                <div class="flex justify-between items-center mb-2">
                  <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Kênh nhập <span class="text-red-500">*</span></label>
                  <GearButton color="indigo" @click="openFavModal('buy_channel', 'Kênh nhập', channelOpts)" />
                </div>
                <SearchableSelect v-model="activeBuyTab.buyForm.buy_channel" :options="channelOpts" placeholder="-- Chọn --" required compact />
                <div class="flex flex-wrap gap-2 mt-2" v-if="renderFavs('buy_channel', channelOpts).length">
                  <FavoriteChip v-for="fav in renderFavs('buy_channel', channelOpts)" :key="fav.value" :label="fav.label" color="indigo" @click="activeBuyTab.buyForm.buy_channel = fav.value" />
                </div>
              </div>

              <!-- Divider + Sub-section: Đối tác -->
              <div class="border-t border-app-border/40 pt-4">
                <h4 class="text-app-text-secondary text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-3 opacity-70">
                  <span class="p-0.5 bg-indigo-600/10 rounded text-indigo-600 text-[8px]">🤝</span> Đối tác
                </h4>
                <div>
                  <div class="flex justify-between items-center mb-2">
                    <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Nhà cung cấp <span class="text-red-500">*</span></label>
                    <GearButton color="indigo" @click="openFavModal('supplier', 'Nhà cung cấp', [])" />
                  </div>
                  <SearchableSelect v-model="activeBuyTab.buyForm.supplier" :async-search-fn="supplierSearchFn" placeholder="-- Gõ tên supplier --" required compact />
                  <div v-if="supplierSocialLinks.fb || supplierSocialLinks.discord" class="flex items-center gap-3 mt-2">
                    <a v-if="supplierSocialLinks.fb" :href="supplierSocialLinks.fb" target="_blank"
                      class="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-400 font-bold transition-colors">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      Facebook
                    </a>
                    <a v-if="supplierSocialLinks.discord" :href="supplierSocialLinks.discord" target="_blank"
                      class="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z"/></svg>
                      Discord
                    </a>
                  </div>
                  <div class="flex flex-wrap gap-2 mt-2" v-if="renderFavs('supplier', []).length">
                    <FavoriteChip v-for="fav in renderFavs('supplier', [])" :key="fav.value" :label="fav.label" color="indigo" @click="activeBuyTab.buyForm.supplier = fav.value" />
                  </div>
                  <div v-if="activeBuyTab.buyForm.supplier === '__new__'" class="mt-3 p-3 bg-app-bg border border-app-border rounded-xl space-y-3">
                    <input v-model="activeBuyTab.newSupplierId" type="text" placeholder="Mã NCC (ID) *" required class="input-field !py-1.5 text-xs" />
                    <input v-model="activeBuyTab.newSupplierName" type="text" placeholder="Tên nhà cung cấp *" required class="input-field !py-1.5 text-xs" />
                  </div>
                  <div v-if="buyDuplicateWarning" class="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-[10px] text-amber-600 font-bold">
                    ⚠️ {{ buyDuplicateWarning }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Card: Người thanh toán (Social) -->
            <div v-if="isBuySocialChannel" class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
              <h3 class="text-app-text-primary text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
                <span class="p-1 bg-indigo-600/10 rounded text-indigo-600">👤</span> Người thanh toán
              </h3>
              <div>
                <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Người thanh toán</label>
                <SearchableSelect v-model="activeBuyTab.buyForm.assigned_trader" :options="buyRecipientOpts" placeholder="-- Chọn --" compact class="mt-2" />
                <p class="text-[10px] text-app-text-muted mt-1">Nhân viên thanh toán cho đơn nhập hàng này</p>
              </div>
            </div>

            <!-- Card: Kho nhận -->
            <div v-if="buyKhoOpts.length > 0" class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
              <h3 class="text-app-text-primary text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
                <span class="p-1 bg-indigo-600/10 rounded text-indigo-600">📦</span> Kho nhận
              </h3>
              <div>
                <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Kho nhận hàng</label>
                <SearchableSelect v-model="activeBuyTab.buyForm.game_account" :options="buyKhoOpts" placeholder="-- Chọn kho --" compact class="mt-2" />
                <p class="text-[10px] text-app-text-muted mt-1">Kho game sẽ nhận hàng vào</p>
              </div>
            </div>

            <!-- Platform Fees - Buy (Marketplace only) -->
            <div v-if="isBuyMarketplaceChannel" class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
              <h3 class="text-app-text-primary text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
                <span class="p-1 bg-indigo-600/10 rounded text-indigo-600">💰</span> Phí sàn
              </h3>
              <div class="space-y-3">
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Commission</label>
                  <input v-model="activeBuyTab.buyForm.channel_fee_native" type="number" step="0.01" min="0" class="input-field !py-1.5 text-xs" placeholder="0.00" />
                </div>
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Chi phí khác</label>
                  <input v-model="activeBuyTab.buyForm.other_cost_native" type="number" step="0.01" min="0" class="input-field !py-1.5 text-xs" placeholder="0.00" />
                </div>
              </div>
            </div>
          </div>

          <!-- Cột Giữa (9): Game Context, Items, Currency, Note -->
          <div class="col-span-1 lg:col-span-9 flex flex-col gap-4">
            <OrderFormSection
              color="indigo"
              :order-items="activeBuyTab.orderItems"
              :disable-price-and-total="true"
              total-label="Tổng nhập hàng"
              :item-opts="buyItemOpts"
              :game-context="activeBuyTab.gameContext"
              :game-context-opts="gameContextOpts"
              :total-vnd="buyTotalVnd"
              :currency="activeBuyTab.buyForm.transaction_currency"
              :favorites="favorites"
              :render-favs="renderFavs"
              @add-item="addItemBuy"
              @remove-item="removeItemBuy"
              @qty-change="onQtyChangeBuy"
              @price-change="onPriceChangeBuy"
              @total-change="onTotalChangeBuy"
              @currency-item-change="onCurrencyItemChangeBuy"
              @open-fav="openFavModal"
              @add-fav-item="addFavItemBuy"
              @select-game-context="setGameContextBuy"
              @game-context-change="onGameContextChangeBuy"
              @update:game-context="setGameContextBuy"
            >
              <template #currency>
                <div class="flex flex-col gap-2 items-end">
                  <div class="flex items-center gap-1.5">
                    <label class="text-[8px] font-black text-app-text-muted uppercase tracking-widest whitespace-nowrap">Tiền tệ</label>
                    <select v-model="activeBuyTab.buyForm.transaction_currency" required class="input-field !py-1.5 !px-2 text-[11px] w-20" :disabled="isBuyMarketplaceChannel" @change="onBuyCurrencyChange">
                      <option value="VND">VND</option>
                      <option value="USD">USD</option>
                      <option value="CNY">CNY</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </div>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="buyIsNegotiation" class="accent-amber-500 w-3.5 h-3.5 rounded" />
                    <span class="text-[9px] font-black text-amber-600 uppercase tracking-widest">Thương lượng</span>
                  </label>
                </div>
              </template>
              <template #note>
                <div class="border-t border-app-border/40 pt-4">
                  <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><span>📝</span> Ghi chú</label>
                  <textarea v-model="activeBuyTab.note" class="input-field resize-none w-full p-3 text-sm min-h-[60px]" placeholder="Nhập ghi chú thêm cho đơn hàng này..."></textarea>
                </div>
              </template>
              <template #item-extra="{ item, idx }">
                <div v-if="buyKhoOpts.length > 0 && item.quantity > 0" class="mt-1 px-2">
                  <button type="button" @click="toggleKhoExpand(idx)"
                    class="w-full flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest py-1 px-2 rounded-lg transition-all"
                    :class="item._khoExpanded ? 'bg-indigo-600/10 text-indigo-600' : 'bg-app-bg text-app-text-muted hover:text-indigo-600'">
                    <span>📦</span>
                    <span v-if="!item.allocations?.some(a => a.game_account)">Chọn kho</span>
                    <span v-else>{{ item.allocations.filter(a => a.game_account).length }} kho</span>
                    <span class="ml-auto text-[8px]">{{ item._khoExpanded ? '▲' : '▼' }}</span>
                  </button>
                  <div v-if="item._khoExpanded" class="mt-1.5 space-y-1 pl-2 border-l-2 border-indigo-600/20">
                    <div v-for="(alloc, aIdx) in (item.allocations || [])" :key="aIdx" class="flex items-center gap-1.5">
                      <SearchableSelect v-model="alloc.game_account" :options="khoAllocAccountOpts(idx, aIdx)" placeholder="-- Kho --" compact class="flex-1" />
                      <input v-model.number="alloc.quantity" type="number" min="0" step="any"
                        class="w-16 text-right bg-app-bg border border-app-border rounded-lg px-1.5 py-1 text-[10px] font-mono outline-none focus:border-indigo-600"
                        :placeholder="item.quantity" />
                      <button v-if="(item.allocations || []).length > 1" type="button" @click="removeKhoAlloc(idx, aIdx)"
                        class="text-red-400 hover:text-red-300 text-[10px] px-0.5">&#10005;</button>
                    </div>
                    <div class="flex items-center gap-2 text-[9px]">
                      <button type="button" @click="addKhoAlloc(idx)" class="text-indigo-400 hover:text-indigo-300 font-bold">+ Thêm kho</button>
                      <span v-if="khoAllocTotal(idx) > 0" class="ml-auto font-mono"
                        :class="Math.abs(khoAllocTotal(idx) - (item.quantity || 0)) < 0.001 ? 'text-emerald-600' : 'text-amber-600'">
                        {{ khoAllocTotal(idx) }} / {{ item.quantity }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>
            </OrderFormSection>
          </div>

        </div>
      </div>

      <!-- ================= SELL ORDER LAYOUT ================= -->
      <div v-if="tab === 'sell'" class="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 h-full overflow-y-auto custom-scrollbar">

        <!-- Cột Trái (3): Thong tin don hang -->
        <div class="col-span-1 lg:col-span-3 flex flex-col gap-3 sm:gap-4 lg:overflow-y-auto lg:pr-1 lg:custom-scrollbar">
          <div class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 class="text-app-text-primary text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
              <span class="p-1 bg-orange-600/10 rounded text-orange-600">📌</span> Thông tin đơn hàng
            </h3>

            <!-- Sell Channel -->
            <div>
              <div class="flex justify-between items-center mb-2">
                <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Kênh bán <span class="text-red-500">*</span></label>
                <GearButton color="orange" @click="openFavModal('sell_channel', 'Kênh bán', channelOpts)" />
              </div>
              <SearchableSelect v-model="sellForm.sell_channel" :options="channelOpts" placeholder="-- Chọn --" required compact />
              <div class="flex flex-wrap gap-2 mt-2" v-if="renderFavs('sell_channel', channelOpts).length">
                <FavoriteChip v-for="fav in renderFavs('sell_channel', channelOpts)" :key="fav.value" :label="fav.label" color="orange" @click="sellForm.sell_channel = fav.value" />
              </div>
            </div>

            <!-- Divider + Customer -->
            <div class="border-t border-app-border/40 pt-4">
              <h4 class="text-app-text-secondary text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-3 opacity-70">
                <span class="p-0.5 bg-orange-600/10 rounded text-orange-600 text-[8px]">👤</span> Khách Hàng
              </h4>
              <div>
                <div class="flex justify-between items-center mb-2">
                  <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Khách hàng</label>
                  <GearButton color="orange" @click="openFavModal('customer', 'Khách hàng', [])" />
                </div>
                <SearchableSelect v-model="sellForm.customer" :async-search-fn="customerSearchFn" placeholder="-- Gõ tên customer --" @change="onCustomerChange" compact />
                <div class="flex flex-wrap gap-2 mt-2" v-if="renderFavs('customer', []).length">
                  <FavoriteChip v-for="fav in renderFavs('customer', [])" :key="fav.value" :label="fav.label" color="orange" @click="setCustomerAndFetch(fav.value)" />
                </div>

                <div v-if="sellForm.customer === '__new__'" class="mt-3 p-3 bg-app-bg border border-app-border rounded-xl space-y-3">
                  <input v-model="newCustomerName" type="text" placeholder="Tên khách hàng mới *" required class="input-field !py-1.5 text-xs" />
                </div>
              </div>

              <div v-if="duplicateCustomerWarning" class="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-[10px] text-amber-600 font-bold">
                ⚠️ {{ duplicateCustomerWarning }}
              </div>
              <div v-if="customerInfo.name" class="mt-3 bg-app-bg border border-app-border rounded-xl p-3 space-y-2">
                <div class="flex justify-between items-center text-[10px]">
                  <span class="font-black text-app-text-muted uppercase tracking-widest opacity-80">Xưng hô:</span>
                  <span class="font-bold text-app-text-primary">{{ customerInfo.custom_external_handle || '—' }}</span>
                </div>
                <div class="flex justify-between items-center text-[10px]">
                  <span class="font-black text-app-text-muted uppercase tracking-widest opacity-80">Hạng:</span>
                  <span :class="tierColor(customerInfo.custom_customer_tier)" class="font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-current/10">{{ customerInfo.custom_customer_tier || 'Thường' }}</span>
                </div>
              </div>
            </div>

            <!-- Divider + Customer Details -->
            <div class="border-t border-app-border/40 pt-4 space-y-3">
              <div>
                <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">BTag khách hàng</label>
                <input v-model="sellForm.customer_btag_snapshot" type="text" placeholder="BattleTag" class="input-field !py-1.5 text-xs" />
              </div>
              <div>
                <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tên trong game</label>
                <input v-model="sellForm.customer_ingame_name_snapshot" type="text" placeholder="Tên trong game" class="input-field !py-1.5 text-xs" />
              </div>
            </div>

            <!-- External Order Info (Marketplace only) -->
            <div v-if="isMarketplaceChannel" class="border-t border-app-border/40 pt-4 space-y-3">
              <h4 class="text-app-text-secondary text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-3 opacity-70">
                <span class="p-0.5 bg-orange-600/10 rounded text-orange-600 text-[8px]">🔗</span> Đơn nền tảng
              </h4>
              <div>
                <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">External Order ID</label>
                <input v-model="sellForm.external_order_id" type="text" placeholder="VD: #12345" class="input-field !py-1.5 text-xs" />
              </div>
              <div>
                <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Link đơn hàng</label>
                <input v-model="sellForm.order_url" type="url" placeholder="https://..." class="input-field !py-1.5 text-xs" />
              </div>
            </div>
          </div>

          <!-- Card: Người nhận -->
          <div v-if="isSocialChannel" class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
            <h3 class="text-app-text-primary text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
              <span class="p-1 bg-orange-600/10 rounded text-orange-600">👤</span> Người nhận
            </h3>
            <div>
              <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Người nhận</label>
              <SearchableSelect v-model="sellRecipient" :options="sellRecipientOpts" placeholder="-- Chọn người nhận --" compact class="mt-2" />
              <p class="text-[10px] text-app-text-muted mt-1">Chọn người nhận để tạo QR, hoặc để "Ghi nợ" để giao xong vào công nợ</p>
            </div>
          </div>

          <!-- Platform Fees (Marketplace only) -->
          <div v-if="isMarketplaceChannel" class="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
            <h3 class="text-app-text-primary text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
              <span class="p-1 bg-orange-600/10 rounded text-orange-600">💰</span> Phí sàn
            </h3>
            <div class="space-y-3">
              <div>
                <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Commission <span class="text-red-500">*</span></label>
                <input v-model="sellForm.channel_fee_native" type="number" step="0.01" min="0" class="input-field !py-1.5 text-xs" placeholder="0.00" />
              </div>
              <div>
                <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Chi phí khác</label>
                <input v-model="sellForm.other_cost_native" type="number" step="0.01" min="0" class="input-field !py-1.5 text-xs" placeholder="0.00" />
              </div>
            </div>
          </div>
        </div>

        <!-- Cột Giữa (9): Game Context, Items, Currency, Note -->
        <div class="col-span-1 lg:col-span-9 flex flex-col gap-4">
          <OrderFormSection
            color="orange"
            :order-items="sellOrderItems"
            :disable-price-and-total="!isMarketplaceChannel"
            :item-opts="sellItemOpts"
            v-model:game-context="sellGameContext"
            :game-context-opts="gameContextOpts"
            :total-vnd="sellTotalVnd"
            :currency="sellForm.sale_currency"
            :favorites="favorites"
            :render-favs="renderFavs"
            qty-label="SL"
            price-label="Giá Bán"
            total-label="Tổng bán hàng"
            :earning-amount="isMarketplaceChannel ? sellPlatformEarning : null"
            @add-item="addItemSell"
            @remove-item="removeItemSell"
            @qty-change="onQtyChangeSell"
            @price-change="onPriceChangeSell"
            @total-change="onTotalChangeSell"
            @currency-item-change="onCurrencyItemChangeSell"
            @open-fav="openFavModal"
            @add-fav-item="addFavItemSell"
            @select-game-context="setGameContextSell"
            @game-context-change="onGameContextChangeSell"
          >
            <template #currency>
              <div class="flex flex-col gap-2 items-end">
                <div class="flex items-center gap-1.5">
                  <label class="text-[8px] font-black text-app-text-muted uppercase tracking-widest whitespace-nowrap">Tiền tệ</label>
                  <select v-model="sellForm.sale_currency" required class="input-field !py-1.5 !px-2 text-[11px] w-20" @change="onSellCurrencyChange">
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                      <option value="USDT">USDT</option>
                  </select>
                </div>
                <label v-if="!isMarketplaceChannel" class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" v-model="sellIsNegotiation" class="accent-amber-500 w-3.5 h-3.5 rounded" />
                  <span class="text-[9px] font-black text-amber-600 uppercase tracking-widest">Thương lượng</span>
                </label>
              </div>
            </template>
            <template #note>
              <div class="border-t border-app-border/40 pt-4">
                <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><span>📝</span> Ghi chú</label>
                <textarea v-model="sellNote" class="input-field resize-none w-full p-3 text-sm min-h-[60px]" placeholder="Nhập ghi chú thêm cho đơn hàng này..."></textarea>
                <div class="mt-3 space-y-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="sellLinkBuyItem" class="accent-indigo-600 w-3.5 h-3.5 rounded" />
                    <span class="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Liên kết item mua</span>
                  </label>
                  <div v-if="sellLinkBuyItem">
                    <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">Tìm đơn mua (theo tên item)</label>
                    <SearchableSelect v-model="sellLinkedItem" :async-search-fn="buyOrderSearchFn" placeholder="-- Gõ tên item --" compact />
                  </div>
                </div>
              </div>
            </template>
          </OrderFormSection>
        </div>

      </div>
    </form>

    <FavoriteSettingsModal
      :isOpen="favModalOpen"
      :title="favModalTitle"
      :options="favModalOptions"
      :initialSelected="favModalInitial"
      @close="favModalOpen = false"
      @save="saveFavorites"
    />

    <PresetSettingsModal
      :isOpen="presetModalOpen"
      :presets="presets"
      :recipientOpts="allBuyRecipientOpts"
      @close="presetModalOpen = false"
      @savePreset="savePreset"
      @deletePreset="deletePreset"
      @setDefault="setDefault"
    />

    <!-- QR Payment Dialog -->
    <div v-if="qrDialogOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="closeQrDialog">
      <div class="bg-app-surface border border-app-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col mx-4">
        <div class="px-7 py-5 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-base uppercase tracking-tight">Mã QR thanh toán</h3>
          <button @click="closeQrDialog" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-lg">✕</button>
        </div>
        <div class="p-7 space-y-4">
          <p class="text-sm text-app-text-muted text-center">Gửi mã QR cho khách để thanh toán</p>
          <p class="text-center text-app-text-primary font-bold">Đơn: {{ qrData.orderName }}</p>
          <p class="text-center text-sm text-app-text-muted">Mã tham chiếu: {{ qrData.refCode }}</p>
          <div v-if="qrData.qrUrl" class="flex justify-center">
            <img :src="qrData.qrUrl" alt="QR thanh toán" class="w-56 h-56 object-contain" />
          </div>
          <p v-else class="text-center text-amber-500 text-sm">QR chưa sẵn sàng, vui lòng xem trong chi tiết đơn</p>
        </div>
        <div class="px-7 py-4 border-t border-app-border flex justify-end gap-3">
          <button @click="closeQrDialog" class="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition">Đã gửi QR →</button>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
defineOptions({ name: 'CreateOrderView' })
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SearchableSelect from '../components/SearchableSelect.vue'
import OrderFormSection from '../components/OrderFormSection.vue'
import FavoriteSettingsModal from '../components/FavoriteSettingsModal.vue'
import PresetSettingsModal from '../components/PresetSettingsModal.vue'
import AppButton from '../components/AppButton.vue'
import GearButton from '../components/GearButton.vue'
import FavoriteChip from '../components/FavoriteChip.vue'
import BackButton from '../components/BackButton.vue'
import BuyTabBar from '../components/BuyTabBar.vue'
import { useFavorites } from '../composables/useFavorites.js'
import { useBuyOrderTabs } from '../composables/useBuyOrderTabs.js'
import { useBuyPresets } from '../composables/useBuyPresets.js'
import { useItemPrice } from '../composables/useItemPrice.js'
import { getDoc, createDoc, updateDoc, getList, frappeCall } from '../api/index.js'
import { formatMoney, tierColor } from '../utils/format.js'
import { useNotify } from '../composables/useNotify.js'
import { useMetadata } from '../composables/useMetadata.js'
import { useAuth } from '../composables/useAuth.js'
import { useBadgeCounts } from '../composables/useBadgeCounts.js'

const {
  channels,
  suppliers,
  customers,
  gameContexts,
  gameAccounts,
  currencyItems,
  channelOpts,
  supplierSearchFn,
  customerSearchFn,
  gameContextOpts,
  getItemOpts,
  currencyItemMap,
  channelMap,
  contextMap,
  fetchMetadata
} = useMetadata()

const router = useRouter()
const route = useRoute()

function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/t1-active')
  }
}

function closeQrDialog() {
  qrDialogOpen.value = false
  router.push('/t1-active')
}

const submitting = ref(false)
const error = ref('')
const qrDialogOpen = ref(false)
const qrData = ref({ orderName: '', qrUrl: '', refCode: '', amount: '' })
const { success, error: notifyError, warn, info, confirm } = useNotify()
const tab = ref('sell')
const { favorites, renderFavs } = useFavorites()
const { presets, defaultPreset, savePreset, deletePreset, setDefault } = useBuyPresets()
const { getItemPrice } = useItemPrice()
const presetModalOpen = ref(false)

// ========== BUY ORDER TABS ==========
const {
  tabs: buyTabs,
  activeTabId,
  activeBuyTab,
  createTab: createBuyTab,
  closeTab: closeBuyTab,
  switchToTab: switchBuyTab,
  markTabSubmitted,
  updateTabLabel,
  isTabDirty,
  saveToStorage: saveBuyTabs,
  restoreFromStorage: restoreBuyTabs,
} = useBuyOrderTabs()

const { user } = useAuth()

const buyDuplicateWarning = ref('')
const supplierSocialLinks = ref({ fb: '', discord: '' })
const buySelectedGameTitle = ref('')
const buyItemOpts = getItemOpts(buySelectedGameTitle)
const buyTotalVnd = computed(() => {
  if (!activeBuyTab.value) return 0
  return activeBuyTab.value.orderItems.reduce((s, r) => s + ((r.quantity || 0) * (r.unit_price || 0)), 0)
})

function handleAddBuyTab() {
  const id = createBuyTab()
  if (!id) warn('Tối đa 10 tab cùng lúc')
}

function handleCloseBuyTab(id) {
  if (isTabDirty(id)) {
    if (!confirm('Đơn nhập hàng chưa gửi. Đóng tab?')) return
  }
  closeBuyTab(id)
}

// Re-resolve game title when switching buy tabs
watch(activeTabId, () => {
  if (tab.value === 'buy') updateBuyGameTitle()
})

// Supplier auto-fill watcher for buy tabs
watch(() => activeBuyTab.value?.buyForm.supplier, async (val) => {
  if (!val || val === '__new__') { buyDuplicateWarning.value = ''; supplierSocialLinks.value = { fb: '', discord: '' }; return }
  buyDuplicateWarning.value = ''
  supplierSocialLinks.value = { fb: '', discord: '' }
  checkDuplicateSupplier(val)
  // Update tab label with supplier name
  updateTabLabel(activeTabId.value, val)
  // Auto-fill channel & currency
  try {
    const doc = await getDoc('Supplier', val)
    supplierSocialLinks.value = {
      fb: doc?.custom_facebook_url || '',
      discord: doc?.custom_discord_url || '',
    }
    if (doc?.custom_buy_channel && activeBuyTab.value) {
      activeBuyTab.value.buyForm.buy_channel = doc.custom_buy_channel
    }
    if (doc?.custom_preferred_currency && activeBuyTab.value && !activeBuyTab.value.orderItems?.some(i => i.quantity || i.unit_price)) {
      activeBuyTab.value.buyForm.transaction_currency = doc.custom_preferred_currency
    }
  } catch {
    supplierSocialLinks.value = { fb: '', discord: '' }
  }
})

// Buy tab event handlers
function createBuyItem(currencyItem = '') {
  return {
    currency_item: currencyItem,
    quantity: null, unit_price: null, total: null,
    allocations: [{ game_account: activeBuyTab.value?.buyForm?.game_account || '', quantity: 0 }],
    _khoExpanded: false,
  }
}
function addItemBuy() {
  if (activeBuyTab.value) activeBuyTab.value.orderItems.push(createBuyItem())
}
function removeItemBuy(idx) {
  if (activeBuyTab.value) activeBuyTab.value.orderItems.splice(idx, 1)
}
function onQtyChangeBuy(idx) {
  const item = activeBuyTab.value?.orderItems[idx]
  if (item && item.unit_price != null && item.quantity != null)
    item.total = item.quantity * item.unit_price
}
function onPriceChangeBuy(idx) {
  const item = activeBuyTab.value?.orderItems[idx]
  if (item && item.quantity > 0 && item.unit_price != null)
    item.total = item.quantity * item.unit_price
}
function onTotalChangeBuy(idx) {
  const item = activeBuyTab.value?.orderItems[idx]
  if (item && item.quantity > 0 && item.total != null)
    item.unit_price = Math.round((item.total / item.quantity) * 10000) / 10000
}
async function onCurrencyItemChangeBuy(idx) {
  const item = activeBuyTab.value?.orderItems[idx]
  if (!item?.currency_item || !activeBuyTab.value?.gameContext) return
  try {
    const price = await getItemPrice(item.currency_item, activeBuyTab.value.gameContext, activeBuyTab.value.buyForm.transaction_currency, 'Mua')
    item.unit_price = price || 0
    if (item.quantity > 0) item.total = item.quantity * item.unit_price
  } catch { item.unit_price = 0 }
}
function onBuyCurrencyChange() {
  if (isBuyMarketplaceChannel.value) return
  activeBuyTab.value?.orderItems.forEach((item, idx) => {
    if (item.currency_item) onCurrencyItemChangeBuy(idx)
  })
}
function addFavItemBuy(itemVal) {
  if (!activeBuyTab.value) return
  if (activeBuyTab.value.orderItems.some(i => i.currency_item === itemVal)) {
    warn('Item này đã có trong danh sách')
    return
  }
  activeBuyTab.value.orderItems.push(createBuyItem(itemVal))
}
async function setGameContextBuy(val) {
  if (!activeBuyTab.value) return
  const oldContext = activeBuyTab.value.gameContext
  activeBuyTab.value.gameContext = val
  if (oldContext && oldContext !== val) {
    activeBuyTab.value.buyForm.game_account = ''
    activeBuyTab.value.orderItems.splice(0)
  }
  updateBuyGameTitle()
}

// --- Per-item kho allocation helpers ---
function addKhoAlloc(idx) {
  const item = activeBuyTab.value?.orderItems[idx]
  if (!item) return
  if (!item.allocations) item.allocations = []
  item.allocations.push({ game_account: '', quantity: 0 })
}
function removeKhoAlloc(itemIdx, allocIdx) {
  const item = activeBuyTab.value?.orderItems[itemIdx]
  if (!item?.allocations) return
  item.allocations.splice(allocIdx, 1)
}
function khoAllocAccountOpts(itemIdx, allocIdx) {
  const item = activeBuyTab.value?.orderItems[itemIdx]
  if (!item?.allocations) return buyKhoOpts.value
  const used = item.allocations.filter((_, i) => i !== allocIdx).map(a => a.game_account).filter(Boolean)
  return buyKhoOpts.value.filter(o => !used.includes(o.value))
}
function khoAllocTotal(idx) {
  const item = activeBuyTab.value?.orderItems[idx]
  if (!item?.allocations) return 0
  return item.allocations.reduce((s, a) => s + (a.quantity || 0), 0)
}
function toggleKhoExpand(idx) {
  const item = activeBuyTab.value?.orderItems[idx]
  if (!item) return
  item._khoExpanded = !item._khoExpanded
}
function onGameContextChangeBuy() {
  updateBuyGameTitle()
}
function updateBuyGameTitle() {
  if (!activeBuyTab.value?.gameContext) { buySelectedGameTitle.value = ''; return }
  buySelectedGameTitle.value = contextMap.value[activeBuyTab.value.gameContext]?.game_title || ''
  if (activeBuyTab.value && activeBuyTab.value.orderItems.length === 0) addItemBuy()
}

// ========== SELL ORDER (single instance) ==========
const sellOrderItems = ref([])
const sellGameContext = ref('')
const sellNote = ref('')
const sellLinkBuyItem = ref(false)
const sellLinkedItem = ref('')
const sellIsNegotiation = ref(false)
const buyIsNegotiation = ref(false)
const sellTotalVnd = ref(0)
const sellSelectedGameTitle = ref('')
const sellItemOpts = getItemOpts(sellSelectedGameTitle)

// Watch: clear linked item when checkbox is unchecked
watch(sellLinkBuyItem, (val) => {
  if (!val) sellLinkedItem.value = ''
})

// Async search function for buy orders by item name
async function buyOrderSearchFn(txt) {
  if (!txt || txt.trim().length < 2) return []
  const results = await getList('Currency Item', {
    fields: ['name', 'item_name', 'game_title'],
    filters: [['item_name', 'like', `%${txt.trim()}%`]],
    limit: 50,
  })
  return (results || []).map(item => ({
    label: `${item.item_name} (${item.game_title || ''})`,
    value: item.name,
    description: item.game_title || '',
  }))
}

const sellForm = ref({
  sell_channel: '',
  customer: '',
  customer_btag_snapshot: '',
  customer_ingame_name_snapshot: '',
  sale_currency: 'VND',
  channel_fee_native: '',
  other_cost_native: '',
  external_order_id: '',
  order_url: '',
})

const isBuySocialChannel = computed(() => {
  if (!activeBuyTab.value?.buyForm?.buy_channel) return false
  const ch = channels.value.find(c => c.name === activeBuyTab.value.buyForm.buy_channel)
  return ch?.channel_group === 'Social'
})

const isBuyMarketplaceChannel = computed(() => {
  if (!activeBuyTab.value?.buyForm?.buy_channel) return false
  const ch = channels.value.find(c => c.name === activeBuyTab.value.buyForm.buy_channel)
  return ch?.channel_group === 'Marketplace'
})

const isMarketplaceChannel = computed(() => {
  if (!sellForm.value.sell_channel) return false
  const ch = channels.value.find(c => c.name === sellForm.value.sell_channel)
  return ch?.channel_group === 'Marketplace'
})

const isSocialChannel = computed(() => {
  if (!sellForm.value.sell_channel) return false
  const ch = channels.value.find(c => c.name === sellForm.value.sell_channel)
  return ch?.channel_group === 'Social'
})

const sellRecipient = ref('')
const buyTraderUsers = ref([])
const sellTraderUsers = ref([])

async function loadRecipientUsers() {
  try {
    const [buyUsers, sellUsers] = await Promise.all([
      frappeCall('gege_custom.gege_custom.utils.get_users_with_roles', { cba_role: 'Payment' }),
      frappeCall('gege_custom.gege_custom.utils.get_users_with_roles', { cba_role: 'Receiving' }),
    ])
    buyTraderUsers.value = buyUsers || []
    sellTraderUsers.value = sellUsers || []
  } catch (e) { console.error('Failed to load users:', e) }
}

const buyRecipientOpts = computed(() => {
  const cur = activeBuyTab.value?.buyForm?.transaction_currency
  const users = buyTraderUsers.value
    .filter(u => {
      if (!u.roles.some(r => ['Payment Accountant'].includes(r))) return false
      if (cur && u.currencies && !u.currencies.includes(cur)) return false
      return true
    })
    .map(u => {
      return { label: `${u.full_name || u.email} (Payment Accountant)`, value: u.email }
    })
  return [{ label: 'Công nợ', value: '' }, ...users]
})

const allBuyRecipientOpts = computed(() => {
  return buyTraderUsers.value
    .filter(u => u.roles.some(r => ['Payment Accountant'].includes(r)))
    .map(u => ({ label: `${u.full_name || u.email}`, value: u.email }))
})

// Auto-select current user as assigned_trader for new buy tabs
watch([buyRecipientOpts, activeTabId], () => {
  if (!activeBuyTab.value) return
  if (activeBuyTab.value.buyForm.assigned_trader) return
  if (activeBuyTab.value.status !== 'new') return
  const me = user.value
  if (!me) return
  if (buyRecipientOpts.value.some(o => o.value === me)) {
    activeBuyTab.value.buyForm.assigned_trader = me
  }
}, { immediate: true })

const buyKhoOpts = computed(() => {
  if (!activeBuyTab.value?.gameContext) return []
  const gc = gameContexts.value.find(g => g.name === activeBuyTab.value.gameContext)
  if (!gc) return []
  return gameAccounts.value
    .filter(a => a.game_title === gc.game_title)
    .map(a => ({ label: a.account_name, value: a.name }))
})

const sellRecipientOpts = computed(() => {
  const cur = sellForm.value?.sale_currency
  const users = sellTraderUsers.value
    .filter(u => {
      if (!u.roles.some(r => ['Trader1', 'Trader2', 'Payment Accountant', 'Management Accountant'].includes(r))) return false
      if (cur && u.currencies && !u.currencies.includes(cur)) return false
      return true
    })
    .map(u => {
      const role = u.roles.find(r => ['Trader1', 'Trader2', 'Payment Accountant', 'Management Accountant'].includes(r))
      return { label: `${u.full_name || u.email} (${role})`, value: u.email }
    })
  return [{ label: 'Công nợ', value: '' }, ...users]
})

// Backward compat alias
const recipientOpts = computed(() => {
  return [...new Map([...buyRecipientOpts.value, ...sellRecipientOpts.value].map(o => [o.value, o])).values()]
})

const sellGrossAmount = computed(() => {
  return (sellOrderItems.value || []).reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)
})

const sellPlatformEarning = computed(() => {
  return Math.max(0, sellGrossAmount.value - Number(sellForm.value.channel_fee_native || 0) - Number(sellForm.value.other_cost_native || 0))
})

function formatAmount(n) {
  return Number(n || 0).toLocaleString('vi-VN')
}

const newCustomerName = ref('')
const customerInfo = ref({})
const duplicateCustomerWarning = ref('')

watch(() => sellForm.value.customer, (val) => {
  if (!val || val === '__new__') { duplicateCustomerWarning.value = ''; return }
  duplicateCustomerWarning.value = ''
  checkDuplicateCustomer(val)
})

watch(() => sellForm.value.sell_channel, () => {
  if (isMarketplaceChannel.value) {
    sellForm.value.sale_currency = 'USD'
  }
  if (!isMarketplaceChannel.value) {
    sellForm.value.channel_fee_native = ''
    sellForm.value.other_cost_native = ''
    sellForm.value.external_order_id = ''
    sellForm.value.order_url = ''
  }
  if (!isSocialChannel.value) {
    sellRecipient.value = ''
  }
})

watch(() => activeBuyTab.value?.buyForm?.buy_channel, () => {
  if (isBuyMarketplaceChannel.value && activeBuyTab.value) {
    activeBuyTab.value.buyForm.transaction_currency = 'USD'
  }
})

// Auto-fill items with order-level kho
watch(() => activeBuyTab.value?.buyForm?.game_account, (newKho) => {
  if (!activeBuyTab.value) return
  for (const item of activeBuyTab.value.orderItems) {
    if (!item.allocations || item.allocations.length === 0) {
      item.allocations = [{ game_account: newKho || '', quantity: 0 }]
    } else if (item.allocations.length === 1 && !item.allocations[0].game_account) {
      item.allocations[0].game_account = newKho || ''
    }
  }
})

function addItemSell() {
  sellOrderItems.value.push({ currency_item: '', quantity: null, unit_price: null, total: null })
}
function removeItemSell(idx) {
  sellOrderItems.value.splice(idx, 1)
  calcSellTotal()
}
function onQtyChangeSell(idx) {
  const item = sellOrderItems.value[idx]
  if (item.unit_price != null && item.quantity != null)
    item.total = item.quantity * item.unit_price
  calcSellTotal()
}
function onPriceChangeSell(idx) {
  const item = sellOrderItems.value[idx]
  if (item.quantity > 0 && item.unit_price != null)
    item.total = item.quantity * item.unit_price
  calcSellTotal()
}
function onTotalChangeSell(idx) {
  const item = sellOrderItems.value[idx]
  if (item.quantity > 0 && item.total != null)
    item.unit_price = Math.round((item.total / item.quantity) * 10000) / 10000
  calcSellTotal()
}
function calcSellTotal() {
  sellTotalVnd.value = sellOrderItems.value.reduce((s, r) => s + ((r.quantity || 0) * (r.unit_price || 0)), 0)
}
async function onCurrencyItemChangeSell(idx) {
  const item = sellOrderItems.value[idx]
  if (!item?.currency_item || !sellGameContext.value) return
  try {
    const price = await getItemPrice(item.currency_item, sellGameContext.value, sellForm.value.sale_currency, 'Bán')
    item.unit_price = price || 0
    if (item.quantity > 0) item.total = item.quantity * item.unit_price
    calcSellTotal()
  } catch { item.unit_price = 0 }
}
function onSellCurrencyChange() {
  if (isMarketplaceChannel.value) return
  sellOrderItems.value.forEach((item, idx) => {
    if (item.currency_item) onCurrencyItemChangeSell(idx)
  })
}
function addFavItemSell(itemVal) {
  if (sellOrderItems.value.some(i => i.currency_item === itemVal)) {
    warn('Item này đã có trong danh sách')
    return
  }
  sellOrderItems.value.push({ currency_item: itemVal, quantity: null, unit_price: null, total: null })
}
function setGameContextSell(val) {
  const oldContext = sellGameContext.value
  sellGameContext.value = val
  if (oldContext && oldContext !== val) {
    sellOrderItems.value = []
    sellTotalVnd.value = 0
  }
  updateSellGameTitle()
}
function onGameContextChangeSell() {
  sellOrderItems.value = []
  sellTotalVnd.value = 0
  updateSellGameTitle()
}
function updateSellGameTitle() {
  if (!sellGameContext.value) { sellSelectedGameTitle.value = ''; return }
  sellSelectedGameTitle.value = contextMap.value[sellGameContext.value]?.game_title || ''
  addItemSell()
}
async function setCustomerAndFetch(val) {
  sellForm.value.customer = val
  await onCustomerChange()
}
async function onCustomerChange() {
  if (!sellForm.value.customer || sellForm.value.customer === '__new__') { customerInfo.value = {}; return }
  customerInfo.value = await getDoc('Customer', sellForm.value.customer)
  if (customerInfo.value.custom_primary_channel) {
    sellForm.value.sell_channel = customerInfo.value.custom_primary_channel
  }
  if (customerInfo.value.custom_external_handle) {
    sellForm.value.customer_btag_snapshot = customerInfo.value.custom_external_handle
  }
  if (customerInfo.value.default_currency && !isMarketplaceChannel.value && !sellOrderItems.value?.some(i => i.quantity || i.unit_price)) {
    sellForm.value.sale_currency = customerInfo.value.default_currency
  }
  // Auto-fill game context only if no items selected yet
  if (customerInfo.value.custom_primary_game_context && !hasSellItems()) {
    sellGameContext.value = customerInfo.value.custom_primary_game_context
    onGameContextChangeSell()
  }
}

function hasSellItems() {
  return sellOrderItems.value.some(i => i.currency_item)
}

// ========== Quick Fill ==========
async function applyQuickFill() {
  const p = defaultPreset.value
  if (!p || !activeBuyTab.value) return
  const t = activeBuyTab.value

  t.buyForm.assigned_trader = p.assigned_trader || ''
  t.buyForm.transaction_currency = p.transaction_currency || 'VND'
  t.buyForm.game_account = p.game_account || ''

  if (p.game_context) {
    t.gameContext = p.game_context
    updateBuyGameTitle()
  }

  // Clear auto-added items and set preset items
  await nextTick()
  t.orderItems.splice(0)
  for (const entry of (p.currency_items || [])) {
    const item = createBuyItem(entry.currency_item)
    item.unit_price = entry.unit_price || null
    t.orderItems.push(item)
  }
  if (t.orderItems.length === 0) addItemBuy()

  success(`Quick Fill: ${p.name}`)
}

// ========== Shared ==========
function switchTab(t) {
  tab.value = t
  error.value = ''
}

const favModalOpen = ref(false)
const favModalTitle = ref('')
const favModalOptions = ref([])
const favModalField = ref('')
const favModalInitial = ref([])

function openFavModal(fieldKey, title, options) {
  favModalField.value = fieldKey
  favModalTitle.value = title
  favModalOptions.value = options
  favModalInitial.value = favorites.value[fieldKey] || []
  favModalOpen.value = true
}

function saveFavorites(selected) {
  favorites.value[favModalField.value] = selected
}

async function checkDuplicateCustomer(selectedName) {
  try {
    const doc = await getDoc('Customer', selectedName)
    const nameLower = (doc?.customer_name || '').toLowerCase().trim()
    if (!nameLower) return
    const results = await frappeCall('frappe.desk.search.search_link', {
      doctype: 'Customer',
      txt: nameLower,
      page_length: 20,
    })
    const matches = (results || []).filter(r =>
      r.value !== selectedName && (r.value || '').toLowerCase().trim() === nameLower
    )
    if (matches.length > 0) {
      duplicateCustomerWarning.value = `Có ${matches.length} khách hàng trùng tên: ${matches.map(m => m.value).join(', ')}`
    }
  } catch {}
}

async function checkDuplicateSupplier(selectedName) {
  try {
    const doc = await getDoc('Supplier', selectedName)
    const nameLower = (doc?.supplier_name || '').toLowerCase().trim()
    if (!nameLower) return
    const fbUrl = (doc?.custom_facebook_url || '').trim()
    const discordUrl = (doc?.custom_discord_url || '').trim()
    if (!fbUrl && !discordUrl) return
    const results = await frappeCall('frappe.desk.search.search_link', {
      doctype: 'Supplier',
      txt: nameLower,
      page_length: 20,
    })
    const matches = (results || []).filter(r =>
      r.value !== selectedName && (r.value || '').toLowerCase().trim() === nameLower
    )
    const dupes = []
    for (const match of matches) {
      const matchDoc = await getDoc('Supplier', match.value)
      const matchFb = (matchDoc?.custom_facebook_url || '').trim()
      const matchDiscord = (matchDoc?.custom_discord_url || '').trim()
      if (fbUrl && fbUrl === matchFb && discordUrl && discordUrl === matchDiscord) {
        dupes.push(match.value)
      }
    }
    if (dupes.length > 0) {
      buyDuplicateWarning.value = `Có ${dupes.length} nhà cung cấp trùng tên VÀ trùng cả FB + Discord: ${dupes.join(', ')}`
    }
  } catch {}
}

// ========== SUBMIT ==========
async function handleSubmit() {
  if (tab.value === 'buy') return handleBuySubmit()

  // --- SELL ---
  const filledItems = sellOrderItems.value.filter(r => r.currency_item && r.quantity > 0)
  if (filledItems.length === 0) { return warn('Thêm ít nhất 1 item') }
  if (filledItems.some(r => !r.currency_item || r.quantity <= 0)) {
    return warn('Vui lòng chọn Currency Item hợp lệ và nhập số lượng lớn hơn 0.')
  }
  const btag = (sellForm.value.customer_btag_snapshot || '').trim()
  const ingame = (sellForm.value.customer_ingame_name_snapshot || '').trim()
  if (!btag && !ingame) {
    return warn('Nhập ít nhất 1 trong 2: BTag khách hàng hoặc Tên trong game.')
  }

  submitting.value = true
  error.value = ''
  try {
    let payload

    if (sellForm.value.customer === '__new__') {
      if (!newCustomerName.value.trim()) { warn('Nhập tên Customer'); submitting.value = false; return }
      const customerDoc = await createDoc('Customer', {
        customer_name: newCustomerName.value.trim(),
        custom_primary_channel: sellForm.value.sell_channel || undefined,
        custom_external_handle: (sellForm.value.customer_btag_snapshot || '').replace(/\s+/g, '') || undefined,
        default_currency: sellForm.value.sale_currency || undefined,
        custom_primary_game_context: sellGameContext.value || undefined,
      })
      if (!customerDoc?.name) { notifyError('Tạo Customer thất bại'); submitting.value = false; return }
      sellForm.value.customer = customerDoc.name
      customers.value.push({ name: customerDoc.name, customer_name: newCustomerName.value.trim() })
    }

    const items = filledItems.map(r => {
      const item = { currency_item: r.currency_item, quantity: r.quantity, unit_price: r.unit_price }
      Object.keys(item).forEach(k => { if (item[k] === '' || item[k] === null || item[k] === undefined) delete item[k] })
      return item
    })

    payload = {
      sell_channel: sellForm.value.sell_channel,
      customer: sellForm.value.customer || undefined,
      customer_btag_snapshot: (sellForm.value.customer_btag_snapshot || '').replace(/\s+/g, '') || undefined,
      customer_ingame_name_snapshot: sellForm.value.customer_ingame_name_snapshot || undefined,
      game_context: sellGameContext.value,
      sale_currency: sellForm.value.sale_currency,
      channel_fee_native: sellForm.value.channel_fee_native || undefined,
      other_cost_native: sellForm.value.other_cost_native || undefined,
      external_order_id: sellForm.value.external_order_id || undefined,
      order_url: sellForm.value.order_url || undefined,
      notes: sellNote.value,
      linked_currency_item: (sellLinkBuyItem.value && sellLinkedItem.value) || undefined,
      sell_items: items,
      assigned_trader: sellRecipient.value || undefined,
      is_debt_order: +!sellRecipient.value,
      is_negotiation: isMarketplaceChannel.value ? 0 : +sellIsNegotiation.value,
    }
    Object.keys(payload).forEach(k => { if (payload[k] === null || payload[k] === '') delete payload[k] })
    const doc = await createDoc('Sell Order', payload)
    if (doc?.name) {
      // Update Customer with latest BTag/ingame name
      if (sellForm.value.customer && sellForm.value.customer !== '__new__') {
        const updates = {}
        const btag = (sellForm.value.customer_btag_snapshot || '').replace(/\s+/g, '')
        const ingame = (sellForm.value.customer_ingame_name_snapshot || '').trim()
        if (btag) updates.custom_external_handle = btag
        if (ingame) updates.custom_ingame_id = ingame
        if (sellForm.value.sell_channel) updates.custom_primary_channel = sellForm.value.sell_channel
        if (sellGameContext.value) updates.custom_primary_game_context = sellGameContext.value
        if (Object.keys(updates).length) {
          try { await updateDoc('Customer', sellForm.value.customer, updates) } catch {}
        }
      }
      success(`Tạo đơn ${doc.name} thành công`)
      sellOrderItems.value = []
      sellTotalVnd.value = 0
      sellNote.value = ''
      const { refreshBadges } = useBadgeCounts()
      refreshBadges()
      // Show QR dialog for Social/Direct + VND
      const channelGroup = channels.value.find(c => c.name === sellForm.value.sell_channel)?.channel_group || ''
      if ((!channelGroup || channelGroup === 'Social' || channelGroup === 'Direct') && sellForm.value.sale_currency === 'VND') {
        try {
          const qrInfo = await frappeCall('frappe.client.get_list', {
            doctype: 'Sell Order',
            filters: [['name', '=', doc.name]],
            fields: ['vietqr_image', 'payment_reference_code'],
            limit_page_length: 1,
          })
          qrData.value = {
            orderName: doc.name,
            qrUrl: qrInfo?.[0]?.vietqr_image || '',
            refCode: qrInfo?.[0]?.payment_reference_code || '',
          }
          qrDialogOpen.value = true
        } catch {
          router.push('/t1-active')
        }
      } else {
        router.push('/t1-active')
      }
    } else {
      notifyError('Tạo đơn thất bại')
    }
  } catch (e) {
    notifyError('Lỗi kết nối: ' + e.message)
  } finally {
    submitting.value = false
  }
}

async function handleBuySubmit() {
  const t = activeBuyTab.value
  if (!t) return

  const filledItems = t.orderItems.filter(r => r.currency_item && r.quantity > 0)
  if (filledItems.length === 0) { return warn('Thêm ít nhất 1 item') }
  if (filledItems.some(r => !r.currency_item || r.quantity <= 0)) {
    return warn('Vui lòng chọn Currency Item hợp lệ và nhập số lượng lớn hơn 0.')
  }

  submitting.value = true
  error.value = ''
  try {
    // Create new Supplier if needed
    if (t.buyForm.supplier === '__new__') {
      if (!t.newSupplierId.trim()) { warn('Nhập mã NCC (ID)'); submitting.value = false; return }
      if (!t.newSupplierName.trim()) { warn('Nhập tên Supplier'); submitting.value = false; return }
      const supplierDoc = await frappeCall('gege_custom.gege_custom.api.helpers.create_supplier', {
        supplier_name: t.newSupplierName.trim(),
        supplier_id: t.newSupplierId.trim(),
        buy_channel: t.buyForm.buy_channel || undefined,
        preferred_currency: t.buyForm.transaction_currency || undefined,
      })
      if (!supplierDoc?.name) { notifyError('Tạo Supplier thất bại'); submitting.value = false; return }
      t.buyForm.supplier = supplierDoc.name
      suppliers.value.push({ name: supplierDoc.name, supplier_name: supplierDoc.supplier_name })
    }

    const items = filledItems.map(r => {
      const allocs = (r.allocations || []).filter(a => a.game_account && a.quantity > 0)
      const item = { currency_item: r.currency_item, quantity: r.quantity, unit_price: r.unit_price }
      if (allocs.length > 0) {
        item.target_game_account = allocs[0].game_account
        item.receive_allocations_json = JSON.stringify(allocs)
      } else if (t.buyForm.game_account) {
        item.target_game_account = t.buyForm.game_account
      }
      Object.keys(item).forEach(k => { if (item[k] === '' || item[k] === null || item[k] === undefined) delete item[k] })
      return item
    })

    const payload = {
      buy_channel: t.buyForm.buy_channel,
      supplier: t.buyForm.supplier,
      game_context: t.gameContext,
      transaction_currency: t.buyForm.transaction_currency,
      notes: t.note,
      buy_items: items,
      assigned_trader: t.buyForm.assigned_trader || undefined,
      game_account: t.buyForm.game_account || undefined,
      is_negotiation: +buyIsNegotiation.value,
    }
    Object.keys(payload).forEach(k => { if (payload[k] === null || payload[k] === '') delete payload[k] })

    // Warn if assigned trader's Payment wallet balance is insufficient
    if (t.buyForm.assigned_trader && t.buyForm.transaction_currency) {
      try {
        const totalAmount = filledItems.reduce((s, r) => s + (Number(r.quantity || 0) * Number(r.unit_price || 0)), 0)
        if (totalAmount > 0) {
          const walletData = await frappeCall('gege_custom.gege_custom.utils.get_employee_wallet', { user: t.buyForm.assigned_trader })
          const curInfo = (walletData?.currencies || []).find(c => c.currency === t.buyForm.transaction_currency)
          const balance = curInfo?.balance || 0
          if (balance < totalAmount) {
            const balStr = Number(balance).toLocaleString('vi-VN')
            const amtStr = Number(totalAmount).toLocaleString('vi-VN')
            const cur = t.buyForm.transaction_currency
            if (!(await confirm(`⚠ Cảnh báo: Số dư tài khoản chi của nhân viên chỉ còn ${balStr} ${cur}, nhưng đơn hàng cần ${amtStr} ${cur}.\n\nVẫn tiếp tục tạo đơn?`))) {
              submitting.value = false; return
            }
          }
        }
      } catch (e) { /* ignore balance check failure */ }
    }

    const doc = await createDoc('Buy Order', payload)
    if (doc?.name) {
      success(`Tạo đơn ${doc.name} thành công`)
      markTabSubmitted(activeTabId.value, doc.name)
      const { refreshBadges } = useBadgeCounts()
      refreshBadges()
      closeBuyTab(activeTabId.value)
    } else {
      notifyError('Tạo đơn thất bại')
    }
  } catch (e) {
    notifyError('Lỗi kết nối: ' + e.message)
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await fetchMetadata()
  loadRecipientUsers()
  restoreBuyTabs()
  if (buyTabs.value.length === 0 || (buyTabs.value.length === 1 && !isTabDirty(buyTabs.value[0].id))) {
    // Fresh start — no dirty tabs, ensure at least 1 empty tab
  }
})

onUnmounted(() => {
  saveBuyTabs()
})
</script>

<style scoped>
</style>
