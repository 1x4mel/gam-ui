<template>
  <div class="flex flex-col gap-1">
    <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30">{{ label }}</p>

    <div class="flex items-center gap-2 flex-wrap">
      <!-- Value -->
      <template v-if="!hasValue">
        <span class="text-app-text-muted text-sm italic">Chưa đặt</span>
      </template>
      <template v-else>
        <code
          v-if="revealed"
          class="text-sm font-black font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg break-all select-all"
        >{{ value }}</code>
        <span v-else class="text-app-text-primary text-sm font-black tracking-tight">••••••••</span>
      </template>

      <!-- Actions -->
      <div v-if="hasValue" class="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          @click="toggleReveal"
          :disabled="loading"
          :title="revealed ? 'Ẩn' : 'Hiện'"
          :aria-label="revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
          class="w-7 h-7 flex items-center justify-center rounded-lg border transition active:scale-95 disabled:opacity-50"
          :class="revealed
            ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30'
            : 'bg-app-bg/50 text-app-text-secondary border-app-border hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/30'"
        >
          <span v-if="loading" class="w-3.5 h-3.5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></span>
          <span v-else>{{ revealed ? '🙈' : '👁' }}</span>
        </button>

        <button
          type="button"
          @click="handleCopy"
          :disabled="loading"
          title="Copy"
          aria-label="Sao chép"
          class="w-7 h-7 flex items-center justify-center rounded-lg border transition active:scale-95 disabled:opacity-50"
          :class="justCopied
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
            : 'bg-app-bg/50 text-app-text-secondary border-app-border hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/30'"
        >
          <span>{{ justCopied ? '✓' : '📋' }}</span>
        </button>
      </div>
    </div>

    <p v-if="error" class="text-[10px] text-red-500 font-medium">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useRevealPassword } from '../composables/useRevealPassword.js'

const props = defineProps({
  /** GAM DocType name, e.g. "GAM Account" / "GAM Email". */
  doctype: { type: String, required: true },
  /** Doc name. */
  name: { type: String, required: true },
  /** Password fieldname: account_password / email_password / totp_secret. */
  fieldname: { type: String, required: true },
  label: { type: String, default: 'Mật khẩu' },
  /** Whether a password is stored (controls reveal availability). */
  hasValue: { type: Boolean, default: true },
})

const { reveal, copy, forget, loading, error } = useRevealPassword()

const revealed = ref(false)
const value = ref('')
const justCopied = ref(false)
let copiedTimer = null

async function toggleReveal() {
  if (revealed.value) {
    revealed.value = false
    return
  }
  try {
    value.value = await reveal(props.doctype, props.name, props.fieldname)
    revealed.value = true
  } catch {
    // error surfaced via composable
  }
}

async function handleCopy() {
  try {
    const text = await copy(props.doctype, props.name, props.fieldname)
    await writeToClipboard(text)
    justCopied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { justCopied.value = false }, 1500)
  } catch {
    // error surfaced via composable
  }
}

function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  return Promise.resolve()
}

// Reset visibility when target changes
watch(() => [props.doctype, props.name, props.fieldname], () => {
  revealed.value = false
  value.value = ''
})

onUnmounted(() => {
  clearTimeout(copiedTimer)
  forget(props.doctype, props.name, props.fieldname)
})

defineExpose({ toggleReveal })
</script>
