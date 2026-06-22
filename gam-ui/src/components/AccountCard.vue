<template>
  <router-link
    :to="`/accounts/${account.name}`"
    class="block bg-app-surface border rounded-2xl p-4 transition relative"
    :class="cardClass"
  >
    <div class="flex items-center gap-3 flex-wrap">
      <PlatformBadge :platform="account.platform" />
      <RoleBadge v-for="r in rolesOf(account)" :key="r" :role="r" />
      <p class="font-black text-app-text-primary text-sm flex-1 min-w-0 truncate">{{ account.username }}</p>
      <StatusBadge :status="account.status" />

      <!-- Admin back-office: CRUD actions (only when the viewer can manage). -->
      <template v-if="mode === 'admin' && canManage">
        <button
          @click.prevent.stop="$emit('edit')"
          class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition"
        >
          Sửa
        </button>
        <button
          @click.prevent.stop="$emit('delete')"
          class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition"
        >
          Xoá
        </button>
      </template>

      <!-- Operate / task-oriented: inline lease actions.
           Free → Checkin (start). Held by me → Checkout (release).
           Held by other + admin → Force release. Members see read-only lock. -->
      <template v-else-if="mode === 'operate'">
        <button
          v-if="!lease" @click.prevent.stop="$emit('start')"
          class="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-[10px] font-black uppercase tracking-widest transition active:scale-95 shadow-lg shadow-blue-600/20"
        >
          ✅ Checkin
        </button>
        <button
          v-else-if="isMine(account.name)" @click.prevent.stop="$emit('end')"
          class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest transition active:scale-95"
        >
          ✓ Checkout
        </button>
        <button
          v-if="lease && !isMine(account.name) && canForce" @click.prevent.stop="$emit('force')"
          class="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20 text-[10px] font-black uppercase tracking-widest transition active:scale-95"
        >
          🔓 Force
        </button>
      </template>

      <span class="text-app-text-muted">›</span>
    </div>

    <div class="mt-2 flex items-center gap-2 text-[10px] text-app-text-muted flex-wrap">
      <!-- lock / active / rested badges (Req #5 lock + governance rested) -->
      <span
        v-if="lease && !isMine(account.name)"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold"
      >
        🔒 {{ lease.used_by_full_name || userName(lease.used_by) }}<span v-if="lease.purpose"> · {{ lease.purpose }}</span>
      </span>
      <span
        v-else-if="lease && isMine(account.name)"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 font-bold"
      >
        🟢 bạn đang dùng
      </span>
      <span
        v-else-if="account.is_rested_enough"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold"
      >
        😴 nghỉ đủ
      </span>
      <span v-if="account.email" class="truncate">📧 {{ account.email }}</span>
      <span v-if="account.source" class="truncate">📦 {{ account.source }}</span>
      <span
        v-for="g in (account.games || [])" :key="g.game"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold"
      >
        <span v-if="g.is_main">★</span> 🎮 {{ g.game_name || g.game
        }}<span v-if="g.server_region" class="opacity-60">· {{ g.server_region }}</span>
      </span>
    </div>
  </router-link>
</template>

<script setup>
/**
 * AccountCard — shared row card for the account list views.
 *
 * Extracted from AccountListView so the admin back-office (`/accounts`) and the
 * operational role|game view (`/role/:role(/game/:game)`) render the SAME card
 * (platform / roles / username / status / games / lock-rested badges), differing
 * only by `mode`:
 *   - 'admin'   → CRUD actions (Sửa / Xoá), shown only when `canManage` is true.
 *   - 'operate' → task-oriented lease actions (Checkin / Checkout / Force),
 *                 task-first so members find → checkout in one click. CRUD is
 *                 intentionally hidden here (admins reach it via /accounts).
 *
 * Lock/rested state comes from the shared `useActiveUsage` singleton, so both
 * views show identical, realtime lease state without each owning the wiring.
 *
 * Events:
 *   - edit, delete            (admin mode)
 *   - start, end, force       (operate mode: begin / release / admin-reclaim lease)
 */
import { computed } from 'vue'
import PlatformBadge from './PlatformBadge.vue'
import RoleBadge from './RoleBadge.vue'
import StatusBadge from './StatusBadge.vue'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { userName } from '../utils/format.js'

const props = defineProps({
  account: { type: Object, required: true },
  mode: { type: String, default: 'admin' }, // 'admin' | 'operate'
  canManage: { type: Boolean, default: false }, // show Sửa/Xoá in admin mode
  canForce: { type: Boolean, default: false },  // show 🔓 Force in operate mode
})

defineEmits(['edit', 'delete', 'start', 'end', 'force'])

const { leaseFor, isMine } = useActiveUsage()

/** Active lease for this account (shared singleton), or null if free. */
const lease = computed(() => leaseFor(props.account.name))

const cardClass = computed(() =>
  lease.value
    ? (isMine(props.account.name)
        ? 'border-blue-500/40 ring-1 ring-blue-500/20 hover:border-blue-500'
        : 'border-amber-500/40 opacity-70 hover:border-amber-500/70')
    : 'border-app-border hover:border-indigo-600/50'
)

/** Distinct role values for a card — an account may carry several roles across
 *  its (role, game) bindings. */
function rolesOf(acc) {
  const rows = acc.role_games || acc.games || []
  const out = []
  for (const g of rows) {
    if (g.role && !out.includes(g.role)) out.push(g.role)
  }
  return out
}
</script>
