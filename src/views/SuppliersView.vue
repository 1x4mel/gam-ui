<template>
  <div class="h-full">
  <PaginatedListLayout
    ref="listLayout"
    :total-items="totalCount"
    :current-page="currentPage"
    :total-pages="totalPages"
    :page-size="pageSize"
    :self-scroll="true"
    @update:current-page="goToPage"
    @update:page-size="setPageSize"
  >
    <template #header>
      <PageHeader
        title="Nhà cung cấp"
        subtitle="Danh sách đối tác cung cấp currency và thông tin thanh toán"
        :connected="false"
        @refresh="() => loadPage(false)"
      >
        <template #actions>
          <AppButton variant="primary" size="sm sm:lg" @click="openSupplierForm()"><span class="hidden sm:inline">+ Supplier mới</span><span class="sm:hidden">+ Thêm</span></AppButton>
        </template>
      </PageHeader>
    </template>

    <template #filters>
      <div class="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-hidden">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm theo tên supplier, contact hoặc ngân hàng..."
          class="px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary placeholder-app-text-muted/80 outline-none focus:border-indigo-500 transition w-full sm:w-64 shadow-sm"
        />

        <select v-model="filterTier" class="px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]">
          <option value="">Tất cả phân cấp</option>
          <option value="Bronze">Bronze</option>
          <option value="Silver">Silver</option>
          <option value="Gold">Gold</option>
          <option value="Platinum">Platinum</option>
        </select>

        <span class="text-app-text-muted text-xs font-medium">{{ totalCount }} nhà cung cấp</span>
      </div>
    </template>

    <div v-if="loading" class="h-full flex items-center justify-center">
      <LoadingSpinner size="lg" text="Đang tải danh sách supplier..." />
    </div>
    <div v-else-if="suppliers.length === 0" class="h-full flex items-center justify-center">
      <EmptyState icon="🏢" text="Không tìm thấy supplier nào" />
    </div>

    <template v-else>
    <ResponsiveTable
      :min-width="600"
      outer-class="mx-2 sm:mx-4 shadow-xl"
      rounded="2xl sm:3xl"
      mobile-class="px-3 sm:px-4 space-y-2"
    >
      <template #header>
        <th class="px-4 sm:px-8 py-5">Đối tác (Supplier)</th>
        <th class="px-3 sm:px-6 py-5 text-center">Tier & Type</th>
        <th class="px-3 sm:px-6 py-5">Liên hệ (Contact)</th>
        <th class="px-3 sm:px-6 py-5">Thanh toán (Bank)</th>
        <th class="px-3 sm:px-6 py-5 text-center">QR</th>
        <th class="px-4 sm:px-8 py-5 text-right">Thao tác</th>
      </template>
      <template #body>
        <tr
          v-for="s in suppliers"
          :key="s.name"
          @click="openSupplierForm(s.name)"
          class="hover:bg-indigo-600/[0.03] transition-all cursor-pointer group"
        >
          <td class="px-4 sm:px-8 py-5">
            <div class="flex items-center gap-4">
              <div class="w-11 h-11 rounded-2xl bg-app-bg border border-app-border flex items-center justify-center font-black text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 transition-all duration-300 shadow-sm">
                {{ s.supplier_name.slice(0, 1).toUpperCase() }}
              </div>
              <div>
                <p class="text-sm font-black text-app-text-primary group-hover:text-indigo-600 transition-colors">{{ s.supplier_name }}</p>
                <p class="text-[10px] text-app-text-muted font-bold uppercase tracking-wider mt-0.5">ID: {{ s.name }}</p>
              </div>
            </div>
          </td>

          <td class="px-3 sm:px-6 py-5 text-center">
            <div class="flex flex-col items-center gap-2">
              <span :class="['text-[9px] px-2.5 py-1 rounded-lg font-black border uppercase tracking-widest shadow-sm', tierColor(s.custom_supplier_tier)]">
                {{ s.custom_supplier_tier }}
              </span>
              <span class="text-[9px] font-black text-app-text-muted uppercase tracking-widest opacity-70">{{ s.custom_trader_type || 'N/A' }}</span>
            </div>
          </td>

          <td class="px-3 sm:px-6 py-5">
            <p class="text-xs text-app-text-secondary font-black tracking-tight">{{ s.custom_contact_handle || '—' }}</p>
            <div class="flex items-center gap-2 mt-1">
              <a v-if="s.custom_facebook_url" :href="s.custom_facebook_url" target="_blank" rel="noopener" @click.stop class="text-blue-400 hover:text-blue-300 text-xs font-bold" title="Facebook">FB</a>
              <a v-if="s.custom_discord_url" :href="s.custom_discord_url" target="_blank" rel="noopener" @click.stop class="text-indigo-400 hover:text-indigo-300 text-xs font-bold" title="Discord">DC</a>
              <span class="text-[10px] text-app-text-muted font-bold uppercase tracking-widest opacity-70">{{ s.custom_buy_channel || '' }}</span>
            </div>
          </td>

          <td class="px-3 sm:px-6 py-5">
            <div v-if="s._bank_summary" class="flex flex-col gap-0.5">
              <span v-for="(b, i) in s._bank_summary" :key="i" class="text-xs text-app-text-primary font-black uppercase tracking-tight">
                {{ b.bank_name }} •• {{ b.account_number ? b.account_number.slice(-4) : '—' }}
                <span v-if="b.account_holder" class="text-app-text-muted font-semibold normal-case">{{ b.account_holder }}</span>
                <span v-if="b.currency" class="text-app-text-muted font-bold">{{ b.currency }}</span>
              </span>
            </div>
            <span v-else class="text-app-text-muted text-xs opacity-50">Chưa có</span>
          </td>

          <td class="px-3 sm:px-6 py-5 text-center">
            <span class="text-app-text-muted text-xs opacity-50">—</span>
          </td>

          <td class="px-4 sm:px-8 py-5 text-right">
            <AppButton variant="ghost" size="sm" @click.stop="openSupplierForm(s.name)">✏️ Sửa</AppButton>
          </td>
        </tr>
      </template>
      <template #mobile>
        <div v-for="s in suppliers" :key="s.name"
          class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
          @click="openSupplierForm(s.name)"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-app-bg border border-app-border flex items-center justify-center font-black text-indigo-600 text-xs shrink-0">
                {{ s.supplier_name.slice(0, 1).toUpperCase() }}
              </div>
              <span class="text-app-text-primary font-black text-sm truncate">{{ s.supplier_name }}</span>
            </div>
            <span :class="['text-[8px] px-2 py-0.5 rounded-md font-black border uppercase tracking-widest shrink-0', tierColor(s.custom_supplier_tier)]">
              {{ s.custom_supplier_tier }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Liên hệ</p>
              <p class="text-app-text-secondary font-bold truncate">{{ s.custom_contact_handle || '—' }}</p>
              <div class="flex gap-2 mt-0.5">
                <a v-if="s.custom_facebook_url" :href="s.custom_facebook_url" target="_blank" rel="noopener" @click.stop class="text-blue-400 text-[9px] font-bold">FB</a>
                <a v-if="s.custom_discord_url" :href="s.custom_discord_url" target="_blank" rel="noopener" @click.stop class="text-indigo-400 text-[9px] font-bold">DC</a>
              </div>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Ngân hàng</p>
              <p v-if="s._bank_summary?.length" class="text-app-text-primary font-bold truncate">
                {{ s._bank_summary[0].bank_name }} •• {{ s._bank_summary[0].account_number ? s._bank_summary[0].account_number.slice(-4) : '—' }}
              </p>
              <p v-else class="text-app-text-muted font-bold">Chưa có</p>
            </div>
          </div>
        </div>
      </template>
    </ResponsiveTable>
    </template>
  </PaginatedListLayout>

  <!-- Add/Edit Modal -->
  <SupplierFormModal
    :isOpen="isModalOpen"
    :supplierName="selectedSupplier"
    @close="isModalOpen = false"
    @saved="onSaved"
  />

  <!-- Image Viewer Modal -->
  <MediaLightbox v-model:open="lightboxOpen" :item="lightboxItem" show-pan-zoom :show-download="false" />
  </div>
</template>

<script setup>
defineOptions({ name: 'SuppliersView' })
import { ref, computed, watch, onMounted, onActivated } from 'vue'
import { debounce } from 'lodash-es'
import SupplierFormModal from '../components/SupplierFormModal.vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import AppButton from '../components/AppButton.vue'
import EmptyState from '../components/EmptyState.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import MediaLightbox from '../components/MediaLightbox.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import { frappeCall } from '../api/index.js'
import { useUrlSync } from '../composables/useOrderUrlSync.js'
import { tierColor } from '../utils/format.js'

const loading = ref(false)
const suppliers = ref([])
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(30)
const searchQuery = ref('')
const filterTier = ref('')
const isModalOpen = ref(false)
const selectedSupplier = ref(null)
const lightboxOpen = ref(false)
const lightboxItem = ref(null)
const listLayout = ref(null)
const getScrollContainer = () => listLayout.value?.scrollContainer

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

useUrlSync({
  routeNames: ['SuppliersView'],
  params: { searchQuery, filterTier },
  queryMap: { searchQuery: 'q', filterTier: 'tier' },
})

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadPage(true)
}

function setPageSize(size) {
  pageSize.value = size
  currentPage.value = 1
  loadPage(false)
}

let _loadPromise = null
async function loadPage(isBackground = false) {
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    if (!isBackground) loading.value = true
    try {
      const result = await frappeCall('gege_custom.gege_custom.api.helpers.get_suppliers_page', {
        page: currentPage.value,
        page_size: pageSize.value,
        search: searchQuery.value || undefined,
        tier: filterTier.value || undefined,
      })
      suppliers.value = result.data || []
      totalCount.value = result.total_count || 0
    } catch (e) {
      console.error('Lỗi load suppliers:', e)
    } finally {
      loading.value = false
      _loadPromise = null
    }
  })()
  return _loadPromise
}

const debouncedSearchLoad = debounce(() => { currentPage.value = 1; loadPage(false) }, 500)
watch(searchQuery, () => debouncedSearchLoad())
watch(filterTier, () => { currentPage.value = 1; loadPage(false) })

function openSupplierForm(name = null) {
  selectedSupplier.value = name
  isModalOpen.value = true
}

function onSaved() {
  loadPage(true)
}

function viewQr(url) {
  lightboxItem.value = { attachment: url }
  lightboxOpen.value = true
}

onActivated(() => {
  loadPage(true)
})

onMounted(() => {
  loadPage(false)
})
</script>
