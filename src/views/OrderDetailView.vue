<template>
  <DetailPageLayout :loading="loading" loading-text="Đang nạp chi tiết đơn hàng..."
    @dragover="onPageDragOver" @dragleave="onPageDragLeave" @drop="onPageDrop">
    <template #toolbar>
      <BackButton @click="goBack" />
    </template>

    <!-- Full-page drop overlay -->
    <div v-if="pageDragOver && canUpload && canAct"
      class="fixed inset-0 z-40 bg-indigo-600/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-lg uppercase tracking-widest shadow-2xl">
        Thả file để tải bằng chứng cho {{ order?.name }}
      </div>
    </div>

    <!-- Error -->
    <div v-if="fetchError" class="bg-red-500/10 border border-red-500/10 rounded-2xl p-6 text-center">
      <p class="text-red-500 font-black uppercase text-xs tracking-widest">{{ fetchError }}</p>
    </div>

    <template v-else-if="order">
      <div class="detail-zoom">

      <!-- ===== HEADER ===== -->
      <div class="bg-app-surface border border-app-border rounded-2xl overflow-hidden mb-3 sm:mb-4 shadow-sm">
        <!-- Top row: Type + Game + Order name + Status -->
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-app-border flex flex-wrap items-center justify-between gap-2"
          :class="orderType === 'buy' ? 'bg-indigo-500/[0.03]' : 'bg-emerald-500/[0.03]'">
          <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <span class="text-xs px-2.5 py-1 rounded-lg font-black tracking-widest shrink-0"
              :class="orderType === 'buy' ? 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/30' : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'">
              {{ orderType === 'buy' ? 'BUY' : 'SELL' }}
            </span>
            <span v-if="order.game_context" class="text-xs px-2.5 py-1 rounded-lg font-black tracking-wide shrink-0 bg-amber-500/10 text-amber-600 border border-amber-500/20">
              {{ order.game_context }}
            </span>
            <span class="text-app-text-primary font-black text-sm sm:text-base tracking-tight">{{ order.name }}</span>
            <StatusBadge :status="order.status" />
            <span v-if="order.is_negotiation && order.negotiation_status === 'Pending'"
              class="text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide shrink-0 bg-amber-500/15 text-amber-600 border border-amber-500/25">
              Chờ ML
            </span>
            <span v-if="order.is_negotiation && order.negotiation_status === 'Confirmed'"
              class="text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide shrink-0 bg-emerald-500/15 text-emerald-600 border border-emerald-500/25">
              ML duyệt
            </span>
          </div>
          <div class="shrink-0 flex items-center gap-3 text-app-text-muted text-[10px] font-bold uppercase tracking-widest">
            <template v-if="orderType === 'sell' && externalOrderUrl">
              <a :href="externalOrderUrl" target="_blank" class="flex items-center gap-3 text-indigo-400 hover:text-indigo-300 hover:underline">
                <span>{{ order.sell_channel }}</span>
                <span v-if="order.external_order_id" class="opacity-30">|</span>
                <span v-if="order.external_order_id">{{ order.external_order_id }}</span>
                <span v-if="order.customer_ingame_name_snapshot" class="opacity-30">|</span>
                <span v-if="order.customer_ingame_name_snapshot">{{ order.customer_ingame_name_snapshot }}</span>
              </a>
            </template>
            <template v-else>
              <span>{{ orderType === 'buy' ? order.buy_channel : order.sell_channel }}</span>
              <template v-if="orderType === 'sell' && order.external_order_id">
                <span class="opacity-30">|</span>
                <span class="text-app-text-secondary">{{ order.external_order_id }}</span>
              </template>
              <template v-if="orderType === 'sell' && order.customer_ingame_name_snapshot">
                <span class="opacity-30">|</span>
                <span class="text-app-text-secondary">{{ order.customer_ingame_name_snapshot }}</span>
              </template>
            </template>
            <span class="opacity-30">|</span>
            <span>{{ formatDate(order.creation) }}</span>
          </div>
        </div>

        <!-- Items + Total -->
        <div class="px-4 sm:px-6 py-3 border-b border-app-border/50 flex flex-wrap items-center justify-between gap-2">
          <span class="text-app-text-primary font-black text-sm uppercase tracking-tight">{{ orderItemsSummary }}</span>
          <span class="font-mono text-sm font-black px-3 py-1 rounded-xl border border-app-border bg-app-bg"
            :class="orderType === 'buy' ? 'text-indigo-600' : 'text-emerald-600'">
            {{ formatMoney(orderType === 'buy' ? order.total_vnd : netOrderAmount, orderType === 'buy' ? order.transaction_currency : order.sale_currency) }}
          </span>
        </div>

        <!-- Buy Order: Items table -->
        <div v-if="orderType === 'buy' && (order.items?.length || canEditBuyItems)" class="border-b border-app-border/50">

          <!-- EDIT MODE -->
          <div v-if="editingBuyItems" class="px-4 py-3 space-y-2">
            <!-- Header row -->
            <div class="flex items-center gap-2 pb-1 border-b border-app-border/30">
              <span class="flex-1 min-w-0 text-[10px] font-black text-app-text-muted uppercase tracking-widest">Mặt hàng</span>
              <span class="w-20 text-right text-[10px] font-black text-app-text-muted uppercase tracking-widest">SL</span>
              <span class="w-24 text-right text-[10px] font-black text-app-text-muted uppercase tracking-widest">Đơn giá</span>
              <span class="w-5 shrink-0"></span>
            </div>
            <div v-for="(item, idx) in editedBuyItems" :key="idx"
              class="flex items-center gap-2 py-1">
              <SearchableSelect v-model="item.currency_item" :options="buyItemOptsForRow(idx)" placeholder="Mặt hàng" class="flex-1 min-w-0" compact />
              <input v-model.number="item.quantity" type="number" min="0.001" step="any"
                class="w-20 text-right bg-app-bg text-app-text-primary border border-app-border rounded-lg px-2 py-1 text-xs font-mono font-bold outline-none focus:border-emerald-600"
                placeholder="SL" />
              <input v-model.number="item.unit_price" type="number" min="0" step="any"
                class="w-24 text-right bg-app-bg text-app-text-primary border border-app-border rounded-lg px-2 py-1 text-xs font-mono font-bold outline-none focus:border-emerald-600"
                placeholder="Đơn giá" />
              <button type="button" @click="editedBuyItems.splice(idx, 1)"
                class="text-red-400 hover:text-red-300 text-sm px-1 shrink-0 w-5 text-center">&#10005;</button>
            </div>
            <!-- Actions -->
            <div class="flex items-center gap-3 pt-1">
              <button type="button" @click="editedBuyItems.push({ name: '', currency_item: '', quantity: 0, unit_price: 0 })"
                class="text-xs font-bold text-emerald-500 hover:text-emerald-400">+ Thêm dòng</button>
              <div class="flex-1" />
              <button type="button" @click="cancelEditBuyItems"
                class="px-4 py-1.5 rounded-lg text-xs font-bold text-app-text-muted hover:text-app-text-primary border border-app-border">Hủy</button>
              <button type="button" @click="saveEditedBuyItems" :disabled="savingBuyItems"
                class="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                {{ savingBuyItems ? 'Đang lưu...' : 'Lưu' }}
              </button>
            </div>
          </div>

          <!-- READ MODE -->
          <div v-else>
            <div class="space-y-0">
              <div v-for="(item, i) in order.items" :key="i" class="border-b border-app-border/20 last:border-b-0">
                <!-- Item header -->
                <div class="flex items-center justify-between px-4 py-2 hover:bg-app-bg/30">
                  <span class="font-bold text-app-text-primary text-xs">{{ cItemName(item) }}</span>
                  <span class="text-app-text-muted text-[10px] font-mono">
                    {{ formatQty(item.quantity) }} x {{ formatMoney(item.unit_price, order.sale_currency || order.transaction_currency) }}
                    <span v-if="item.received_quantity > 0 && item.received_quantity < item.quantity - 0.001" class="text-amber-500 ml-1">(đã nhận {{ formatQty(item.received_quantity) }})</span>
                  </span>
                </div>
                <!-- Multi-account allocations (editable, only for items not yet fully received) -->
                <div v-if="canUpload && (item.quantity - (item.received_quantity || 0)) > 0.001" class="px-4 pb-2 space-y-1">
                  <div v-for="(alloc, aIdx) in (receivingAllocs[i] || [])" :key="aIdx" class="flex items-center gap-2">
                    <SearchableSelect v-model="alloc.game_account" :options="recvAccountOpts(i, aIdx)" placeholder="-- Chọn kho --" class="flex-1" compact />
                    <input v-model.number="alloc.quantity" type="number" min="0.001" step="any"
                      class="w-20 text-right bg-app-bg text-app-text-primary border border-app-border rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-600" placeholder="SL" />
                    <button v-if="(receivingAllocs[i] || []).length > 1" type="button" @click="receivingAllocs[i].splice(aIdx, 1)" class="text-red-400 hover:text-red-300 text-xs px-1">&#10005;</button>
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" @click="addRecvAlloc(i)" class="text-xs text-indigo-400 hover:text-indigo-300">+ Thêm kho</button>
                    <span v-if="recvAllocTotal(i) > 0" class="text-[9px] font-bold ml-auto"
                      :class="Math.abs((item.received_quantity || 0) + recvAllocTotal(i) - item.quantity) < 0.001 ? 'text-emerald-600' : 'text-amber-600'">
                      +{{ formatQty(recvAllocTotal(i)) }} → {{ formatQty(Math.min((item.received_quantity || 0) + recvAllocTotal(i), item.quantity)) }} / {{ formatQty(item.quantity) }}
                    </span>
                  </div>
                </div>
                <!-- Fully received indicator -->
                <div v-else-if="canUpload && (item.quantity - (item.received_quantity || 0)) <= 0.001" class="px-4 pb-2 text-[10px] text-emerald-500">
                  Đã nhận đủ: {{ formatQty(item.received_quantity) }} / {{ formatQty(item.quantity) }}
                </div>
                <!-- Read-only view -->
                <div v-else class="px-4 pb-2 flex items-center gap-3 text-[10px] text-app-text-secondary">
                  <span>Thực nhận: {{ formatQty(item.received_quantity) }}</span>
                  <span>Kho: {{ item.target_game_account || '—' }}</span>
                </div>
              </div>
            </div>
            <!-- Edit button for buy items -->
            <div v-if="canEditBuyItems && order.items?.length" class="px-4 py-2 border-t border-app-border/20">
              <button type="button" @click="startEditBuyItems"
                class="text-[9px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-widest">Sửa</button>
            </div>
            <div v-else-if="canEditBuyItems && !order.items?.length" class="px-4 py-3 flex items-center justify-between">
              <span class="text-xs text-app-text-muted italic">Chưa có mặt hàng</span>
              <button type="button" @click="startEditBuyItems"
                class="text-xs font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest">+ Thêm</button>
            </div>
          </div>
        </div>

        <!-- Sell Order: Items table -->
        <div v-if="orderType === 'sell' && (order.items?.length || canEditSellItems)" class="border-b border-app-border/50">

          <!-- READ MODE -->
          <div v-if="!editingItems">
            <div v-if="order.items?.length" class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead class="bg-app-bg/50">
                  <tr class="text-app-text-muted text-[9px] font-black uppercase tracking-widest border-b border-app-border/30">
                    <th class="text-left py-2 px-4">Mặt hàng</th>
                    <th class="text-right py-2 px-4">Số lượng</th>
                    <th v-if="order.items.some(i => (i.delivered_quantity || 0) > 0)" class="text-right py-2 px-4">Đã giao</th>
                    <th class="text-right py-2 px-4">Đơn giá</th>
                    <th class="text-right py-2 px-4">Thành tiền</th>
                    <th v-if="order.items.some(i => i.unit_cost_price)" class="text-right py-2 px-4">Giá vốn</th>
                    <th v-if="order.items.some(i => i.profit)" class="text-right py-2 px-4 text-emerald-600">Lợi nhuận</th>
                    <th v-if="canEditSellItems" class="py-2 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-app-border/20">
                  <tr v-for="(item, i) in order.items" :key="i" class="hover:bg-app-bg/30">
                    <td class="py-2 px-4 font-bold text-app-text-primary">
                      {{ cItemName(item) }}
                      <span v-if="(item.delivered_quantity || 0) >= (item.quantity || 0) - 0.001 && (item.delivered_quantity || 0) > 0" class="text-emerald-500 ml-1 text-[8px]">Đã giao đủ</span>
                    </td>
                    <td class="py-2 px-4 text-right font-mono font-bold text-app-text-secondary">{{ formatQty(item.quantity) }}</td>
                    <td v-if="order.items.some(i => (i.delivered_quantity || 0) > 0)" class="py-2 px-4 text-right font-mono"
                      :class="(item.delivered_quantity || 0) >= (item.quantity || 0) - 0.001 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'">
                      {{ formatQty(item.delivered_quantity || 0) }}
                    </td>
                    <td class="py-2 px-4 text-right font-mono text-app-text-secondary opacity-60">{{ formatMoney(item.unit_price, order.sale_currency || order.transaction_currency) }}</td>
                    <td class="py-2 px-4 text-right font-mono font-bold text-indigo-600">{{ formatMoney(item.total, order.sale_currency || order.transaction_currency) }}</td>
                    <td v-if="order.items.some(i => i.unit_cost_price)" class="py-2 px-4 text-right font-mono text-app-text-secondary opacity-60">{{ formatMoney(item.unit_cost_price, order.sale_currency || order.transaction_currency) }}</td>
                    <td v-if="order.items.some(i => i.profit)" class="py-2 px-4 text-right font-mono font-bold text-emerald-600">{{ formatMoney(item.profit, order.sale_currency || order.transaction_currency) }}</td>
                    <td v-if="canEditSellItems && i === 0" :rowspan="order.items.length" class="py-2 px-2 align-top">
                      <button type="button" @click="startEditItems"
                        class="text-xs font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest">Sửa</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="px-4 py-3 flex items-center justify-between">
              <span class="text-xs text-app-text-muted italic">
                <template v-if="order.custom_qty">Custom - {{ order.custom_item_name || '?' }} — {{ order.custom_qty }} items cần giao</template>
                <template v-else>Chưa có mặt hàng</template>
              </span>
              <button type="button" @click="startEditItems"
                class="text-xs font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest">+ Thêm</button>
            </div>
          </div>

          <!-- EDIT MODE -->
          <div v-else class="px-4 py-3 space-y-2">
            <!-- Header row -->
            <div class="flex items-center gap-2 pb-1 border-b border-app-border/30">
              <span class="flex-1 min-w-0 text-[10px] font-black text-app-text-muted uppercase tracking-widest">Mặt hàng</span>
              <span class="w-20 text-right text-[10px] font-black text-app-text-muted uppercase tracking-widest">SL</span>
              <span class="w-24 text-right text-[10px] font-black text-app-text-muted uppercase tracking-widest">Đơn giá</span>
              <span class="w-24 text-right text-[10px] font-black text-app-text-muted uppercase tracking-widest shrink-0">Thành tiền</span>
              <span class="w-5 shrink-0"></span>
            </div>
            <div v-for="(item, idx) in editedItems" :key="idx"
              class="flex items-center gap-2 py-1">
              <SearchableSelect v-model="item.currency_item" :options="sellItemOptsForRow(idx)" placeholder="Mặt hàng" class="flex-1 min-w-0"
                :disabled="item.delivered_quantity > 0" compact />
              <input v-model.number="item.quantity" type="number" min="1" step="1"
                class="w-20 text-right bg-app-bg text-app-text-primary border border-app-border rounded-lg px-2 py-1 text-xs font-mono font-bold outline-none focus:border-emerald-600"
                placeholder="SL" />
              <input v-model.number="item.unit_price" type="number" min="0" step="any"
                class="w-24 text-right bg-app-bg text-app-text-primary border border-app-border rounded-lg px-2 py-1 text-xs font-mono font-bold outline-none focus:border-emerald-600"
                placeholder="Đơn giá" />
              <span class="text-xs font-mono text-app-text-muted w-24 text-right shrink-0">
                {{ formatMoney(item.quantity * item.unit_price, order.sale_currency) }}
              </span>
              <button v-if="item.delivered_quantity <= 0" type="button" @click="removeEditedItem(idx)"
                class="text-red-400 hover:text-red-300 text-sm px-1 shrink-0 w-5 text-center">&#10005;</button>
              <span v-else class="w-5 shrink-0"></span>
            </div>
            <!-- Total summary -->
            <div v-if="editedItems.length > 0" class="flex items-center gap-2 pt-1 border-t border-app-border/30">
              <span class="flex-1 text-xs font-bold text-app-text-muted">
                Tổng: {{ editedItems.reduce((s, i) => s + (i.quantity || 0), 0) }}
              </span>
              <span class="w-20"></span>
              <span class="w-24"></span>
              <span class="text-xs font-mono font-bold text-indigo-600 w-24 text-right shrink-0">
                {{ formatMoney(editedItems.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0), order.sale_currency) }}
              </span>
              <span class="w-5 shrink-0"></span>
            </div>
            <!-- Actions -->
            <div class="flex items-center gap-3 pt-1">
              <button type="button" @click="addEditedItem"
                class="text-xs font-bold text-emerald-500 hover:text-emerald-400">+ Thêm dòng</button>
              <div class="flex-1" />
              <button type="button" @click="cancelEditItems"
                class="px-4 py-1.5 rounded-lg text-xs font-bold text-app-text-muted hover:text-app-text-primary border border-app-border">Hủy</button>
              <button type="button" @click="saveEditedItems" :disabled="savingItems"
                class="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                {{ savingItems ? 'Đang lưu...' : 'Lưu' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Sell Order: Fee breakdown (Marketplace) -->
        <div v-if="orderType === 'sell' && (order.channel_fee_vnd || order.other_cost_vnd)" class="px-4 sm:px-6 py-3 border-b border-app-border/50 bg-emerald-500/[0.02]">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-[9px] font-black text-orange-600 uppercase tracking-widest">Phí sàn</span>
          </div>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-app-text-muted">Tổng tiền hàng</span>
              <span class="font-bold text-app-text-primary">{{ formatMoney(order.gross_sale_vnd, order.sale_currency) }}</span>
            </div>
            <div v-if="order.channel_fee_vnd" class="flex justify-between">
              <span class="text-app-text-muted">- Commission</span>
              <span class="font-bold text-red-500">{{ formatMoney(order.channel_fee_vnd, order.sale_currency) }}</span>
            </div>
            <div v-if="order.other_cost_vnd" class="flex justify-between">
              <span class="text-app-text-muted">- Chi phí khác</span>
              <span class="font-bold text-red-500">{{ formatMoney(order.other_cost_vnd, order.sale_currency) }}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-app-border/30">
              <span class="font-black text-app-text-primary">Thực nhận</span>
              <span class="font-black text-emerald-600">{{ formatMoney(order.earning_vnd, order.sale_currency) }}</span>
            </div>
          </div>
        </div>

        <!-- Refund info (always visible when refund_amount > 0) -->
        <div v-if="order.refund_amount > 0" class="px-4 sm:px-6 py-3 border-b border-app-border/50 bg-red-500/[0.02]">
          <div class="space-y-1 text-xs">
            <div class="flex items-center gap-1.5 mb-2">
              <span class="text-[9px] font-black text-red-500 uppercase tracking-widest">Hoàn tiền</span>
              <span class="text-[9px] text-app-text-muted">— {{ order.workflow_state }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-app-text-muted">Số tiền hoàn</span>
              <span class="font-black text-red-500">-{{ formatMoney(order.refund_amount, order.sale_currency) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-app-text-muted">Còn lại</span>
              <span class="font-black text-emerald-600">{{ formatMoney((Number(order.earning_native || order.earning_vnd || 0) - Number(order.refund_amount || 0)), order.sale_currency) }}</span>
            </div>
            <div v-if="order.refund_reason" class="flex justify-between">
              <span class="text-app-text-muted">Lý do</span>
              <span class="text-app-text-primary">{{ order.refund_reason }}</span>
            </div>
            <div v-if="refundReturnedItems.length" class="mt-1 space-y-0.5">
              <span class="text-app-text-muted">Trả lại hàng:</span>
              <div v-for="ri in refundReturnedItems" :key="ri.item" class="flex justify-between pl-2">
                <span class="text-app-text-secondary">{{ ri.item }}</span>
                <span class="text-app-text-primary font-bold">x{{ ri.qty }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Buy Order: Payment Reference Code -->
        <div v-if="orderType === 'buy' && order.payment_reference_code" class="px-4 sm:px-6 py-3 border-b border-app-border/50 bg-indigo-500/[0.02]">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Thanh toán</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-app-text-muted text-xs">Mã tham chiếu</span>
              <span class="text-app-text-primary font-mono font-black text-sm">{{ order.payment_reference_code }}</span>
              <CopyButton :text="order.payment_reference_code" title="Copy mã" />
            </div>
            <div v-if="order.vietqr_image" class="mt-2">
              <div @click="openLightbox({ attachment: order.vietqr_image })"
                class="w-24 h-24 rounded-xl bg-app-bg border border-app-border overflow-hidden cursor-pointer hover:border-indigo-600 transition relative group">
                <img :src="order.vietqr_image" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"><span>🔎</span></div>
              </div>
            </div>
            <span v-if="order.payment_method === 'Manual'" class="inline-block text-[10px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded font-bold">Chuyển khoản thủ công</span>
            <span v-else-if="order.payment_method === 'VietQR'" class="inline-block text-[10px] text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded font-bold">VietQR</span>
          </div>
        </div>

        <!-- Actions -->
        <div v-if="canAct && (availableActions.length || canRequestCancel) || canClaim"
          class="px-4 sm:px-6 py-4 border-t border-app-border/50 flex flex-wrap items-center gap-2 sm:gap-3"
          :class="orderType === 'buy' ? 'bg-indigo-500/[0.02]' : 'bg-emerald-500/[0.02]'"
          @click.stop>
          <span class="text-app-text-muted text-[9px] font-black uppercase tracking-widest opacity-40 mr-auto">Thao tác</span>
          <AppButton v-if="canClaim" variant="primary" size="md"
            :loading="transitioning === 'Claim'" :disabled="!!transitioning"
            @click="handleClaim">
            Nhận đơn
          </AppButton>
          <AppButton v-if="startDeliveryAction" variant="primary" size="md"
            :loading="transitioning === startDeliveryAction.action" :disabled="!!transitioning"
            @click="startDeliveryAction.action === 'Start Delivery' ? openStartDelivery() : askConfirmation(startDeliveryAction)">
            {{ actionLabel(startDeliveryAction.action) }}
          </AppButton>
          <!-- Evidence Uploaded + sell: Đã giao = upload evidence + transition Delivered -->
          <AppButton v-if="deliverAction && isSellEvidenceUploaded" variant="success" size="md"
            :loading="deliveringEvidence" :disabled="deliveringEvidence"
            @click="handleDeliverWithEvidence">
            {{ actionLabel(deliverAction.action) }}
          </AppButton>
          <!-- Normal Deliver (buy orders, other states) -->
          <AppButton v-else-if="deliverAction" variant="success" size="md"
            :loading="transitioning === deliverAction.action" :disabled="!!transitioning"
            @click="askConfirmation(deliverAction)">
            {{ actionLabel(deliverAction.action) }}
          </AppButton>
          <!-- Upload evidence (hidden when Evidence Uploaded + sell — handled by Đã giao) -->
          <AppButton v-if="canUpload" variant="primary" size="md" @click="openUpload">Tải bằng chứng</AppButton>
          <AppButton v-if="completeAction" variant="success" size="md"
            :loading="transitioning === completeAction.action" :disabled="!!transitioning"
            @click="askConfirmation(completeAction)">
            {{ actionLabel(completeAction.action) }}
          </AppButton>
          <AppButton v-if="createDebtAction" variant="warning" size="md"
            :loading="transitioning === createDebtAction.action" :disabled="!!transitioning"
            @click="askConfirmation(createDebtAction)">
            {{ actionLabel(createDebtAction.action) }}
          </AppButton>
          <AppButton v-for="action in otherActions" :key="action.action"
            :variant="actionStyle(action.action)" size="md"
            :loading="transitioning === action.action" :disabled="!!transitioning"
            @click="askConfirmation(action)">
            {{ actionLabel(action.action) }}
          </AppButton>
          <AppButton v-if="canRequestCancel" variant="danger-ghost" size="md"
            :loading="transitioning === 'Request Cancel'" :disabled="!!transitioning"
            @click="askConfirmation({ action: 'Request Cancel', method: 'request_cancel' })">
            Yêu cầu hủy
          </AppButton>
        </div>
      </div>

      <!-- ===== CUSTOMER / SUPPLIER + GHI CHÚ ===== -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <!-- Customer/Supplier -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 shadow-sm">
          <h3 class="text-app-text-muted text-[10px] font-black uppercase tracking-widest mb-3 opacity-50">{{ orderType === 'buy' ? 'Nhà cung cấp' : 'Khách hàng' }}</h3>

          <!-- BUY -->
          <template v-if="orderType === 'buy'">
            <div class="text-app-text-primary font-black text-base sm:text-xl tracking-tight mb-3 truncate">
              <a v-if="supplierUrl" :href="supplierUrl" target="_blank" rel="noopener" class="text-indigo-500 hover:text-indigo-400 hover:underline">{{ supplierData?.supplier_name || order.supplier }}</a>
              <template v-else>{{ supplierData?.supplier_name || order.supplier }}</template>
            </div>
            <div v-if="supplierData?.custom_payment_qr || order.customer_ingame_name_snapshot" class="mt-3 flex items-start gap-3">
              <div v-if="supplierData?.custom_payment_qr"
                @click="openLightbox({ attachment: supplierData.custom_payment_qr })"
                class="w-14 h-14 rounded-xl bg-app-bg border border-app-border overflow-hidden cursor-pointer hover:border-indigo-600 transition relative group shrink-0">
                <img :src="supplierData.custom_payment_qr" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"><span>🔎</span></div>
              </div>
              <div v-if="order.customer_ingame_name_snapshot" class="flex flex-col gap-1 flex-1 min-w-0">
                <span class="text-app-text-muted text-[9px] font-black uppercase tracking-widest opacity-40">In-game</span>
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="text-app-text-primary font-bold truncate">{{ order.customer_ingame_name_snapshot }}</span>
                  <CopyButton :text="order.customer_ingame_name_snapshot" title="Copy" />
                </div>
              </div>
            </div>
          </template>

          <!-- SELL -->
          <template v-else>
            <div class="text-app-text-primary font-black text-base sm:text-xl tracking-tight mb-3 break-words">
              <a v-if="customerUrl" :href="customerUrl" target="_blank" class="text-emerald-500 hover:text-emerald-400 hover:underline">{{ order.customer_name_snapshot || order.customer }}</a>
              <template v-else>{{ order.customer_name_snapshot || order.customer }}</template>
            </div>
            <div class="space-y-2">
              <CopyRow v-if="order.customer_handle_snapshot" label="INGAME" :value="order.customer_handle_snapshot" copy-title="Sao chép Ingame" color="secondary" />
              <CopyRow v-if="order.customer_btag_snapshot" label="BTAG" :value="order.customer_btag_snapshot" copy-title="Sao chép BattleTag" color="secondary" />
            </div>
            <div v-if="order.vietqr_image" class="mt-3">
              <span class="text-app-text-muted text-[9px] font-black uppercase tracking-widest opacity-40 block mb-2">Mã thanh toán</span>
              <div class="flex items-start gap-3">
                <div @click="openLightbox({ attachment: order.vietqr_image })"
                  class="w-24 h-24 rounded-xl bg-app-bg border border-app-border overflow-hidden cursor-pointer hover:border-indigo-600 transition relative group shrink-0">
                  <img :src="order.vietqr_image" class="w-full h-full object-cover" />
                  <div class="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"><span>🔎</span></div>
                </div>
                <div v-if="order.payment_reference_code" class="flex flex-col gap-1 flex-1 min-w-0">
                  <span class="text-app-text-muted text-[9px] font-black uppercase tracking-widest opacity-40">Mã tham chiếu</span>
                  <div class="flex items-center gap-1.5 text-xs">
                    <span class="text-app-text-primary font-mono font-black truncate">{{ order.payment_reference_code }}</span>
                    <CopyButton :text="order.payment_reference_code" title="Copy mã" />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- GHI CHÚ -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-app-text-muted text-[10px] font-black uppercase tracking-widest opacity-50">Ghi chú</h3>
            <div class="flex items-center gap-1">
              <AppButton v-if="order.note" variant="ghost" size="sm" @click="copyNote">📋 Copy</AppButton>
              <AppButton v-if="canAct && (isTrader1 || isAdmin)" variant="ghost" size="sm" @click="openEditNote">Sửa</AppButton>
            </div>
          </div>
          <div v-if="order.note" class="bg-app-bg/50 border border-app-border rounded-xl p-3">
            <p class="text-app-text-secondary text-sm whitespace-pre-wrap leading-relaxed break-all" v-html="linkify(order.note)"></p>
          </div>
          <p v-else class="text-app-text-muted text-xs opacity-40 italic">Không có ghi chú</p>
          <div class="mt-3 pt-3 border-t border-app-border/30 space-y-1.5 text-[10px]">
            <div class="flex justify-between">
              <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">Người tạo</span>
              <span class="text-app-text-primary font-bold">{{ userName(order.created_by) || '—' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">Người nhận</span>
              <span class="text-app-text-primary font-bold">{{ userName(order.claimed_by) || '—' }}</span>
            </div>
            <div v-if="order.claimed_at" class="flex justify-between">
              <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">Thời gian nhận</span>
              <span class="text-app-text-secondary font-bold opacity-60">{{ formatDate(order.claimed_at) }}</span>
            </div>
            <!-- ML price confirmation -->
            <template v-if="order.is_negotiation && order.price_set_by">
              <div class="flex justify-between">
                <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">ML duyệt giá</span>
                <span class="text-app-text-primary font-bold">{{ userName(order.price_set_by) }}</span>
              </div>
              <div v-if="order.price_set_at" class="flex justify-between">
                <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">Thời gian duyệt</span>
                <span class="text-app-text-secondary font-bold opacity-60">{{ formatDate(order.price_set_at) }}</span>
              </div>
            </template>
            <!-- Assigned Trader (buy) -->
            <div v-if="orderType === 'buy'" class="flex justify-between items-center gap-2">
              <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">Người thanh toán</span>
              <div class="flex items-center gap-2">
                <span class="text-app-text-primary font-bold">{{ userName(order.assigned_trader) || '—' }}</span>
                <button v-if="isPaymentOrAbove && order.status !== 'Completed' && order.status !== 'Cancelled'" type="button"
                  class="text-[9px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest"
                  @click="openTraderAssign">Đổi</button>
              </div>
            </div>
            <!-- Tài khoản thanh toán (buy) -->
            <div v-if="orderType === 'buy'" class="flex justify-between">
              <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">Tài khoản thanh toán</span>
              <span class="text-app-text-primary font-bold">{{ order.paid_from_trader_account || '—' }}</span>
            </div>
            <!-- Assigned Trader (sell) -->
            <div v-if="orderType === 'sell'" class="flex justify-between items-center gap-2">
              <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">Người nhận tiền</span>
              <div class="flex items-center gap-2">
                <span class="text-app-text-primary font-bold">{{ userName(order.assigned_trader) || '—' }}</span>
                <button v-if="isPaymentOrAbove && order.status !== 'Completed' && order.status !== 'Cancelled'" type="button"
                  class="text-[9px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest"
                  @click="openTraderAssign">Đổi</button>
              </div>
            </div>
            <!-- Tài khoản nhận tiền (sell) -->
            <div v-if="orderType === 'sell'" class="flex justify-between">
              <span class="text-app-text-muted font-black uppercase tracking-widest opacity-40">Tài khoản nhận tiền</span>
              <span class="text-app-text-primary font-bold">{{ order.trader_1_receiving_account || '—' }}</span>
            </div>
          </div>
        </div>
      </div>


      <!-- ===== BẰNG CHỨNG ===== -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 mb-3 sm:mb-4 shadow-sm">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-app-text-muted text-[10px] font-black uppercase tracking-widest opacity-50">Bằng chứng ({{ evidence.length }})</h3>
          <AppButton v-if="canUpload" variant="primary" size="sm" @click="openUpload">Tải lên</AppButton>
        </div>
        <EmptyState v-if="evidence.length === 0" icon="📭" text="Chưa có bằng chứng" />
        <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          <div v-for="ev in evidence" :key="ev.name"
            class="bg-app-bg border border-app-border rounded-xl overflow-hidden cursor-pointer group/card hover:shadow-lg transition-all"
            @click="openLightbox(ev)">
            <div class="aspect-video bg-app-surface flex items-center justify-center relative overflow-hidden">
              <img v-if="isImage(ev.attachment)" :src="ev.attachment" class="w-full h-full object-cover group-hover/card:scale-110 transition duration-500" />
              <video v-else-if="isVideo(ev.attachment)" :src="ev.attachment" class="w-full h-full object-cover" muted></video>
              <span v-else class="text-3xl">📄</span>
            </div>
            <div class="px-3 py-2 border-t border-app-border/30 flex justify-between items-center opacity-40">
              <p class="text-[9px] text-app-text-muted font-bold truncate">{{ userName(ev.uploaded_by) }}</p>
              <p class="text-[8px] text-app-text-muted font-bold">{{ formatDate(ev.uploaded_at) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== PHÂN BỔ LOT (FIFO) ===== -->
      <div v-if="saleAllocations.length > 0" class="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 mb-3 sm:mb-4 shadow-sm">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-app-text-muted text-[10px] font-black uppercase tracking-widest opacity-50">Phân bổ Lot ({{ saleAllocations.length }})</h3>
          <router-link to="/lots" class="text-[10px] font-black text-indigo-600 hover:text-indigo-400 uppercase tracking-widest transition-colors">Quản lý Lot →</router-link>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-app-border/50">
                <th class="text-left py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">#</th>
                <th class="text-left py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Lot</th>
                <th class="text-left py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Loại</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">SL</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Giá vốn/đv</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">FX</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">COGS</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Giá bán/đv</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Margin</th>
                <th class="text-left py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Mua từ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sa in saleAllocations" :key="sa.name" class="border-b border-app-border/20 hover:bg-app-bg/50 transition-colors">
                <td class="py-2 px-2 text-app-text-muted font-bold">{{ sa.fifo_rank }}</td>
                <td class="py-2 px-2">
                  <router-link :to="`/lots?lot=${sa.lot}`" class="text-indigo-600 hover:text-indigo-400 font-bold transition-colors">{{ sa.lot }}</router-link>
                </td>
                <td class="py-2 px-2">
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    :class="sa.lot_type === 'Flip' ? 'bg-purple-500/10 text-purple-600' : 'bg-blue-500/10 text-blue-600'">
                    {{ sa.lot_type }}
                  </span>
                </td>
                <td class="py-2 px-2 text-right font-mono font-bold">{{ fmtNum(sa.qty_allocated) }}</td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(sa.cost_native_of_lot) }} <span class="text-app-text-muted text-[8px]">{{ sa.native_currency_of_lot }}</span></td>
                <td class="py-2 px-2 text-right font-mono text-app-text-muted">{{ fmtNum(sa.fx_rate_to_sell, 6) }}</td>
                <td class="py-2 px-2 text-right font-mono font-bold">{{ fmtNum(sa.cost_in_sell_currency) }}</td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(sa.sell_price_per_unit_native) }}</td>
                <td class="py-2 px-2 text-right font-bold" :class="sa.margin_pct >= 0 ? 'text-emerald-600' : 'text-red-500'">
                  {{ sa.margin_pct >= 0 ? '+' : '' }}{{ fmtNum(sa.margin_pct, 1) }}%
                </td>
                <td class="py-2 px-2">
                  <router-link v-if="sa.primary_source_buy_order" :to="`/order/buy/${sa.primary_source_buy_order}`" class="text-indigo-600 hover:text-indigo-400 text-[10px] font-bold transition-colors">{{ sa.primary_source_buy_order }}</router-link>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-app-border/50 font-bold">
                <td colspan="3" class="py-2 px-2 text-right text-app-text-muted">Tổng</td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(saleAllocations.reduce((s, a) => s + Number(a.qty_allocated || 0), 0)) }}</td>
                <td colspan="2"></td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(saleAllocations.reduce((s, a) => s + Number(a.cost_in_sell_currency || 0), 0)) }}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- ===== LOTS ĐƯỢC TẠO (BUY ORDER) ===== -->
      <div v-if="orderType === 'buy' && buyLots.length > 0" class="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 mb-3 sm:mb-4 shadow-sm">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-app-text-muted text-[10px] font-black uppercase tracking-widest opacity-50">Lots được tạo ({{ buyLots.length }})</h3>
          <router-link to="/lots" class="text-[10px] font-black text-indigo-600 hover:text-indigo-400 uppercase tracking-widest transition-colors">Quản lý Lot →</router-link>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-app-border/50">
                <th class="text-left py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">#</th>
                <th class="text-left py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Lot</th>
                <th class="text-left py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Loại</th>
                <th class="text-left py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Account</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">SL ban đầu</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Còn lại</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Tổng giá</th>
                <th class="text-right py-2 px-2 text-app-text-muted font-black uppercase tracking-wider text-[9px]">Giá/đv</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(lot, idx) in buyLots" :key="lot.name" class="border-b border-app-border/20 hover:bg-app-bg/50 transition-colors">
                <td class="py-2 px-2 text-app-text-muted font-bold">{{ idx + 1 }}</td>
                <td class="py-2 px-2">
                  <router-link :to="`/lots?lot=${lot.name}`" class="text-indigo-600 hover:text-indigo-400 font-bold transition-colors">{{ lot.name }}</router-link>
                </td>
                <td class="py-2 px-2">
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    :class="lot.lot_type === 'Flip' ? 'bg-purple-500/10 text-purple-600' : 'bg-blue-500/10 text-blue-600'">
                    {{ lot.lot_type }}
                  </span>
                </td>
                <td class="py-2 px-2 text-app-text-secondary text-[10px]">{{ lot.game_account }}</td>
                <td class="py-2 px-2 text-right font-mono font-bold">{{ fmtNum(lot.qty_initial) }}</td>
                <td class="py-2 px-2 text-right font-mono font-bold" :class="lot.qty_remaining > 0 ? 'text-emerald-600' : 'text-app-text-muted'">{{ fmtNum(lot.qty_remaining) }}</td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(lot.cost_native) }} <span class="text-app-text-muted text-[8px]">{{ lot.native_currency }}</span></td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(lot.qty_initial > 0 ? lot.cost_native / lot.qty_initial : 0) }} <span class="text-app-text-muted text-[8px]">{{ lot.native_currency }}</span></td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-app-border/50 font-bold">
                <td colspan="4" class="py-2 px-2 text-right text-app-text-muted">Tổng</td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(buyLots.reduce((s, l) => s + Number(l.qty_initial || 0), 0)) }}</td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(buyLots.reduce((s, l) => s + Number(l.qty_remaining || 0), 0)) }}</td>
                <td class="py-2 px-2 text-right font-mono">{{ fmtNum(buyLots.reduce((s, l) => s + Number(l.cost_native || 0), 0)) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- ===== LỊCH SỬ HOẠT ĐỘNG ===== -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 shadow-sm">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-app-text-muted text-[10px] font-black uppercase tracking-widest opacity-50">Lịch sử hoạt động</h3>
          <AppButton variant="ghost" size="sm" @click="showAddNote = true">+ Thêm ghi chú</AppButton>
        </div>
        <EmptyState v-if="logs.length === 0" icon="📜" text="Chưa có hoạt động" />
        <div v-else class="space-y-2 max-h-[400px] overflow-y-auto">
          <div v-for="log in logs" :key="log.name" class="flex gap-3 items-start">
            <div class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs border" :class="logStyle(log.action)">
              {{ logIcon(log.action) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-[10px] font-black text-app-text-primary truncate">{{ userName(log.owner) || log.owner }}</span>
                <span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" :class="logColor(log.action)">{{ log.action }}</span>
                <span class="text-[8px] text-app-text-muted font-bold ml-auto shrink-0">{{ formatTimeAgo(log.creation) }}</span>
              </div>
              <p v-if="log.note" class="text-xs text-app-text-secondary whitespace-pre-wrap leading-relaxed opacity-80" v-html="linkify(log.note)"></p>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== MODALS ===== -->

      <!-- Upload Evidence -->
      <ModalWrapper v-model="showUpload" radius="2xl sm:[3rem]" :z-index="50">
        <div class="p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight text-center mb-4">Tải bằng chứng</h3>
          <EvidenceUploadModal ref="uploadFormRef" :uploading="uploading" :error="uploadError" :existing-evidence="evidence"
            @submit="handleUpload" @cancel="showUpload = false" @preview="openLightbox" />
        </div>
      </ModalWrapper>

      <!-- Add Note -->
      <ModalWrapper v-model="showAddNote" radius="2xl sm:[3rem]" :z-index="50">
        <div class="p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight text-center mb-4">Thêm ghi chú</h3>
          <textarea v-model="newNoteText" placeholder="Nội dung ghi chú..."
            class="w-full bg-app-surface border border-app-border rounded-xl p-4 text-app-text-primary text-sm font-medium mb-4 resize-none outline-none focus:border-indigo-600 min-h-[120px]" rows="4"></textarea>
          <div class="flex gap-3">
            <AppButton variant="neutral" size="lg" class="flex-1" @click="showAddNote = false">Quay lại</AppButton>
            <AppButton variant="primary" size="lg" class="flex-[2]" :loading="submittingNote" :disabled="submittingNote" @click="submitNote">Ghi nhận</AppButton>
          </div>
        </div>
      </ModalWrapper>

      <!-- Start Delivery (Sell Order) -->
      <ModalWrapper v-model="startDeliveryModal" size="lg">
        <template #header>
          <h3 class="text-app-text-primary font-bold text-lg px-4 sm:px-6 pt-4 pb-3 border-b border-app-border">
            Bắt đầu giao hàng - {{ order?.name }}
          </h3>
        </template>
        <div class="p-4 sm:p-6">
          <div v-if="deliveryLoading" class="text-center py-6 text-app-text-muted">
            <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Đang kiểm tra tồn kho...
          </div>
          <div v-else-if="deliveryItems.length === 0" class="text-center py-6 text-app-text-muted text-sm">Không có item cần giao</div>
          <div v-else class="space-y-4">
            <div v-for="(di, diIdx) in deliveryItems" :key="diIdx" class="bg-app-bg border border-app-border rounded-xl p-4">
              <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-bold text-app-text-primary">{{ cItemName(di) }}</span>
                <span class="text-xs text-app-text-muted font-mono">Cần giao: {{ formatQty(di.remaining_quantity ?? di.quantity) }}</span>
              </div>
              <div v-for="(alloc, aIdx) in deliveryAllocations[diIdx]" :key="aIdx" class="flex items-center gap-2 mb-1">
                <SearchableSelect v-model="alloc.game_account" :options="deliveryAccountOpts(diIdx, aIdx)" placeholder="-- Chọn kho --" class="flex-1" />
                <input v-model.number="alloc.quantity" type="number" min="0" class="w-24 text-right bg-app-bg text-app-text-primary border border-app-border rounded px-2 py-1 text-sm" placeholder="0" />
                <button v-if="deliveryAllocations[diIdx].length > 1" type="button" @click="deliveryAllocations[diIdx].splice(aIdx, 1)" class="text-red-400 hover:text-red-300 text-xs">&#10005;</button>
              </div>
              <button type="button" @click="deliveryAllocations[diIdx].push({ game_account: '', quantity: 0 })" class="text-xs text-indigo-400 hover:text-indigo-300 mt-1">+ Thêm nguồn</button>
            </div>
            <div class="flex gap-4">
              <button type="button" @click="startDeliveryModal = false" class="flex-1 py-3 rounded-2xl bg-app-surface text-app-text-muted hover:text-app-text-primary border border-app-border">Quay lại</button>
              <button type="button" @click="submitStartDelivery" :disabled="deliverySubmitting" class="flex-1 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white shadow-lg shadow-orange-600/20">
                {{ deliverySubmitting ? 'Đang xử lý...' : 'Bắt đầu giao hàng' }}
              </button>
            </div>
          </div>
        </div>
      </ModalWrapper>

      <!-- Edit Note -->
      <EditNoteModal v-model="showEditNoteModal" :order="editNoteOrder" @saved="loadOrder" />

      <!-- Lightbox -->
      <MediaLightbox v-model:open="lightboxOpen" :item="lightboxItem" :show-download="false" show-external-link />

      <!-- Cancel Request -->
      <ModalWrapper v-model="showCancelModal" radius="2xl sm:[3rem]" :z-index="50">
        <div class="p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <div class="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-xl mx-auto mb-3 shadow-lg shadow-red-600/20">⚠️</div>
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight text-center mb-1">Yêu cầu hủy đơn hàng</h3>
          <p class="text-app-text-muted text-[10px] font-black uppercase tracking-widest text-center opacity-40 mb-4">{{ order?.name }}</p>
          <CancelRequestModal ref="cancelModalRef" @confirm="submitCancelRequest" @cancel="showCancelModal = false" />
        </div>
      </ModalWrapper>

      <!-- Trader Assignment -->
      <ModalWrapper v-model="showTraderAssign" size="sm">
        <template #header>
          <div class="px-6 pt-6 pb-3">
            <h3 class="text-app-text-primary font-bold text-base">Đổi {{ orderType === 'buy' ? 'người thanh toán' : 'người nhận tiền' }}</h3>
          </div>
        </template>
        <div class="px-6 py-4">
          <SearchableSelect v-model="selectedTrader" :async-search-fn="searchPaymentUsers" placeholder="-- Chọn người --" />
        </div>
        <template #footer>
          <div class="px-6 pb-6 pt-2 flex gap-3 justify-end">
            <AppButton variant="ghost" @click="showTraderAssign = false">Hủy</AppButton>
            <AppButton variant="primary" :loading="assigningTrader" :disabled="!selectedTrader || assigningTrader" @click="submitTraderAssign">Xác nhận</AppButton>
          </div>
        </template>
      </ModalWrapper>

      </div>
    </template>

    <template #modals>
      <!-- Bank account selection modal for Complete action -->
      <ModalWrapper v-model="bankAcctModalOpen" radius="2xl sm:[3rem]" :z-index="50">
        <div class="p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-xl mx-auto mb-3 shadow-lg shadow-indigo-600/20">🏦</div>
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight text-center mb-1">
            Chọn {{ orderType === 'buy' ? 'tài khoản thanh toán' : 'tài khoản nhận tiền' }}
          </h3>
          <p class="text-app-text-muted text-[10px] font-black uppercase tracking-widest text-center opacity-40 mb-4">{{ order?.name }}</p>

          <LoadingSpinner v-if="bankAcctLoading" class="py-8" />
          <template v-else>
            <EmptyState v-if="bankAcctOpts.length === 0" message="Không có tài khoản khả dụng" />
            <div v-else class="space-y-3">
              <SearchableSelect v-model="selectedBankAcct" :options="bankAcctOpts" placeholder="-- Chọn tài khoản --" />
              <div class="flex items-center justify-end gap-2 pt-2">
                <button @click="bankAcctModalOpen = false" class="px-4 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary transition">Hủy</button>
                <button :disabled="!selectedBankAcct" @click="confirmBankAcctAndComplete"
                  class="px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50">Xác nhận</button>
              </div>
            </div>
          </template>
        </div>
      </ModalWrapper>

      <!-- Refund Modal -->
      <ModalWrapper v-model="refundModalOpen">
        <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">{{ refundFullRefund.value ? "Hoàn tiền toàn bộ" : "Hoàn tiền một phần" }}</h3>
          <button @click="refundModalOpen = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">&#10005;</button>
        </div>
        <div class="p-8 space-y-5 max-h-[60vh] overflow-y-auto">

          <!-- Bank account selector -->
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tài khoản trừ tiền hoàn <span class="text-red-500">*</span></label>
            <div v-if="refundIsMarketplace" class="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
              <p class="text-xs text-blue-600 font-bold">{{ refundResolvedBankLabel }}</p>
              <p class="text-[9px] text-blue-400">Ví nền tảng — tự động chọn</p>
            </div>
            <div v-else class="bg-app-bg border border-app-border rounded-lg p-3">
              <p class="text-xs text-app-text-primary font-bold">{{ refundResolvedBankLabel || 'Tài khoản của trader' }}</p>
              <p class="text-[9px] text-app-text-muted">Tự động chọn từ đơn hàng</p>
            </div>
          </div>

          <!-- Recipient account (Social channels only) -->
          <div v-if="!refundIsMarketplace">
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tài khoản nhận tiền hoàn <span class="text-red-500">*</span></label>
            <SearchableSelect v-model="refundRecipientAccount" :options="refundRecipientOpts" placeholder="-- Chọn người nhận tiền --" compact />
            <p class="text-[9px] text-app-text-muted mt-1">Người nhận tiền hoàn (có thể khác trader gốc)</p>
          </div>

          <!-- Refund amount -->
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Số tiền hoàn <span class="text-red-500">*</span></label>
            <input v-model.number="refundAmount" type="number" step="0.01" class="input-field !py-2.5 text-sm" placeholder="Nhập số tiền hoàn..." />
            <p class="text-[9px] text-app-text-muted mt-1">Tiền đơn gốc: {{ formatMoney(refundOriginalAmount, order.sale_currency) }}</p>
          </div>

          <!-- Items to return (optional) -->
          <div v-if="refundItems.length > 0">
            <div class="flex items-center justify-between mb-2">
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Trả lại hàng (tùy chọn)</label>
              <button @click="refundShowItems = !refundShowItems" class="text-[9px] text-indigo-600 font-bold">{{ refundShowItems ? 'Ẩn' : 'Hiện chi tiết' }}</button>
            </div>
            <div v-if="refundShowItems" class="space-y-2">
              <div v-for="ri in refundItems" :key="ri.item_name"
                class="bg-app-bg border border-app-border rounded-xl p-3">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-bold text-app-text-primary">{{ ri.item_label }}</span>
                  <span class="text-[10px] text-app-text-muted">SL: {{ ri.qty_total }} x {{ formatMoney(ri.unit_price, order.sale_currency) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest shrink-0">Hoàn</label>
                  <input v-model.number="ri.qty_refund" type="number" min="0" :max="ri.qty_total"
                    class="input-field !py-1 !px-2 text-xs w-20" />
                  <span class="text-[9px] text-app-text-muted">/ {{ ri.qty_total }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Reason -->
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Lý do hoàn tiền</label>
            <input v-model="refundReason" type="text" class="input-field !py-2.5 text-sm" placeholder="Lý do hoàn tiền..." />
          </div>
        </div>
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="refundModalOpen = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <button :disabled="refundSaving || !refundAmount || refundAmount <= 0" @click="submitRefund"
            class="px-5 py-2 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition disabled:opacity-50">
            {{ refundSaving ? 'Đang xử lý...' : 'Xác nhận hoàn tiền' }}
          </button>
        </div>
      </ModalWrapper>
    </template>

    <ActionConfirmModal
      v-model="actionConfirmModal"
      :icon="actionConfirmData.icon"
      :title="actionConfirmData.title"
      :subtitle="actionConfirmData.subtitle"
      :order="order"
      :amount="actionConfirmData.amount"
      :amount-label="actionConfirmData.amountLabel"
      :order-status="actionConfirmData.orderStatus"
      :bank-label="actionConfirmData.bankLabel"
      :bank-options="actionConfirmData.bankOptions"
      :confirm-text="actionConfirmData.confirmText"
      :loading="!!transitioning"
      :auto-select-user="actionConfirmData.autoSelectUser"
      @confirm="handleActionConfirmFromModal"
    />
  </DetailPageLayout>
</template>


<script setup>
defineOptions({ name: 'OrderDetailView' })
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getDoc, getList, createDoc, updateDoc, getWorkflowActions, applyWorkflowAction, frappeCall } from '../api/index.js'
import { useAuth } from '../composables/useAuth.js'
import { useRealtime } from '../composables/useRealtime.js'
import { formatQty, formatMoney, formatDate, isImage, isVideo, userName, currencyName, formatTimeAgo, stripHtml, linkify } from '../utils/format.js'
import { validateSellItems } from '../utils/validateSellItems.js'
import { logIcon, logStyle, logColor } from '../utils/logHelpers.js'
import { normalizeOrderInPlace } from '../utils/normalizeOrder.js'
import EditNoteModal from '../components/EditNoteModal.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import InfoRow from '../components/InfoRow.vue'
import StatusBadge from '../components/StatusBadge.vue'
import BackButton from '../components/BackButton.vue'
import AppButton from '../components/AppButton.vue'
import CopyButton from '../components/CopyButton.vue'
import CopyRow from '../components/CopyRow.vue'
import EmptyState from '../components/EmptyState.vue'
import DetailPageLayout from '../components/DetailPageLayout.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import MediaLightbox from '../components/MediaLightbox.vue'
import { useNotify } from '../composables/useNotify.js'
import { useMetadata } from '../composables/useMetadata.js'
import { useEvidenceUpload } from '../composables/useEvidenceUpload.js'
import EvidenceUploadModal from '../components/EvidenceUploadModal.vue'
import ActionConfirmModal from '../components/ActionConfirmModal.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import CancelRequestModal from '../components/CancelRequestModal.vue'

const router = useRouter()
const route = useRoute()

function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    // Fallback: Nếu là Trader 1 đưa về t1-active, nếu không đưa về queue
    if (isTrader1.value) router.push('/t1-active')
    else router.push('/queue')
  }
}
const { user, isTrader1, isTrader2, isOpsManager, isAccountant, isPaymentAccountant, isManagementAccountant, isChiefAccountant, isAdmin } = useAuth()
const { subscribeDoc, unsubscribeDoc } = useRealtime()
const { success, error, warn, info, confirm } = useNotify()
const {
  gameContexts,
  gameAccounts: allGameAccounts,
  fetchMetadata,
  currencyItems,
  currencyItemMap,
} = useMetadata()

const loading = ref(true)
const fetchError = ref('')
const order = ref(null)
const evidence = ref([])
const saleAllocations = ref([])
const buyLots = ref([])
const logs = ref([])
const transitioning = ref('')
const showUpload = ref(false)
const uploadFormRef = ref(null)
const lightboxOpen = ref(false)
const lightboxItem = ref(null)

function cItemName(item) {
  if (!item?.currency_item) return ''
  return item.currency_item_name
    || currencyItemMap.value?.[item.currency_item]?.item_name
    || item.currency_item
}
const gameAccounts = ref([])
const showCancelModal = ref(false)
const cancelReason = ref('')
const showAddNote = ref(false)
const newNoteText = ref('')
const submittingNote = ref(false)
const showEditNoteModal = ref(false)
const editNoteOrder = ref(null)
const editingItems = ref(false)
const editedItems = ref([])
const savingItems = ref(false)
const fetchedActions = ref([])
const supplierData = ref(null)
const pageDragOver = ref(false)

// Buy order item editing
const editingBuyItems = ref(false)
const editedBuyItems = ref([])
const savingBuyItems = ref(false)

// Trader assignment
const showTraderAssign = ref(false)
const assigningTrader = ref(false)
const selectedTrader = ref('')

// isPaymentOrAbove computed
const isPaymentOrAbove = computed(() => isAdmin.value || isChiefAccountant.value || isManagementAccountant.value)

// Start Delivery (Sell Order)
const startDeliveryModal = ref(false)
const deliveryItems = ref([])
const deliveryAllocations = ref([])
const deliveryLoading = ref(false)
const deliverySubmitting = ref(false)

// Bank account selection for Complete action
const bankAcctModalOpen = ref(false)
const bankAcctOpts = ref([])
const bankAcctLoading = ref(false)
const selectedBankAcct = ref('')
const pendingCompleteAction = ref(null)

const { uploading, uploadError, submitEvidence } = useEvidenceUpload()

const canAct = computed(() => {
  if (!order.value) return false
  if (isAdmin.value || isAccountant.value || isOpsManager.value) return true
  const terminalStates = ['Delivered', 'Completed', 'Failed', 'Cancelled', 'Disputed', 'Refunded']
  if (isTrader1.value) {
    if (terminalStates.includes(order.value.status)) return false
    return true
  }
  if (isTrader2.value) {
    if (order.value.status === 'Cancellation Requested') return false
    if (terminalStates.includes(order.value.status)) return false
    return order.value.claimed_by === user.value
  }
  return false
})

const canEditSellItems = computed(() => {
  if (!order.value || orderType.value !== 'sell') return false
  if (!canAct.value) return false
  // Lock editing once delivered or beyond
  const locked = ['Delivered', 'Completed', 'Failed', 'Cancelled', 'Disputed', 'Refunded', 'Outstanding', 'Payment Pending']
  if (locked.includes(order.value.status)) return false
  return isTrader1.value || isAdmin.value
})

const canEditBuyItems = computed(() => {
  if (!order.value || orderType.value !== 'buy') return false
  if (!canAct.value) return false
  const locked = ['Completed', 'Failed', 'Cancelled', 'Disputed', 'Refunded', 'Outstanding']
  if (locked.includes(order.value.status)) return false
  return isTrader1.value || isOpsManager.value || isAdmin.value
})

const sellItemOpts = computed(() => {
  let items = currencyItems.value
  // Filter by game context
  if (order.value?.game_context) {
    const gc = gameContexts.value.find(g => g.name === order.value.game_context)
    if (gc) items = items.filter(i => i.game_title === gc.game_title)
  }
  // Custom order: filter by category matching notes keyword
  const customName = order.value?.custom_item_name
  if (customName) {
    const kw = customName.toLowerCase()
    let cat = null
    if (kw.includes('rune')) cat = 'Rune'
    else if (kw.includes('gem')) cat = 'Gems'
    else if (kw.includes('gold')) cat = 'Currency'
    if (cat) items = items.filter(i => i.item_category === cat)
  }
  return items.map(i => ({ label: i.item_name, value: i.name }))
})

function sellItemOptsForRow(idx) {
  const taken = new Set(editedItems.value.map((it, i) => i !== idx ? it.currency_item : null).filter(Boolean))
  return sellItemOpts.value.filter(o => !taken.has(o.value) || o.value === editedItems.value[idx]?.currency_item)
}

const gameAccountOpts = computed(() => {
  return gameAccounts.value.map(a => ({ label: a.account_name, value: a.name }))
})

// Buy Order: multi-account receiving allocations
const receivingAllocs = ref({})

function initReceivingAllocs() {
  const allocs = {}
  if (orderType.value === 'buy' && order.value?.items) {
    order.value.items.forEach((item, i) => {
      const ordered = item.quantity || 0
      const alreadyReceived = item.received_quantity || 0
      const remaining = Math.max(0, ordered - alreadyReceived)

      if (remaining <= 0.001) {
        // Already fully received — no allocations needed
        allocs[i] = []
        return
      }

      if (item.receive_allocations_json) {
        try {
          const parsed = JSON.parse(item.receive_allocations_json)
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Scale allocations to remaining qty (for next round)
            const allocTotal = parsed.reduce((s, a) => s + (a.quantity || 0), 0)
            if (allocTotal > 0.001) {
              allocs[i] = parsed.map(a => ({
                game_account: a.game_account || '',
                quantity: Math.round((a.quantity / allocTotal) * remaining * 1000) / 1000
              }))
              return
            }
          }
        } catch {}
      }
      // Default: single row with remaining qty, fallback to order-level game_account
      allocs[i] = [{ game_account: item.target_game_account || order.value.game_account || '', quantity: remaining }]
    })
  }
  receivingAllocs.value = allocs
}

function fmtNum(v, decimals = 2) {
  if (v == null || isNaN(v)) return ''
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

function recvAccountOpts(itemIdx, currentIdx) {
  const allocs = receivingAllocs.value[itemIdx] || []
  const used = allocs.filter((_, i) => i !== currentIdx).map(a => a.game_account).filter(Boolean)
  return gameAccountOpts.value.filter(o => !used.includes(o.value))
}

function recvAllocTotal(itemIdx) {
  return (receivingAllocs.value[itemIdx] || []).reduce((s, a) => s + (a.quantity || 0), 0)
}

function addRecvAlloc(itemIdx) {
  if (!receivingAllocs.value[itemIdx]) receivingAllocs.value[itemIdx] = []
  receivingAllocs.value[itemIdx].push({ game_account: '', quantity: 0 })
}

const orderItemsSummary = computed(() => {
  if (!order.value) return '—'
  const items = order.value.items || []
  if (items.length === 0) return order.value.currency_item || '—'
  return items.map(i => cItemName(i)).join(' | ')
})

const orderGameAccounts = computed(() => {
  if (!order.value) return 'N/A'
  const items = order.value.items || []
  if (items.length === 0) return order.value.target_game_account || 'N/A'
  const accounts = items.map(i => i.target_game_account).filter(Boolean)
  return accounts.length ? accounts.join(', ') : 'N/A'
})

const orderType = computed(() => route.params.type) // 'buy' or 'sell'
const doctype = computed(() => orderType.value === 'buy' ? 'Buy Order' : 'Sell Order')

const netOrderAmount = computed(() => {
  const earning = Number(order.value?.earning_vnd || order.value?.earning_native || 0)
  const refund = Number(order.value?.refund_amount || 0)
  return earning - refund
})

const externalOrderUrl = computed(() => {
  const o = order.value
  if (!o?.external_order_id) return ''
  if (o.order_url) return o.order_url
  const ch = (o.sell_channel || '').toLowerCase()
  const id = o.external_order_id
  if (ch === 'g2g') return `https://www.g2g.com/order/${id}`
  if (ch === 'eldorado') return `https://www.eldorado.gg/order/${id}`
  if (ch === 'skycoach') return `https://skycoach.gg/order/${id}`
  return ''
})

const customerUrl = computed(() => {
  if (orderType.value !== 'sell' || !order.value) return ''
  return order.value._partyInfo?.url ? order.value._partyInfo.url : ''
})

const supplierUrl = computed(() => {
  if (orderType.value !== 'buy' || !supplierData.value) return ''
  return supplierData.value.custom_facebook_url || supplierData.value.custom_discord_url || ''
})

const canUpload = computed(() => {
  if (!order.value) return false
  if (!canAct.value) return false
  const s = order.value.status
  if (s === 'Cancellation Requested') return false
  if (s === 'Delivered') return false
  // Hide in Evidence Uploaded for sell — handled by Đã giao button
  if (s === 'Evidence Uploaded' && orderType.value === 'sell') return false
  return orderType.value === 'buy'
    ? ['Receiving', 'Evidence Uploaded'].includes(s)
    : ['In Delivery', 'Evidence Uploaded'].includes(s)
})

const isSellEvidenceUploaded = computed(() =>
  order.value?.status === 'Evidence Uploaded' && orderType.value === 'sell'
)

const deliveringEvidence = ref(false)

async function handleDeliverWithEvidence() {
  deliveringEvidence.value = true
  try {
    if (order.value.external_order_id) {
      // Marketplace: upload evidence to marketplace + transition to Delivered
      await frappeCall('gege_custom.gege_custom.api.botpastedon.post_evidence_to_marketplace', {
        sell_order_name: order.value.name
      })
      success('Đã giao — bằng chứng đang được đăng lên sàn')
    } else {
      // Social/Direct: just transition to Delivered
      await applyWorkflowAction(doctype.value, order.value.name, 'Deliver')
      success('Đã giao')
    }
    await loadOrder()
  } catch (e) {
    warn(e.message || 'Lỗi giao hàng')
  } finally {
    deliveringEvidence.value = false
  }
}

const availableActions = computed(() => {
  return fetchedActions.value.map(a => ({
    action: a.action,
    next: a.next_state,
  }))
})

const startDeliveryAction = computed(() => availableActions.value.find(a => a.action === 'Start Delivery' || a.action === 'Start Receiving'))
const deliverAction = computed(() => availableActions.value.find(a => a.action === 'Deliver'))
const completeAction = computed(() => {
  return isOpsManager.value || isAdmin.value || isTrader2.value || isPaymentOrAbove.value || (isPaymentAccountant.value && order.value?.assigned_trader === user.value)
    ? availableActions.value.find(a => a.action === 'Complete')
    : null
})
const createDebtAction = computed(() => {
  if (!isOpsManager.value && !isAdmin.value) return null
  return availableActions.value.find(a => a.action === 'Create Debt')
})
const canClaim = computed(() => {
  if (!(isTrader2.value || isAdmin.value)) return false
  if (order.value.status !== 'Queued') return false
  return true
})

const UI_FLOW_ACTIONS = new Set(['Upload Evidence', 'Claim'])
const hiddenActions = new Set(['Cancel', 'Reject Cancel', 'Mark Failed'])

const otherActions = computed(() => {
  const seen = new Set()
  const s = order.value.status
  const isAdminRole = isAdmin.value || isAccountant.value
  const hideUnclaim = isAdminRole ? !['Claimed', 'In Delivery', 'Receiving'].includes(s) : s !== 'Claimed'
  const evidenceOnlyComplete = s === 'Evidence Uploaded' && orderType.value === 'sell'
  // Trader1/Trader2: hide all actions in Delivered state
  const isTraderRole = (isTrader1.value || isTrader2.value) && !isAdmin.value && !isOpsManager.value
  if (isTraderRole && s === 'Delivered') return []
  return availableActions.value.filter(a => {
    if (UI_FLOW_ACTIONS.has(a.action)) return false
    if (hiddenActions.has(a.action)) return false
    if (a.action === 'Start Delivery' || a.action === 'Start Receiving') return false
    if (a.action === 'Deliver') return false
    if (a.action === 'Complete' || a.action === 'Create Debt') return false
    if (a.action === 'Request Cancel') return false
    if (hideUnclaim && a.action === 'Unclaim') return false
    if (seen.has(a.action)) return false
    seen.add(a.action)
    // Hide Confirm Payment / Mark Received from payment accountants who are not assigned
    if (isPaymentAccountant.value && !isPaymentOrAbove.value && !isAdmin.value && !isOpsManager.value
      && ['Confirm Payment', 'Mark Received'].includes(a.action) && order.value.assigned_trader !== user.value) return false
    if (isTrader1.value && !isAdmin.value && !isAccountant.value) {
      if (['Complete', 'Create Debt', 'Dispute'].includes(a.action)) return false
    }
    if (isTrader2.value) {
      if (['Complete', 'Create Debt', 'Approve Cancel', 'Reject Cancel'].includes(a.action)) return false
      if (evidenceOnlyComplete && a.action !== 'Complete' && a.action !== 'Create Debt' && a.action !== 'Deliver' && a.action !== 'Request Cancel') return false
    }
    if (isTrader2.value && s === 'Cancellation Requested') return false
    return true
  })
})

const canRequestCancel = computed(() => {
  if (!canAct.value) return false
  const s = order.value.status
  // Trader1 can cancel sell orders in Payment Pending
  if (isTrader1.value && orderType.value === 'sell' && s === 'Payment Pending') return true
  if (!isTrader2.value) return false
  if (['Completed', 'Failed', 'Cancelled', 'Disputed', 'Refunded', 'Partially Refunded', 'Cancellation Requested',
       'Evidence Uploaded', 'Payment Pending', 'Outstanding', 'Delivered'].includes(s)) return false
  return !fetchedActions.value.some(a => a.action === 'Request Cancel')
})


const ACTION_LABELS = {
  'Claim': 'Nhận đơn',
  'Unclaim': 'Trả Queue',
  'Cancel': 'Hủy trực tiếp',
  'Deliver': 'Đã giao',
  'Start Receiving': 'Bắt đầu nhận',
  'Start Delivery': 'Bắt đầu giao',
  'Upload Evidence': 'Tải bằng chứng',
  'Mark Failed': 'Đánh dấu lỗi',
  'Confirm Payment': 'Xác nhận thanh toán',
  'Complete': 'Hoàn thành',
  'Dispute': 'Tranh chấp',
  'Resolve': 'Giải quyết',
  'Refund': 'Hoàn tiền',
  'Partial Refund': 'Hoàn tiền một phần',
  'Reject Refund': 'Từ chối hoàn',
  'Request Cancel': 'Yêu cầu hủy',
  'Reject to Queue': 'Không duyệt → Trả Queue',
  'Approve Cancel': 'Duyệt hủy',
  'Reject Cancel': 'Từ chối hủy',
  'Mark Partial': 'Giao một phần',
  'Create Debt': 'Tạo công nợ',
  'Mark Received': 'Đã nhận',
}

function actionLabel(action) {
  return ACTION_LABELS[action] || action
}

function actionStyle(action) {
  if (['Cancel', 'Mark Failed', 'Dispute'].includes(action)) return 'danger'
  if (['Claim', 'Queue', 'Confirm Payment', 'Mark Received'].includes(action)) return 'primary'
  if (['Complete', 'Deliver', 'Resolve'].includes(action)) return 'success'
  if (['Reject to Queue', 'Unclaim'].includes(action)) return 'warning'
  if (action === 'Partial Refund') return 'warning'
  if (action === 'Request Cancel') return 'danger-ghost'
  return 'neutral'
}

// Inline edit sell items
function startEditItems() {
  if (!order.value?.items) return
  editedItems.value = order.value.items.map(item => ({
    name: item.name,
    currency_item: item.currency_item,
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    delivered_quantity: Number(item.delivered_quantity || 0),
  }))
  editingItems.value = true
}

function cancelEditItems() {
  editingItems.value = false
  editedItems.value = []
}

function addEditedItem() {
  const price = Number(order.value?.order_unit_price) || Number(editedItems.value[0]?.unit_price) || 0
  editedItems.value.push({
    name: '',
    currency_item: '',
    quantity: 0,
    unit_price: price,
    delivered_quantity: 0,
  })
}

function removeEditedItem(idx) {
  const item = editedItems.value[idx]
  if (item.delivered_quantity > 0) {
    warn('Không thể xóa item đã giao hàng')
    return
  }
  editedItems.value.splice(idx, 1)
}

async function saveEditedItems() {
  if (validateSellItems(editedItems.value, order.value, warn, currencyItemMap.value)) return
  savingItems.value = true
  try {
    const itemsPayload = editedItems.value.map(item => ({
      name: item.name || undefined,
      currency_item: item.currency_item,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))
    await frappeCall('gege_custom.gege_custom.utils.update_sell_order_items', {
      name: order.value.name,
      sell_items: JSON.stringify(itemsPayload),
    })
    editingItems.value = false
    editedItems.value = []
    await loadOrder()
    success('Cập nhật mặt hàng thành công')
  } catch (e) {
    warn('Lỗi: ' + (e.message || e).replace(/<[^>]*>/g, '').trim())
  } finally {
    savingItems.value = false
  }
}

// Buy Order: inline edit items
function buyItemOptsForRow(idx) {
  const taken = new Set(editedBuyItems.value.map((it, i) => i !== idx ? it.currency_item : null).filter(Boolean))
  let items = currencyItems.value
  if (order.value?.game_context) {
    const gc = gameContexts.value.find(g => g.name === order.value.game_context)
    if (gc) items = items.filter(i => i.game_title === gc.game_title)
  }
  return items.map(i => ({ label: i.item_name, value: i.name })).filter(o => !taken.has(o.value) || o.value === editedBuyItems.value[idx]?.currency_item)
}

function startEditBuyItems() {
  editedBuyItems.value = (order.value.items || []).map(item => ({
    name: item.name,
    currency_item: item.currency_item,
    quantity: item.quantity,
    unit_price: item.unit_price,
  }))
  editingBuyItems.value = true
}

function cancelEditBuyItems() {
  editingBuyItems.value = false
  editedBuyItems.value = []
}

async function saveEditedBuyItems() {
  const valid = editedBuyItems.value.filter(e => e.currency_item && e.quantity > 0)
  if (!valid.length) return warn('Phải có ít nhất 1 mặt hàng')
  savingBuyItems.value = true
  try {
    const itemsPayload = valid.map(item => ({
      name: item.name || undefined,
      currency_item: item.currency_item,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))
    await frappeCall('gege_custom.gege_custom.utils.update_buy_order_items', {
      name: order.value.name,
      buy_items: JSON.stringify(itemsPayload),
    })
    editingBuyItems.value = false
    editedBuyItems.value = []
    await loadOrder()
    success('Cập nhật mặt hàng thành công')
  } catch (e) {
    warn('Lỗi: ' + (e.message || e).replace(/<[^>]*>/g, '').trim())
  } finally {
    savingBuyItems.value = false
  }
}

// Trader assignment
async function searchPaymentUsers(query) {
  try {
    const users = await frappeCall('gege_custom.gege_custom.utils.get_users_with_roles', { cba_role: 'Payment' }) || []
    return users.map(u => ({
      label: u.full_name || u.email,
      value: u.email,
      description: u.full_name ? u.email : '',
    })).filter(u => !query || u.label.toLowerCase().includes(query.toLowerCase()) || u.value.toLowerCase().includes(query.toLowerCase()))
  } catch { return [] }
}

function openTraderAssign() {
  selectedTrader.value = order.value.assigned_trader || ''
  showTraderAssign.value = true
}

async function submitTraderAssign() {
  if (!selectedTrader.value) return
  assigningTrader.value = true
  try {
    await updateDoc(doctype.value, order.value.name, 'assigned_trader', selectedTrader.value)
    order.value.assigned_trader = selectedTrader.value
    success('Đã đổi ' + (orderType.value === 'buy' ? 'người thanh toán' : 'người nhận tiền'))
    showTraderAssign.value = false
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    assigningTrader.value = false
  }
}

async function loadOrder(isSoft = false) {
  const name = route.params.name
  if (!name || name === 'undefined') return
  
  if (!isSoft) {
    loading.value = true
    fetchError.value = ''
  }
  try {
    order.value = await getDoc(doctype.value, name)
    if (!order.value) {
      if (!isSoft) router.replace({ name: 'NotFoundView' })
      return
    }
    normalizeOrderInPlace(order.value, orderType.value)
    supplierData.value = null

    if (orderType.value === 'buy' && order.value.supplier) {
      try {
        supplierData.value = await getDoc('Supplier', order.value.supplier)
      } catch (se) {
        console.warn('Could not fetch supplier details:', se)
      }
    }

    if (orderType.value === 'sell' && order.value.customer) {
      try {
        const partyInfo = await frappeCall('gege_custom.gege_custom.utils.get_party_social_links', {
          parties: [order.value.customer]
        })
        if (partyInfo[order.value.customer]) {
          order.value._partyInfo = partyInfo[order.value.customer]
        }
      } catch (e) {
        console.warn('Could not fetch customer social links:', e)
      }
    }

    // Init defaults for Trader 2 receiving
    if (orderType.value === 'buy' && order.value.items) {
      order.value.items.forEach(item => {
        if (item.received_quantity == null || item.received_quantity === 0) {
          // Not yet received: default full qty
          item.received_quantity = 0
        }
      })
      initReceivingAllocs()
    }

    await fetchMetadata()

    if (order.value.game_context) {
      const gc = gameContexts.value.find(g => g.name === order.value.game_context)
      if (gc) {
        gameAccounts.value = allGameAccounts.value.filter(a => a.game_title === gc.game_title)
      } else {
        // Fallback if not in cache (though fetchMetadata should have it)
        gameAccounts.value = await getList('Game Account', {
          fields: ['name', 'account_name'],
          filters: [['game_title', '=', order.value.game_context], ['is_active', '=', 1]]
        })
      }
    }

    evidence.value = await getList('Order Evidence', {
      fields: ['name', 'attachment', 'uploaded_by', 'uploaded_at', 'note'],
      filters: [
        ['reference_doctype', '=', doctype.value],
        ['reference_name', '=', name],
      ],
      limit: 50,
    })

    saleAllocations.value = []
    buyLots.value = []
    if (orderType.value === 'sell') {
      try {
        saleAllocations.value = await getList('Sale Allocation', {
          fields: ['name', 'lot', 'lot_type', 'qty_allocated', 'cost_native_of_lot',
            'native_currency_of_lot', 'fx_rate_to_sell', 'cost_in_sell_currency',
            'sell_price_per_unit_native', 'revenue_native', 'gross_profit_native',
            'margin_pct', 'primary_source_buy_order', 'fifo_rank', 'sell_order_item'],
          filters: [['sell_order', '=', name]],
          limit: 200,
        })
      } catch {}
    } else if (orderType.value === 'buy') {
      try {
        buyLots.value = await getList('Currency Lot', {
          fields: ['name', 'lot_type', 'currency_item', 'game_account', 'game_context',
            'qty_initial', 'qty_remaining', 'cost_native', 'native_currency', 'creation'],
          filters: [['source_buy_order', '=', name]],
          limit: 200,
          order_by: 'creation asc',
        })
      } catch {}
    }

    const fetchedLogs = await getList('Order Log', {
      fields: ['name', 'action', 'note', 'owner', 'creation'],
      filters: [
        ['reference_doctype', '=', doctype.value],
        ['reference_name', '=', name]
      ],
      limit: 100,
      order_by: 'creation desc'
    })

    if (!fetchedLogs.some(l => l.action === 'Created') && order.value) {
      fetchedLogs.push({
        name: 'mock-created',
        action: 'Created',
        note: `Đơn hàng được tạo ra trên hệ thống.`,
        owner: order.value.owner,
        creation: order.value.creation
      })
    }

    logs.value = fetchedLogs

    // Fetch available workflow actions
    fetchedActions.value = await getWorkflowActions(doctype.value, name)
  } catch (e) {
    if (!isSoft) {
      const msg = e.message || String(e)
      if (msg.includes('does not exist') || msg.includes('not found') || msg.includes('DoesNotExistError')) {
        return router.replace({ name: 'NotFoundView' })
      }
      fetchError.value = `Không thể tải đơn hàng. Vui lòng thử lại.`
      console.error('loadOrder error:', msg)
    }
  } finally {
    if (!isSoft) loading.value = false
  }
}


// Refund modal
const refundModalOpen = ref(false)
const refundSaving = ref(false)
const refundItems = ref([])
const refundReason = ref('')
const refundAmount = ref(0)
const refundBankAccount = ref('')
const refundBankOpts = ref([])
const refundRecipientAccount = ref('')
const refundRecipientOpts = ref([])
const refundIsMarketplace = ref(false)
const refundResolvedBankLabel = ref('')
const refundShowItems = ref(false)
const refundFullRefund = ref(false)

const refundOriginalAmount = computed(() => {
  const o = order.value
  // For sell orders, use the ALE "In" amount (net for marketplace, gross for social)
  const items = o.sell_items || o.items || []
  return Math.round(items.reduce((sum, row) => sum + Number(row.quantity || row.qty || 0) * Number(row.unit_price || row.rate || 0), 0) * 100) / 100
})

const refundReturnedItems = computed(() => {
  const o = order.value
  if (!o.refund_items_json) return []
  try {
    const data = typeof o.refund_items_json === 'string' ? JSON.parse(o.refund_items_json) : o.refund_items_json
    const items = data.refund_items || []
    const orderItems = o.sell_items || o.items || []
    return items.filter(ri => ri.qty > 0).map(ri => {
      const match = orderItems.find(oi => oi.name === ri.item_name)
      return { item: match?.currency_item || match?.item_name || ri.item_name, qty: ri.qty }
    })
  } catch { return [] }
})

async function openRefundModal(isFull = false) {
  refundFullRefund.value = isFull
  refundItems.value = (order.value.sell_items || order.value.items || []).map(row => ({
    item_name: row.name,
    item_label: cItemName(row) || row.item_name || row.item_code || 'Item',
    qty_total: Number(row.quantity || row.qty || 1),
    qty_refund: isFull ? Number(row.quantity || row.qty || 1) : 0,
    unit_price: Number(row.unit_price || row.rate || 0),
  }))
  refundReason.value = ''
  refundAmount.value = refundOriginalAmount.value
  refundShowItems.value = false
  refundBankAccount.value = ''
  refundRecipientAccount.value = ''

  // Check if marketplace
  const channel = order.value.sell_channel || order.value.channel
  if (channel) {
    try {
      const ch = await getDoc('Channel', channel)
      if (ch.channel_group === 'Marketplace') {
        refundIsMarketplace.value = true
        refundResolvedBankLabel.value = `${channel} Wallet (${order.value.sale_currency || order.value.currency || 'USD'})`
        refundBankOpts.value = []
      } else {
        refundIsMarketplace.value = false
        // Resolve source label (trader's account)
        const origAcct = order.value.trader_1_receiving_account
        refundResolvedBankLabel.value = origAcct ? origAcct : 'Tài khoản trader'
        // Load recipient options for social channels
        await loadRefundRecipientOpts()
      }
    } catch (e) {
      refundIsMarketplace.value = false
      refundResolvedBankLabel.value = ''
      await loadRefundRecipientOpts()
    }
  } else {
    refundIsMarketplace.value = false
    refundResolvedBankLabel.value = ''
    await loadRefundRecipientOpts()
  }

  refundModalOpen.value = true
}

async function loadRefundBankOpts() {
  try {
    const role = orderType.value === 'buy' ? 'Payment' : 'Receiving'
    const currency = order.value.sale_currency || order.value.transaction_currency || ''
    const accounts = await frappeCall('gege_custom.gege_custom.utils.get_adjustable_bank_accounts', { role, currency })
    refundBankOpts.value = (accounts || []).map(a => ({
      value: a.value,
      label: a.label,
    }))
    // Auto-select the original trader account if available
    const origAcct = order.value.trader_1_receiving_account
    if (origAcct && refundBankOpts.value.some(o => o.value === origAcct)) {
      refundBankAccount.value = origAcct
    }
  } catch (e) {
    console.error('Failed to load bank accounts for refund:', e)
  }
}

async function loadRefundRecipientOpts() {
  try {
    const currency = order.value.sale_currency || order.value.transaction_currency || ''
    const accounts = await frappeCall('gege_custom.gege_custom.utils.get_adjustable_bank_accounts', { role: 'Receiving', currency })
    refundRecipientOpts.value = (accounts || []).map(a => ({
      value: a.value,
      label: a.label,
    }))
  } catch (e) {
    console.error('Failed to load recipient accounts:', e)
  }
}

async function submitRefund() {
  if (!refundAmount.value || Number(refundAmount.value) <= 0) { error('Nhập số tiền hoàn'); return }
  if (!refundIsMarketplace.value && !refundRecipientAccount.value) { error('Chọn tài khoản nhận tiền hoàn'); return }

  const items = refundItems.value.filter(ri => ri.qty_refund > 0).map(ri => ({
    item_name: ri.item_name,
    qty: ri.qty_refund,
  }))

  refundSaving.value = true
  try {
    const params = {
      refund_amount: String(refundAmount.value),
      refund_reason: refundReason.value,
    }
    if (items.length) params.refund_items = JSON.stringify(items)
    if (!refundIsMarketplace.value && refundRecipientAccount.value) {
      params.refund_recipient_account = refundRecipientAccount.value
    }
    const wfAction = refundFullRefund.value ? 'Refund' : 'Partial Refund'
    await applyWorkflowAction(doctype.value, order.value.name, wfAction, params)
    refundModalOpen.value = false
    await loadOrder()
    success('Đã hoàn tiền thành công')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    refundSaving.value = false
  }
}

const actionConfirmModal = ref(false)
const actionConfirmData = ref({
  action: null, icon: '', title: '', subtitle: '', amount: '', amountLabel: '',
  orderStatus: '', confirmText: '', bankLabel: '', bankOptions: [], autoSelectUser: '',
})

async function askConfirmation(action) {
  // Complete + buy: auto-resolve bank account and pay directly (no modal)
  if (action.action === 'Complete' && orderType.value === 'buy') {
    transitioning.value = action.action
    try {
      let bankAccount = ''
      try {
        bankAccount = await frappeCall('gege_custom.gege_custom.utils.resolve_order_bank_account', {
          doctype: doctype.value, name: order.value.name,
        }) || ''
      } catch {}
      success(`Thanh toán & hoàn thành! PE: ${(await frappeCall('gege_custom.gege_custom.api.debt.pay_buy_order_now', {
        buy_order_name: order.value.name, bank_account: bankAccount,
      })).payment_entry || 'OK'}`)
      await loadOrder()
    } catch (e) {
      error(`Lỗi: ${e.message || e}`)
    } finally {
      transitioning.value = ''
    }
    return
  }

  // Complete + sell + isTrader2: just workflow transition (no modal)
  if (action.action === 'Complete' && orderType.value === 'sell' && isTrader2.value) {
    transitioning.value = action.action
    try {
      await applyWorkflowAction(doctype.value, order.value.name, 'Complete')
      success('Hoàn thành đơn hàng')
      await loadOrder()
    } catch (e) {
      error(`Lỗi: ${e.message || e}`)
    } finally {
      transitioning.value = ''
    }
    return
  }

  // Complete: use rich modal with bank account selector
  if (action.action === 'Complete') {
    const cur = orderType.value === 'buy'
      ? (order.value.transaction_currency || 'VND')
      : (order.value.sale_currency || 'VND')
    const amt = orderType.value === 'buy'
      ? (order.value.total_vnd || order.value.grand_total_native || 0)
      : (order.value.earning_vnd || 0)

    let bankAccount = ''
    try {
      bankAccount = await frappeCall('gege_custom.gege_custom.utils.resolve_order_bank_account', {
        doctype: doctype.value, name: order.value.name,
      }) || ''
    } catch (e) { /* no resolved account */ }

    actionConfirmData.value = {
      action,
      icon: '✅',
      title: 'Hoàn thành & Thanh toán',
      subtitle: orderType.value === 'buy' ? 'Xác nhận thanh toán cho đơn mua' : 'Xác nhận nhận tiền cho đơn bán',
      amount: amt ? formatMoney(amt, cur) : '',
      amountLabel: orderType.value === 'buy' ? 'Số tiền' : 'Thực nhận',
      orderStatus: order.value.status,
      confirmText: 'Hoàn thành',
      bankLabel: orderType.value === 'buy' ? 'Tài khoản thanh toán' : 'Tài khoản nhận tiền',
      bankOptions: [],
      autoSelectUser: '',
      bankAccount,
    }
    actionConfirmModal.value = true
    return
  }

  // Deliver: simple confirm modal
  if (action.action === 'Deliver') {
    actionConfirmData.value = {
      action,
      icon: '📦',
      title: 'Xác nhận giao hàng',
      subtitle: 'Xác nhận đã giao hàng thành công',
      amount: '',
      orderStatus: order.value.status,
      confirmText: 'Đã giao',
      bankOptions: [],
    }
    actionConfirmModal.value = true
    return
  }

  // Refund / Partial Refund: open refund modal directly (no confirm dialog)
  if (action.action === 'Refund' || action.action === 'Partial Refund') {
    return openRefundModal(action.action === 'Refund')
  }

  if (!(await confirm(`Bạn có chắc chắn muốn thực hiện "${actionLabel(action.action)}" không?`))) return

  if (action.method === 'unclaim') return handleUnclaim()
  if (action.method === 'request_cancel' || action.action === 'Request Cancel') {
    cancelModalRef.value?.reset()
    showCancelModal.value = true
    currentAction.value = action
    return
  }
  if (action.method === 'reject_to_queue') return handleRejectToQueue()

  await performAction(action.next, action.action)
}

async function handleActionConfirmFromModal({ bankAccount } = {}) {
  actionConfirmModal.value = false
  const action = actionConfirmData.value.action
  if (!action) return

  // Complete: use payment API instead of pure workflow transition
  if (action.action === 'Complete') {
    transitioning.value = action.action
    try {
      if (orderType.value === 'buy') {
        // Auto-resolve bank account for buy orders
        let resolvedAccount = bankAccount
        if (!resolvedAccount) {
          try {
            resolvedAccount = await frappeCall('gege_custom.gege_custom.utils.resolve_order_bank_account', {
              doctype: doctype.value, name: order.value.name,
            }) || ''
          } catch {}
        }
        const result = await frappeCall('gege_custom.gege_custom.api.debt.pay_buy_order_now', {
          buy_order_name: order.value.name,
          bank_account: resolvedAccount,
        })
        success(`Thanh toán & hoàn thành! PE: ${result.payment_entry || 'OK'}`)
      } else if (isTrader2.value) {
        // Trader2 completing sell order: just transition
        await applyWorkflowAction(doctype.value, order.value.name, 'Complete')
        success('Hoàn thành đơn hàng')
      } else {
        const params = { sell_order_name: order.value.name }
        if (bankAccount) params.bank_account = bankAccount
        const result = await frappeCall('gege_custom.gege_custom.api.debt.complete_sell_order', params)
        const parts = ['Đã hoàn thành!']
        if (result.sales_invoice) parts.push(`SI: ${result.sales_invoice}`)
        if (result.payment_entry) parts.push(`PE: ${result.payment_entry}`)
        success(parts.join(' '))
      }
      await loadOrder()
    } catch (e) {
      error(`Lỗi: ${e.message || e}`)
    } finally {
      transitioning.value = ''
    }
    return
  }

  await performAction(action.next, action.action)
}

async function performAction(nextState, actionLabel) {
  transitioning.value = actionLabel
  try {
    await applyWorkflowAction(doctype.value, order.value.name, actionLabel)
    await loadOrder()
    success(`Thực hiện "${actionLabel}" thành công`)
  } catch (e) {
    error(`Lỗi: ${e.message || e}`)
  } finally {
    transitioning.value = ''
  }
}

async function openBankAcctModal(action) {
  pendingCompleteAction.value = action
  selectedBankAcct.value = ''
  bankAcctModalOpen.value = true
  bankAcctLoading.value = true
  try {
    // Auto-resolve bank account
    try {
      const resolved = await frappeCall('gege_custom.gege_custom.utils.resolve_order_bank_account', {
        doctype: doctype.value,
        name: order.value.name,
      })
      if (resolved) selectedBankAcct.value = resolved
    } catch {}
  } catch (e) {
    error('Không thể tải danh sách tài khoản: ' + (e.message || e))
    bankAcctModalOpen.value = false
  } finally {
    bankAcctLoading.value = false
  }
}

async function confirmBankAcctAndComplete() {
  if (!selectedBankAcct.value) { error('Vui lòng chọn tài khoản'); return }
  bankAcctModalOpen.value = false
  const action = pendingCompleteAction.value
  if (!action) return
  pendingCompleteAction.value = null
  transitioning.value = 'Complete'
  try {
    await applyWorkflowAction(doctype.value, order.value.name, 'Complete', { bank_account: selectedBankAcct.value })
    await loadOrder()
    success('Hoàn thành đơn hàng thành công')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    transitioning.value = ''
  }
}

async function handleClaim() {
  transitioning.value = 'Claim'
  try {
    await applyWorkflowAction(doctype.value, order.value.name, 'Claim')
    await loadOrder()
    success('Nhận đơn thành công')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    transitioning.value = ''
  }
}

async function handleUnclaim() {
  transitioning.value = 'Unclaim'
  try {
    await applyWorkflowAction(doctype.value, order.value.name, 'Unclaim')
    await loadOrder()
    success('Đã hủy nhận đơn (Unclaim)')
  } catch (e) {
    error('Lỗi: ' + e.message)
  } finally {
    transitioning.value = ''
  }
}

async function handleRejectToQueue() {
  transitioning.value = 'Từ chối (Đẩy lên Queue)'
  try {
    await applyWorkflowAction(doctype.value, order.value.name, 'Reject to Queue')
    await loadOrder()
    success('Đã từ chối đơn')
  } catch (e) {
    error('Lỗi: ' + e.message)
  } finally {
    transitioning.value = ''
  }
}

async function submitCancelRequest({ reason, files }) {
  const s = order.value.status
  if (s === 'Cancellation Requested') {
    showCancelModal.value = false
    return warn('Đơn hàng đã được yêu cầu hủy rồi')
  }

  transitioning.value = 'Request Cancel'
  try {
    if (files?.length) {
      const { uploadFileOnly } = useEvidenceUpload()
      for (const f of files) {
        const uploaded = await uploadFileOnly(f)
        if (uploaded?.file_url) {
          await createDoc('Order Evidence', {
            reference_doctype: doctype.value,
            reference_name: order.value.name,
            attachment: uploaded.file_url,
            note: '[Hủy đơn] ' + reason,
          })
        }
      }
    }

    await createDoc('Order Log', {
      reference_doctype: doctype.value,
      reference_name: order.value.name,
      action: 'Cancel Request',
      note: reason,
    })

    await applyWorkflowAction(doctype.value, order.value.name, 'Request Cancel', { cancel_reason: reason })
    showCancelModal.value = false
    await loadOrder()
    success('Đã gửi yêu cầu hủy đơn')
  } catch (e) {
    error('Lỗi: ' + e.message)
  } finally {
    transitioning.value = ''
  }
}

async function submitNote() {
  if (!newNoteText.value.trim()) return warn('Vui lòng nhập nội dung ghi chú')
  submittingNote.value = true
  try {
    await createDoc('Order Log', {
      reference_doctype: doctype.value,
      reference_name: order.value.name,
      action: 'Note',
      note: newNoteText.value
    })
    showAddNote.value = false
    newNoteText.value = ''
    await loadOrder()
    success('Đã thêm ghi chú')
  } catch(e) {
    error('Lỗi: ' + e.message)
  } finally {
    submittingNote.value = false
  }
}

function openEditNote() {
  editNoteOrder.value = order.value
  showEditNoteModal.value = true
}

function copyNote() {
  if (!order.value?.note) return
  navigator.clipboard.writeText(order.value.note).then(() => success('Đã sao chép ghi chú'))
}

function openUpload() {
  const s = order.value.status
  const isSupplemental = s === 'Evidence Uploaded'
  if (!isSupplemental && canUpload.value && orderType.value === 'buy' && order.value.items) {
    // Validate multi-account allocations
    for (let i = 0; i < order.value.items.length; i++) {
      const item = order.value.items[i]
      const alreadyReceived = item.received_quantity || 0
      const ordered = item.quantity || 0
      const remaining = ordered - alreadyReceived
      // Skip items already fully received
      if (remaining <= 0.001) continue
      const allocs = receivingAllocs.value[i] || []
      const total = allocs.reduce((s, a) => s + (a.quantity || 0), 0)
      if (allocs.length === 0 || !allocs[0].game_account || total <= 0) {
        return warn(`Vui lòng chọn kho và nhập SL cho ${cItemName(item)}`)
      }
      if (total > remaining + 0.001) {
        return warn(`Tổng SL nhập (${total}) vượt SL còn lại cho ${cItemName(item)} (còn ${remaining})`)
      }
    }
  }
  // Sell order: must have items filled in before uploading evidence
  if (orderType.value === 'sell' && (!order.value.items || order.value.items.length === 0)) {
    return warn('Vui lòng nhập chi tiết items trước khi thêm bằng chứng')
  }
  showUpload.value = true
}

async function handleUpload({ files, file, type, note }) {
  const fileArray = files || (file ? [file] : [])
  const s = order.value.status
  const isSupplemental = s === 'Evidence Uploaded'
  const result = await submitEvidence({
    files: fileArray, type, note,
    referenceDoctype: doctype.value,
    referenceName: order.value.name,
    channel: orderType.value === 'buy' ? order.value.buy_channel : order.value.sell_channel,
    beforeUpload: !isSupplemental && orderType.value === 'buy' && order.value.items ? async () => {
      // Build items payload with receive_allocations_json
      const itemsPayload = order.value.items.map((r, i) => {
        const allocs = (receivingAllocs.value[i] || []).filter(a => a.game_account && a.quantity > 0)
        const totalQty = allocs.reduce((s, a) => s + a.quantity, 0)
        const alreadyReceived = r.received_quantity || 0
        return {
          name: r.name,
          currency_item: r.currency_item,
          quantity: r.quantity,
          unit_price: r.unit_price,
          received_quantity: alreadyReceived + totalQty,
          target_game_account: allocs[0]?.game_account || r.target_game_account || '',
          receive_allocations_json: allocs.length > 0 ? JSON.stringify(allocs) : '',
        }
      })
      await updateDoc('Buy Order', order.value.name, { buy_items: itemsPayload })
    } : undefined,
  })
  if (result) {
    showUpload.value = false
    uploadFormRef.value?.reset()
    // Log evidence upload with details
    try {
      const parts = []
      if (note) parts.push(note)
      if (orderType.value === 'buy' && !isSupplemental && order.value.items) {
        const detail = order.value.items.map((r, i) => {
          const allocs = (receivingAllocs.value[i] || []).filter(a => a.game_account && a.quantity > 0)
          const totalQty = allocs.reduce((s, a) => s + a.quantity, 0)
          if (totalQty > 0) return cItemName(r) + ': +' + totalQty
          return null
        }).filter(Boolean).join(', ')
        if (detail) parts.push('Nhận hàng: ' + detail)
      }
    } catch {}
    await loadOrder()
    success('Upload evidence thành công')
  }
}

function openLightbox(ev) {
  if (isImage(ev.attachment) || isVideo(ev.attachment)) {
    lightboxItem.value = ev
    lightboxOpen.value = true
  } else {
    window.open(ev.attachment, '_blank')
  }
}

// --- Drag & Drop ---
function onPageDragOver(e) {
  e.preventDefault()
  if (canUpload.value) pageDragOver.value = true
}
function onPageDragLeave(e) {
  if (!e.relatedTarget || e.relatedTarget === document.documentElement) pageDragOver.value = false
}
async function onPageDrop(e) {
  e.preventDefault()
  pageDragOver.value = false
  if (!canUpload.value) return
  const files = e.dataTransfer?.files
  if (!files?.length) return
  openUpload()
  await nextTick()
  if (uploadFormRef.value) uploadFormRef.value.addFiles(Array.from(files))
}

// --- Start Delivery (Sell Order) ---
function deliveryAccountOpts(diIdx, currentIdx) {
  const di = deliveryItems.value[diIdx]
  if (!di) return []
  const allocs = deliveryAllocations.value[diIdx] || []
  const usedAccounts = allocs.filter((_, i) => i !== currentIdx).map(a => a.game_account).filter(Boolean)
  return (di.accountOpts || []).filter(opt => !usedAccounts.includes(opt.value))
}

async function openStartDelivery() {
  deliveryItems.value = []
  deliveryAllocations.value = []
  startDeliveryModal.value = true
  deliveryLoading.value = true
  try {
    const fullOrder = await getDoc('Sell Order', order.value.name)
    normalizeOrderInPlace(fullOrder, 'sell')
    const items = fullOrder.items || []
    const newItems = []
    for (const item of items) {
      const invRes = await getList('Inventory Position', {
        fields: ['game_account', 'qty_available', 'currency_item'],
        filters: [['game_context', '=', fullOrder.game_context], ['currency_item', '=', item.currency_item], ['qty_available', '>', 0], ['is_active', '=', 1]],
        limit: 0
      })
      const accountMap = {}
      for (const pos of invRes) { if (!accountMap[pos.game_account]) accountMap[pos.game_account] = 0; accountMap[pos.game_account] += Number(pos.qty_available || 0) }
      const accountOpts = Object.entries(accountMap).sort((a, b) => b[1] - a[1]).map(([ga, qty]) => ({ value: ga, label: `${ga} | Còn: ${qty.toLocaleString('vi-VN')}`, qty_available: qty }))
      const deliveredQty = Number(item.delivered_quantity || 0)
      let prevAllocQty = 0
      try { prevAllocQty = JSON.parse(item.delivery_allocations_json || '[]').reduce((s, a) => s + (Number(a.quantity) || 0), 0) } catch {}
      const remainingQty = Number(item.quantity) - Math.max(deliveredQty, prevAllocQty)
      if (remainingQty <= 0) continue
      newItems.push({ currency_item: item.currency_item, quantity: item.quantity, delivered_quantity: deliveredQty, remaining_quantity: remainingQty, unit_price: item.unit_price, item_name: item.name, accountOpts })
    }
    deliveryItems.value = newItems
    deliveryAllocations.value = newItems.map(item => [{ game_account: item.accountOpts?.[0]?.value || '', quantity: item.remaining_quantity }])
  } catch (e) {
    error('Không thể tải thông tin tồn kho: ' + e.message)
  } finally {
    deliveryLoading.value = false
  }
}

async function submitStartDelivery() {
  for (let idx = 0; idx < deliveryItems.value.length; idx++) {
    const allocs = deliveryAllocations.value[idx] || []
    const item = deliveryItems.value[idx]
    if (allocs.length === 0 || allocs.some(a => !a.game_account)) return warn(`Vui lòng chọn kho cho ${cItemName(item)}`)
    if (allocs.some(a => !a.quantity || a.quantity <= 0)) return warn(`Vui lòng nhập số lượng > 0 cho ${cItemName(item)}`)
    const totalQty = allocs.reduce((s, a) => s + (Number(a.quantity) || 0), 0)
    if (totalQty > (item.remaining_quantity || item.quantity)) return warn(`${cItemName(item)}: Tổng SL phân bổ vượt quá SL cần giao`)
  }
  deliverySubmitting.value = true
  try {
    const fullOrder = await getDoc('Sell Order', order.value.name)
    const existingItems = fullOrder?.sell_items || []
    const itemsPayload = deliveryItems.value.map((di, idx) => {
      const match = existingItems.find(ei => ei.currency_item === di.currency_item)
      const allocs = deliveryAllocations.value[idx]
      return { name: match?.name, currency_item: di.currency_item, quantity: di.quantity, delivered_quantity: match?.delivered_quantity || 0, unit_price: di.unit_price || match?.unit_price || 0, target_game_account: allocs[0]?.game_account || '', delivery_allocations_json: JSON.stringify(allocs.filter(a => a.game_account && a.quantity > 0)) }
    })
    await frappeCall('gege_custom.gege_custom.utils.update_sell_order_delivery_allocations', { name: order.value.name, sell_items: JSON.stringify(itemsPayload) })
    await applyWorkflowAction('Sell Order', order.value.name, 'Start Delivery')
    startDeliveryModal.value = false
    await loadOrder()
    success('Đã bắt đầu giao hàng')
  } catch (e) {
    error('Lỗi: ' + e.message)
  } finally {
    deliverySubmitting.value = false
  }
}

const cancelModalRef = ref(null)
const currentAction = ref(null)

onMounted(() => {
  loadOrder()
  subscribeDoc(doctype.value, route.params.name, () => { if (!editingItems.value) loadOrder(true) })
})

onUnmounted(() => {
  unsubscribeDoc(doctype.value, route.params.name)
})
</script>

<style scoped>
.detail-zoom {
  font-size: 1.25rem;
}
.detail-zoom :deep(.text-xs),
.detail-zoom :deep(.text-sm) { font-size: 1rem !important; }
.detail-zoom :deep(.text-base) { font-size: 1.25rem !important; }
.detail-zoom :deep(.text-lg) { font-size: 1.375rem !important; }
.detail-zoom :deep(.text-xl) { font-size: 1.5rem !important; }
.detail-zoom :deep(.text-2xl) { font-size: 1.875rem !important; }
.detail-zoom :deep(.text-3xl) { font-size: 2.25rem !important; }
.detail-zoom :deep(.text-\[8px\]) { font-size: 0.7rem !important; }
.detail-zoom :deep(.text-\[9px\]) { font-size: 0.8rem !important; }
.detail-zoom :deep(.text-\[10px\]) { font-size: 0.875rem !important; }
.detail-zoom :deep(.text-\[11px\]) { font-size: 0.9375rem !important; }
.detail-zoom :deep(.text-\[15px\]) { font-size: 1.1875rem !important; }
.detail-zoom :deep(input),
.detail-zoom :deep(textarea),
.detail-zoom :deep(select) { font-size: 1rem !important; }
.detail-zoom :deep(button) { font-size: inherit !important; }
</style>
  