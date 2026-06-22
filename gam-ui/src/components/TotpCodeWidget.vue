<template>
  <div class="flex flex-col gap-1.5">
    <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30">{{ label }}</p>

    <template v-if="!hasValue">
      <span class="text-app-text-muted text-sm italic">Không có 2FA</span>
    </template>

    <template v-else>
      <!-- Locked: require an explicit (audited) reveal before generating codes -->
      <div v-if="!revealed" class="flex items-center gap-2">
        <span class="text-app-text-primary text-sm font-black tracking-tight">••••••</span>
        <button
          @click="startReveal"
          :disabled="loading"
          class="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/20 transition active:scale-95 disabled:opacity-50"
        >
          <span v-if="loading" class="inline-block align-middle w-3 h-3 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></span>
          <span v-else>🔐 Hiện mã TOTP</span>
        </button>
        <p v-if="error" class="text-[10px] text-red-500 font-medium ml-1">{{ error }}</p>
      </div>

      <!-- Unlocked: live 6-digit code + countdown -->
      <div v-else class="flex flex-col gap-2">
        <div class="flex items-center gap-3 flex-wrap">
          <code
            class="text-2xl font-black font-mono tracking-[0.2em] text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-xl select-all"
          >{{ code || '·'.repeat(digits) }}</code>

          <button
            @click="handleCopy"
            :disabled="!code"
            title="Copy mã"
            class="px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition active:scale-95 disabled:opacity-40"
            :class="justCopied
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
              : 'bg-app-bg/50 text-app-text-secondary border-app-border hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/30'"
          >
            {{ justCopied ? '✓' : '📋 Copy' }}
          </button>

          <button
            @click="hide"
            title="Ẩn"
            class="ml-auto w-7 h-7 flex items-center justify-center rounded-lg border bg-app-bg/50 text-app-text-secondary border-app-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition active:scale-95"
          >
            🙈
          </button>
        </div>

        <!-- Countdown progress bar -->
        <div class="flex items-center gap-2">
          <div class="flex-1 h-1 rounded-full bg-app-border overflow-hidden">
            <div
              class="h-full rounded-full transition-[width] duration-1000 ease-linear"
              :class="progress < 0.25 ? 'bg-red-500' : 'bg-indigo-500'"
              :style="{ width: (progress * 100) + '%' }"
            ></div>
          </div>
          <span class="text-[10px] text-app-text-muted font-mono w-12 text-right">{{ secondsLeft }}s</span>
        </div>

        <p v-if="error" class="text-[10px] text-red-500 font-medium">{{ error }}</p>
        <p v-else class="text-[10px] text-app-text-muted">Mã làm mới sau mỗi {{ period }} giây.</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useRevealPassword } from '../composables/useRevealPassword.js'
import { useTotpCode } from '../composables/useTotpCode.js'

const props = defineProps({
  /** GAM DocType name, e.g. "GAM Account". */
  doctype: { type: String, required: true },
  /** Doc name. */
  name: { type: String, required: true },
  /** Password fieldname holding the TOTP secret. */
  fieldname: { type: String, default: 'totp_secret' },
  label: { type: String, default: '2FA / Mã TOTP' },
  /** Whether a secret is stored (controls reveal availability). */
  hasValue: { type: Boolean, default: true },
  /** TOTP time-step + length (RFC 6238 defaults). */
  period: { type: Number, default: 30 },
  digits: { type: Number, default: 6 },
})

const { reveal, forget } = useRevealPassword()
const totp = useTotpCode(
  () => reveal(props.doctype, props.name, props.fieldname),
  { period: props.period, digits: props.digits },
)

const { code, secondsLeft, progress, loading, error } = totp

const revealed = ref(false)
const justCopied = ref(false)
let copyTimer = null

function startReveal() {
  revealed.value = true
  totp.start()
}

function hide() {
  revealed.value = false
  totp.reset()
  forget(props.doctype, props.name, props.fieldname)
}

async function handleCopy() {
  if (!code.value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code.value)
    } else {
      const ta = document.createElement('textarea')
      ta.value = code.value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    justCopied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { justCopied.value = false }, 1500)
  } catch {
    /* clipboard blocked — ignore */
  }
}

// Reset everything when the target account/field changes.
watch(() => [props.doctype, props.name, props.fieldname], hide)

onUnmounted(() => {
  clearTimeout(copyTimer)
  totp.stop()
  forget(props.doctype, props.name, props.fieldname)
})
</script>
