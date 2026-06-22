<template>
  <div class="h-full">
  <PaginatedListLayout self-scroll :total-items="0">
    <template #header>
    <!-- Header -->
    <PageHeader
      title="Cảnh báo kho"
      subtitle="Cảnh báo tồn kho chi tiết theo từng máy chủ/mùa giải"
      icon="⚠️"
      :connected="connected"
      @refresh="loadAll"
    >
      <template #actions>
        <AppButton variant="primary" size="md" @click="openAllSettings">⚙️ Cài đặt ngưỡng</AppButton>
      </template>
    </PageHeader>
    </template>
    <div class="h-full overflow-auto custom-scrollbar">
    <template v-if="!loading">
        <div v-if="warningGroups.length === 0 && safeItems.length === 0" class="bg-app-surface border border-app-border rounded-[3rem] p-24 text-center shadow-sm">
          <div class="w-24 h-24 bg-green-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-4xl shadow-inner border border-green-500/10">✅</div>
          <h3 class="text-app-text-primary font-black text-2xl uppercase tracking-tight mb-2">Hệ thống an toàn!</h3>
          <p class="text-app-text-muted text-[11px] font-black uppercase tracking-widest opacity-50">Tồn kho trên tất cả máy chủ đều đang ở mức ổn định.</p>
        </div>

        <div v-else class="space-y-8">
          <section v-for="group in warningGroups" :key="group.contextName" class="space-y-6">
            <div class="flex items-center gap-6 px-1">
              <div class="h-px flex-1 bg-app-border"></div>
              <h3 class="text-indigo-600 text-[10px] font-black uppercase tracking-[0.4em] whitespace-nowrap bg-indigo-600/5 px-6 py-2 rounded-full border border-indigo-600/10">
                🖥️ {{ getContextLabel(group.contextName) }}
              </h3>
              <div class="h-px flex-1 bg-app-border"></div>
            </div>

            <div class="grid grid-cols-1 gap-4">
              <div v-for="item in group.items" :key="item.id"
                :class="item.effective <= 0 ? 'animate-warning-critical' : 'animate-warning-low'"
                class="bg-app-surface border rounded-[2.5rem] overflow-hidden transition-all group/item shadow-sm">
                <div class="px-8 py-6 flex flex-col md:flex-row md:items-center gap-8">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-3">
                      <span class="text-[9px] px-2.5 py-1 bg-app-bg text-app-text-muted rounded-xl font-black uppercase tracking-widest border border-app-border">
                        {{ item.game_title }}
                      </span>
                      <h3 class="text-app-text-primary font-black text-lg tracking-tight">{{ item.item_display_name }}</h3>
                    </div>
                    <div class="flex flex-wrap gap-x-8 gap-y-3">
                      <div class="flex flex-col gap-1">
                        <span class="text-[10px] font-black text-app-text-muted uppercase tracking-widest opacity-40">Tồn khả dụng</span>
                        <span class="text-app-text-secondary font-black font-mono text-sm">{{ formatQty(item.available) }}</span>
                      </div>
                      <div class="flex flex-col gap-1">
                        <span class="text-[10px] font-black text-app-text-muted uppercase tracking-widest opacity-40">Chờ giao</span>
                        <span class="text-orange-500 font-black font-mono text-sm">{{ formatQty(item.pending) }}</span>
                      </div>
                      <div class="flex flex-col gap-1">
                        <span class="text-[10px] font-black text-app-text-muted uppercase tracking-widest opacity-40">Thực sự còn</span>
                        <span class="font-black font-mono text-sm" :class="item.effective <= 0 ? 'text-red-500 underline decoration-red-500/30 underline-offset-4' : 'text-yellow-600'">
                          {{ formatQty(item.effective) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-8">
                    <div class="text-right px-6 py-4 bg-app-bg/50 rounded-[1.5rem] border border-app-border/50 group-hover/item:border-red-500/10 transition-all shadow-inner">
                      <p class="text-[9px] text-app-text-muted uppercase tracking-[0.2em] mb-1 font-black opacity-60">Ngưỡng</p>
                      <div class="flex items-center gap-3 justify-end">
                        <span class="text-app-text-primary font-mono font-black text-xl">{{ formatQty(item.warning_threshold) }}</span>
                        <button @click="editExistingThreshold(item)" class="p-2 bg-indigo-600/10 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all transform hover:scale-110">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>
                        </button>
                      </div>
                    </div>
                    
                    <div v-if="item.effective <= 0" class="min-w-[100px] text-center py-2 bg-red-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-red-500/20 animate-pulse">
                      Cạn kho
                    </div>
                    <div v-else class="min-w-[100px] text-center py-2 bg-yellow-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-yellow-500/20">
                      Sắp hết
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Safe Section -->
        <div v-if="safeItems.length > 0" class="mt-16 pt-12 border-t border-app-border border-dashed">
          <h3 class="text-app-text-muted text-[10px] uppercase tracking-[0.5em] font-black mb-8 px-1 text-center opacity-40 italic">Các vật phẩm đang an toàn</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50 hover:opacity-100 transition duration-500">
            <div v-for="item in safeItems" :key="item.id" 
              class="bg-app-surface/50 border border-app-border p-6 rounded-[2rem] flex items-center justify-between group/safe hover:bg-app-surface hover:shadow-lg transition-all">
              <div class="flex-1">
                <p class="text-app-text-muted text-[9px] font-black uppercase mb-2 tracking-widest opacity-60">{{ getContextLabel(item.game_context) }}</p>
                <p class="text-app-text-primary text-sm font-black mb-3">{{ item.item_display_name }}</p>
                <div class="flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest">
                  <div class="flex items-center gap-2">
                    <span class="text-app-text-muted opacity-40">Tồn:</span>
                    <span class="text-app-text-secondary">{{ formatQty(item.available) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-app-text-muted opacity-40">Chờ giao:</span>
                    <span class="text-orange-500">{{ formatQty(item.pending) }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-green-500">
                    <span class="opacity-60">Thực còn:</span>
                    <span class="font-mono text-sm tracking-tighter">{{ formatQty(item.effective) }}</span>
                  </div>
                </div>
              </div>
              <div class="text-right ml-6 border-l border-app-border pl-6">
                <p class="text-[9px] text-app-text-muted uppercase font-black tracking-widest mb-2 opacity-60">Ngưỡng</p>
                <div class="flex items-center gap-3 justify-end">
                  <p class="text-app-text-muted text-sm font-mono font-black">{{ formatQty(item.warning_threshold) }}</p>
                  <button @click="editExistingThreshold(item)" class="p-2 text-app-text-muted hover:text-indigo-600 transition-all opacity-60 hover:opacity-100 transform hover:rotate-90">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
    </template>
    </div>
  </PaginatedListLayout>

  <!-- Settings Modal -->
      <ModalWrapper v-model="showModal" size="md" radius="[2.5rem]" :z-index="50">
        <div class="h-2 bg-indigo-600 w-full"></div>
        <div class="p-10 overflow-y-auto">
          <h3 class="text-app-text-primary font-black text-2xl uppercase tracking-tight mb-2">Cài đặt cảnh báo</h3>
          <p class="text-app-text-muted text-[10px] font-black uppercase tracking-widest opacity-50 mb-8 border-b border-app-border pb-6">Thiết lập ngưỡng tồn kho theo máy chủ</p>
          <div class="space-y-8">
            <div v-if="!editingDocName" class="space-y-6">
              <div>
                <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-3 px-1 opacity-60">Chọn Game</label>
                <select v-model="modalGame" class="app-select" @change="selectedItem = ''; selectedContext = ''">
                  <option value="">-- Chọn Game --</option>
                  <option v-for="g in gameTitles" :key="g" :value="g">{{ gameIcon(g) }} {{ g }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-3 px-1 opacity-60">Chọn Vật phẩm</label>
                <select v-model="selectedItem" class="app-select" :disabled="!modalGame">
                  <option value="">-- Chọn Vật phẩm --</option>
                  <option v-for="i in filteredCurrencyItems" :key="i.name" :value="i.name">{{ i.item_name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-3 px-1 opacity-60">Máy chủ / League</label>
                <select v-model="selectedContext" class="app-select" :disabled="!modalGame">
                  <option value="">-- Chọn Máy chủ/League --</option>
                  <option v-for="c in filteredGameContexts" :key="c.name" :value="c.name">{{ getContextLabel(c.name) }}</option>
                </select>
              </div>
            </div>
            <div v-else class="bg-indigo-600/[0.03] border border-indigo-600/10 rounded-[1.5rem] p-6 transition-all">
              <p class="text-indigo-600 text-[9px] uppercase font-black mb-2 tracking-widest opacity-60">Đang cấu hình cho:</p>
              <p class="text-app-text-primary font-black text-lg tracking-tight mb-1">{{ editingDisplayName }}</p>
              <p class="text-app-text-muted text-[11px] font-black uppercase tracking-widest opacity-40">{{ gameIcon(modalGame) }} {{ modalGame }} · {{ getContextLabel(selectedContext) }}</p>
            </div>
            <div>
              <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-3 px-1 opacity-60">Ngưỡng báo động (Threshold)</label>
              <div class="relative group">
                <input
                  type="number"
                  v-model.number="thresholdValue"
                  class="w-full bg-app-surface border border-app-border rounded-2xl px-6 py-6 text-app-text-primary font-mono text-3xl font-black outline-none focus:border-indigo-600 transition-all"
                  placeholder="0"
                  min="0"
                />
                <div class="absolute right-6 top-1/2 -translate-y-1/2 text-app-text-muted font-black text-[10px] uppercase opacity-30 pointer-events-none group-focus-within:opacity-100 transition-opacity">Số lượng tiền tệ</div>
              </div>
              <div class="mt-4 p-4 bg-app-surface rounded-xl border border-app-border flex gap-3 italic">
                <span class="text-indigo-600">💡</span>
                <p class="text-[10px] text-app-text-muted font-medium leading-relaxed opacity-60">
                  Ngưỡng này sẽ áp dụng chung. Hệ thống báo đỏ khi: (Tồn khả dụng - Chờ giao) ≤ Ngưỡng.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="p-8 bg-app-bg/50 border-t border-app-border flex gap-4">
          <button v-if="editingDocName" @click="removeThreshold" :disabled="saving"
            class="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
          </button>
          <button @click="showModal = false" class="flex-1 py-4 rounded-2xl btn-premium bg-app-surface border border-app-border text-app-text-muted hover:text-app-text-primary">Quay lại</button>
          <AppButton variant="primary" size="lg" class="flex-[2]" :loading="saving" :disabled="saving || !selectedItem || !selectedContext" @click="saveThreshold">🚀 Publish Policy</AppButton>
        </div>
      </ModalWrapper>
  </div>
</template>

<script setup>
defineOptions({ name: 'WarningView' })
import { ref, computed, onActivated } from 'vue'
import { getList, updateDoc, createDoc, deleteDoc } from '../api/index.js'
import { formatQty, gameIcon } from '../utils/format.js'
import PageHeader from '../components/PageHeader.vue'
import AppButton from '../components/AppButton.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { useMetadata } from '../composables/useMetadata.js'
import { useNotify } from '../composables/useNotify.js'
import { useOrderItems } from '../composables/useOrderItems.js'

const { success, error, warn, info, confirm } = useNotify()
const { fetchOrderItems } = useOrderItems()
const { currencyItems, gameContexts, fetchMetadata } = useMetadata()

const loading = ref(true)
const thresholds = ref([])
const inventoryPositions = ref([])
const pendingOrders = ref([])

const showModal = ref(false)
const editingDocName = ref(null)
const editingDisplayName = ref('')
const selectedItem = ref('')
const selectedContext = ref('')
const thresholdValue = ref(0)
const saving = ref(false)
const modalGame = ref('')

const gameTitles = computed(() => {
  const titles = [...new Set(currencyItems.value.map(i => i.game_title).filter(Boolean))]
  return titles.sort()
})

const filteredCurrencyItems = computed(() => {
  if (!modalGame.value) return []
  return currencyItems.value.filter(i => i.game_title === modalGame.value)
})

const filteredGameContexts = computed(() => {
  if (!modalGame.value) return []
  return gameContexts.value.filter(c => c.game_title === modalGame.value)
})

// All calculated stats per threshold
const allStats = computed(() => {
  return thresholds.value.map(t => {
    const item = currencyItems.value.find(i => i.name === t.currency_item) || {}
    const ctx = gameContexts.value.find(c => c.name === t.game_context) || {}
    
    // Available in this specific context
    const available = inventoryPositions.value
      .filter(p => p.currency_item === t.currency_item && p.game_context === t.game_context)
      .reduce((sum, p) => sum + (p.qty_available || 0), 0)
    
    // Pending in this specific context
    const pending = pendingOrders.value
      .filter(o => o.game_context === t.game_context)
      .reduce((sum, o) => {
        const itemQty = (o.items || []).filter(i => i.currency_item === t.currency_item).reduce((s, i) => s + (i.quantity || 0), 0)
        return sum + itemQty
      }, 0)
    
    const effective = available - pending
    const threshold = t.warning_threshold || 0
    const isWarning = effective <= threshold

    return {
      id: t.name,
      currency_item: t.currency_item,
      game_context: t.game_context,
      game_title: item.game_title || 'N/A',
      item_display_name: item.item_name || t.currency_item,
      available,
      pending,
      effective,
      warning_threshold: threshold,
      isWarning
    }
  })
})

const warningGroups = computed(() => {
  const warnings = allStats.value.filter(i => i.isWarning)
  const groups = {}
  warnings.forEach(w => {
    if (!groups[w.game_context]) groups[w.game_context] = []
    groups[w.game_context].push(w)
  })

  return Object.entries(groups).map(([ctx, items]) => ({
    contextName: ctx,
    items: items.sort((a,b) => a.effective - b.effective)
  })).sort((a,b) => a.contextName.localeCompare(b.contextName))
})

const safeItems = computed(() => allStats.value.filter(i => !i.isWarning).sort((a,b) => a.item_display_name.localeCompare(b.item_display_name)))

function getContextLabel(ctxName) {
  const ctx = gameContexts.value.find(c => c.name === ctxName)
  if (!ctx) return ctxName
  return [ctx.season_or_league, ctx.mode].filter(Boolean).join(' - ') || ctxName
}

async function loadAll() {
  loading.value = true
  try {
    const results = await Promise.allSettled([
      getList('Inventory Warning Threshold', { fields: ['name', 'currency_item', 'game_context', 'warning_threshold'], limit: 1000 }),
      getList('Inventory Position', { fields: ['currency_item', 'game_context', 'qty_available'], filters: [['is_active', '=', 1]], limit: 1000 }),
      getList('Sell Order', { fields: ['name', 'game_context', 'workflow_state'], filters: [['workflow_state', 'in', ['Queued', 'Claimed']]], limit: 1000 }),
      fetchMetadata(),
    ])
    const [tData, pData, soData] = results.map(r => r.status === 'fulfilled' ? r.value : [])

    // Fetch Sell Order Item child table separately (Frappe list API doesn't return child tables)
    if (soData?.length) {
      try { await fetchOrderItems(soData, 'Sell Order') } catch { /* no permission */ }
    }

    thresholds.value = tData || []
    inventoryPositions.value = pData || []
    pendingOrders.value = soData || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function openAllSettings() {
  editingDocName.value = null
  modalGame.value = ''
  selectedItem.value = ''
  selectedContext.value = ''
  thresholdValue.value = 0
  showModal.value = true
}

function editExistingThreshold(stat) {
  editingDocName.value = stat.id
  editingDisplayName.value = stat.item_display_name
  modalGame.value = stat.game_title || ''
  selectedItem.value = stat.currency_item
  selectedContext.value = stat.game_context
  thresholdValue.value = stat.warning_threshold
  showModal.value = true
}

async function saveThreshold() {
  if (!selectedItem.value || !selectedContext.value) return
  saving.value = true
  try {
    const newVal = Number(thresholdValue.value) || 0
    
    // Find existing doc by filters instead of trying to guess the name
    const existing = await getList('Inventory Warning Threshold', {
      filters: [
        ['currency_item', '=', selectedItem.value],
        ['game_context', '=', selectedContext.value]
      ],
      limit: 1
    })
    
    if (existing && existing.length > 0) {
      await updateDoc('Inventory Warning Threshold', existing[0].name, {
        warning_threshold: newVal
      })
    } else {
      await createDoc('Inventory Warning Threshold', {
        currency_item: selectedItem.value,
        game_context: selectedContext.value,
        warning_threshold: newVal
      })
    }
    
    showModal.value = false
    await loadAll()
    success('Lưu ngưỡng tồn kho thành công')
  } catch (e) {
    error('Lỗi khi lưu ngưỡng: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function removeThreshold() {
  if (!editingDocName.value) return
  if (!(await confirm('Bạn có chắc chắn muốn xóa thiết lập cảnh báo này?'))) return
  
  saving.value = true
  try {
    await deleteDoc('Inventory Warning Threshold', editingDocName.value)
    showModal.value = false
    await loadAll()
    success('Đã xóa thiết lập cảnh báo')
  } catch (e) {
    error('Lỗi khi xóa: ' + e.message)
  } finally {
    saving.value = false
  }
}

onActivated(async () => {
  await loadAll()
})

const { connected } = useRealtimeSubscriptions(
  {
    'Inventory Warning Threshold': loadAll,
    'Sell Order': loadAll,
    'Inventory Position': loadAll,
    'Currency Item': loadAll,
    'Game Context': loadAll,
  },
  { onMount: loadAll }
)
</script>

<style scoped>
.animate-warning-critical {
  border: 1px solid rgba(239, 68, 68, 0.3);
  animation: pulse-critical 2s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
}
.animate-warning-low {
  border: 1px solid rgba(234, 179, 8, 0.3);
  animation: pulse-low 2s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(234, 179, 8, 0);
}
@keyframes pulse-critical {
  0%, 100% {
    border-color: rgba(239, 68, 68, 0.3);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
  50% {
    border-color: rgba(239, 68, 68, 0.8);
    box-shadow: 0 0 20px 4px rgba(239, 68, 68, 0.15);
  }
}
@keyframes pulse-low {
  0%, 100% {
    border-color: rgba(234, 179, 8, 0.3);
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0);
  }
  50% {
    border-color: rgba(234, 179, 8, 0.8);
    box-shadow: 0 0 20px 4px rgba(234, 179, 8, 0.1);
  }
}
</style>
