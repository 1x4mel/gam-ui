<template>
  <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" @click.self="close">
    <div class="bg-app-surface border border-app-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
      <!-- Header -->
      <div class="px-5 py-3 border-b border-app-border flex justify-between items-center bg-app-bg/50">
        <h3 class="text-app-text-primary font-bold text-sm">Quét QR ngân hàng</h3>
        <button @click="close" class="text-app-text-muted hover:text-app-text-primary transition p-1.5 hover:bg-app-bg rounded-lg text-lg">✕</button>
      </div>

      <!-- Camera view -->
      <div v-if="mode === 'camera'" class="relative bg-black">
        <video ref="videoEl" autoplay playsinline muted class="w-full aspect-square object-cover" />
        <!-- Scanning overlay -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="w-56 h-56 border-2 border-indigo-400/60 rounded-2xl">
            <div class="w-6 h-6 border-t-2 border-l-2 border-indigo-400 rounded-tl-xl" />
          </div>
        </div>
        <div v-if="cameraLoading" class="absolute inset-0 flex items-center justify-center bg-black/60">
          <span class="text-white text-xs font-bold">Đang bật camera...</span>
        </div>
        <div v-if="cameraError" class="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
          <div>
            <p class="text-red-400 text-xs font-bold mb-2">{{ cameraError }}</p>
            <button @click="mode = 'upload'" class="text-indigo-400 text-xs font-bold">Tải ảnh lên thay</button>
          </div>
        </div>
      </div>

      <!-- Upload view -->
      <div v-if="mode === 'upload'" class="p-5">
        <div v-if="!loading && !error && !result"
          @click="triggerFileInput" @dragover.prevent @drop.prevent="onDrop"
          class="border-2 border-dashed border-app-border rounded-xl p-6 text-center cursor-pointer hover:border-indigo-500/50 transition-colors">
          <div class="text-3xl mb-2 opacity-60">📷</div>
          <p class="text-app-text-secondary text-sm font-bold mb-0.5">Chụp hoặc tải ảnh QR</p>
          <p class="text-app-text-muted text-[11px]">Nhấn để chọn ảnh (JPG, PNG)</p>
        </div>

        <!-- Preview -->
        <div v-if="previewUrl && !result" class="relative">
          <img :src="previewUrl" class="w-full rounded-xl border border-app-border" />
          <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
            <span class="text-white text-xs font-bold">Đang nhận diện...</span>
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p class="text-red-400 text-xs font-bold">{{ error }}</p>
          <button @click="reset" class="mt-2 text-indigo-500 text-xs font-bold">Thử lại</button>
        </div>
      </div>

      <!-- Detected result flash -->
      <div v-if="result" class="px-5 py-3 bg-emerald-500/10 border-t border-emerald-500/20">
        <div class="flex items-center gap-2">
          <span class="text-emerald-500 text-sm">✓</span>
          <span v-if="result.provider" class="text-emerald-600 text-xs font-bold">{{ result.provider }}</span>
          <span class="text-app-text-primary text-xs font-bold">{{ result.accountNumber }}</span>
          <span v-if="result.bankName" class="text-app-text-muted text-[10px]">· {{ result.bankName }}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-app-border bg-app-bg/50 flex gap-2">
        <button @click="close" class="flex-1 px-3 py-2 rounded-lg border border-app-border text-app-text-muted text-xs font-bold hover:bg-app-bg transition">Huỷ</button>
        <button v-if="mode === 'camera'" @click="stopCamera(); mode = 'upload'" class="px-3 py-2 rounded-lg border border-app-border text-app-text-muted text-xs font-bold hover:bg-app-bg transition">📁 Ảnh</button>
        <button v-if="mode === 'upload' && hasCamera" @click="startCamera" class="px-3 py-2 rounded-lg border border-app-border text-app-text-muted text-xs font-bold hover:bg-app-bg transition">📷 Camera</button>
        <button v-if="result" @click="apply" class="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition">Áp dụng</button>
      </div>

      <input ref="fileInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onFileSelected" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { prepareZXingModule, readBarcodesFromImageData, readBarcodesFromImageFile } from 'zxing-wasm/reader'
import { decodeVietQR } from '../utils/vietqr.js'

const props = defineProps({ isOpen: Boolean })
const emit = defineEmits(['close', 'scanned'])

let wasmReady = false
async function initWasm() {
  if (!wasmReady) {
    await prepareZXingModule({
      locateFile: (file) => `/${file}`
    })
    wasmReady = true
  }
}

const videoEl = ref(null)
const fileInput = ref(null)
const previewUrl = ref(null)
const loading = ref(false)
const error = ref(null)
const result = ref(null)
const mode = ref('upload')
const cameraLoading = ref(false)
const cameraError = ref(null)
const hasCamera = ref(false)

let stream = null
let scanRAF = null

watch(() => props.isOpen, (open) => {
  if (open) {
    reset()
    checkCamera()
  } else {
    stopCamera()
  }
})

onUnmounted(stopCamera)

async function checkCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      hasCamera.value = false
      return
    }
    hasCamera.value = (await navigator.mediaDevices.enumerateDevices()).some(d => d.kind === 'videoinput')
  } catch {
    hasCamera.value = false
  }
}

async function startCamera() {
  mode.value = 'camera'
  cameraLoading.value = true
  cameraError.value = null
  stopCamera()

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
    })
    if (videoEl.value) {
      videoEl.value.srcObject = stream
      await videoEl.value.play()
    }
    cameraLoading.value = false
    startScanning()
  } catch (e) {
    cameraLoading.value = false
    if (e.name === 'NotAllowedError') {
      cameraError.value = 'Camera bị từ chối. Cho phép truy cập camera hoặc dùng ảnh.'
    } else if (e.name === 'NotFoundError') {
      cameraError.value = 'Không tìm thấy camera.'
      hasCamera.value = false
    } else {
      cameraError.value = 'Không thể mở camera. Thử tải ảnh lên.'
    }
  }
}

function stopCamera() {
  if (scanRAF) {
    cancelAnimationFrame(scanRAF)
    scanRAF = null
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
}

function startScanning() {
  const video = videoEl.value
  if (!video || !stream) return

  const canvas = document.createElement('canvas')

  async function tick() {
    if (!stream || result.value) return
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        await initWasm()
        const codes = await readBarcodesFromImageData(imageData, { formats: ['QRCode'] })
        if (codes.length > 0 && codes[0].text) {
          console.log('[QR raw]', codes[0].text)
          const parsed = decodeVietQR(codes[0].text)
          console.log('[QR parsed]', JSON.stringify(parsed))
          if (parsed.bankBin || parsed.accountNumber) {
            result.value = parsed
            setTimeout(() => apply(), 600)
            return
          }
        }
      } catch { /* scan frame failed, continue */ }
    }
    scanRAF = requestAnimationFrame(tick)
  }
  scanRAF = requestAnimationFrame(tick)
}

function reset() {
  previewUrl.value = null
  loading.value = false
  error.value = null
  result.value = null
  cameraError.value = null
  cameraLoading.value = false
}

function triggerFileInput() {
  fileInput.value?.click()
}

function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (file) processFile(file)
  e.target.value = ''
}

function onDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) processFile(file)
}

async function processFile(file) {
  reset()
  loading.value = true
  previewUrl.value = URL.createObjectURL(file)
  try {
    await initWasm()
    const codes = await readBarcodesFromImageFile(file, { formats: ['QRCode'] })
    loading.value = false
    if (codes.length > 0 && codes[0].text) {
      console.log('[QR raw]', codes[0].text)
      const parsed = decodeVietQR(codes[0].text)
      console.log('[QR parsed]', JSON.stringify(parsed))
      if (parsed.bankBin || parsed.accountNumber) {
        result.value = parsed
        return
      }
      error.value = 'Không tìm thấy thông tin ngân hàng trong mã QR'
    } else {
      error.value = 'Không nhận diện được mã QR'
    }
  } catch {
    loading.value = false
    error.value = 'Không nhận diện được mã QR'
  }
}

function apply() {
  if (result.value) {
    emit('scanned', result.value)
    close()
  }
}

function close() {
  stopCamera()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  emit('close')
}
</script>
