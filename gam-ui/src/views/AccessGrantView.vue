<template>
  <div class="max-w-6xl mx-auto pb-10">
    <PageHeader
      title="Phân quyền truy cập"
      subtitle="Cấp quyền role · game · module cho từng người dùng (L2 fine-scoping)"
      icon="🛡️"
    />

    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 mt-4">
      <!-- User picker -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-4">
        <h3 class="text-app-text-primary font-bold text-sm mb-2">Người dùng</h3>
        <input
          v-model="userFilter" type="text" placeholder="Tìm theo tên / email..."
          class="w-full mb-3 px-3 py-2 rounded-lg bg-app-bg border border-app-border text-app-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <LoadingSpinner v-if="loadingUsers" />
        <div v-else-if="!filteredUsers.length" class="text-app-text-muted text-sm py-6 text-center">
          Không tìm thấy người dùng.
        </div>
        <div v-else class="max-h-[28rem] overflow-y-auto space-y-1 pr-1">
          <button
            v-for="u in filteredUsers" :key="u.name" type="button"
            @click="selectUser(u.name)"
            class="w-full text-left px-3 py-2 rounded-lg border transition"
            :class="selectedUser === u.name
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-app-border hover:bg-indigo-500/10 text-app-text-primary'"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-sm truncate">{{ u.full_name }}</span>
              <span
                v-if="u.is_admin"
                class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                :class="selectedUser === u.name ? 'bg-white/20 text-white' : 'bg-amber-500/15 text-amber-600'"
              >
                Admin
              </span>
            </div>
            <div
              class="text-xs truncate"
              :class="selectedUser === u.name ? 'text-white/70' : 'text-app-text-muted'"
            >
              {{ u.email }}
            </div>
          </button>
        </div>
      </div>

      <!-- Matrix editor -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-4">
        <LoadingSpinner v-if="loadingMatrix" />
        <EmptyState
          v-else-if="!selectedUser" icon="👥"
          title="Chọn một người dùng"
          message="Chọn người dùng bên trái để cấu hình quyền truy cập chi tiết."
        />
        <template v-else>
          <!-- Default-policy banner -->
          <div
            class="mb-4 rounded-xl border px-4 py-3 text-sm"
            :class="isEmptyMode
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-indigo-500/10 border-indigo-500/30 text-app-text-secondary'"
          >
            <p v-if="isEmptyMode">
              <span class="font-bold">Chế độ mặc định ({{ defaultPolicy }}):</span>
              người dùng này chưa có grant nào nên sidebar/phân quyền tuân theo Frappe role
              ({{ defaultPolicy === 'match_role' ? 'hiển thị theo role đang giữ' : 'không hiển thị gì' }}).
              Cấp <span class="font-bold">ít nhất 1 mục</span> bên dưới để bật chế độ phân quyền chi tiết.
            </p>
            <p v-else>
              <span class="font-bold">Chế độ phân quyền chi tiết đang bật</span> — người dùng chỉ thấy
              đúng các mục đã cấp bên dưới ({{ grantedCount }} mục).
            </p>
          </div>

          <!-- Sections (module visibility) -->
          <section class="mb-5">
            <h3 class="text-app-text-primary font-bold text-sm mb-2">Module (section)</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                v-for="s in sections" :key="s.key"
                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-app-border cursor-pointer hover:bg-indigo-500/10"
              >
                <input
                  type="checkbox" :checked="isOn('SECTION', s.key)"
                  @change="toggle('SECTION', s.key)" class="w-4 h-4 accent-indigo-600"
                />
                <span class="text-sm text-app-text-primary">{{ s.label }}</span>
                <code class="ml-auto text-[10px] text-app-text-muted">{{ s.key }}</code>
              </label>
            </div>
          </section>

          <!-- Role × Game matrix -->
          <section>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-app-text-primary font-bold text-sm">Role · Game (tài khoản theo trò chơi)</h3>
              <button
                type="button" @click="clearAllRoleGames"
                class="text-xs text-app-text-muted hover:text-red-500 transition"
              >
                Bỏ chọn tất cả
              </button>
            </div>

            <EmptyState
              v-if="!roleGroups.length" icon="🎮"
              title="Chưa có dữ liệu role · game"
              message="Chưa có tài khoản nào được gán role + game để cấp quyền."
            />

            <div v-else class="space-y-3">
              <div
                v-for="g in roleGroups" :key="g.role"
                class="rounded-xl border border-app-border overflow-hidden"
              >
                <div class="flex items-center justify-between px-3 py-2 bg-app-bg">
                  <span class="font-semibold text-sm text-app-text-primary">📂 {{ g.label }}</span>
                  <button
                    type="button" @click="toggleRoleAll(g)"
                    class="text-xs px-2 py-1 rounded-md transition"
                    :class="roleAllOn(g)
                      ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                      : 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20'"
                  >
                    {{ roleAllOn(g) ? 'Bỏ chọn cả role' : 'Chọn cả role' }}
                  </button>
                </div>
                <div class="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  <label
                    v-for="it in g.games" :key="it.key"
                    class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-500/10"
                  >
                    <input
                      type="checkbox" :checked="isOn('ROLE_GAME', it.key)"
                      @change="toggle('ROLE_GAME', it.key)" class="w-4 h-4 accent-indigo-600"
                    />
                    <span class="text-sm text-app-text-primary flex-1 truncate">{{ gameShort(it) }}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-app-bg text-app-text-muted font-bold">
                      {{ it.count }}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <!-- Sticky save bar -->
          <div class="sticky bottom-0 -mx-4 -mb-4 mt-5 px-4 py-3 bg-app-surface/95 backdrop-blur border-t border-app-border flex items-center gap-3">
            <span class="text-sm" :class="isDirty ? 'text-amber-600 font-bold' : 'text-app-text-muted'">
              {{ isDirty ? '● Có thay đổi chưa lưu' : 'Đã lưu' }}
            </span>
            <span class="text-xs text-app-text-muted ml-auto">{{ grantedCount }} mục đã cấp</span>
            <button
              type="button" :disabled="!isDirty || saving" @click="revert"
              class="px-3 py-2 rounded-lg text-sm font-medium border border-app-border text-app-text-secondary hover:bg-app-bg transition disabled:opacity-40"
            >
              Hoàn tác
            </button>
            <button
              type="button" :disabled="!isDirty || saving" @click="save"
              class="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-40"
            >
              {{ saving ? 'Đang lưu...' : 'Lưu thay đổi' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import { useNotify } from '../composables/useNotify.js'
import { frappeCall } from '../api/index.js'

defineOptions({ name: 'AccessGrantView' })

const { success, error: notifyError } = useNotify()
const route = useRoute()

// --- user picker ---
const users = ref([])
const loadingUsers = ref(false)
const userFilter = ref('')
const selectedUser = ref('')

const filteredUsers = computed(() => {
  const q = userFilter.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(u =>
    String(u.name).toLowerCase().includes(q) ||
    String(u.email).toLowerCase().includes(q) ||
    String(u.full_name || '').toLowerCase().includes(q)
  )
})

// --- grantable catalogue (independent of the selected user) ---
const grantable = ref({ roles: [], items: [] })
const sections = ref([])
const loadingMatrix = ref(false)

// --- the working grant set for the selected user (reactive via reassignment) ---
const granted = ref(new Set())
const original = ref(new Set())
const defaultPolicy = ref('match_role')
const saving = ref(false)

const isEmptyMode = computed(() => original.value.size === 0)
const grantedCount = computed(() => granted.value.size)
const isDirty = computed(() => !eqSet(granted.value, original.value))

const roleGroups = computed(() => {
  const labelByValue = new Map((grantable.value.roles || []).map(r => [r.value, r.label]))
  const map = new Map()
  for (const it of (grantable.value.items || [])) {
    if (!map.has(it.role)) map.set(it.role, [])
    map.get(it.role).push(it)
  }
  return [...map.entries()].map(([role, games]) => ({
    role,
    label: labelByValue.get(role) || role,
    games,
  }))
})

function gameShort(it) {
  // it.label = "ROLE · GAME_NAME" → keep the game half for compactness.
  const parts = String(it.label || it.game).split(' · ')
  return parts.length > 1 ? parts.slice(1).join(' · ') : (parts[0] || it.game)
}

function isOn(scope, key) { return granted.value.has(`${scope}|${key}`) }
function toggle(scope, key) {
  const k = `${scope}|${key}`
  const next = new Set(granted.value)
  if (next.has(k)) next.delete(k); else next.add(k)
  granted.value = next
}
function roleAllOn(g) { return g.games.length > 0 && g.games.every(it => isOn('ROLE_GAME', it.key)) }
function toggleRoleAll(g) {
  const next = new Set(granted.value)
  const allOn = roleAllOn(g)
  for (const it of g.games) {
    const k = `ROLE_GAME|${it.key}`
    if (allOn) next.delete(k); else next.add(k)
  }
  granted.value = next
}
function clearAllRoleGames() {
  const next = new Set(granted.value)
  for (const k of next) if (k.startsWith('ROLE_GAME|')) next.delete(k)
  granted.value = next
}
function revert() { granted.value = new Set(original.value) }

function selectUser(name) { selectedUser.value = name }

async function loadUserGrants() {
  if (!selectedUser.value) return
  loadingMatrix.value = true
  try {
    const [rows, mine] = await Promise.all([
      frappeCall('gam.api.get_access_grants', { user: selectedUser.value, app: 'GAM' }),
      frappeCall('gam.api.get_my_access_grants', { app: 'GAM' }).catch(() => null),
    ])
    // default policy comes from the session user's own grant profile (admin-only view,
    // but policy is global per-app → safe to reuse for the banner).
    if (mine && mine.default_policy) defaultPolicy.value = mine.default_policy
    const grantedRows = (rows || []).filter(r => r.granted === 1 || r.granted === '1' || r.granted === true)
    const set = new Set(grantedRows.map(r => `${r.scope}|${r.key}`))
    granted.value = new Set(set)
    original.value = new Set(set)
  } catch (e) {
    notifyError(e.message || 'Không tải được phân quyền')
  } finally {
    loadingMatrix.value = false
  }
}

async function save() {
  if (!selectedUser.value || !isDirty.value) return
  saving.value = true
  try {
    const grantsOut = [...granted.value].map(combined => {
      const idx = combined.indexOf('|')
      return { scope: combined.slice(0, idx), key: combined.slice(idx + 1), value: '' }
    })
    await frappeCall('gam.api.save_access_grants', {
      user: selectedUser.value,
      app: 'GAM',
      grants: grantsOut,
    })
    original.value = new Set(granted.value)
    success('Đã lưu phân quyền cho ' + selectedUser.value)
  } catch (e) {
    notifyError(e.message || 'Lưu thất bại')
  } finally {
    saving.value = false
  }
}

watch(selectedUser, loadUserGrants)

onMounted(async () => {
  loadingUsers.value = true
  loadingMatrix.value = true
  try {
    const [u, rg, sec] = await Promise.all([
      frappeCall('gam.api.get_gam_users'),
      frappeCall('gam.api.get_grantable_role_games'),
      frappeCall('gam.api.get_grantable_sections'),
    ])
    users.value = u || []
    grantable.value = rg || { roles: [], items: [] }
    sections.value = sec || []
    // Deep-link support: ?user=<name> preselects the user (used by the role-audit
    // cross-link and direct bookmarks). Only apply if that user actually exists.
    const qUser = route.query.user && String(route.query.user)
    if (qUser && u && u.some(x => x.name === qUser)) {
      selectedUser.value = qUser
    }
  } catch (e) {
    notifyError(e.message || 'Không tải được dữ liệu phân quyền')
  } finally {
    loadingUsers.value = false
    loadingMatrix.value = false
  }
})

function eqSet(a, b) {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const k of a) if (!b.has(k)) return false
  return true
}
</script>
