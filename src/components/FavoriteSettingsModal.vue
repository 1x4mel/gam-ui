<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="close">
    <div class="bg-app-surface border border-app-border rounded-xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col mx-4">
      <div class="p-4 border-b border-app-border flex justify-between items-center bg-app-bg/50">
        <h3 class="text-app-text-primary font-medium text-sm">Cấu hình mục yêu thích: {{ title }}</h3>
        <button @click="close" class="text-app-text-muted hover:text-app-text-primary transition">✕</button>
      </div>

      <div class="p-3 border-b border-app-border bg-app-surface">
        <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Tìm kiếm..."
              class="w-full bg-app-bg text-sm text-app-text-primary px-3 py-2 pl-8 rounded border border-app-border focus:border-indigo-500 outline-none transition"
            />
            <div class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <svg class="h-4 w-4 text-app-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
        </div>
      </div>

      <div class="p-2 max-h-64 overflow-y-auto space-y-1 flex-grow">
        <label
          v-for="opt in filteredOptions"
          :key="opt.value"
          class="flex items-center gap-3 p-2 rounded hover:bg-app-bg cursor-pointer transition select-none"
        >
          <input
            type="checkbox"
            :value="opt.value"
            v-model="tempSelected"
            class="h-4 w-4 text-indigo-600 rounded border-app-border bg-app-bg focus:ring-offset-app-surface focus:ring-indigo-500"
          >
          <span class="text-sm text-app-text-secondary" :class="tempSelected.includes(opt.value) ? 'text-app-text-primary font-medium' : ''">{{ opt.label }}</span>
        </label>
        <p v-if="filteredOptions.length === 0" class="text-xs text-app-text-muted text-center py-4">Không tìm thấy lựa chọn nào.</p>
      </div>

      <div class="p-4 border-t border-app-border bg-app-bg/30 flex gap-3">
        <AppButton variant="neutral" size="sm" class="flex-1" @click="close">Huỷ</AppButton>
        <AppButton variant="primary" size="sm" class="flex-1" @click="save">Lưu lại</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppButton from './AppButton.vue'

const props = defineProps({
  isOpen: Boolean,
  title: String,
  options: Array, // [{label, value}]
  initialSelected: Array // [value1, value2]
})

const emit = defineEmits(['close', 'save'])

const searchQuery = ref('')
const tempSelected = ref([])

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    searchQuery.value = ''
    tempSelected.value = [...(props.initialSelected || [])]
  }
})

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const q = searchQuery.value.toLowerCase()
  return props.options.filter(o => o.label.toLowerCase().includes(q))
})

function close() {
  emit('close')
}

function save() {
  emit('save', tempSelected.value)
  close()
}
</script>

