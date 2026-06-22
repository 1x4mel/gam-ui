<template>
  <div class="space-y-6">
    <slot name="prepend" />

    <!-- Existing Evidence -->
    <div v-if="existingEvidence.length">
      <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-3 px-1 opacity-60">
        Bằng chứng đã tải ({{ existingEvidence.length }})
      </label>
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
        <div v-for="ev in existingEvidence" :key="ev.name"
          class="bg-app-bg border border-app-border rounded-xl overflow-hidden cursor-pointer group/exist hover:shadow-md transition-all"
          @click="$emit('preview', ev)">
          <div class="aspect-square bg-app-surface flex items-center justify-center relative overflow-hidden">
            <img v-if="isMediaImage(ev.attachment)" :src="ev.attachment" class="w-full h-full object-cover group-hover/exist:scale-110 transition duration-500" />
            <video v-else-if="isMediaVideo(ev.attachment)" :src="ev.attachment" class="w-full h-full object-cover" muted />
            <span v-else class="text-2xl">📄</span>
          </div>
          <div class="px-2 py-1.5 border-t border-app-border/30">
            <p class="text-[9px] text-app-text-muted font-medium truncate">{{ formatDate(ev.uploaded_at) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Drop Zone -->
    <div
      class="relative rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all duration-200 cursor-pointer"
      :class="isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-app-border hover:border-indigo-500/50 bg-app-bg/50'"
      @click="triggerFileInput"
      @dragover.prevent="isDragging = true"
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" ref="fileInputRef" :accept="accept" @change="onFileChange" multiple class="hidden" />
      <div class="pointer-events-none">
        <span class="text-3xl block mb-2">{{ isDragging ? '📥' : '📂' }}</span>
        <p class="text-app-text-primary text-xs font-bold">
          {{ isDragging ? 'Thả file vào đây' : 'Kéo thả file hoặc bấm để chọn' }}
        </p>
        <p class="text-app-text-muted text-[9px] mt-1 uppercase tracking-widest opacity-50">PNG, JPG, MP4 — tối đa 500MB</p>
      </div>
    </div>

    <!-- Selected Files List -->
    <div v-if="selectedFiles.length" class="space-y-1.5">
      <div v-for="(f, i) in selectedFiles" :key="i"
        class="flex items-center gap-2.5 bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-xs">
        <!-- File preview thumbnail -->
        <div class="w-10 h-10 rounded-lg overflow-hidden bg-app-bg border border-app-border/50 shrink-0 flex items-center justify-center">
          <img v-if="isImageFile(f)" :src="objectUrl(f)" class="w-full h-full object-cover" />
          <span v-else-if="isVideoFile(f)" class="text-lg">🎬</span>
          <span v-else class="text-lg">📄</span>
        </div>
        <div class="flex-1 min-w-0">
          <span class="text-app-text-primary truncate block font-medium">{{ f.name }}</span>
          <span class="text-app-text-muted/50 text-[10px]">{{ formatSize(f.size) }} · {{ extOf(f.name).toUpperCase() }}</span>
        </div>
        <button @click="removeFile(i)" class="text-red-400 hover:text-red-300 shrink-0 ml-1">✕</button>
      </div>
    </div>

    <!-- Note -->
    <div>
      <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-3 px-1 opacity-60">Ghi chú thêm</label>
      <textarea v-model="localNote" placeholder="Thêm ghi chú cho bằng chứng..."
        class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-4 text-app-text-primary text-sm font-medium resize-none outline-none focus:border-indigo-600 min-h-[100px]" rows="3"></textarea>
    </div>

    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
    <div class="flex flex-wrap gap-3 sm:gap-4">
      <AppButton variant="neutral" size="lg" class="flex-1" @click="$emit('cancel')">Quay lại</AppButton>
      <AppButton variant="primary" size="lg" class="flex-[2]" :loading="uploading" :disabled="uploading || !selectedFiles.length" @click="handleSubmit">Xác nhận ({{ selectedFiles.length }})</AppButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import AppButton from './AppButton.vue'
import { formatDate } from '../utils/format.js'

const props = defineProps({
  uploading: Boolean,
  error: String,
  accept: { type: String, default: 'image/*,video/*' },
  existingEvidence: { type: Array, default: () => [] },
})

const emit = defineEmits(['submit', 'cancel', 'preview'])

const localNote = ref('')
const fileInputRef = ref(null)
const selectedFiles = ref([])
const isDragging = ref(false)

const objectUrls = new Map()

function objectUrl(f) {
  if (!objectUrls.has(f)) {
    objectUrls.set(f, URL.createObjectURL(f))
  }
  return objectUrls.get(f)
}

function extOf(name) {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop() : ''
}

function isImageFile(f) {
  return f.type.startsWith('image/')
}

function isVideoFile(f) {
  return f.type.startsWith('video/')
}

function isMediaImage(url) {
  return /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url || '')
}

function isMediaVideo(url) {
  return /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(url || '')
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function addFiles(files) {
  const newFiles = Array.from(files)
  newFiles.forEach(f => {
    if (!selectedFiles.value.find(sf => sf.name === f.name && sf.size === f.size)) {
      selectedFiles.value.push(f)
    }
  })
}

function onFileChange() {
  const input = fileInputRef.value
  if (!input?.files) return
  addFiles(input.files)
  input.value = ''
}

function onDrop(e) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files || !files.length) return
  addFiles(files)
}

function removeFile(idx) {
  const removed = selectedFiles.value.splice(idx, 1)[0]
  if (removed && objectUrls.has(removed)) {
    URL.revokeObjectURL(objectUrls.get(removed))
    objectUrls.delete(removed)
  }
}

function handleSubmit() {
  if (!selectedFiles.value.length) return
  emit('submit', { files: selectedFiles.value, note: localNote.value })
}

function reset() {
  localNote.value = ''
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

defineExpose({ reset, addFiles })
</script>
