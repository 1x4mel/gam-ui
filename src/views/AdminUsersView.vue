<template>
  <div class="w-full flex flex-col h-full">
    <!-- Header -->
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/logs')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Người dùng</h2>
      <div class="flex-1" />
      <AppButton variant="primary" size="sm" @click="openForm(null)">+ Người dùng mới</AppButton>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
      <!-- Filters -->
      <div class="flex items-center gap-3 mb-4 px-1">
        <input v-model="search" type="text" placeholder="Tìm email, tên..." class="input-field !py-2 text-sm flex-1 max-w-xs" />
        <select v-model="roleFilter" class="input-field !py-2 text-sm w-48">
          <option value="">Tất cả vai trò</option>
          <option v-for="r in allRoles" :key="r" :value="r">{{ roleLabel(r) }}</option>
        </select>
        <span class="text-app-text-muted text-[10px] font-bold">{{ filteredUsers.length }} người dùng</span>
      </div>

      <LoadingSpinner v-if="loading" class="flex items-center justify-center py-20" />
      <EmptyState v-else-if="filteredUsers.length === 0" message="Không tìm thấy người dùng" />
      <ResponsiveTable v-else>
        <template #header>
          <th class="px-4 py-3">Email</th>
          <th class="px-4 py-3">Họ tên</th>
          <th class="px-4 py-3">Vai trò</th>
          <th class="px-4 py-3 text-center">Trạng thái</th>
          <th class="px-4 py-3 text-right w-20">Thao tác</th>
        </template>
        <template #body>
          <tr v-for="u in filteredUsers" :key="u.email" class="hover:bg-app-bg/50 transition">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-sm font-black text-indigo-600 shrink-0">{{ initials(u) }}</div>
                <div>
                  <p class="text-sm font-bold text-app-text-primary">{{ u.full_name || '—' }}</p>
                  <p class="text-[11px] text-app-text-muted font-mono">{{ u.email }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-app-text-primary font-medium">{{ u.full_name || '—' }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span v-for="r in u.roles" :key="r" class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" :class="roleBadgeClass(r)">{{ roleLabel(r) }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="text-[10px] font-bold px-2.5 py-1 rounded-full" :class="u.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-400'">
                {{ u.enabled ? 'Hoạt động' : 'Tắt' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <button @click="openForm(u.email)" class="px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-600 hover:bg-indigo-500/10 transition">Sửa</button>
            </td>
          </tr>
        </template>
        <template #mobile>
          <div v-for="u in filteredUsers" :key="u.email" class="bg-app-surface border border-app-border rounded-xl p-4 mb-3 space-y-3 cursor-pointer hover:border-indigo-600/30 transition" @click="openForm(u.email)">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-sm font-black text-indigo-600 shrink-0">{{ initials(u) }}</div>
                <div>
                  <p class="text-sm font-bold text-app-text-primary">{{ u.full_name || u.email }}</p>
                  <p class="text-[11px] text-app-text-muted font-mono">{{ u.email }}</p>
                </div>
              </div>
              <span class="text-[10px] font-bold px-2.5 py-1 rounded-full" :class="u.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-400'">
                {{ u.enabled ? 'Bật' : 'Tắt' }}
              </span>
            </div>
            <div class="flex flex-wrap gap-1">
              <span v-for="r in u.roles" :key="r" class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" :class="roleBadgeClass(r)">{{ roleLabel(r) }}</span>
            </div>
          </div>
        </template>
      </ResponsiveTable>
    </div>

    <UserFormModal :is-open="formOpen" :user-email="selectedUser" @close="formOpen = false" @saved="onSaved" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { getList, frappeCall } from '../api/index.js'
import AppButton from '../components/AppButton.vue'
import BackButton from '../components/BackButton.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import UserFormModal from '../components/UserFormModal.vue'

defineOptions({ name: 'AdminUsersView' })

const allRoles = ['Trader1', 'Trader2', 'Market Leader', 'Payment Accountant', 'Management Accountant', 'Chief Accountant', 'Ops Manager']

const roleLabels = {
  'Trader1': 'Trader 1',
  'Trader2': 'Trader 2',
  'Market Leader': 'Market Leader',
  'Payment Accountant': 'Kế toán thanh toán',
  'Management Accountant': 'Kế toán vận hành',
  'Chief Accountant': 'KT Trưởng',
  'Ops Manager': 'Vận hành',
}

const users = ref([])
const loading = ref(false)
const search = ref('')
const roleFilter = ref('')
const formOpen = ref(false)
const selectedUser = ref(null)

const filteredUsers = computed(() => {
  const q = search.value.toLowerCase()
  return users.value.filter(u => {
    if (roleFilter.value && !u.roles.includes(roleFilter.value)) return false
    if (q && !u.email.toLowerCase().includes(q) && !(u.full_name || '').toLowerCase().includes(q)) return false
    return true
  })
})

async function loadUsers() {
  loading.value = true
  try {
    const data = await frappeCall('gege_custom.gege_custom.utils.get_users_with_roles')
    users.value = (data || []).map(u => ({
      email: u.email,
      full_name: u.full_name || '',
      enabled: u.enabled !== 0,
      roles: u.roles || [],
    }))
  } catch (e) {
    console.error('Failed to load users:', e)
  } finally {
    loading.value = false
  }
}

function openForm(email) {
  selectedUser.value = email
  formOpen.value = true
}

function onSaved() {
  loadUsers()
}

function initials(u) {
  if (u.full_name) {
    const parts = u.full_name.split(' ')
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0][0].toUpperCase()
  }
  return u.email[0].toUpperCase()
}

function roleLabel(role) {
  return roleLabels[role] || role
}

function roleBadgeClass(role) {
  const map = {
    'Trader1': 'bg-indigo-500/10 text-indigo-600',
    'Trader2': 'bg-purple-500/10 text-purple-600',
    'Market Leader': 'bg-orange-500/10 text-orange-600',
    'Payment Accountant': 'bg-emerald-500/10 text-emerald-600',
    'Management Accountant': 'bg-emerald-500/10 text-emerald-600',
    'Chief Accountant': 'bg-teal-500/10 text-teal-600',
    'Ops Manager': 'bg-amber-500/10 text-amber-600',
  }
  return map[role] || 'bg-app-bg text-app-text-muted'
}

onMounted(loadUsers)
onActivated(loadUsers)
</script>
