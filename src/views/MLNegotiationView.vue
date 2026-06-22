<template>
  <div class="h-full">
    <PaginatedListLayout self-scroll :total-items="totalCount">
      <template #header>
        <PageHeader title="Đơn Thương lượng" subtitle="Đơn chờ Market Leader set giá" @refresh="loadData">
        </PageHeader>
      </template>
      <template #default>
        <LoadingSpinner v-if="loading" text="Đang tải..." />

        <EmptyState v-else-if="totalCount === 0" icon="📭" text="Không có đơn nào chờ xử lý" />

        <div v-else class="max-w-4xl mx-auto px-4 space-y-4">
          <!-- Buy Orders -->
          <template v-if="orders.buy && orders.buy.length > 0">
            <h3 class="text-sm font-bold text-app-text-muted uppercase tracking-wider px-1 mt-2">Buy Orders</h3>
            <div v-for="order in orders.buy" :key="order.name"
              class="bg-app-surface rounded-xl border border-app-border p-4 cursor-pointer hover:border-indigo-500/50 transition"
              @click="openOrder(order, 'Buy Order')">
              <div class="flex items-center justify-between mb-2">
                <span class="font-mono text-sm text-indigo-600 font-bold">{{ order.name }}</span>
                <span class="text-xs text-app-text-muted">{{ formatTime(order.creation) }}</span>
              </div>
              <div class="text-sm text-app-text-secondary">
                <span>{{ order.game_context }}</span> / <span>{{ order.buy_channel }}</span>
                <span class="mx-2">|</span>
                <span>{{ order.supplier || 'N/A' }}</span>
              </div>
              <div class="mt-2 text-xs text-app-text-muted">
                {{ order.items?.length || 0 }} item(s) — chưa có giá
              </div>
            </div>
          </template>

          <!-- Sell Orders -->
          <template v-if="orders.sell && orders.sell.length > 0">
            <h3 class="text-sm font-bold text-app-text-muted uppercase tracking-wider px-1 mt-4">Sell Orders</h3>
            <div v-for="order in orders.sell" :key="order.name"
              class="bg-app-surface rounded-xl border border-app-border p-4 cursor-pointer hover:border-indigo-500/50 transition"
              @click="openOrder(order, 'Sell Order')">
              <div class="flex items-center justify-between mb-2">
                <span class="font-mono text-sm text-indigo-600 font-bold">{{ order.name }}</span>
                <span class="text-xs text-app-text-muted">{{ formatTime(order.creation) }}</span>
              </div>
              <div class="text-sm text-app-text-secondary">
                <span>{{ order.game_context }}</span> / <span>{{ order.sell_channel }}</span>
                <span class="mx-2">|</span>
                <span>{{ order.customer || 'N/A' }}</span>
              </div>
              <div class="mt-2 text-xs text-app-text-muted">
                {{ order.items?.length || 0 }} item(s) — chưa có giá
              </div>
            </div>
          </template>
        </div>

        <!-- Price Setting Modal -->
        <div v-if="selectedOrder" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="selectedOrder = null">
          <div class="bg-app-bg rounded-2xl shadow-2xl border border-app-border p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-bold text-app-text-primary mb-1">{{ selectedOrderType }} — {{ selectedOrder.name }}</h3>
            <p class="text-sm text-app-text-muted mb-4">{{ selectedOrder.game_context }} / {{ selectedOrder.buy_channel || selectedOrder.sell_channel }}</p>

            <table class="w-full text-sm mb-4">
              <thead>
                <tr class="text-left text-app-text-muted border-b border-app-border">
                  <th class="px-2 py-2">Item</th>
                  <th class="px-2 py-2 text-right">Qty</th>
                  <th class="px-2 py-2 text-right">Giá</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in selectedOrder.items" :key="item.name" class="border-b border-app-border">
                  <td class="px-2 py-2 font-medium">{{ itemName(item.currency_item) }}</td>
                  <td class="px-2 py-2 text-right">{{ item.quantity }}</td>
                  <td class="px-2 py-2 text-right">
                    <input v-model.number="item.unit_price" type="number" step="any"
                      class="w-28 px-2 py-1 rounded text-right bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500" />
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="confirmError" class="text-sm text-red-500 mb-3">{{ confirmError }}</div>

            <div class="flex gap-3">
              <AppButton variant="ghost" @click="selectedOrder = null">Hủy</AppButton>
              <AppButton variant="primary" @click="confirmPrice" :disabled="confirming">
                {{ confirming ? 'Đang xử lý...' : 'Confirm Price' }}
              </AppButton>
            </div>
          </div>
        </div>
      </template>
    </PaginatedListLayout>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { frappeCall, getList } from '../api/index.js'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import PageHeader from '../components/PageHeader.vue'
import AppButton from '../components/AppButton.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'

const loading = ref(false)
const orders = ref({ buy: [], sell: [] })
const selectedOrder = ref(null)
const selectedOrderType = ref('')
const confirming = ref(false)
const confirmError = ref('')
const currencyItemMap = ref({})

function itemName(id) {
  return currencyItemMap.value[id]?.item_name || id
}

const totalCount = computed(() => (orders.value.buy?.length || 0) + (orders.value.sell?.length || 0))

async function loadData() {
  loading.value = true
  try {
    const [data, ciList] = await Promise.all([
      frappeCall('gege_custom.gege_custom.api.market_leader.get_negotiation_orders'),
      getList('Currency Item', { fields: ['name', 'item_name'], limit: 0 }),
    ])
    orders.value = data
    const map = {}
    ciList.forEach(c => { map[c.name] = c })
    currencyItemMap.value = map
  } finally {
    loading.value = false
  }
}

function openOrder(order, doctype) {
  selectedOrder.value = JSON.parse(JSON.stringify(order))
  selectedOrderType.value = doctype
  confirmError.value = ''
}

async function confirmPrice() {
  if (!selectedOrder.value) return
  confirming.value = true
  confirmError.value = ''
  try {
    const items = selectedOrder.value.items.map(i => ({
      name: i.name,
      unit_price: i.unit_price,
    }))
    await frappeCall('gege_custom.gege_custom.api.market_leader.set_negotiation_price', {
      doctype: selectedOrderType.value,
      order_name: selectedOrder.value.name,
      items: JSON.stringify(items),
    })
    selectedOrder.value = null
    await loadData()
  } catch (e) {
    confirmError.value = e.message || 'Lỗi khi confirm giá'
  } finally {
    confirming.value = false
  }
}

function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('vi-VN')
}

onMounted(loadData)
</script>
