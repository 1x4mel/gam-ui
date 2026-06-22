<template>
  <div class="w-full flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/logs')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Dữ liệu Game</h2>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
      <!-- Tabs -->
      <div class="mb-4 px-1">
        <UnderlineTab v-model="activeTab" :tabs="tabs" />
      </div>

      <!-- Filters + Actions -->
      <div class="flex items-center gap-3 mb-4 px-1">
        <input v-model="search" type="text" placeholder="Tìm kiếm..." class="input-field !py-2 text-sm flex-1 max-w-xs" />
        <select v-if="activeTab === 'currency-item' || activeTab === 'game-account'" v-model="filterGameTitle" class="input-field !py-2 text-sm max-w-[180px]">
          <option value="">Tất cả Game</option>
          <option v-for="t in gameTitleOpts" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <label class="flex items-center gap-2 text-xs text-app-text-muted font-bold cursor-pointer">
          <input type="checkbox" v-model="showInactive" class="accent-indigo-600 w-3.5 h-3.5" />
          Hiện ẩn
        </label>
        <span class="text-app-text-muted text-[10px] font-bold">{{ currentRows.length }}</span>
        <div class="flex-1" />
        <AppButton variant="primary" size="sm" @click="openForm(null)">+ {{ currentLabel }} mới</AppButton>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>

      <!-- Empty -->
      <EmptyState v-else-if="currentRows.length === 0" :message="`Không có ${currentLabel.toLowerCase()} nào`" />

      <!-- Table -->
      <ResponsiveTable v-else>
        <template #header>
          <th v-for="col in currentColumns" :key="col.key" class="px-4 py-3" :class="colThClass(col)">{{ col.label }}</th>
          <th class="px-4 py-3 text-right w-28">Thao tác</th>
        </template>
        <template #body>
          <tr v-for="row in paginatedRows" :key="row.name" class="hover:bg-app-bg/50 transition">
            <td v-for="col in currentColumns" :key="col.key" class="px-4 py-3 text-sm" :class="col.td || ''">
              <template v-if="col.key === 'is_active'">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                  :class="row.is_active ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-gray-200/50 text-gray-400 border border-gray-200'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="row.is_active ? 'bg-emerald-500' : 'bg-gray-300'"></span>
                  {{ row.is_active ? 'Hoạt động' : 'Ẩn' }}
                </span>
              </template>
              <template v-else-if="col.key === 'channel_group'">
                <span v-if="row.channel_group" class="px-2.5 py-1 rounded-full text-[10px] font-bold border"
                  :class="groupBadgeClass(row.channel_group)">{{ row.channel_group }}</span>
                <span v-else class="text-app-text-muted">—</span>
              </template>
              <template v-else-if="col.key === 'status'">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                  :class="{ 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20': row.status === 'Active', 'bg-amber-500/10 text-amber-600 border-amber-500/20': row.status === 'Suspended', 'bg-red-500/10 text-red-500 border-red-500/20': row.status === 'Banned' }">{{ row.status || '—' }}</span>
              </template>
              <template v-else-if="col.key === 'short_code'">
                <span v-if="row.short_code" class="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 text-xs font-mono font-bold">{{ row.short_code }}</span>
                <span v-else class="text-app-text-muted">—</span>
              </template>
              <template v-else-if="col.key === 'game_title'">
                <span class="text-app-text-primary font-medium">{{ resolveGameTitle(row.game_title) }}</span>
              </template>
              <template v-else-if="col.key === 'description' || col.key === 'note'">
                <span class="text-app-text-muted line-clamp-1">{{ row[col.key] || '—' }}</span>
              </template>
              <template v-else>
                <span class="text-app-text-primary font-medium">{{ row[col.key] || '—' }}</span>
              </template>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button @click="openForm(row.name)" class="px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-600 hover:bg-indigo-500/10 transition">Sửa</button>
                <button @click="handleDelete(row.name)" class="px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-500 hover:bg-red-500/10 transition">Xóa</button>
              </div>
            </td>
          </tr>
        </template>
        <template #mobile>
          <div v-for="row in paginatedRows" :key="row.name" class="bg-app-surface border border-app-border rounded-xl p-4 mb-3 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-app-text-primary">{{ row[columnsMap[activeTab][0].key] }}</p>
                <p v-if="getSecondaryText(row)" class="text-xs text-app-text-muted mt-0.5">{{ getSecondaryText(row) }}</p>
              </div>
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold"
                :class="row.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-200/50 text-gray-400'">
                <span class="w-1.5 h-1.5 rounded-full" :class="row.is_active ? 'bg-emerald-500' : 'bg-gray-300'"></span>
                {{ row.is_active ? 'Hoạt động' : 'Ẩn' }}
              </span>
            </div>
            <div class="flex gap-2 justify-end">
              <button @click="openForm(row.name)" class="px-3 py-1.5 rounded-lg text-[10px] font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 transition">Sửa</button>
              <button @click="handleDelete(row.name)" class="px-3 py-1.5 rounded-lg text-[10px] font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition">Xóa</button>
            </div>
          </div>
        </template>
      </ResponsiveTable>
    </div>

    <!-- Pagination bar (outside scroll area, sticky at bottom) -->
    <div v-if="currentRows.length > 0" class="flex-shrink-0 border-t border-app-border bg-app-surface px-3 sm:px-4 py-2">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-app-text-muted">
        <div class="flex items-center gap-2">
          <span>{{ ((currentPage - 1) * pageSize) + 1 }}-{{ Math.min(currentPage * pageSize, currentRows.length) }} / {{ currentRows.length }}</span>
          <select :value="pageSize" @change="pageSize = Number($event.target.value); currentPage = 1"
            class="bg-app-bg border border-app-border rounded-lg px-2 py-1 text-app-text-primary text-xs">
            <option v-for="opt in [10, 20, 30]" :key="opt" :value="opt">{{ opt }} / trang</option>
          </select>
        </div>
        <div class="flex items-center gap-1">
          <button @click="currentPage = currentPage - 1" :disabled="currentPage <= 1"
            class="px-2 py-1 rounded-lg hover:bg-app-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <template v-for="p in visiblePages" :key="p">
            <span v-if="p === '...'" class="px-1 text-app-text-muted">...</span>
            <button v-else @click="currentPage = p" class="w-7 h-7 rounded-lg text-xs font-bold transition-colors"
              :class="p === currentPage ? 'bg-indigo-600 text-white' : 'hover:bg-app-bg text-app-text-secondary'">{{ p }}</button>
          </template>
          <button @click="currentPage = currentPage + 1" :disabled="currentPage >= totalPages"
            class="px-2 py-1 rounded-lg hover:bg-app-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Inline Modal -->
    <div v-if="formOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="formOpen = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">{{ editingName ? `${currentLabel}: ${editingName}` : `Tạo mới ${currentLabel}` }}</h3>
          <button @click="formOpen = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">✕</button>
        </div>

        <div class="flex-1 overflow-y-auto p-8 space-y-5">
          <div v-if="formError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ formError }}</div>

          <!-- Dynamic form fields based on active tab -->
          <template v-if="activeTab === 'game-title'">
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tên Game <span class="text-red-500">*</span></label>
              <input v-model="formData.title_name" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: Path of Exile 2" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Mã viết tắt</label>
              <input v-model="formData.short_code" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: POE2" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Mô tả</label>
              <textarea v-model="formData.description" class="input-field !py-2.5 text-sm resize-none" rows="3" placeholder="Mô tả game..."></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm text-app-text-primary font-medium cursor-pointer">
              <input type="checkbox" v-model="formData.is_active" class="accent-indigo-600 w-4 h-4" />
              Hoạt động
            </label>
          </template>

          <template v-if="activeTab === 'game-context'">
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Game Title <span class="text-red-500">*</span></label>
              <select v-model="formData.game_title" class="input-field !py-2.5 text-sm">
                <option value="">-- Chọn Game --</option>
                <option v-for="t in gameTitleOpts" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Server</label>
              <input v-model="formData.server" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: Asia" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Season / League</label>
              <input v-model="formData.season_or_league" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: Season 1" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Mode</label>
              <select v-model="formData.mode" class="input-field !py-2.5 text-sm">
                <option value="">-- Chọn Mode --</option>
                <option value="Softcore">Softcore</option>
                <option value="Standard">Standard</option>
                <option value="Hardcore">Hardcore</option>
              </select>
            </div>
            <label class="flex items-center gap-2 text-sm text-app-text-primary font-medium cursor-pointer">
              <input type="checkbox" v-model="formData.is_active" class="accent-indigo-600 w-4 h-4" />
              Hoạt động
            </label>
          </template>

          <template v-if="activeTab === 'game-account'">
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tên tài khoản <span class="text-red-500">*</span></label>
              <input v-model="formData.account_name" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: username123" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Email</label>
              <input v-model="formData.account_email" type="text" class="input-field !py-2.5 text-sm" placeholder="email@example.com" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Game Title <span class="text-red-500">*</span></label>
              <select v-model="formData.game_title" class="input-field !py-2.5 text-sm">
                <option value="">-- Chọn Game --</option>
                <option v-for="t in gameTitleOpts" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">User quản lý</label>
              <input v-model="formData.owner_user" type="text" class="input-field !py-2.5 text-sm" placeholder="email@gege.vn" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Status</label>
              <select v-model="formData.status" class="input-field !py-2.5 text-sm">
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Banned">Banned</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Ghi chú</label>
              <textarea v-model="formData.note" class="input-field !py-2.5 text-sm resize-none" rows="2" placeholder="Ghi chú..."></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm text-app-text-primary font-medium cursor-pointer">
              <input type="checkbox" v-model="formData.is_active" class="accent-indigo-600 w-4 h-4" />
              Hoạt động
            </label>
          </template>

          <template v-if="activeTab === 'currency-item'">
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tên Item <span class="text-red-500">*</span></label>
              <input v-model="formData.item_name" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: Divine Orb" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Game Title <span class="text-red-500">*</span></label>
              <select v-model="formData.game_title" class="input-field !py-2.5 text-sm">
                <option value="">-- Chọn Game --</option>
                <option v-for="t in gameTitleOpts" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Loại</label>
              <select v-model="formData.item_category" class="input-field !py-2.5 text-sm">
		        <option value="">-- Chọn --</option>
		        <option v-for="cat in itemCategoryOpts" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
		      </select>
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Đơn vị</label>
              <input v-model="formData.unit_label" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: cái, stack, tài khoản" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Ghi chú</label>
              <textarea v-model="formData.note" class="input-field !py-2.5 text-sm resize-none" rows="2" placeholder="Ghi chú..."></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm text-app-text-primary font-medium cursor-pointer">
              <input type="checkbox" v-model="formData.is_active" class="accent-indigo-600 w-4 h-4" />
              Hoạt động
            </label>
          </template>

          <template v-if="activeTab === 'channel'">
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tên Channel <span class="text-red-500">*</span></label>
              <input v-model="formData.channel_name" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: EpicNPC" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Nhóm</label>
              <select v-model="formData.channel_group" class="input-field !py-2.5 text-sm">
                <option value="">-- Chọn nhóm --</option>
                <option value="Marketplace">Marketplace</option>
                <option value="Direct">Direct</option>
                <option value="Social">Social</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Ghi chú</label>
              <textarea v-model="formData.note" class="input-field !py-2.5 text-sm resize-none" rows="2" placeholder="Ghi chú..."></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm text-app-text-primary font-medium cursor-pointer">
              <input type="checkbox" v-model="formData.is_active" class="accent-indigo-600 w-4 h-4" />
              Hoạt động
            </label>
          </template>
        </div>

        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="formOpen = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <AppButton variant="primary" size="sm" :loading="formSaving" @click="saveForm">Lưu</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onActivated } from 'vue'
import { getList, getDoc, createDoc, updateDoc, deleteDoc } from '../api/index.js'
import { useMetadata } from '../composables/useMetadata.js'
import { useNotify } from '../composables/useNotify.js'
import AppButton from '../components/AppButton.vue'
import BackButton from '../components/BackButton.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'

defineOptions({ name: 'AdminGameDataView' })

const { gameTitleOpts, gameTitles, itemCategoryOpts } = useMetadata()
const { success, error: notifyError, confirm } = useNotify()

const tabs = [
  { key: 'game-title', icon: '🎮', label: 'Game Title', doctype: 'Game Title' },
  { key: 'game-context', icon: '🎯', label: 'Game Context', doctype: 'Game Context' },
  { key: 'currency-item', icon: '💰', label: 'Currency Item', doctype: 'Currency Item' },
  { key: 'game-account', icon: '🔑', label: 'Game Account', doctype: 'Game Account' },
  { key: 'channel', icon: '📡', label: 'Channel', doctype: 'Channel' },
]

const columnsMap = {
  'game-title': [
    { key: 'title_name', label: 'Tên Game', td: 'font-semibold' },
    { key: 'short_code', label: 'Mã', th: 'w-28 text-left' },
    { key: 'is_active', label: 'Trạng thái', th: 'w-36 text-center', td: 'text-center' },
    { key: 'description', label: 'Mô tả' },
  ],
  'game-context': [
    { key: 'name', label: 'Tên Context', td: 'font-semibold' },
    { key: 'game_title', label: 'Game Title', th: 'w-44' },
    { key: 'season_or_league', label: 'Season / League', th: 'w-36' },
    { key: 'mode', label: 'Mode', th: 'w-28' },
    { key: 'is_active', label: 'Trạng thái', th: 'w-36 text-center', td: 'text-center' },
  ],
  'game-account': [
    { key: 'account_name', label: 'Tài khoản', td: 'font-semibold' },
    { key: 'game_title', label: 'Game Title', th: 'w-36' },
    { key: 'status', label: 'Status', th: 'w-28 text-center', td: 'text-center' },
    { key: 'owner_user', label: 'User', th: 'w-36' },
    { key: 'is_active', label: 'Trạng thái', th: 'w-36 text-center', td: 'text-center' },
  ],
  'channel': [
    { key: 'channel_name', label: 'Tên Channel', td: 'font-semibold' },
    { key: 'channel_group', label: 'Nhóm', th: 'w-36 text-center', td: 'text-center' },
    { key: 'is_active', label: 'Trạng thái', th: 'w-36 text-center', td: 'text-center' },
    { key: 'note', label: 'Ghi chú' },
  ],
  'currency-item': [
    { key: 'item_name', label: 'Tên Item', td: 'font-semibold' },
    { key: 'game_title', label: 'Game Title', th: 'w-44' },
    { key: 'item_category', label: 'Loại', th: 'w-28' },
    { key: 'unit_label', label: 'Đơn vị', th: 'w-24' },
    { key: 'is_active', label: 'Trạng thái', th: 'w-36 text-center', td: 'text-center' },
  ],
}

const activeTab = ref('game-title')
const search = ref('')
const showInactive = ref(false)
const filterGameTitle = ref('')
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

const totalPages = computed(() => Math.ceil(currentRows.value.length / pageSize.value))
const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return currentRows.value.slice(start, start + pageSize.value)
})
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

watch([search, filterGameTitle, showInactive, activeTab], () => { currentPage.value = 1 })

const dataMap = ref({
  'game-title': [],
  'game-context': [],
  'currency-item': [],
  'game-account': [],
  'channel': [],
})

const loadedTabs = ref(new Set())

const currentColumns = computed(() => columnsMap[activeTab.value] || [])
const currentLabel = computed(() => tabs.find(t => t.key === activeTab.value)?.label || '')
const currentRows = computed(() => {
  let rows = dataMap.value[activeTab.value] || []
  if ((activeTab.value === 'currency-item' || activeTab.value === 'game-account') && filterGameTitle.value) {
    rows = rows.filter(r => r.game_title === filterGameTitle.value)
  }
  const q = search.value.toLowerCase()
  return rows.filter(r => {
    if (!showInactive.value && !r.is_active) return false
    if (q) {
      const searchable = [r.name, r.item_name, r.title_name, r.channel_name, r.account_name, r.account_email, r.owner_user, resolveGameTitle(r.game_title)].filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })
})

const formOpen = ref(false)
const editingName = ref(null)
const formData = ref({})
const formSaving = ref(false)
const formError = ref('')

watch(activeTab, (key) => {
  search.value = ''
  if (!loadedTabs.value.has(key)) loadTab(key)
})

const fieldsMap = {
  'game-title': ['name', 'title_name', 'short_code', 'is_active', 'description'],
  'game-context': ['name', 'game_title', 'server', 'season_or_league', 'mode', 'is_active'],
  'currency-item': ['name', 'item_name', 'game_title', 'item_category', 'unit_label', 'is_active', 'note'],
  'game-account': ['name', 'account_name', 'account_email', 'game_title', 'owner_user', 'status', 'is_active', 'note'],
  'channel': ['name', 'channel_name', 'channel_group', 'is_active', 'note'],
}

function colThClass(col) {
  return col.th || 'text-left'
}

function groupBadgeClass(group) {
  const map = {
    'Marketplace': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    'Direct': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    'Social': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    'Other': 'bg-gray-200/50 text-gray-500 border-gray-200',
  }
  return map[group] || 'bg-gray-200/50 text-gray-500 border-gray-200'
}

async function loadTab(key) {
  loading.value = true
  const doctype = tabs.find(t => t.key === key)?.doctype
  try {
    dataMap.value[key] = await getList(doctype, { fields: fieldsMap[key], limit: 500 })
    loadedTabs.value.add(key)
  } catch (e) {
    console.error(`Failed to load ${doctype}:`, e)
  } finally {
    loading.value = false
  }
}

function resolveGameTitle(name) {
  if (!name) return '—'
  const t = gameTitles.value.find(g => g.name === name)
  return t ? t.title_name : name
}

function getSecondaryText(row) {
  if (activeTab.value === 'game-title') return row.short_code || ''
  if (activeTab.value === 'game-context') {
    const parts = [row.season_or_league, row.mode].filter(Boolean)
    return [resolveGameTitle(row.game_title), ...parts].join(' - ')
  }
  if (activeTab.value === 'currency-item') return resolveGameTitle(row.game_title)
  if (activeTab.value === 'game-account') return `${resolveGameTitle(row.game_title)}${row.status ? ' · ' + row.status : ''}`
  if (activeTab.value === 'channel') return row.channel_group || ''
  return ''
}

async function openForm(name) {
  editingName.value = name
  formError.value = ''
  if (name) {
    // Fetch full doc to ensure all fields are populated
    const doctype = tabs.find(t => t.key === activeTab.value)?.doctype
    let row
    try {
      row = await getDoc(doctype, name)
    } catch (e) {
      notifyError('Không tải được dữ liệu')
      return
    }
    if (!row) { notifyError('Không tìm thấy bản ghi'); return }
    if (activeTab.value === 'game-title') formData.value = { title_name: row.title_name, short_code: row.short_code, is_active: !!row.is_active, description: row.description || '' }
    else if (activeTab.value === 'game-context') formData.value = { game_title: row.game_title, server: row.server || '', season_or_league: row.season_or_league || '', mode: row.mode || '', is_active: !!row.is_active }
    else if (activeTab.value === 'currency-item') formData.value = { item_name: row.item_name, game_title: row.game_title, item_category: row.item_category || '', unit_label: row.unit_label || '', is_active: !!row.is_active, note: row.note || '' }
    else if (activeTab.value === 'game-account') formData.value = { account_name: row.account_name, account_email: row.account_email || '', game_title: row.game_title, owner_user: row.owner_user || '', status: row.status || 'Active', is_active: !!row.is_active, note: row.note || '' }
    else if (activeTab.value === 'channel') formData.value = { channel_name: row.channel_name, channel_group: row.channel_group || '', is_active: !!row.is_active, note: row.note || '' }
  } else {
    if (activeTab.value === 'game-title') formData.value = { title_name: '', short_code: '', is_active: true, description: '' }
    else if (activeTab.value === 'game-context') formData.value = { game_title: '', server: '', season_or_league: '', mode: '', is_active: true }
    else if (activeTab.value === 'currency-item') formData.value = { item_name: '', game_title: '', item_category: '', unit_label: '', is_active: true, note: '' }
    else if (activeTab.value === 'game-account') formData.value = { account_name: '', account_email: '', game_title: '', owner_user: '', status: 'Active', is_active: true, note: '' }
    else if (activeTab.value === 'channel') formData.value = { channel_name: '', channel_group: '', is_active: true, note: '' }
  }
  formOpen.value = true
}

async function saveForm() {
  formError.value = ''
  const doctype = tabs.find(t => t.key === activeTab.value)?.doctype
  const nameKey = columnsMap[activeTab.value][0].key

  if (activeTab.value === 'game-context') {
    if (!formData.value.game_title) { formError.value = 'Game Title là bắt buộc'; return }
  } else if (!formData.value[nameKey]) { formError.value = 'Tên là bắt buộc'; return }

  formSaving.value = true
  try {
    const payload = { ...formData.value, is_active: formData.value.is_active ? 1 : 0 }
    if (editingName.value) {
      await updateDoc(doctype, editingName.value, payload)
      success('Đã cập nhật')
    } else {
      await createDoc(doctype, payload)
      success('Đã tạo mới')
    }
    loadedTabs.value.delete(activeTab.value)
    await loadTab(activeTab.value)
    formOpen.value = false
  } catch (e) {
    formError.value = (e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim()
  } finally {
    formSaving.value = false
  }
}

async function handleDelete(name) {
  const ok = await confirm(`Xóa "${name}"?`)
  if (!ok) return
  const doctype = tabs.find(t => t.key === activeTab.value)?.doctype
  try {
    await deleteDoc(doctype, name)
    success('Đã xóa')
    loadedTabs.value.delete(activeTab.value)
    await loadTab(activeTab.value)
  } catch (e) {
    notifyError('Xóa thất bại: ' + (e.message || '').replace(/<[^>]*>/g, '').trim())
  }
}

onMounted(() => loadTab(activeTab.value))
</script>
