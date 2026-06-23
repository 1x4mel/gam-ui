<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Tìm kiếm" subtitle="Tài khoản · Email · Game" icon="🔍" :connected="connected" />

    <div class="max-w-4xl mx-auto w-full flex-1 flex flex-col overflow-hidden px-1">
      <!-- Search input -->
      <div class="relative flex-shrink-0">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted text-lg pointer-events-none">🔍</span>
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          placeholder="Nhập tên tài khoản, email, game..."
          class="w-full pl-12 pr-10 py-4 rounded-2xl bg-app-surface border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 focus:ring-2 focus:ring-indigo-600/10 transition"
          @input="onInput"
          @keydown.enter="searchNow"
        />
        <button
          v-if="query" @click="clearQuery"
          class="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition"
        >
          ✕
        </button>
      </div>

      <!-- Results -->
      <div class="flex-1 overflow-y-auto custom-scrollbar mt-4 space-y-6">
        <LoadingSpinner v-if="loading" size="md" text="Đang tìm..." />

        <template v-else-if="hasResults">
          <!-- Accounts -->
          <section v-if="results.accounts?.length">
            <p class="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              🎮 Tài khoản <span class="text-app-text-muted/50">({{ results.accounts.length }})</span>
            </p>
            <div class="space-y-2">
              <button
                v-for="a in results.accounts" :key="a.name"
                @click="router.push(`/accounts/${a.name}`)"
                class="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-2xl p-4 hover:border-indigo-600/50 transition text-left"
              >
                <PlatformBadge :platform="a.platform" />
                <div class="flex-1 min-w-0">
                  <p class="font-black text-app-text-primary text-sm truncate">{{ a.username }}</p>
                  <p class="text-[10px] text-app-text-muted truncate">{{ a.email }}</p>
                </div>
                <StatusBadge :status="a.status || 'ACTIVE'" />
              </button>
            </div>
          </section>

          <!-- Emails -->
          <section v-if="results.emails?.length">
            <p class="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              📧 Email <span class="text-app-text-muted/50">({{ results.emails.length }})</span>
            </p>
            <div class="space-y-2">
              <div
                v-for="e in results.emails" :key="e.name"
                class="flex items-center gap-3 bg-app-surface border border-app-border rounded-2xl p-4"
              >
                <span>📧</span>
                <div class="flex-1 min-w-0">
                  <p class="font-black text-app-text-primary text-sm truncate">{{ e.address }}</p>
                  <p class="text-[10px] text-app-text-muted">{{ e.provider || 'Email' }}</p>
                </div>
                <CopyButton :text="e.address" />
              </div>
            </div>
          </section>

          <!-- Games -->
          <section v-if="results.games?.length">
            <p class="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              🎯 Game <span class="text-app-text-muted/50">({{ results.games.length }})</span>
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="g in results.games" :key="g.name"
                @click="goToGameAccounts(g.name)"
                class="bg-app-surface border border-app-border rounded-2xl p-4 hover:border-indigo-600/50 transition text-left"
              >
                <p class="font-black text-app-text-primary text-sm truncate">🎮 {{ g.game_name }}</p>
                <p v-if="g.publisher" class="text-[10px] text-app-text-muted truncate mt-0.5">{{ g.publisher }}</p>
              </button>
            </div>
          </section>
        </template>

        <EmptyState
          v-else-if="searched && query"
          icon="🔍" text="Không tìm thấy kết quả"
          subtext="Thử từ khoá khác (tên tài khoản, email, tên game)."
        />

        <EmptyState
          v-else-if="!query"
          icon="⌨️" text="Bắt đầu tìm kiếm"
          subtext="Nhập tên tài khoản game, địa chỉ email hoặc tên game."
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import PlatformBadge from '../components/PlatformBadge.vue'
import StatusBadge from '../components/StatusBadge.vue'
import CopyButton from '../components/CopyButton.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { frappeCall } from '../api/index.js'

defineOptions({ name: 'SearchView' })

const router = useRouter()
const { connected } = useRealtime()

const inputEl = ref(null)
const query = ref('')
const loading = ref(false)
const searched = ref(false)
const results = ref({})

const hasResults = computed(() =>
  !!(results.value.accounts?.length || results.value.emails?.length || results.value.games?.length)
)

let debounceTimer = null
function onInput() {
  clearTimeout(debounceTimer)
  if (!query.value.trim()) {
    results.value = {}
    searched.value = false
    return
  }
  debounceTimer = setTimeout(searchNow, 350)
}

async function searchNow() {
  const q = query.value.trim()
  if (!q) return
  clearTimeout(debounceTimer)
  loading.value = true
  searched.value = true
  try {
    results.value = await frappeCall('gam.api.global_search', { query: q }) || {}
  } catch {
    results.value = {}
  } finally {
    loading.value = false
  }
}

function clearQuery() {
  query.value = ''
  results.value = {}
  searched.value = false
  inputEl.value?.focus()
}

function goToGameAccounts(gameName) {
  router.push({ path: '/admin/game-accounts', query: { game: gameName } })
}
</script>
