<template>
  <button
    :class="['relative overflow-hidden transition-all duration-200 active:scale-95', variantClasses, sizeClasses]"
    :disabled="disabled || loading"
  >
    <span :class="{ 'opacity-0': loading }"><slot /></span>
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  pill: { type: Boolean, default: false },
})

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50',
  orange: 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20 disabled:opacity-50',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50',
  warning: 'bg-yellow-600 text-white hover:bg-yellow-500 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-50',
  ghost: 'bg-app-surface hover:bg-indigo-500/10 text-app-text-secondary hover:text-indigo-600 border border-app-border shadow-sm disabled:opacity-50',
  'danger-ghost': 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 disabled:opacity-50',
  'warning-ghost': 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 border border-yellow-500/20 disabled:opacity-50',
  'success-ghost': 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 disabled:opacity-50',
  neutral: 'bg-app-surface border border-app-border text-app-text-muted hover:text-app-text-primary disabled:opacity-50',
}

const sizes = {
  xs: 'px-3 py-1.5 text-[11px] font-medium rounded',
  sm: 'px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl',
  md: 'px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-2xl',
  lg: 'px-8 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-2xl',
}

const variantClasses = computed(() => variants[props.variant] || variants.primary)
const sizeClasses = computed(() => {
  const base = sizes[props.size] || sizes.md
  return props.pill ? base.replace(/rounded-\S+/, 'rounded-full') : base
})
</script>
