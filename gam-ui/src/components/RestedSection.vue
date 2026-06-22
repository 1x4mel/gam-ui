<template>
  <!--
    RestedSection — "Đang nghỉ" (cooling) section: accounts đã checkout đang chờ
    đủ `min_rested_hours` để "Sẵn sàng & an toàn" dùng lại.

    Đối xứng với ActiveSection nhưng cho trạng thái OFFLINE. Bộ đếm countdown
    realtime được drive bởi prop `now` (parent tick mỗi 1s, đã align với DB server
    clock qua useElapsedTimer). Mỗi row được classify vào tier cooling → warming →
    almost → ready (blue → teal → green). Khi ready: label "Sẵn sàng & an toàn".
  -->
  <section v-if="rows.length" class="mt-8">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-base">🔵</span>
      <h2 class="text-sm font-black uppercase tracking-widest text-app-text-primary">
        Đang nghỉ (cooling)
      </h2>
      <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-tier-cool/15 text-tier-cool">
        {{ rows.length }}
      </span>
      <span
        v-if="readyCount > 0"
        class="text-[10px] font-black px-2 py-0.5 rounded-full bg-tier-safe/15 text-tier-safe flex items-center gap-1"
      >
        🟢 {{ readyCount }} sẵn sàng
      </span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="r in rows"
        :key="r.account"
        class="relative bg-app-surface border rounded-2xl p-5 pl-6 shadow-sm transition overflow-hidden"
        :class="restedBorderClass(t(r).tier)"
      >
        <!-- Leading tier colour stripe. -->
        <span
          class="absolute left-0 top-0 bottom-0 w-1.5"
          :class="restedDotClass(t(r).tier)"
          aria-hidden="true"
        ></span>

        <!-- Header row -->
        <div class="flex items-start gap-3">
          <PlatformBadge :platform="r.platform" size="md" />
          <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('detail', r.account)">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-black text-app-text-primary text-base truncate">
                {{ r.username || r.account }}
              </h3>
              <span
                v-if="t(r).ready"
                class="gam-blink text-[10px] font-black text-white bg-tier-safe px-1.5 py-0.5 rounded"
              >✓ SẴN SÀNG</span>
            </div>
            <p class="text-xs text-app-text-muted truncate mt-0.5">
              <span v-if="r.main_game">🎯 {{ r.main_game }} · </span>🎮 {{ r.platform }}
            </p>
          </div>
        </div>

        <!-- Last user -->
        <div class="mt-4 space-y-1.5 text-xs">
          <p class="flex items-center gap-1.5 text-app-text-secondary">
            <span>👤</span>
            <span class="font-bold">{{ userName(r.used_by) }}</span>
          </p>
          <p class="flex items-center gap-1.5 text-app-text-muted">
            <span>📝</span>
            <span class="truncate">{{ r.purpose || '—' }}</span>
          </p>
        </div>

        <!-- Timer + progress bar -->
        <div class="mt-3">
          <div class="flex items-center gap-1.5 text-[10px] mb-1.5">
            <span class="w-2 h-2 rounded-full" :class="dotClass(r)"></span>
            <span class="font-black uppercase tracking-wider" :class="restedTextClass(t(r).tier)">
              {{ t(r).label }}
            </span>
          </div>
          <!-- Progress bar: % of min_rested reached. -->
          <div
            class="h-1.5 rounded-full bg-app-bg overflow-hidden"
            role="progressbar"
            :aria-valuenow="t(r).percent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Đã nghỉ ${t(r).percent}% thời gian phục hồi`"
          >
            <div
              class="h-full rounded-full transition-all duration-1000 ease-linear"
              :class="restedDotClass(t(r).tier)"
              :style="{ width: Math.max(4, t(r).percent) + '%' }"
            ></div>
          </div>
          <!-- Rested + remaining labels -->
          <div class="flex items-center justify-between mt-1.5 font-mono">
            <span class="text-[11px] font-bold" :class="restedTextClass(t(r).tier)">
              😴 {{ restedLabel(r) }}
            </span>
            <span class="text-[11px] text-app-text-muted">
              <span v-if="t(r).ready" class="font-black text-tier-safe">Sẵn sàng & an toàn</span>
              <span v-else>⏳ còn {{ remainingLabel(r) }}</span>
              <span v-if="minHours"> / {{ minHours }}h</span>
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-4 flex items-center gap-2 flex-wrap">
          <button
            v-if="t(r).ready"
            @click="$emit('checkin', r)"
            class="px-3 py-2 rounded-xl bg-tier-safe/15 text-tier-safe border border-tier-safe/30 text-[10px] font-black uppercase tracking-widest hover:bg-tier-safe/25 transition active:scale-95"
          >
            ✓ Checkin ngay
          </button>
          <button
            @click="$emit('detail', r.account)"
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
  restedTier,
  restedTextClass,
  restedDotClass,
  restedBorderClass,
  formatDuration,
  endedMsOf,
} from '../composables/useElapsedTimer.js'

defineOptions({ name: 'RestedSection' })

const props = defineProps({
  rows: { type: Array, default: () => [] },
  now: { type: Number, required: true },
  settings: { type: Object, default: () => ({}) },
})

defineEmits(['detail', 'checkin'])

const minHours = computed(() => Number(props.settings?.min_rested_hours) || 0)

function restedMs(r) {
  const ended = endedMsOf(r)
  if (ended == null) return 0
  return Math.max(0, props.now - ended)
}

/** Tier bundle for a resting row. */
function t(r) {
  return restedTier(restedMs(r), props.settings)
}

function restedLabel(r) {
  return formatDuration(restedMs(r))
}

function remainingLabel(r) {
  return formatDuration(t(r).remainingMs)
}

function dotClass(r) {
  const res = t(r)
  return `${restedDotClass(res.tier)} ${res.dotAnim}`
}

const readyCount = computed(() => props.rows.filter((r) => t(r).ready).length)
defineExpose({ readyCount })
</script>
