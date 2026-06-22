<template>
  <!--
    ActiveSection — one titled block inside the "Đang hoạt động" view.

    tone="mine"  → the session user's own leases (blue accent, Checkout button)
    tone="other" → leases held by other users (admin may Force Checkout)

    The realtime timer is driven by the `now` prop (the parent ticks every 1s)
    and prefers the absolute `started_at_epoch` from the server so it is
    timezone-independent and consistent with the server auto-release sweep.
  -->
  <section v-if="rows.length" class="mt-6">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-base">{{ icon }}</span>
      <h2 class="text-sm font-black uppercase tracking-widest text-app-text-primary">{{ title }}</h2>
      <span
        class="text-[10px] font-black px-2 py-0.5 rounded-full"
        :class="tone === 'mine' ? 'bg-blue-500/15 text-blue-600' : 'bg-app-bg text-app-text-muted'"
      >{{ rows.length }}</span>
      <span v-if="overCount > 0" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 flex items-center gap-1">
        ⚠️ {{ overCount }} quá giờ
      </span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="l in rowsWithMeta"
        :key="l.account"
        class="bg-app-surface border rounded-2xl p-5 shadow-sm transition"
        :class="cardClass(l)"
      >
        <!-- Header row -->
        <div class="flex items-start gap-3">
          <PlatformBadge :platform="l.platform" size="md" />
          <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('detail', l.account)">
            <div class="flex items-center gap-2">
              <h3 class="font-black text-app-text-primary text-base truncate">{{ l.username || l.account }}</h3>
              <span v-if="isMine(l)" class="text-[10px] font-black text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">BẠN</span>
              <span v-if="isOver(l)" class="gam-blink text-[10px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded">⚠️ QUÁ GIỜ</span>
            </div>
            <p class="text-xs text-app-text-muted truncate mt-0.5">
              <span v-if="l.main_game">🎯 {{ l.main_game }} · </span>🎮 {{ l.platform }}
            </p>
          </div>
        </div>

        <!-- Holder / purpose / timer -->
        <div class="mt-4 space-y-1.5 text-xs">
          <p class="flex items-center gap-1.5 text-app-text-secondary">
            <span>👤</span>
            <span class="font-bold">{{ userName(l.used_by) }}</span>
            <span v-if="isMine(l)" class="text-blue-600">(đang là bạn)</span>
          </p>
          <p class="flex items-center gap-1.5 text-app-text-muted">
            <span>📝</span>
            <span class="truncate">{{ l.purpose || '—' }}</span>
          </p>
          <p class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-full"
              :class="isOver(l) ? 'gam-blink-dot bg-red-500' : 'bg-blue-500 animate-pulse'"
            ></span>
            <span
              class="font-black uppercase tracking-wider text-[10px]"
              :class="isOver(l) ? 'gam-blink text-red-500' : 'text-blue-500'"
            >Online</span>
            <span class="text-app-text-muted">⏱ {{ elapsedLabel(l) }}</span>
            <span v-if="maxHours" class="text-app-text-muted">/ {{ maxHours }}h</span>
          </p>
        </div>

        <!-- Actions -->
        <div class="mt-4 flex items-center gap-2 flex-wrap">
          <button
            v-if="showCheckout && isMine(l)" @click="$emit('checkout', l)" :disabled="busyAccount === l.account"
            class="px-3 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition active:scale-95 disabled:opacity-50"
          >
            {{ busyAccount === l.account ? '...' : '✓ Checkout' }}
          </button>
          <button
            v-if="canForce && !isMine(l)" @click="$emit('force', l)"
            class="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition active:scale-95"
          >
            🔓 Force Checkout
          </button>
          <button
            @click="$emit('detail', l.account)"
            class="px-3 py-2 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition ml-auto"
          >
            → Chi tiết
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import PlatformBadge from './PlatformBadge.vue'
import { userName } from '../utils/format.js'

defineOptions({ name: 'ActiveSection' })

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '🟢' },
  tone: { type: String, default: 'default' }, // 'mine' | 'other' | 'default'
  rows: { type: Array, default: () => [] },
  now: { type: Number, required: true },
  settings: { type: Object, default: () => ({}) },
  currentUserId: { type: String, default: '' },
  showCheckout: { type: Boolean, default: true },
  canForce: { type: Boolean, default: false },
  busyAccount: { type: String, default: null },
})

defineEmits(['detail', 'checkout', 'force'])

const maxHours = computed(() => Number(props.settings?.max_online_hours) || 0)
const hardHours = computed(() => Number(props.settings?.hard_cap_online_hours) || 0)

// attach live markers without mutating the shared singleton rows
const rowsWithMeta = computed(() => props.rows)

function isMine(l) {
  return !!l.used_by && l.used_by === props.currentUserId
}

function startedMs(l) {
  // Prefer the absolute server epoch (timezone-independent). Fall back to
  // parsing the naive datetime string for backends that don't return it yet.
  const epoch = Number(l.started_at_epoch)
  if (epoch && !isNaN(epoch)) return epoch * 1000
  if (!l.started_at) return null
  const str = typeof l.started_at === 'string' ? l.started_at.replace(' ', 'T') : l.started_at
  const iso = typeof str === 'string' && !/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str + 'Z' : str
  const t = new Date(iso).getTime()
  return isNaN(t) ? null : t
}

function elapsedMs(l) {
  const started = startedMs(l)
  if (!started) return 0
  return Math.max(0, props.now - started)
}

function elapsedHours(l) {
  return elapsedMs(l) / 3600000
}

function isOver(l) {
  const h = elapsedHours(l)
  if (maxHours.value && h >= maxHours.value) return true
  if (hardHours.value && h >= hardHours.value) return true
  return false
}

function elapsedLabel(l) {
  const ms = elapsedMs(l)
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function cardClass(l) {
  if (isOver(l)) return 'gam-over-warning'
  if (isMine(l)) return 'border-blue-500/40 ring-1 ring-blue-500/20'
  return props.tone === 'other' ? 'border-amber-500/30' : 'border-app-border'
}

// exposed for the section header "X quá giờ" counter
const overCount = computed(() => props.rows.filter(isOver).length)
defineExpose({ overCount, isOver, elapsedLabel })
</script>

<style scoped>
/* Over-time warning: red blinking border + pulsing accent. */
.gam-over-warning {
  border-color: rgb(239 68 68 / 0.6);
  box-shadow: 0 0 0 1px rgb(239 68 68 / 0.35), 0 0 18px -4px rgb(239 68 68 / 0.5);
  animation: gam-blink-border 1s steps(2, start) infinite;
}

.gam-blink {
  animation: gam-blink-text 1s steps(2, start) infinite;
}

.gam-blink-dot {
  animation: gam-blink-text 1s steps(2, start) infinite;
}

@keyframes gam-blink-text {
  0% { opacity: 1; }
  50% { opacity: 0.25; }
  100% { opacity: 1; }
}

@keyframes gam-blink-border {
  0% {
    border-color: rgb(239 68 68 / 0.85);
    box-shadow: 0 0 0 1px rgb(239 68 68 / 0.45), 0 0 22px -3px rgb(239 68 68 / 0.6);
  }
  50% {
    border-color: rgb(239 68 68 / 0.3);
    box-shadow: 0 0 0 1px rgb(239 68 68 / 0.15);
  }
  100% {
    border-color: rgb(239 68 68 / 0.85);
    box-shadow: 0 0 0 1px rgb(239 68 68 / 0.45), 0 0 22px -3px rgb(239 68 68 / 0.6);
  }
}
</style>
