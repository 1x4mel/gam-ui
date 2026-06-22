<template>
  <div class="h-full">
    <PaginatedListLayout ref="listLayout" :total-items="total" :current-page="currentPage" :total-pages="totalPages" :page-size="pageSize" :self-scroll="true" @update:current-page="goToPage" @update:page-size="changePageSize">
      <template #header>
        <PageHeader title="Khách hàng" subtitle="Danh sách khách hàng trong hệ thống" :connected="false" @refresh="fetchCustomers" />
      </template>
      <template #filters>
        <div class="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-hidden">
          <input v-model="search" type="text" placeholder="Tìm theo tên, handle, ingame ID..." class="px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary placeholder-app-text-muted/80 outline-none focus:border-indigo-500 transition w-full sm:w-64 shadow-sm">
          <select v-model="tierFilter" class="px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]">
            <option value="">Tất cả phân cấp</option>
            <option value="Bronze">Bronze</option>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
            <option value="Platinum">Platinum</option>
          </select>
          <select v-model="typeFilter" class="px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]">
            <option value="">Tất cả loại</option>
            <option value="Individual">Individual</option>
            <option value="Company">Company</option>
          </select>
          <span class="text-app-text-muted text-xs font-medium">{{ total }} khách hàng</span>
        </div>
      </template>
      <template #default>
        <!-- Loading -->
        <div v-if="loading" class="h-full flex items-center justify-center">
          <LoadingSpinner size="lg" text="Đang tải danh sách khách hàng..." />
        </div>
        <!-- Empty -->
        <div v-else-if="customers.length === 0" class="h-full flex items-center justify-center">
          <EmptyState icon="👤" text="Không tìm thấy khách hàng nào" />
        </div>
        <!-- Desktop table -->
        <ResponsiveTable v-else :min-width="600" outer-class="mx-2 sm:mx-4 shadow-xl" rounded="2xl sm:3xl" mobile-class="px-3 sm:px-4 space-y-2">
          <template #header>
            <th class="px-4 sm:px-8 py-5">Khách hàng</th>
            <th class="px-3 sm:px-6 py-5 text-center">Tier & Loại</th>
            <th class="px-3 sm:px-6 py-5">Liên hệ</th>
            <th class="px-3 sm:px-6 py-5">Game</th>
            <th class="px-3 sm:px-6 py-5">Ghi chú</th>
            <th class="px-4 sm:px-8 py-5 text-right">Cập nhật</th>
            <th class="px-4 sm:px-8 py-5 text-right">Thao tác</th>
          </template>
          <template #body>
            <tr v-for="c in customers" :key="c.name" class="hover:bg-indigo-600/[0.03] transition-all group">
              <td class="px-4 sm:px-8 py-5">
                <div class="flex items-center gap-4">
                  <div class="w-11 h-11 rounded-2xl bg-app-bg border border-app-border flex items-center justify-center font-black text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 transition-all duration-300 shadow-sm">{{ (c.customer_name || c.name).slice(0, 1).toUpperCase() }}</div>
                  <div>
                    <p class="text-sm font-black text-app-text-primary group-hover:text-indigo-600 transition-colors">{{ c.customer_name || c.name }}</p>
                    <p class="text-[10px] text-app-text-muted font-bold uppercase tracking-wider mt-0.5">ID: {{ c.name }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 sm:px-6 py-5 text-center">
                <div class="flex flex-col items-center gap-2">
                  <span :class="['text-[9px] px-2.5 py-1 rounded-lg font-black border uppercase tracking-widest shadow-sm', tierColor(c.custom_customer_tier)]">{{ c.custom_customer_tier || '—' }}</span>
                  <span class="text-[9px] font-black text-app-text-muted uppercase tracking-widest opacity-70">{{ c.customer_type || 'N/A' }}</span>
                </div>
              </td>
              <td class="px-3 sm:px-6 py-5">
                <p class="text-xs text-app-text-secondary font-black tracking-tight">{{ c.custom_external_handle || '—' }}</p>
                <p class="text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-1 opacity-70">{{ c.custom_primary_channel || '—' }}</p>
              </td>
              <td class="px-3 sm:px-6 py-5">
                <p class="text-xs text-app-text-secondary font-black tracking-tight">{{ c.custom_ingame_id || '—' }}</p>
                <p class="text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-1 opacity-70">{{ c.custom_primary_game_context || '—' }}</p>
              </td>
              <td class="px-3 sm:px-6 py-5"><p class="text-xs text-app-text-muted font-medium truncate max-w-[150px]">{{ c.custom_risk_note || '—' }}</p></td>
              <td class="px-4 sm:px-8 py-5 text-right"><span class="text-[10px] text-app-text-muted font-bold">{{ formatDate(c.modified) }}</span></td>
              <td class="px-4 sm:px-8 py-5 text-right">
                <div class="flex items-center justify-end gap-1">
                  <AppButton variant="ghost" size="sm" @click.stop="openEdit(c)">Sửa</AppButton>
                  <AppButton variant="ghost" size="sm" class="text-red-400 hover:text-red-600" @click.stop="deleteCustomer(c)">Xóa</AppButton>
                </div>
              </td>
            </tr>
          </template>
          <template #mobile>
            <div v-for="c in customers" :key="c.name" class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-8 h-8 rounded-xl bg-app-bg border border-app-border flex items-center justify-center font-black text-indigo-600 text-xs shrink-0">{{ (c.customer_name || c.name).slice(0, 1).toUpperCase() }}</div>
                  <span class="text-app-text-primary font-black text-sm truncate">{{ c.customer_name || c.name }}</span>
                </div>
                <span :class="['text-[8px] px-2 py-0.5 rounded-md font-black border uppercase tracking-widest shrink-0', tierColor(c.custom_customer_tier)]">{{ c.custom_customer_tier || '—' }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[10px]">
                <div><p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Liên hệ</p><p class="text-app-text-secondary font-bold truncate">{{ c.custom_external_handle || '—' }}</p></div>
                <div><p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Ingame ID</p><p class="text-app-text-primary font-bold truncate">{{ c.custom_ingame_id || '—' }}</p></div>
                <div><p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Kênh</p><p class="text-app-text-secondary font-bold truncate">{{ c.custom_primary_channel || '—' }}</p></div>
                <div><p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Cập nhật</p><p class="text-app-text-primary font-bold">{{ formatDate(c.modified) }}</p></div>
              </div>
              <div class="flex justify-end gap-1 mt-2 pt-2 border-t border-app-border">
                <AppButton variant="ghost" size="sm" @click.stop="openEdit(c)">Sửa</AppButton>
                <AppButton variant="ghost" size="sm" class="text-red-400 hover:text-red-600" @click.stop="deleteCustomer(c)">Xóa</AppButton>
              </div>
            </div>
          </template>
        </ResponsiveTable>

        <!-- Edit modal -->
        <div v-if="editModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="editModal = false">
          <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
              <div>
                <h3 class="text-app-text-primary font-black text-xl uppercase tracking-tight">Cập nhật khách hàng</h3>
                <p class="text-app-text-muted text-[11px] font-medium mt-1">{{ editForm.customer_name || editForm.name }}</p>
              </div>
              <button @click="editModal = false" class="text-app-text-muted hover:text-app-text-primary transition-colors p-2 hover:bg-app-bg rounded-xl text-xl">&#10005;</button>
            </div>
            <div class="flex-1 overflow-y-auto p-8 space-y-6">
              <div class="space-y-4">
                <div>
                  <label class="label-text">Tên khách hàng <span class="text-red-500">*</span></label>
                  <input v-model="editForm.customer_name" type="text" class="cust-input" placeholder="Tên khách hàng">
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="label-text">Phân cấp (Tier)</label>
                    <select v-model="editForm.custom_customer_tier" class="cust-input appearance-none cursor-pointer">
                      <option value="">— Không chọn —</option>
                      <option value="Bronze">Bronze</option>
                      <option value="Silver">Silver</option>
                      <option value="Gold">Gold</option>
                      <option value="Platinum">Platinum</option>
                    </select>
                  </div>
                  <div>
                    <label class="label-text">Loại khách</label>
                    <select v-model="editForm.customer_type" class="cust-input appearance-none cursor-pointer">
                      <option value="Individual">Individual</option>
                      <option value="Company">Company</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="label-text">External Handle (Zalo/Telegram...)</label>
                  <input v-model="editForm.custom_external_handle" type="text" class="cust-input" placeholder="@username hoặc SĐT">
                </div>
                <div>
                  <label class="label-text">Ingame ID</label>
                  <input v-model="editForm.custom_ingame_id" type="text" class="cust-input" placeholder="Ingame ID">
                </div>
                <div>
                  <label class="label-text">Kênh chính</label>
                  <input v-model="editForm.custom_primary_channel" type="text" class="cust-input" placeholder="Facebook, Zalo, ...">
                </div>
                <div>
                  <label class="label-text">Game context</label>
                  <input v-model="editForm.custom_primary_game_context" type="text" class="cust-input" placeholder="Server, realm, ...">
                </div>
                <div>
                  <label class="label-text">Ghi chú rủi ro</label>
                  <textarea v-model="editForm.custom_risk_note" class="cust-input" rows="2" placeholder="Ghi chú về khách hàng..."></textarea>
                </div>
              </div>
            </div>
            <div class="px-8 py-6 border-t border-app-border bg-app-bg/50 flex gap-4">
              <AppButton variant="neutral" size="lg" class="flex-1" @click="editModal = false">Huỷ</AppButton>
              <AppButton variant="primary" size="lg" class="flex-1" :loading="saving" @click="saveCustomer">Lưu</AppButton>
            </div>
          </div>
        </div>
      </template>
    </PaginatedListLayout>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onActivated } from 'vue'
import { frappeCall, getList, updateDoc, deleteDoc } from '../api/index.js'
import AppButton from '../components/AppButton.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import { tierColor as _tierColor } from '../utils/format.js'
import PageHeader from '../components/PageHeader.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import { usePageSize } from '../composables/usePageSize.js'

const loading = ref(false)
const customers = ref([])
const total = ref(0)
const search = ref('')
const tierFilter = ref('')
const typeFilter = ref('')
const { pageSize, setPageSize } = usePageSize('customers', 20)
const currentPage = ref(1)
const totalPages = ref(1)
const editModal = ref(false)
const saving = ref(false)
const editForm = ref({ name: '', customer_name: '', customer_type: 'Individual', custom_customer_tier: '', custom_external_handle: '', custom_ingame_id: '', custom_primary_channel: '', custom_primary_game_context: '', custom_risk_note: '' })
let debounceTimer = null

function tierColor(t) { return _tierColor(t) || '' }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' }

watch([search, tierFilter, typeFilter], () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { currentPage.value = 1; fetchCustomers() }, 300)
})

let _loadPromise = null
async function fetchCustomers() {
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    loading.value = true
    try {
      const res = await frappeCall('gege_custom.gege_custom.api.helpers.get_customers', {
        search: search.value || undefined,
        tier: tierFilter.value || undefined,
        customer_type: typeFilter.value || undefined,
        page: currentPage.value,
        page_size: pageSize.value,
      })
      customers.value = res.data || []
      total.value = res.total_count || 0
      totalPages.value = Math.max(1, Math.ceil(total.value / pageSize.value))
    } catch (e) { console.error('Lỗi load customers:', e) }
    finally { loading.value = false; _loadPromise = null }
  })()
  return _loadPromise
}

function goToPage(p) { currentPage.value = Math.max(1, Math.min(p, totalPages.value)); fetchCustomers() }
function changePageSize(s) { setPageSize(s); currentPage.value = 1; fetchCustomers() }

function openEdit(c) {
  editForm.value = {
    name: c.name, customer_name: c.customer_name || '', customer_type: c.customer_type || 'Individual',
    custom_customer_tier: c.custom_customer_tier || '', custom_external_handle: c.custom_external_handle || '',
    custom_ingame_id: c.custom_ingame_id || '', custom_primary_channel: c.custom_primary_channel || '',
    custom_primary_game_context: c.custom_primary_game_context || '', custom_risk_note: c.custom_risk_note || '',
  }
  editModal.value = true
}

async function saveCustomer() {
  if (!editForm.value.customer_name) return alert('Vui lòng nhập tên khách hàng')
  saving.value = true
  try {
    await updateDoc('Customer', editForm.value.name, {
      customer_name: editForm.value.customer_name, customer_type: editForm.value.customer_type,
      custom_customer_tier: editForm.value.custom_customer_tier, custom_external_handle: editForm.value.custom_external_handle,
      custom_ingame_id: editForm.value.custom_ingame_id, custom_primary_channel: editForm.value.custom_primary_channel,
      custom_primary_game_context: editForm.value.custom_primary_game_context, custom_risk_note: editForm.value.custom_risk_note,
    })
    editModal.value = false
    fetchCustomers()
  } catch (e) { alert('Lỗi lưu: ' + (e.message || e)) }
  finally { saving.value = false }
}

async function deleteCustomer(c) {
  const checks = [
    { doctype: 'Sell Order', label: 'đơn bán' },
    { doctype: 'Sales Invoice', label: 'hóa đơn' },
    { doctype: 'Quotation', label: 'báo giá' },
    { doctype: 'Delivery Note', label: 'phiếu giao hàng' },
  ]
  const found = []
  for (const { doctype, label } of checks) {
    try { if ((await getList(doctype, { fields: ['name'], filters: [['customer', '=', c.name]], limit: 1 })).length) found.push(label) } catch {}
  }
  if (found.length) return alert(`Không thể xóa: khách hàng này có ${found.join(', ')} trong hệ thống.`)
  if (!confirm(`Xóa khách hàng "${c.customer_name || c.name}"?`)) return
  try { await deleteDoc('Customer', c.name); fetchCustomers() } catch (e) { alert('Lỗi xóa: ' + (e.message || e)) }
}

onMounted(() => { fetchCustomers() })
onActivated(() => { fetchCustomers() })
</script>

<style scoped>
.label-text { display: block; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: var(--app-text-muted); margin-bottom: 6px; }
.cust-input { width: 100%; background: var(--app-bg); border: 1px solid var(--app-border); border-radius: 12px; padding: 10px 14px; font-size: 13px; color: var(--app-text-primary); outline: none; transition: border-color 0.15s; }
.cust-input:focus { border-color: #6366f1; }
</style>
