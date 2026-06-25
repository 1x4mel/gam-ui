<template>
  <!--
    ActiveSection — one titled block inside the "Đang hoạt động" view.

    tone="mine"  → the session user's own leases (blue accent, Checkout button)
    tone="other" → leases held by other users (admin may Force Checkout)

    The realtime timer is driven by the `now` prop (the parent ticks every 1s,
    already aligned to the DB server clock via useElapsedTimer) and prefers the
    absolute `started_at_epoch` from the server so it is timezone-independent
    and consistent with the server auto-release sweep.

    Each lease is classified into a colour tier (safe → soon → near → over →
    critical) based on the configured soft/hard online caps. Colour is never the
    only signal: a Vietnamese label + emoji accompany it (accessibility).
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
        class="relative bg-app-surface border rounded-2xl p-5 pl-6 shadow-sm transition overflow-hidden"
        :class="cardClass(l)"
      >
        <!-- Leading tier colour stripe (left edge) for at-a-glance scanning. -->
        <span
          class="absolute left-0 top-0 bottom-0 w-1.5"
          :class="`bg-tier-${t(l).tier}`"
          aria-hidden="true"
        ></span>

        <!-- Header row -->
        <div class="flex items-start gap-3">
          <PlatformBadge :platform="l.platform" size="md" />
          <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('detail', l.account)">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-black text-app-text-primary text-base truncate">{{ l.username || l.account }}</h3>
              <span v-if="isMine(l)" class="text-[10px] font-black text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">BẠN</span>
              <span
                v-if="isOver(l)"
                class="gam-blink text-[10px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded"
              >⚠️ QUÁ GIỜ</span>
            </div>
            <p class="text-xs text-app-text-muted truncate mt-0.5">
              <span v-if="l.main_game">🎯 {{ l.main_game }} · </span>🎮 {{ l.platform }}
            </p>
          </div>
        </div>

        <!-- Holder / purpose -->
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
        </div>

        <!-- Timer + progress bar -->
        <div class="mt-3">
          <div class="flex items-center gap-1.5 text-[10px] mb-1.5">
            <span class="w-2 h-2 rounded-full" :class="dotClass(l)"></span>
            <span class="font-black uppercase tracking-wider" :class="tierLabelClass(l)">
              {{ t(l).label }}
            </span>
          </div>
          <!-- Progress bar: % of the soft online cap. -->
          <div
            class="h-1.5 rounded-full bg-app-bg overflow-hidden"
            role="progressbar"
            :aria-valuenow="t(l).percent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Đã dùng ${t(l).percent}% thời gian`"
          >
            <div
              class="h-full rounded-full transition-all duration-1000 ease-linear"
              :class="`bg-tier-${t(l).tier}`"
              :style="{ width: Math.max(4, t(l).percent) + '%' }"
            ></div>
          </div>
          <!-- Elapsed + remaining labels -->
          <div class="flex items-center justify-between mt-1.5 font-mono">
            <span class="text-[11px] font-bold" :class="tierLabelClass(l)">
              ⏱ {{ elapsedLabel(l) }}
            </span>
            <span class="text-[11px] text-app-text-muted">
              <span v-if="t(l).remainingMs > 0">⏳ còn {{ remainingLabel(l) }}</span>
              <span v-else class="font-black text-tier-over">QUÁ GIỜ</span>
              <span v-if="maxHours"> / {{ maxHours }}h</span>
            </span>
          </div>
        </div>

        <!-- Handoff chain indicator: this lease continues a previous shift. -->
        <div v-if="l.prev_lease" class="mt-3 flex items-center gap-1.5 text-[10px] text-blue-600 font-bold">
          <span>🔀</span><span>Nối ca (bàn giao từ ca trước)</span>
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
            v-if="showHandoff && (isMine(l) || canForce)" @click="$emit('handoff', l)" :disabled="busyAccount === l.account"
            class="px-3 py-2 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition active:scale-95 disabled:opacity-50"
          >
            🔀 Bàn giao
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
import {
  elapsedTier,
  tierTextClass,
  tierDotClass,
  tierBorderClass,
  formatDuration,
  startedMsOf,
} from '../composables/useElapsedTimer.js'

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
  showHandoff: { type: Boolean, default: true },
  canForce: { type: Boolean, default: false },
  busyAccount: { type: String, default: null },
})

defineEmits(['detail', 'checkout', 'force', 'handoff'])

const maxHours = computed(() => Number(props.settings?.max_online_hours) || 0)

// attach live markers without mutating the shared singleton rows
const rowsWithMeta = computed(() => props.rows)

function isMine(l) {
  return !!l.used_by && l.used_by === props.currentUserId
}

function elapsedMs(l) {
  const started = startedMsOf(l)
  if (started == null) return 0
  return Math.max(0, props.now - started)
}

/** Tier bundle ({tier, percent, remainingMs, label, emoji, dotAnim}) for a lease. */
function t(l) {
  return elapsedTier(elapsedMs(l), props.settings)
}

function isOver(l) {
  const r = t(l)
  return r.tier === 'over' || r.tier === 'critical'
}

function elapsedLabel(l) {
  return formatDuration(elapsedMs(l))
}

function remainingLabel(l) {
  return formatDuration(t(l).remainingMs)
}

function cardClass(l) {
  return tierBorderClass(t(l).tier)
}

function dotClass(l) {
  const r = t(l)
  return `${tierDotClass(r.tier)} ${r.dotAnim}`
}

function tierLabelClass(l) {
  return tierTextClass(t(l).tier)
}

// exposed for the section header "X quá giờ" counter
const overCount = computed(() => props.rows.filter(isOver).length)
defineExpose({ overCount, isOver, elapsedLabel })
</script>

<!-- Over-time / blink utility classes (gam-over-warning, gam-critical-warning,
     gam-blink, gam-blink-dot) now live globally in src/style.css so they can be
     shared with AccountCard (scoped styles do not leak across components). -->
