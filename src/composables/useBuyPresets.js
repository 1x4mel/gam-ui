import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'trader1_buy_presets'

function generateId() {
  return 'preset_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export function useBuyPresets() {
  let initial = []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) initial = JSON.parse(raw)
  } catch { /* corrupt data — ignore */ }

  const presets = ref(initial)

  const defaultPreset = computed(() => presets.value.find(p => p.is_default) || null)

  watch(presets, (newVal) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal))
  }, { deep: true })

  function savePreset(data) {
    const idx = presets.value.findIndex(p => p.id === data.id)
    if (idx >= 0) {
      presets.value[idx] = { ...presets.value[idx], ...data }
    } else {
      presets.value.push({ id: generateId(), ...data })
    }
  }

  function deletePreset(id) {
    presets.value = presets.value.filter(p => p.id !== id)
  }

  function setDefault(id) {
    presets.value.forEach(p => { p.is_default = p.id === id })
  }

  return { presets, defaultPreset, savePreset, deletePreset, setDefault }
}
