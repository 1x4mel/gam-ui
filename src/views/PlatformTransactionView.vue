<template>
  <div class="w-full flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/queue')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">GD Nền tảng</h2>
      <div class="flex-1" />
      <AppButton variant="primary" size="sm" @click="openForm(null)">+ Tạo giao dịch</AppButton>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
      <div class="flex items-center gap-3 mb-4 px-1">
        <select v-model="filters.transaction_type" class="input-field !py-2 text-sm w-32">
          <option value="">Tất cả</option>
          <option value="Deposit">Nạp</option>
          <option value="Withdraw">Rút</option>
        </select>
        <span class="text-app-text-muted text-[10px] font-bold">{{ filteredRows.length }}<template v-if="hasMore"> (còn thêm)</template></span>
      </div>

      <LoadingSpinner v-if="loading" class="flex items-center justify-center py-20" />
      <EmptyState v-else-if="filteredRows.length === 0" message="Không có giao dịch nền tảng" />
      <ResponsiveTable v-else>
        <template #header>
          <th class="px-4 py-3">Thời gian</th>
          <th class="px-4 py-3 text-center">Loại</th>
          <th class="px-4 py-3">Nền tảng</th>
          <th class="px-4 py-3 text-right">Số tiền</th>
          <th class="px-4 py-3">TK</th>
          <th class="px-4 py-3 text-center">Trạng thái</th>
        </template>
        <template #body>
          <tr v-for="row in filteredRows" :key="row.name" class="hover:bg-app-bg/50 transition">
            <td class="px-4 py-3 text-xs text-app-text-muted whitespace-nowrap">{{ formatTime(row.transaction_date) }}</td>
            <td class="px-4 py-3 text-center">
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                :class="row.transaction_type === 'Withdraw' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600'">
                {{ row.transaction_type === 'Deposit' ? 'Nạp' : 'Rút' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-app-text-primary font-medium">{{ row.channel }}</td>
            <td class="px-4 py-3 text-right text-sm font-bold text-app-text-primary">{{ formatNum(row.amount) }} {{ row.currency }}</td>
            <td class="px-4 py-3 text-xs text-app-text-muted font-mono">{{ row.bank_account }}</td>
            <td class="px-4 py-3 text-center">
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                :class="row.status === 'Submitted' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-200/50 text-gray-500'">
                {{ row.status === 'Submitted' ? 'Hoàn thành' : 'Nháp' }}
              </span>
            </td>
          </tr>
        </template>
        <template #mobile>
          <div v-for="row in filteredRows" :key="row.name" class="bg-app-surface border border-app-border rounded-xl p-4 mb-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-app-text-primary">{{ row.channel }}</p>
                <p class="text-xs text-app-text-muted">{{ formatTime(row.transaction_date) }}</p>
              </div>
              <div class="text-right">
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  :class="row.transaction_type === 'Withdraw' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600'">
                  {{ row.transaction_type === 'Deposit' ? 'Nạp' : 'Rút' }}
                </span>
                <p class="text-sm font-bold text-app-text-primary mt-1">{{ formatNum(row.amount) }} {{ row.currency }}</p>
              </div>
            </div>
          </div>
        </template>
      </ResponsiveTable>
      <LoadMoreButton :has-more="hasMore" :loading="loading" :item-count="rows.length" @load-more="loadMore" />
    </div>

    <!-- Create Modal -->
    <div v-if="formOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="formOpen = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">Tạo giao dịch nền tảng</h3>
          <button @click="formOpen = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">✕</button>
        </div>
        <div class="flex-1 overflow-y-auto p-8 space-y-5">
          <div v-if="formError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ formError }}</div>
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Loại <span class="text-red-500">*</span></label>
            <select v-model="formData.transaction_type" class="input-field !py-2.5 text-sm">
              <option value="Deposit">Nạp lên nền tảng</option>
              <option value="Withdraw">Rút từ nền tảng</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Nền tảng <span class="text-red-500">*</span></label>
            <select v-model="formData.channel" class="input-field !py-2.5 text-sm">
              <option value="">-- Chọn --</option>
              <option v-for="c in channels" :key="c.name" :value="c.name">{{ c.channel_name }}</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Currency <span class="text-red-500">*</span></label>
            <select v-model="formData.currency" class="input-field !py-2.5 text-sm">
              <option value="VND">VND</option>
              <option value="USD">USD</option>
              <option value="USDT">USDT</option>
              <option value="CNY">CNY</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Số tiền <span class="text-red-500">*</span></label>
            <input v-model="formData.amount" type="number" class="input-field !py-2.5 text-sm" placeholder="0" />
          </div>
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Ghi chú</label>
            <textarea v-model="formData.note" class="input-field !py-2.5 text-sm resize-none" rows="2"></textarea>
          </div>
        </div>
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="formOpen = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <AppButton variant="primary" size="sm" :loading="formSaving" @click="saveForm">Tạo</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getList, createDoc } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import AppButton from '../components/AppButton.vue'
import BackButton from '../components/BackButton.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadMoreButton from '../components/LoadMoreButton.vue'

defineOptions({ name: 'PlatformTransactionView' })

const { success, error: notifyError } = useNotify()
const rows = ref([])
const channels = ref([])
const loading = ref(false)
const filters = ref({ transaction_type: '' })
const formOpen = ref(false)
const formSaving = ref(false)
const formError = ref('')
const formData = ref({ transaction_type: 'Deposit', channel: '', currency: 'VND', amount: '', note: '' })
const offset = ref(0)
const hasMore = ref(false)
const SERVER_PAGE_SIZE = 200

const filteredRows = computed(() => {
  if (!filters.value.transaction_type) return rows.value
  return rows.value.filter(r => r.transaction_type === filters.value.transaction_type)
})

async function loadData(isLoadMore = false) {
  loading.value = true
  try {
    const currentOffset = isLoadMore ? offset.value : 0
    const [data, channelList] = await Promise.all([
      getList('Platform Transaction', { fields: ['name', 'transaction_date', 'transaction_type', 'channel', 'amount', 'currency', 'bank_account', 'status'], limit: SERVER_PAGE_SIZE + 1, offset: currentOffset, order_by: 'transaction_date desc' }),
      getList('Channel', { fields: ['name', 'channel_name', 'channel_group'], filters: [['is_active', '=', 1]], limit: 200 }),
    ])
    const hasMoreRows = data.length > SERVER_PAGE_SIZE
    if (hasMoreRows) data.length = SERVER_PAGE_SIZE
    if (isLoadMore) {
      rows.value = [...rows.value, ...data]
    } else {
      rows.value = data
    }
    offset.value = currentOffset + SERVER_PAGE_SIZE
    hasMore.value = hasMoreRows
    channels.value = channelList
  } catch (e) {
    console.error('Failed to load:', e)
  } finally {
    loading.value = false
  }
}

function loadMore() { loadData(true) }

function openForm() {
  formError.value = ''
  formData.value = { transaction_type: 'Deposit', channel: '', currency: 'VND', amount: '', note: '' }
  formOpen.value = true
}

async function saveForm() {
  formError.value = ''
  if (!formData.value.channel || !formData.value.amount) { formError.value = 'Nền tảng và số tiền là bắt buộc'; return }
  formSaving.value = true
  try {
    const doc = await createDoc('Platform Transaction', {
      transaction_type: formData.value.transaction_type,
      channel: formData.value.channel,
      currency: formData.value.currency,
      amount: formData.value.amount,
      note: formData.value.note,
    })
    success('Đã tạo giao dịch')
    formOpen.value = false
    await loadData()
  } catch (e) {
    formError.value = (e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim()
  } finally {
    formSaving.value = false
  }
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

onMounted(loadData)
</script>
