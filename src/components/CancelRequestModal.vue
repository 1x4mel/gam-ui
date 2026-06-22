<template>
  <div class="space-y-5">
    <!-- Reason -->
    <div>
      <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2 px-1 opacity-60">Lý do hủy <span class="text-red-400">*</span></label>
      <textarea v-model="reason" placeholder="Nhập lý do hủy đơn hàng..."
        class="w-full bg-app-surface border border-app-border rounded-2xl px-4 py-3 text-app-text-primary text-sm font-medium resize-none outline-none focus:border-red-500 min-h-[80px]" rows="3"></textarea>
    </div>

    <!-- Optional Evidence -->
    <div>
      <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2 px-1 opacity-60">Bằng chứng (tùy chọn)</label>
      <div
        class="relative rounded-xl border-2 border-dashed p-4 text-center transition-all duration-200 cursor-pointer"
        :class="isDragging ? 'border-red-500 bg-red-500/10' : 'border-app-border hover:border-red-500/50 bg-app-bg/50'"
        @click="triggerFileInput"
        @dragover.prevent="isDragging = true"
        @dragenter.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
      >
        <input type="file" ref="fileInputRef" accept="image/*,video/*" @change="onFileChange" multiple class="hidden" />
        <div class="pointer-events-none">
          <span class="text-xl block mb-1">{{ isDragging ? '📥' : '📎' }}</span>
          <p class="text-app-text-primary text-[11px] font-bold">{{ isDragging ? 'Thả file vào đây' : 'Kéo thả hoặc bấm chọn' }}</p>
        </div>
      </div>

      <!-- Selected Files -->
      <div v-if="selectedFiles.length" class="mt-2 space-y-1">
        <div v-for="(f, i) in selectedFiles" :key="i"
          class="flex items-center gap-2 bg-app-surface/60 border border-app-border/50 rounded-lg px-2.5 py-1.5 text-xs">
          <div class="w-8 h-8 rounded overflow-hidden bg-app-bg border border-app-border/50 shrink-0 flex items-center justify-center">
            <img v-if="f.type.startsWith('image/')" :src="objectUrl(f)" class="w-full h-full object-cover" />
            <span v-else-if="f.type.startsWith('video/')" class="text-sm">🎬</span>
            <span v-else class="text-sm">📄</span>
          </div>
          <span class="text-app-text-primary truncate flex-1 font-medium">{{ f.name }}</span>
          <span class="text-app-text-muted/50 shrink-0 text-[10px]">{{ formatSize(f.size) }}</span>
          <button @click="removeFile(i)" class="text-red-400 hover:text-red-300 shrink-0">✕</button>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-3">
      <AppButton variant="neutral" size="lg" class="flex-1" @click="$emit('cancel')">Xem lại</AppButton>
      <AppButton variant="danger" size="lg" class="flex-[2]" :disabled="!reason.trim()" @click="handleSubmit">Gửi yêu cầu hủy</AppButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import AppButton from './AppButton.vue'

const emit = defineEmits(['confirm', 'cancel'])

const reason = ref('')
const fileInputRef = ref(null)
const selectedFiles = ref([])
const isDragging = ref(false)
const objectUrls = new Map()

function objectUrl(f) {
  if (!objectUrls.has(f)) objectUrls.set(f, URL.createObjectURL(f))
  return objectUrls.get(f)
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

function triggerFileInput() { fileInputRef.value?.click() }

function onFileChange() {
  const input = fileInputRef.value
  if (!input?.files) return
  addFiles(input.files)
  input.value = ''
}

function onDrop(e) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files?.length) return
  addFiles(files)
}

function addFiles(files) {
  Array.from(files).forEach(f => {
    if (!selectedFiles.value.find(sf => sf.name === f.name && sf.size === f.size)) {
      selectedFiles.value.push(f)
    }
  })
}

function removeFile(idx) {
  const removed = selectedFiles.value.splice(idx, 1)[0]
  if (removed && objectUrls.has(removed)) {
    URL.revokeObjectURL(objectUrls.get(removed))
    objectUrls.delete(removed)
  }
}

function handleSubmit() {
  if (!reason.value.trim()) return
  emit('confirm', { reason: reason.value.trim(), files: [...selectedFiles.value] })
}

function reset() {
  reason.value = ''
  objectUrls.forEach(url => URL.revokeObjectURL(url))
  objectUrls.clear()
  selectedFiles.value = []
  isDragging.value = false
  if (fileInputRef.value) fileInputRef.value.value = ''
}

onUnmounted(() => {
  objectUrls.forEach(url => URL.revokeObjectURL(url))
  objectUrls.clear()
})

defineExpose({ reset })
</script>
