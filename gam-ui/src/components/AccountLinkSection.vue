<template>
  <div class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">🔗 Liên kết</h3>
      <button
        v-if="canEdit" @click="$emit('add-link')"
        class="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/20 transition"
      >
        + Thêm
      </button>
    </div>

    <LoadingSpinner v-if="loading" size="sm" />

    <!-- Hierarchy: parent PLATFORM node + child GAME nodes (parent_account) -->
    <div v-if="showHierarchy && !loading && hierarchy.length" class="space-y-2 mb-3">
      <p class="text-[9px] uppercase font-black tracking-widest text-app-text-muted opacity-50 mb-1">Cây tài khoản</p>
      <router-link
        v-for="h in hierarchy" :key="'hier-' + h.name"
        :to="h.to || `/accounts/${h.name}`"
        class="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-3 py-2.5 hover:border-indigo-600/40 transition group"
      >
        <span class="text-lg leading-none mt-0.5">{{ h.icon }}</span>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-app-text-primary text-sm truncate">{{ h.label || h.name }}</p>
          <p class="text-[10px] text-app-text-muted truncate">{{ h.relation }} · {{ h.platform || '?' }}</p>
          <!-- Bound games/roles live on GAME child nodes (a platform carries none) -->
          <div v-if="h.role_games && h.role_games.length" class="mt-1.5 flex flex-col gap-1">
            <div
              v-for="rg in h.role_games"
              :key="(rg.game || '') + '|' + (rg.role || '') + '|' + (rg.server || '')"
              class="flex items-center gap-1.5 flex-wrap text-[10px]"
            >
              <span class="font-bold text-indigo-600">🎮 {{ rg.game_name || rg.game }}</span>
              <RoleBadge v-if="rg.role" :role="rg.role" size="sm" />
              <span v-if="rg.server_name || rg.server" class="text-app-text-muted bg-app-surface px-1.5 py-0.5 rounded">🌐 {{ rg.server_name || rg.server }}</span>
              <span v-if="Number(rg.is_main)" class="text-[9px] text-amber-500 font-black">★ MAIN</span>
            </div>
          </div>
        </div>
        <div class="text-right shrink-0 flex flex-col items-end gap-1">
          <StatusBadge v-if="h.status" :status="h.status" size="sm" />
          <span class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded" :class="h.badgeCls">{{ h.badge }}</span>
        </div>
      </router-link>
    </div>

    <!-- Explicit bidirectional links (GAM Account Link) -->
    <div v-if="!loading && links.length" class="space-y-2">
      <p v-if="showHierarchy && hierarchy.length" class="text-[9px] uppercase font-black tracking-widest text-app-text-muted opacity-50 mb-1">Liên kết khác</p>
      <router-link
        v-for="link in links" :key="link.name"
        :to="`/accounts/${link.otherName}`"
        class="flex items-center gap-3 bg-app-bg border border-app-border rounded-xl px-3 py-2.5 hover:border-indigo-600/40 transition group"
      >
        <span class="text-lg">→</span>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-app-text-primary text-sm truncate">{{ link.otherName }}</p>
          <p class="text-[10px] text-app-text-muted truncate">{{ link.link_type || 'Linked' }}</p>
        </div>
        <div class="text-right shrink-0">
          <StatusBadge :status="link.status" />
          <p v-if="link.expiry_date" class="text-[10px] mt-1 font-bold" :class="expiryClass(link.expiry_date)">
            {{ expiryLabel(link.expiry_date) }}
          </p>
        </div>
      </router-link>
    </div>

    <p
      v-if="!loading && !hierarchy.length && !links.length"
      class="text-xs text-app-text-muted italic"
    >Chưa có liên kết với tài khoản khác.</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'
import StatusBadge from './StatusBadge.vue'
import RoleBadge from './RoleBadge.vue'
import { getList } from '../api/index.js'

const props = defineProps({
  accountName: { type: String, required: true },
  // Name of the PLATFORM parent (account.parent_account), surfaced as a
  // hierarchy row. Without this the section would only show explicit links and
  // silently hide the parent/child relationship (Bug 2).
  parentAccount: { type: String, default: '' },
  // The full parent PLATFORM doc (already loaded by AccountDetailView) so the
  // parent hierarchy row can display the real username + platform instead of
  // the raw doc name + '?' (Bug 1).
  parentAccountDoc: { type: Object, default: null },
  canEdit: { type: Boolean, default: false },
  // When false, the synthetic parent/child tree is hidden and only explicit
  // GAM Account Link entries render.
  showHierarchy: { type: Boolean, default: true },
  // Rich child GAME nodes (with role_games) supplied by the parent view when it
  // already loaded them (platform detail uses get_platform_children). When
  // provided, the component skips its own basic child fetch and renders the
  // games/roles bound to each child node. null ⇒ fetch the basic list itself.
  childNodes: { type: Array, default: null },
})
defineEmits(['add-link'])

const loading = ref(false)
const rawLinks = ref([])
// Child GAME nodes whose parent_account === this account (parallel fetch).
const children = ref([])

const links = computed(() =>
  rawLinks.value.map(l => {
    const otherName = l.source_account === props.accountName ? l.target_account : l.source_account
    return { name: l.name, otherName, link_type: l.link_type, status: l.status, expiry_date: l.expiry_date }
  })
)

// Effective child GAME nodes: rich docs supplied by the parent view (platform
// detail, role_games already attached via get_platform_children) when present,
// otherwise the basic rows this component fetches itself.
const childRows = computed(() => props.childNodes ?? children.value)

// Synthetic hierarchy rows: the parent PLATFORM node (if any) plus any child
// GAME nodes. These are separate from explicit GAM Account Link entries so the
// user can always see the account tree even when no manual links exist.
const hierarchy = computed(() => {
  const rows = []
  if (props.parentAccount && props.parentAccount !== props.accountName) {
    const pd = props.parentAccountDoc || {}
    rows.push({
      name: props.parentAccount,
      // Real username/platform from the loaded parent doc (Bug 1); fall back to
      // the doc name only when the doc hasn't resolved yet.
      label: pd.username || '',
      to: `/platform-accounts/${props.parentAccount}`,
      relation: 'Platform cha',
      platform: pd.platform || '',
      icon: '🖥️',
      badge: 'PLATFORM',
      badgeCls: 'bg-indigo-500/15 text-indigo-400',
    })
  }
  for (const c of childRows.value) {
    if (c.name === props.accountName) continue
    rows.push({
      name: c.name,
      label: c.username || c.platform || c.name,
      to: `/accounts/${c.name}`,
      relation: 'Node Game',
      platform: c.platform || '',
      icon: '🎮',
      badge: 'GAME',
      badgeCls: 'bg-amber-500/15 text-amber-400',
      status: c.status || '',
      // (role, game) bindings live on GAME nodes; a PLATFORM parent has none.
      role_games: c.role_games || [],
    })
  }
  return rows
})

async function load() {
  if (!props.accountName) return
  loading.value = true
  try {
    const [linkRows, fetchedChildren] = await Promise.all([
      getList('GAM Account Link', {
        fields: ['name', 'source_account', 'target_account', 'link_type', 'status', 'expiry_date'],
        filters: [['status', '=', 'ACTIVE']],
        or_filters: [
          ['source_account', '=', props.accountName],
          ['target_account', '=', props.accountName],
        ],
        limit: 100,
        order_by: 'expiry_date asc',
      }),
      // Child GAME nodes that share this account as their parent_account.
      // Skipped when the parent view supplies rich childNodes (platform detail
      // loads them via get_platform_children with role_games already attached).
      props.childNodes != null
        ? Promise.resolve([])
        : getList('GAM Account', {
            fields: ['name', 'username', 'platform'],
            filters: [['parent_account', '=', props.accountName], ['docstatus', '<', 2]],
            limit: 100,
            order_by: 'creation desc',
          }),
    ])
    rawLinks.value = linkRows || []
    children.value = fetchedChildren || []
  } catch {
    rawLinks.value = []
    children.value = []
  } finally {
    loading.value = false
  }
}

function expiryLabel(d) {
  let dt = d
  if (typeof dt === 'string' && !dt.includes('Z') && !dt.includes('+')) dt = dt + '+07:00'
  const diff = new Date(dt).getTime() - Date.now()
  const days = Math.floor(diff / 86400000)
  if (diff <= 0) return 'đã hết hạn'
  if (days <= 0) return `hết hạn hôm nay`
  return `còn ${days} ngày`
}
function expiryClass(d) {
  let dt = d
  if (typeof dt === 'string' && !dt.includes('Z') && !dt.includes('+')) dt = dt + '+07:00'
  const days = (new Date(dt).getTime() - Date.now()) / 86400000
  if (days <= 1) return 'text-red-500'
  if (days <= 7) return 'text-amber-500'
  return 'text-app-text-muted'
}

defineExpose({ refresh: load })
onMounted(load)
watch(() => props.accountName, load)
</script>
