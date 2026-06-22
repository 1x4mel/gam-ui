<template>
  <div class="h-full">
    <PaginatedListLayout
      self-scroll
      :total-items="total"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      @update:current-page="loadData"
      @update:page-size="onPageSizeChange"
    >
      <template #header>
        <PageHeader title="Bảng giá" subtitle="Giá cố định cho đơn hàng" @refresh="loadData">
          <template #actions>
            <AppButton v-if="canEdit" variant="primary" size="md" @click="openAdd">+ Thêm giá</AppButton>
          </template>
        </PageHeader>
      </template>
      <template #filters>
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="relative">
            <input v-model="search" @input="onFilterChange" placeholder="Tìm item, context..."
              class="pl-8 pr-3 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition w-48" />
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-text-muted text-xs">🔍</span>
          </div>
          <select v-model="filterType" @change="onFilterChange"
            class="px-3 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition">
            <option value="">Tất cả loại</option>
            <option value="Mua">Giá mua</option>
            <option value="Bán">Giá bán</option>
          </select>
          <select v-model="filterContext" @change="onFilterChange"
            class="px-3 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition">
            <option value="">Tất cả Game Context</option>
            <option v-for="gc in gameContexts" :key="gc.name" :value="gc.name">{{ formatGC(gc) }}</option>
          </select>
          <select v-model="filterCurrency" @change="onFilterChange"
            class="px-3 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition">
            <option value="">Tất cả Currency</option>
            <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
      </template>
      <template #default>
        <div v-if="loading" class="text-center py-8 text-app-text-muted">Đang tải...</div>
        <div v-else-if="prices.length === 0" class="text-center py-8 text-app-text-muted">Chưa có giá nào</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-app-text-muted border-b border-app-border">
                <th class="px-4 py-3">Loại</th>
                <th class="px-4 py-3">Item</th>
                <th class="px-4 py-3">Game Context</th>
                <th class="px-4 py-3">Unit Price</th>
                <th class="px-4 py-3">Cập nhật</th>
                <th v-if="canEdit" class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in prices" :key="p.name" class="border-b border-app-border hover:bg-app-surface transition">
                <td class="px-4 py-3">
                  <span v-if="p.price_type === 'Mua'" class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">Mua</span>
                  <span v-else-if="p.price_type === 'Bán'" class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">Bán</span>
                  <span v-else class="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 text-xs font-bold">{{ p.price_type || '—' }}</span>
                </td>
                <td class="px-4 py-3 font-medium">{{ p.currency_item_name || p.currency_item }}</td>
                <td class="px-4 py-3">{{ p.game_context }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5">
                    <template v-if="canEdit">
                      <input v-model.number="p._editPrice" type="number" step="any"
                        class="w-28 px-2 py-1 rounded-lg text-right font-mono outline-none transition"
                        :class="hasChanged(p) ? 'bg-amber-500/10 border border-amber-500/50 focus:border-amber-500' : 'bg-transparent border border-transparent focus:border-indigo-500 hover:border-app-border'"
                        @keyup.enter="saveEdit(p)" @focus="onPriceFocus(p)" />
                    </template>
                    <span v-else class="font-mono">{{ formatNumber(p.unit_price) }}</span>
                    <span class="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 text-xs font-bold">{{ p.currency }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-app-text-muted text-xs">{{ formatUser(p.modified_by) }} · {{ formatTimeAgo(p.modified) }}</td>
                <td v-if="canEdit" class="px-4 py-3 text-right whitespace-nowrap">
                  <button v-if="hasChanged(p)" @click="saveEdit(p)"
                    class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold mr-2 transition">Lưu</button>
                  <button v-if="hasChanged(p)" @click="cancelEdit(p)"
                    class="px-2.5 py-1 rounded-lg bg-app-surface hover:bg-app-border text-app-text-muted text-xs mr-2 transition">Hủy</button>
                  <button @click="confirmDelete(p)" class="text-red-500 hover:text-red-700 text-xs">Xóa</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Add Modal -->
        <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showAddModal = false">
          <div class="bg-app-bg rounded-2xl shadow-2xl border border-app-border p-6 w-full max-w-md mx-4">
            <h3 class="text-lg font-bold text-app-text-primary mb-4">Thêm giá mới</h3>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-app-text-muted">Loại giá *</label>
                <select v-model="modalData.price_type"
                  class="w-full mt-1 px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500">
                  <option value="Mua">Giá mua (Buy Order)</option>
                  <option value="Bán">Giá bán (Sell Order)</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-app-text-muted">Game Context *</label>
                <select v-model="modalData.game_context" @change="onModalContextChange"
                  class="w-full mt-1 px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500">
                  <option value="">Chọn context</option>
                  <option v-for="gc in gameContexts" :key="gc.name" :value="gc.name">{{ formatGC(gc) }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-app-text-muted">Currency Item *</label>
                <SearchableSelect
                  v-model="modalData.currency_item"
                  :options="ciOptions"
                  :disabled="!modalData.game_context"
                  placeholder="Chọn item"
                  clearable
                />
              </div>
              <div>
                <label class="text-xs text-app-text-muted">Currency *</label>
                <select v-model="modalData.currency"
                  class="w-full mt-1 px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500">
                  <option value="">Chọn currency</option>
                  <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-app-text-muted">Unit Price *</label>
                <input v-model.number="modalData.unit_price" type="number" step="any"
                  class="w-full mt-1 px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div v-if="modalError" class="mt-3 text-sm text-red-500">{{ modalError }}</div>
            <div class="flex gap-3 mt-6">
              <AppButton variant="ghost" @click="showAddModal = false">Hủy</AppButton>
              <AppButton variant="primary" @click="submitAdd" :disabled="submitting">Thêm</AppButton>
            </div>
          </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showDeleteModal = false">
          <div class="bg-app-bg rounded-2xl shadow-2xl border border-app-border p-6 w-full max-w-sm mx-4">
            <h3 class="text-lg font-bold text-app-text-primary mb-2">Xác nhận xóa</h3>
            <p class="text-sm text-app-text-secondary mb-1">Xóa giá <span class="font-bold">{{ deleteTarget?.price_type }}</span> cho:</p>
            <p class="text-sm text-app-text-primary font-bold mb-4">{{ deleteTarget?.currency_item_name || deleteTarget?.currency_item }} / {{ deleteTarget?.game_context }} / {{ deleteTarget?.currency }}</p>
            <p class="text-xs text-red-500 mb-4">Giá sẽ bị ẩn khỏi hệ thống (inactive).</p>
            <div class="flex gap-3">
              <AppButton variant="ghost" @click="showDeleteModal = false">Hủy</AppButton>
              <AppButton variant="danger" @click="doDelete" :disabled="submitting">Xóa</AppButton>
            </div>
          </div>
        </div>
      </template>
    </PaginatedListLayout>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getList, createDoc, updateDoc, frappeCall } from '../api/index.js'
import { useAuth } from '../composables/useAuth.js'
import { useItemPrice } from '../composables/useItemPrice.js'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import PageHeader from '../components/PageHeader.vue'
import AppButton from '../components/AppButton.vue'
import SearchableSelect from '../components/SearchableSelect.vue'

const { isAdmin, isGameCurrencyAdmin, isMarketLeader } = useAuth()
const { prices, loading, total, fetchPrices } = useItemPrice()

const canEdit = computed(() => isAdmin.value || isGameCurrencyAdmin.value || isMarketLeader.value)

const currencies = ['USDT', 'USD', 'CNY', 'VND']

const filterType = ref('')
const filterContext = ref('')
const filterCurrency = ref('')
const search = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const gameContexts = ref([])
const currencyItems = ref([])

// Add modal state
const showAddModal = ref(false)
const submitting = ref(false)
const modalError = ref('')
const modalData = ref({ price_type: 'Mua', currency_item: '', game_context: '', currency: '', unit_price: 0 })

// Inline edit state
const originalValues = ref({})

// Delete modal state
const showDeleteModal = ref(false)
const deleteTarget = ref(null)

const ciOptions = computed(() => {
  const gc = gameContexts.value.find(g => g.name === modalData.value.game_context)
  let items = currencyItems.value
  if (gc?.game_title) {
    items = items.filter(ci => ci.game_title === gc.game_title)
  }
  return items.map(ci => ({ label: ci.item_name || ci.name, value: ci.name }))
})

function formatGC(gc) {
  let label = gc.game_title || gc.name
  if (gc.season_or_league) label += ' - ' + gc.season_or_league
  if (gc.server) label += ' (' + gc.server + ')'
  return label
}

function formatNumber(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN')
}

function formatUser(email) {
  if (!email) return '—'
  return email.split('@')[0]
}

function formatTimeAgo(datetime) {
  if (!datetime) return '—'
  const d = new Date(datetime)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return Math.floor(diff / 60) + ' phút trước'
  if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước'
  if (diff < 604800) return Math.floor(diff / 86400) + ' ngày trước'
  return d.toLocaleDateString('vi-VN')
}

// Track original prices to detect changes
function hasChanged(p) {
  const orig = originalValues.value[p.name]
  return orig != null && p._editPrice !== orig
}

function onPriceFocus(p) {
  // Ensure _editPrice is set on focus
  if (p._editPrice == null) p._editPrice = p.unit_price
}

async function loadData() {
  const start = (currentPage.value - 1) * pageSize.value
  await fetchPrices(
    filterType.value || null,
    filterContext.value || null,
    filterCurrency.value || null,
    start,
    pageSize.value,
    search.value || null,
  )
  // Snapshot original prices and init edit buffer
  prices.value.forEach(p => {
    if (!(p.name in originalValues.value)) {
      originalValues.value[p.name] = p.unit_price
    }
    p._editPrice = p.unit_price
  })
}

function onFilterChange() {
  currentPage.value = 1
  loadData()
}

function onPageSizeChange() {
  currentPage.value = 1
  loadData()
}

async function loadMetadata() {
  const [gc, ci] = await Promise.all([
    getList('Game Context', { fields: ['name', 'game_title', 'server', 'season_or_league'], limit: 0 }),
    getList('Currency Item', { fields: ['name', 'item_name', 'game_title'], limit: 0 }),
  ])
  gameContexts.value = gc
  currencyItems.value = ci
}

function onModalContextChange() {
  modalData.value.currency_item = ''
}

function openAdd() {
  modalData.value = { price_type: 'Mua', currency_item: '', game_context: '', currency: '', unit_price: 0 }
  modalError.value = ''
  showAddModal.value = true
}

// Inline edit
function cancelEdit(p) {
  p._editPrice = originalValues.value[p.name]
}

async function saveEdit(p) {
  if (p._editPrice === originalValues.value[p.name]) return
  try {
    await updateDoc('Item Price', p.name, { unit_price: p._editPrice })
    originalValues.value[p.name] = p._editPrice
    p.unit_price = p._editPrice
  } catch (e) {
    alert(e.message || 'Lỗi khi lưu')
  }
}

// Delete with modal
function confirmDelete(p) {
  deleteTarget.value = p
  showDeleteModal.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  submitting.value = true
  try {
    await frappeCall('gege_custom.gege_custom.api.market_leader.delete_price', { name: deleteTarget.value.name })
    showDeleteModal.value = false
    deleteTarget.value = null
    await loadData()
  } catch (e) {
    alert(e.message || 'Lỗi khi xóa')
  } finally {
    submitting.value = false
  }
}

// Add with duplicate check
async function submitAdd() {
  const md = modalData.value
  if (!md.price_type || !md.currency_item || !md.game_context || !md.currency || !md.unit_price) {
    modalError.value = 'Vui lòng điền đủ các trường'
    return
  }
  // Duplicate check against loaded prices
  const dup = prices.value.find(p =>
    p.price_type === md.price_type &&
    p.currency_item === md.currency_item &&
    p.game_context === md.game_context &&
    p.currency === md.currency
  )
  if (dup) {
    const itemName = dup.currency_item_name || dup.currency_item
    modalError.value = `Giá ${md.price_type} đã tồn tại cho ${itemName} / ${md.game_context} / ${md.currency}`
    return
  }
  submitting.value = true
  modalError.value = ''
  try {
    await createDoc('Item Price', {
      price_type: md.price_type,
      currency_item: md.currency_item,
      game_context: md.game_context,
      currency: md.currency,
      unit_price: md.unit_price,
      is_active: 1,
    })
    showAddModal.value = false
    originalValues.value = {}
    await loadData()
  } catch (e) {
    modalError.value = e.message || 'Lỗi'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadData()
  loadMetadata()
})
</script>
