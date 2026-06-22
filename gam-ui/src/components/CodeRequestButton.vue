<template>
  <div class="bg-app-bg border border-app-border rounded-2xl p-4">
    <!-- Trigger -->
    <button
      v-if="!hasCode"
      @click="handleRequest"
      :disabled="loading"
      class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-black text-sm uppercase tracking-wider hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
    >
      <span v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
      <span v-else>🔑</span>
      <span>Lấy Verification Code</span>
    </button>

    <!-- Result -->
    <div v-else class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest">Mã xác minh</p>
        <div class="flex items-center gap-1.5 text-[10px] font-black">
          <PlatformBadge v-if="result.platform" :platform="result.platform" size="xs" />
          <span
            class="px-1.5 py-0.5 rounded-md"
            :class="remainingSeconds > 60 ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'"
          >
            ⏳ {{ countdownLabel }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <code class="flex-1 text-2xl font-black font-mono tracking-[0.2em] text-app-text-primary bg-app-surface border border-app-border rounded-xl px-4 py-3 select-all text-center">
          {{ result.code }}
        </code>
        <button
          @click="handleCopy"
          class="px-3 py-3 rounded-xl border font-black text-[10px] uppercase tracking-wider transition active:scale-95"
          :class="justCopied
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
            : 'bg-app-surface text-app-text-secondary border-app-border hover:bg-indigo-500/10 hover:text-indigo-600'"
        >
          {{ justCopied ? '✓' : '📋' }}
        </button>
      </div>

      <button
        @click="handleRequest"
        :disabled="loading"
        class="w-full text-[10px] text-app-text-muted hover:text-indigo-600 font-black uppercase tracking-wider transition disabled:opacity-50"
      >
        ↻ Thử lại
      </button>
    </div>

    <!-- No code available -->
    <div v-if="showNoCode" class="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span>⏳</span>
        <p class="text-xs text-amber-600 font-medium">Chưa có code mới. Vui lòng đợi 1–2 phút rồi thử lại.</p>
      </div>
      <button
        @click="handleRequest"
        :disabled="loading"
        class="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-600 text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/30 transition active:scale-95 disabled:opacity-50"
      >
        Thử lại
      </button>
    </div>

    <p v-if="error" class="mt-2 text-[10px] text-red-500 font-medium">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useRequestCode } from '../composables/useRequestCode.js'
import { useNotify } from '../composables/useNotify.js'
import PlatformBadge from './PlatformBadge.vue'

const props = defineProps({
  emailName: { type: String, default: '' },
  accountName: { type: String, default: '' },
  platform: { type: String, default: '' },
})

const emit = defineEmits(['fetched'])

const { loading, error, result, hasCode, remainingSeconds, request, reset } = useRequestCode()
const { success, info } = useNotify()

const showNoCode = ref(false)
const justCopied = ref(false)
let copiedTimer = null

const countdownLabel = computed(() => {
  const s = remainingSeconds.value
  if (s <= 0) return 'hết hạn'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
})

async function handleRequest() {
  showNoCode.value = false
  try {
    const res = await request({
      emailName: props.emailName,
      accountName: props.accountName,
      platform: props.platform,
    })
    if (res?.status === 'ok') {
      success('Đã lấy mã xác minh')
      emit('fetched', res)
    } else {
      showNoCode.value = true
      info('Chưa có code mới')
    }
  } catch {
    showNoCode.value = true
  }
}

async function handleCopy() {
  if (!result.value?.code) return
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(result.value.code)
    else {
      const ta = document.createElement('textarea')
      ta.value = result.value.code
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    justCopied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { justCopied.value = false }, 1500)
  } catch {
    /* ignore */
  }
}

onUnmounted(() => {
  clearTimeout(copiedTimer)
  reset()
})

defineExpose({ request: handleRequest })
</script>
