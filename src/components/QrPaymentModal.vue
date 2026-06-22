<template>
  <ModalWrapper v-model="open" size="xl" :z-index="100">
    <!-- Header -->
    <div class="bg-indigo-600 px-4 sm:px-10 py-5 sm:py-8 flex items-center justify-between shadow-lg shadow-indigo-600/20">
      <div class="flex items-center gap-6">
        <div class="w-10 h-10 sm:w-16 sm:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10 shadow-xl">
          <span class="text-2xl sm:text-4xl">🏦</span>
        </div>
        <div>
          <h3 class="text-base sm:text-2xl font-black text-white uppercase tracking-tighter leading-none">Thanh toán VietQR</h3>
          <p class="text-indigo-100 text-[10px] sm:text-xs mt-1 sm:mt-2 font-black opacity-90 tracking-widest uppercase">{{ order?.name }}</p>
        </div>
      </div>
      <button @click="open = false" class="text-white/60 hover:text-white transition-all bg-white/10 hover:bg-white/20 p-3 rounded-2xl">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <div class="p-4 sm:p-10">
      <div v-if="loading" class="py-24 flex flex-col items-center justify-center">
        <div class="animate-spin rounded-full h-14 w-14 border-4 border-indigo-600 border-t-transparent mb-6 shadow-lg shadow-indigo-600/10"></div>
        <p class="text-xs text-app-text-muted font-black uppercase tracking-[0.3em]">Đang tạo mã QR bảo mật...</p>
      </div>

      <div v-else class="flex flex-col lg:flex-row items-center lg:items-center gap-8 sm:gap-16">
        <!-- Left Column: QR Frame -->
        <div class="shrink-0 flex flex-col items-center w-full lg:w-auto">
          <div class="bg-white p-4 sm:p-6 shadow-[0_30px_70px_rgba(0,0,0,0.15)] border border-app-border relative group transition-all duration-500 hover:scale-[1.03] qrcode-container">
            <qrcode-vue :value="qrValue" :size="180" level="H" render-as="canvas" />
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-white/40 backdrop-blur-[2px] pointer-events-none">
              <div class="bg-indigo-600 text-white text-[10px] font-black px-6 py-2.5 rounded-full shadow-2xl tracking-[0.2em]">QUÉT AN TOÀN</div>
            </div>
          </div>

          <div class="mt-10 flex flex-col items-center w-full max-w-[260px]">
            <div class="text-[10px] text-app-text-muted font-black uppercase tracking-[0.3em] flex items-center gap-3 mb-6">
              <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]"></span>
              VIETQR • NAPAS 247
            </div>
            <slot name="qr-extra" />
          </div>
        </div>

        <!-- Right Column: Details Info -->
        <div class="flex-1 w-full lg:w-auto">
          <div class="space-y-8">
            <!-- Amount Header -->
            <div class="bg-indigo-600/[0.03] p-4 sm:p-8 rounded-xl sm:rounded-[2rem] border border-indigo-600/10 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-inner">
              <span class="text-[11px] text-app-text-muted font-black uppercase tracking-[0.2em] opacity-70">Số tiền quyết toán</span>
              <span class="text-2xl sm:text-4xl font-black text-indigo-600 font-mono tracking-tighter leading-none">{{ formatMoney(amount, props.order?.transaction_currency || 'VND') }}</span>
            </div>

            <!-- Details Grid -->
            <div class="grid grid-cols-2 gap-y-4 sm:gap-y-8 gap-x-4 sm:gap-x-10 px-0 sm:px-5">
              <div class="col-span-2">
                <InfoRow label="Chủ tài khoản hưởng thụ" :value="bankInfo?.account_holder || 'N/A'" label-class="opacity-60" value-class="text-xl font-black text-app-text-primary uppercase tracking-tight" />
              </div>
              <div class="col-span-1">
                <InfoRow label="Ngân hàng" :value="bankInfo?.bank_name || 'N/A'" label-class="opacity-60" value-class="text-sm font-black text-app-text-primary uppercase tracking-tight" />
              </div>
              <div class="col-span-1">
                <InfoRow label="Số tài khoản" :value="bankInfo?.account_number || 'N/A'" label-class="opacity-60" value-class="text-lg font-black text-app-text-primary font-mono tracking-widest" />
              </div>

              <div class="col-span-2 bg-app-bg/50 p-6 rounded-[2rem] border border-app-border shadow-inner">
                <span class="block text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-4 opacity-80 ml-2">Nội dung chuyển khoản</span>
                <div @click="copyDesc" class="bg-app-surface px-6 py-4 rounded-2xl border border-app-border shadow-sm flex items-center group/desc cursor-pointer hover:border-indigo-600/30 transition-all">
                  <span class="flex-1 text-[13px] font-black text-indigo-600 break-words leading-relaxed tracking-wider">{{ description }}</span>
                  <span class="text-[10px] font-bold uppercase tracking-widest ml-4 shrink-0 transition-colors" :class="copiedDesc ? 'text-emerald-500' : 'text-app-text-muted group-hover/desc:text-indigo-600'">{{ copiedDesc ? 'Đã copy' : 'Copy' }}</span>
                </div>
              </div>
            </div>

            <!-- Actions slot -->
            <slot name="actions" />
          </div>
        </div>
      </div>
    </div>
  </ModalWrapper>
</template>

<script setup>
import { computed, ref } from 'vue'
import QrcodeVue from 'qrcode.vue'
import ModalWrapper from './ModalWrapper.vue'
import InfoRow from './InfoRow.vue'
import { formatMoney } from '../utils/format.js'

const props = defineProps({
  open: Boolean,
  loading: Boolean,
  qrValue: String,
  order: Object,
  bankInfo: Object,
  description: String,
})

const emit = defineEmits(['update:open'])

const amount = computed(() => props.order?.total_vnd || props.order?.gross_sale_vnd)

const open = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const copiedDesc = ref(false)
function copyDesc() {
  const text = props.description || ''
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      copiedDesc.value = true
      setTimeout(() => { copiedDesc.value = false }, 1500)
    })
  } else {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copiedDesc.value = true
    setTimeout(() => { copiedDesc.value = false }, 1500)
  }
}
</script>
