<template>
  <div class="bg-app-surface border border-app-border rounded-2xl p-7 shadow-sm flex flex-col lg:h-full lg:overflow-hidden">
    <div class="shrink-0 space-y-4 mb-4">
      <h3 class="text-app-text-primary text-[12px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
        <span class="p-2 rounded" :class="colorClass">🎮</span> Dữ liệu Game
      </h3>
      <div>
        <div class="flex justify-between items-center mb-2">
          <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest">Ngữ cảnh Game <span class="text-red-500">*</span></label>
          <GearButton :color="color" @click="$emit('openFav', 'game_context', 'Ngữ cảnh Game', gameContextOpts)" />
        </div>
        <SearchableSelect :model-value="gameContext" @update:model-value="$emit('update:gameContext', $event)" :options="gameContextOpts" placeholder="-- Chọn Context --" @change="$emit('gameContextChange')" required compact />
        <div class="flex flex-wrap gap-2.5 mt-2" v-if="renderFavs('game_context', gameContextOpts).length">
          <FavoriteChip v-for="fav in renderFavs('game_context', gameContextOpts)" :key="fav.value" :label="fav.label" :color="color" @click="$emit('selectGameContext', fav.value)" />
        </div>
      </div>

      <slot name="extra-fields" />

      <!-- Items section — only when game context selected -->
      <template v-if="gameContext">
        <!-- Quick Add & Title -->
        <div class="flex items-end justify-between border-t border-app-border/40 pt-4">
          <div>
            <label class="text-[11px] font-black text-app-text-muted uppercase tracking-widest opacity-80 flex items-center gap-2">Mặt hàng <span class="text-red-500">*</span></label>
            <div class="flex flex-wrap gap-2.5 mt-2 mr-2" v-if="renderFavs('currency_item', itemOpts).length && itemOpts.length > 0">
              <FavoriteChip v-for="fav in renderFavs('currency_item', itemOpts)" :key="fav.value" :label="'+ ' + fav.label" color="emerald" @click="$emit('addFavItem', fav.value)" />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <GearButton v-if="itemOpts.length > 0" :color="color" @click="$emit('openFav', 'currency_item', 'Mặt hàng', itemOpts)" />
          </div>
        </div>
      </template>
    </div>

    <!-- No context message -->
    <div v-if="!gameContext" class="flex-1 flex items-center justify-center py-10">
      <p class="text-app-text-muted text-[12px] font-black uppercase tracking-[0.2em] text-center opacity-50">Chọn Ngữ cảnh Game để thêm items</p>
    </div>

    <!-- Items Loop -->
    <template v-if="gameContext">
      <!-- Mobile: currency above items -->
      <div class="sm:hidden mb-3 flex justify-end">
        <slot name="currency" />
      </div>

      <!-- Items + Currency side by side -->
      <div class="flex-1 flex gap-3 min-h-0">
        <!-- Scrollable items -->
        <div class="flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 -mr-1 sm:-mr-2 lg:max-h-[600px]">
          <!-- Headers -->
          <div v-if="orderItems.length > 0" class="hidden sm:grid gap-3 text-[11px] font-black uppercase tracking-widest text-app-text-muted px-2 mb-2" :style="{ gridTemplateColumns }">
            <span>Mặt hàng</span>
            <span class="text-center">{{ qtyLabel }}</span>
            <span class="text-center">{{ priceLabel }}</span>
            <span class="text-center">Tổng</span>
            <span></span>
          </div>
          <div v-for="(item, idx) in orderItems" :key="idx" class="mb-4">
            <!-- Desktop row -->
            <div class="hidden sm:grid gap-3 items-center bg-app-bg/50 p-3.5 rounded-xl border border-app-border/40 group/row transition-all" :class="[hoverBorderClass]" :style="{ gridTemplateColumns }">
              <SearchableSelect v-model="item.currency_item" :options="filteredItemOpts(idx)" placeholder="Tìm..." compact @change="$emit('currencyItemChange', idx)" />
              <FormattedNumberInput v-model="item.quantity" input-class="input-field !py-3 text-sm font-mono text-center w-full" placeholder="SL" @update:modelValue="$emit('qtyChange', idx)" />
              <FormattedNumberInput v-model="item.unit_price" :disabled="disablePriceAndTotal" input-class="input-field !py-3 text-sm font-mono text-center w-full" placeholder="Giá" @update:modelValue="$emit('priceChange', idx)" />
              <FormattedNumberInput v-model="item.total" :disabled="disablePriceAndTotal" input-class="input-field !py-3 text-sm font-mono text-center w-full" :class="[totalBgClass]" placeholder="Tổng" @update:modelValue="$emit('totalChange', idx)" />
              <button type="button" @click="$emit('removeItem', idx)" class="text-app-text-muted hover:text-red-500 text-lg transition-all text-center w-full transform hover:scale-125 opacity-40 hover:opacity-100">✕</button>
            </div>
            <!-- Mobile card -->
            <div class="sm:hidden bg-app-bg/50 p-4 rounded-xl border border-app-border/40 space-y-2.5 relative group/row">
              <div class="flex items-center justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <SearchableSelect v-model="item.currency_item" :options="filteredItemOpts(idx)" placeholder="Tìm item..." compact @change="$emit('currencyItemChange', idx)" />
                </div>
                <button type="button" @click="$emit('removeItem', idx)" class="text-app-text-muted hover:text-red-500 text-lg p-1 shrink-0">✕</button>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">SL</label>
                  <FormattedNumberInput v-model="item.quantity" input-class="input-field !py-3 !px-2.5 !text-sm font-mono text-center w-full" placeholder="0" @update:modelValue="$emit('qtyChange', idx)" />
                </div>
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">{{ priceLabel }}</label>
                  <FormattedNumberInput v-model="item.unit_price" :disabled="disablePriceAndTotal" input-class="input-field !py-3 !px-2.5 !text-sm font-mono text-center w-full" placeholder="0" @update:modelValue="$emit('priceChange', idx)" />
                </div>
                <div>
                  <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">Tổng</label>
                  <FormattedNumberInput v-model="item.total" :disabled="disablePriceAndTotal" input-class="input-field !py-3 !px-2.5 !text-sm font-mono text-center w-full" :class="[totalBgClass]" placeholder="0" @update:modelValue="$emit('totalChange', idx)" />
                </div>
              </div>
            </div>
            <slot name="item-extra" :item="item" :idx="idx"></slot>
          </div>
          <p v-if="orderItems.length === 0" class="text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] text-center py-10 bg-app-bg border border-dashed border-app-border/60 rounded-xl opacity-50 mt-2">Trống</p>

          <!-- Add Row Button -->
          <button type="button" @click="$emit('addItem')"
            class="w-full py-4 mt-2 rounded-xl bg-app-bg border border-app-border text-indigo-500 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all text-2xl font-black shadow-sm hover:shadow-md">
            +
          </button>

          <!-- Note — inside scroll, below add button -->
          <slot name="note" />
        </div>

        <!-- Currency sidebar (desktop) -->
        <div class="hidden sm:flex flex-col shrink-0 items-center justify-start">
          <slot name="currency" />
        </div>
      </div>

      <!-- Total Footer -->
      <div class="w-full pt-4 mt-auto border-t border-app-border/40 shrink-0">
        <div class="px-6 sm:px-7 py-4 sm:py-5 rounded-xl flex flex-col items-end border" :class="[totalFooterBg, totalFooterBorder]">
          <span class="text-[11px] font-black uppercase tracking-widest mb-1" :class="[totalLabelColor]">{{ totalLabel }}</span>
          <span class="text-xl sm:text-3xl font-black font-mono tracking-tight leading-none" :class="[totalValueColor]">{{ formatMoney(totalVnd, currency) }}</span>
          <template v-if="earningAmount !== null">
            <span class="text-[9px] font-black uppercase tracking-widest mt-2 text-emerald-700/50">{{ earningLabel }}</span>
            <span class="text-base sm:text-lg font-black font-mono tracking-tight leading-none text-emerald-600">{{ formatMoney(earningAmount, currency) }}</span>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SearchableSelect from './SearchableSelect.vue'
import AppButton from './AppButton.vue'
import GearButton from './GearButton.vue'
import FavoriteChip from './FavoriteChip.vue'
import { formatMoney } from '../utils/format.js'
import FormattedNumberInput from './FormattedNumberInput.vue'

const props = defineProps({
  color: { type: String, default: 'indigo' },
  orderItems: { type: Array, required: true },
  itemOpts: { type: Array, default: () => [] },
  gameContext: { type: String, default: '' },
  gameContextOpts: { type: Array, default: () => [] },
  totalVnd: { type: Number, default: 0 },
  currency: { type: String, default: 'VND' },
  favorites: { type: Object, default: () => ({}) },
  qtyLabel: { type: String, default: 'Số lượng' },
  priceLabel: { type: String, default: 'Đơn giá' },
  totalLabel: { type: String, default: 'Tổng thanh toán' },
  renderFavs: { type: Function, required: true },
  earningAmount: { type: Number, default: null },
  earningLabel: { type: String, default: 'Thực nhận' },
  disablePriceAndTotal: { type: Boolean, default: false },
})

const selectedItems = computed(() => new Set(props.orderItems.map(i => i.currency_item).filter(Boolean)))

function filteredItemOpts(idx) {
  const currentVal = props.orderItems[idx]?.currency_item
  return props.itemOpts.filter(o => o.value === currentVal || !selectedItems.value.has(o.value))
}

defineEmits([
  'addItem', 'removeItem', 'qtyChange', 'priceChange', 'totalChange',
  'openFav', 'addFavItem', 'selectGameContext', 'gameContextChange',
  'update:gameContext', 'currencyItemChange',
])

const colorClass = computed(() => props.color === 'orange' ? 'bg-orange-600/10 text-orange-600' : 'bg-indigo-600/10 text-indigo-600')
const hoverBorderClass = computed(() => props.color === 'orange' ? 'hover:border-orange-600/30' : 'hover:border-indigo-600/30')
const totalBgClass = computed(() => props.color === 'orange' ? 'bg-orange-50/30' : 'bg-indigo-50/30')
const totalFooterBg = computed(() => props.color === 'orange' ? 'bg-orange-600/[0.04]' : 'bg-indigo-600/[0.04]')
const totalFooterBorder = computed(() => props.color === 'orange' ? 'border-orange-600/10' : 'border-indigo-600/10')
const totalLabelColor = computed(() => props.color === 'orange' ? 'text-orange-900/50' : 'text-indigo-900/50')
const totalValueColor = computed(() => props.color === 'orange' ? 'text-orange-600' : 'text-indigo-600')
const gridTemplateColumns = computed(() => 'minmax(180px, 2fr) 1fr 1fr 1fr 36px')
</script>
