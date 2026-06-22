<template>
  <div class="relative w-full" ref="containerRef">
    <div 
      class="flex items-center input-field cursor-text relative"
      @click="openDropdown"
      :class="{ 'ring-1 ring-indigo-500 border-indigo-500': isOpen, '!p-0': compact }"
    >
      <input
        ref="inputRef"
        type="text"
        v-model="searchQuery"
        :placeholder="displayPlaceholder"
        class="w-full bg-transparent outline-none text-app-text-primary px-3 py-2 text-sm"
        :class="{ '!py-1 !text-xs px-2': compact }"
        @focus="openDropdown"
        @keydown.down.prevent="navigateDown"
        @keydown.up.prevent="navigateUp"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.esc.prevent="closeDropdown"
        @keydown.tab="closeDropdown"
      />
      <div class="absolute right-2 flex items-center gap-1">
        <button v-if="clearable && modelValue" @mousedown.prevent="clearValue" class="w-4 h-4 flex items-center justify-center rounded-full bg-app-text-muted/30 hover:bg-app-text-muted/50 transition text-app-text-muted pointer-events-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div class="text-app-text-muted pointer-events-none">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
    </div>

    <!-- Dropdown with Teleport -->
    <Teleport to="body">
      <div 
        v-if="isOpen" 
        ref="dropdownRef"
        class="fixed z-[9999] bg-app-surface border border-app-border rounded-lg shadow-2xl max-h-60 overflow-y-auto dropdown-animation"
        :style="dropdownStyle"
      >
        <ul class="py-1 m-0 list-none p-0">
          <li v-if="asyncLoading" class="px-3 py-2 text-xs text-app-text-muted bg-app-surface">Đang tìm...</li>
          <li v-else-if="displayedOptions.length === 0" class="px-3 py-2 text-xs text-app-text-muted bg-app-surface">
            Không tìm thấy kết quả phù hợp
          </li>
          <li
            v-for="(opt, index) in displayedOptions"
            :key="opt.value"
            class="px-3 py-2 text-sm transition-none select-none"
            :class="[
              opt.disabled
                ? 'text-app-text-muted/40 cursor-not-allowed'
                : index === highlightedIndex ? 'bg-indigo-600 text-white cursor-pointer' : 'text-app-text-secondary hover:bg-app-bg bg-app-surface cursor-pointer',
              opt.value === modelValue && index !== highlightedIndex && !opt.disabled ? 'font-bold text-indigo-600' : ''
            ]"
            @mousedown.prevent="!opt.disabled && selectOption(opt)"
            @mouseover="!opt.disabled && (highlightedIndex = index)"
          >
            <span>{{ opt.label }}</span>
            <span v-if="opt.description" class="block text-[10px] opacity-60 truncate">{{ opt.description }}</span>
          </li>
          <li v-if="!asyncSearchFn && filteredOptions.length > 50" class="px-3 py-2 text-[10px] text-app-text-muted italic border-t border-app-border/30 bg-app-bg/10">
            Và {{ filteredOptions.length - 50 }} kết quả khác...
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { normalizeName } from '../utils/format.js'

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean],
    default: ''
  },
  options: {
    type: Array, // Expected: [{ label, value }]
    default: () => []
  },
  placeholder: {
    type: String,
    default: '-- Chọn --'
  },
  compact: {
    type: Boolean,
    default: false
  },
  clearable: {
    type: Boolean,
    default: false
  },
  searchFn: {
    type: Function,
    default: null
  },
  asyncSearchFn: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const searchQuery = ref('')
const highlightedIndex = ref(-1) // Khởi tạo là -1 để không có item nào bị highlight 'đen' khi vừa mở
const containerRef = ref(null)
const inputRef = ref(null)
const dropdownRef = ref(null)
const dropdownStyle = ref({
    top: '0px',
    left: '0px',
    width: '0px'
})

const asyncSelectedLabel = ref('')
const selectedLabel = computed(() => {
  const selected = props.options.find(o => String(o.value) === String(props.modelValue))
  if (selected) return selected.label
  if (props.asyncSearchFn && asyncSelectedLabel.value) return asyncSelectedLabel.value
  return ''
})

const displayPlaceholder = computed(() => {
  if (isOpen.value && selectedLabel.value) return selectedLabel.value
  return selectedLabel.value || props.placeholder
})

const asyncOptions = ref([])
const asyncLoading = ref(false)
let asyncTimer = null

const filteredOptions = computed(() => {
  if (props.asyncSearchFn) return asyncOptions.value
  if (!searchQuery.value) return props.options
  if (props.searchFn) return props.searchFn(searchQuery.value, props.options)
  const q = normalizeName(searchQuery.value)
  return props.options.filter(o => normalizeName(o.label).includes(q) || (o.description && normalizeName(o.description).includes(q)))
})

watch(searchQuery, (val) => {
  if (!props.asyncSearchFn || !isOpen.value) return
  clearTimeout(asyncTimer)
  asyncTimer = setTimeout(async () => {
    asyncLoading.value = true
    try {
      asyncOptions.value = await props.asyncSearchFn(val || '')
    } catch {
      asyncOptions.value = []
    } finally {
      asyncLoading.value = false
    }
  }, 300)
})

const displayedOptions = computed(() => {
    return props.asyncSearchFn ? filteredOptions.value : filteredOptions.value.slice(0, 50)
})

watch(isOpen, (val) => {
  if (val) {
    searchQuery.value = ''
    highlightedIndex.value = -1 // Reset highlight
    // Load initial async options
    if (props.asyncSearchFn) {
      asyncLoading.value = true
      props.asyncSearchFn('').then(r => { asyncOptions.value = r }).catch(() => {}).finally(() => { asyncLoading.value = false })
    }
    updateDropdownPosition()
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)
  } else {
    searchQuery.value = selectedLabel.value
    document.removeEventListener('mousedown', handleClickOutside)
    window.removeEventListener('scroll', updateDropdownPosition, true)
    window.removeEventListener('resize', updateDropdownPosition)
  }
})

let rafId = null
function updateDropdownPosition() {
    if (!containerRef.value || !isOpen.value) return
    
    if (rafId) cancelAnimationFrame(rafId)
    
    rafId = requestAnimationFrame(() => {
        const rect = containerRef.value.getBoundingClientRect()
        // Vì dropdown là 'fixed', tọa độ top/left phải khớp với rect của viewport
        // KHÔNG cộng window.scrollY/X vì như vậy sẽ khiến vị trí bị sai khi ở trong Modal
        dropdownStyle.value = {
            top: `${rect.bottom + 4}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            opacity: 1 // Đảm bảo hiện ra ngay
        }
    })
}

watch(() => props.modelValue, async (val) => {
  if (!isOpen.value) {
    if (props.asyncSearchFn && val && !props.options.length) {
      try {
        const results = await props.asyncSearchFn(val)
        const match = results?.find(o => String(o.value) === String(val))
        asyncSelectedLabel.value = match?.label || String(val)
      } catch { asyncSelectedLabel.value = String(val) }
    }
    searchQuery.value = selectedLabel.value
  }
})

onMounted(async () => {
  if (props.asyncSearchFn && props.modelValue && !props.options.length) {
    try {
      const results = await props.asyncSearchFn(String(props.modelValue))
      const match = results?.find(o => String(o.value) === String(props.modelValue))
      asyncSelectedLabel.value = match?.label || String(props.modelValue)
    } catch { asyncSelectedLabel.value = String(props.modelValue) }
  }
  searchQuery.value = selectedLabel.value
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('scroll', updateDropdownPosition, true)
  window.removeEventListener('resize', updateDropdownPosition)
})

function handleClickOutside(event) {
  if (containerRef.value && !containerRef.value.contains(event.target) && 
      dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    closeDropdown()
  }
}

function openDropdown() {
  if (!isOpen.value) {
    isOpen.value = true
    nextTick(() => {
        if(inputRef.value) inputRef.value.focus()
    })
  }
}

function closeDropdown() {
  if (isOpen.value) {
    isOpen.value = false
    searchQuery.value = selectedLabel.value
  }
}

function selectOption(opt) {
  asyncSelectedLabel.value = opt.label
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  closeDropdown()
}

function clearValue() {
  asyncSelectedLabel.value = ''
  emit('update:modelValue', '')
  emit('change', '')
}

function navigateDown() {
  if (!isOpen.value) {
    openDropdown()
    return
  }
  let next = highlightedIndex.value
  while (next < displayedOptions.value.length - 1) {
    next++
    if (!displayedOptions.value[next]?.disabled) { highlightedIndex.value = next; return }
  }
}

function navigateUp() {
  let prev = highlightedIndex.value
  while (prev > 0) {
    prev--
    if (!displayedOptions.value[prev]?.disabled) { highlightedIndex.value = prev; return }
  }
  highlightedIndex.value = -1
}

function selectHighlighted() {
  if (isOpen.value && displayedOptions.value[highlightedIndex.value]) {
    selectOption(displayedOptions.value[highlightedIndex.value])
  } else if (!isOpen.value) {
    openDropdown()
  }
}
</script>

<style scoped>
.dropdown-animation {
    animation: dropdownOpen 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform, opacity;
}

@keyframes dropdownOpen {
    from {
        opacity: 0;
        transform: translateY(-2px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

</style>
