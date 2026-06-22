<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center animate-in fade-in duration-300"
    @click.self="close"
  >
    <!-- Top-right buttons -->
    <div class="absolute top-4 right-4 flex gap-2 z-10">
      <a
        v-if="showExternalLink && item?.attachment"
        :href="item.attachment"
        target="_blank"
        class="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md"
        @click.stop
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
      </a>
      <button
        @click="close"
        class="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <!-- Image -->
    <img
      v-if="item && isImage(item.attachment)"
      :src="item.attachment"
      :style="showPanZoom ? imgStyle : {}"
      class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
      :class="showPanZoom ? 'pointer-events-none select-none' : ''"
      @click.stop
    />

    <!-- Video -->
    <video
      v-else-if="item && isVideo(item.attachment)"
      :src="item.attachment"
      controls
      autoplay
      class="max-w-[90vw] max-h-[90vh] rounded-lg"
      @click.stop
    />

    <!-- Pan/Zoom controls (PaymentView QR) -->
    <div
      v-if="showPanZoom"
      class="absolute top-4 left-4 right-16 flex flex-col items-center gap-2 bg-app-surface/80 backdrop-blur px-4 py-3 rounded-2xl border border-app-border shadow-2xl z-20"
      @click.stop
    >
      <span class="text-[10px] text-app-text-muted font-black uppercase tracking-widest italic">🔍 Kéo thanh để phóng to</span>
      <div class="flex items-center gap-4 w-full px-2">
        <span class="text-[10px] font-bold text-app-text-muted">1.0x</span>
        <input
          type="range"
          v-model="zoom"
          min="1"
          max="4"
          step="0.1"
          class="flex-1 accent-indigo-600 h-1 bg-app-bg rounded-lg appearance-none cursor-pointer"
        />
        <span class="text-[10px] font-bold text-indigo-600">{{ zoom }}x</span>
      </div>
    </div>

    <!-- Pan drag area (wraps the image when showPanZoom is true) -->
    <div
      v-if="showPanZoom && item && isImage(item.attachment)"
      class="absolute inset-0 cursor-move z-[5]"
      @mousedown="startPan"
      @mousemove="doPan"
      @mouseup="stopPan"
      @mouseleave="stopPan"
    ></div>

    <!-- Bottom bar -->
    <div
      v-if="item && (item.note || showDownload)"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-app-surface/80 backdrop-blur px-4 py-3 rounded-2xl border border-app-border shadow-2xl"
      @click.stop
    >
      <span v-if="item.note" class="text-app-text-secondary text-xs truncate max-w-48">{{ item.note }}</span>
      <a
        v-if="showDownload && item.attachment"
        :href="item.attachment"
        download
        class="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
      >
        Tải về
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { isImage, isVideo } from '../utils/format.js'

const props = defineProps({
  open: Boolean,
  item: Object,
  showDownload: { type: Boolean, default: true },
  showPanZoom: { type: Boolean, default: false },
  showExternalLink: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open'])

// Pan/zoom state
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const startCoords = ref({ x: 0, y: 0 })

const imgStyle = computed(() => ({
  transform: `scale(${zoom.value}) translate(${pan.value.x / zoom.value}px, ${pan.value.y / zoom.value}px)`,
  transition: isPanning.value ? 'none' : 'transform 0.3s ease-out',
}))

function close() {
  emit('update:open', false)
}

function startPan(e) {
  if (zoom.value <= 1) return
  isPanning.value = true
  startCoords.value = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y }
}

function doPan(e) {
  if (!isPanning.value) return
  pan.value = { x: e.clientX - startCoords.value.x, y: e.clientY - startCoords.value.y }
}

function stopPan() {
  isPanning.value = false
}

// Reset pan/zoom when closing
watch(() => props.open, (val) => {
  if (!val) {
    zoom.value = 1
    pan.value = { x: 0, y: 0 }
  }
})
</script>
