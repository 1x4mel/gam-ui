<template>
  <input
    ref="inputRef"
    type="text"
    inputmode="decimal"
    :value="formatted"
    :placeholder="placeholder"
    :class="inputClass"
    :min="min"
    :max="max"
    :disabled="disabled"
    @focus="onFocus"
    @blur="onBlur"
    @input="onInput"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [Number, String], default: '' },
  placeholder: { type: String, default: '0' },
  inputClass: { type: String, default: '' },
  min: { type: Number, default: undefined },
  max: { type: Number, default: undefined },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const inputRef = ref(null)
const focused = ref(false)
const rawText = ref('')

const formatted = computed(() => {
  if (focused.value) return rawText.value || ''
  if (props.modelValue == null || props.modelValue === '') return ''
  return formatNumber(props.modelValue)
})

watch(() => props.modelValue, (v) => {
  if (!focused.value) return
  rawText.value = v != null && v !== '' ? String(v) : ''
})

function onFocus() {
  focused.value = true
  rawText.value = props.modelValue != null && props.modelValue !== '' ? String(props.modelValue) : ''
}

function onBlur() {
  focused.value = false
  const num = parseLocal(rawText.value)
  emit('update:modelValue', num)
}

function onInput(e) {
  const raw = e.target.value
  const cleaned = raw.replace(/[^0-9.,\-]/g, '')
  rawText.value = cleaned
  const num = parseLocal(cleaned)
  emit('update:modelValue', num)
}

function parseLocal(s) {
  if (!s || s === '-' || s === '.' || s === ',') return 0
  // Split on last "." or "," — that's the decimal separator
  // Everything before: thousand-separator dots removed, then parsed as integer
  // Everything after: decimal part
  const match = s.match(/^(.*?)[.,]([0-9]*)$/)
  if (match) {
    const intRaw = match[1].replace(/\./g, '').replace(/,/g, '')
    const decRaw = match[2]
    const n = Number(intRaw + '.' + decRaw)
    return isNaN(n) ? 0 : n
  }
  // No decimal separator — just remove all dots/commas (thousand separators)
  const normalized = s.replace(/[.,]/g, '')
  const n = Number(normalized)
  return isNaN(n) ? 0 : n
}

function formatNumber(n) {
  if (n == null || n === '') return ''
  const str = String(n)
  const parts = str.split('.')
  // Format integer part with dots
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (parts.length > 1) {
    return intPart + ',' + parts[1]
  }
  return intPart
}
</script>
