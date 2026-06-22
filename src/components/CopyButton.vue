<template>
  <button
    @click.stop="handleCopy"
    class="shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all active:scale-95"
    :class="copied
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
      : 'bg-app-bg/50 text-app-text-secondary border-app-border hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/30'"
  >
    {{ copied ? '✓ Đã copy' : 'Copy' }}
  </button>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  text: { type: String, required: true },
  title: { type: String, default: 'Copy' },
  colorClass: { type: String, default: 'text-indigo-600' },
  copiedColorClass: { type: String, default: 'text-emerald-600 bg-emerald-50!' },
})

const copied = ref(false)
let timer = null

function handleCopy() {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(props.text)
  } else {
    const ta = document.createElement('textarea')
    ta.value = props.text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => { copied.value = false }, 1500)
}
</script>
