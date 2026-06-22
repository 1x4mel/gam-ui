<template>
  <DetailPageLayout :loading="loading" loading-text="Đang tải chuyển đổi...">
    <template #toolbar>
      <BackButton @click="$router.back()" />
    </template>
    <template #default v-if="doc">
      <div class="max-w-4xl mx-auto px-4 pb-8 space-y-4">
        <!-- Header -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-5 mb-4 shadow-sm">
          <div class="flex flex-wrap items-center gap-3 mb-3">
            <span :class="[statusColor(doc.status), 'text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg border border-current/10']">{{ doc.status }}</span>
            <span class="text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 border border-current/10">{{ conversionType(doc.conversion_type) }}</span>
            <span class="text-app-text-muted text-xs font-mono">{{ doc.name }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs text-app-text-muted">
            <span>{{ formatDate(doc.conversion_date) }}</span>
            <span v-if="doc.game_account">TK: <b class="text-app-text-primary">{{ doc.game_account }}</b></span>
            <span v-if="doc.game_context">{{ contextLabel(doc.game_context) }}</span>
          </div>
        </div>

        <!-- Consumed items -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-5 mb-4 shadow-sm">
          <h3 class="text-sm font-bold text-app-text-primary mb-3">📥 Hàng tiêu hao</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead><tr class="border-b border-app-border">
                <th class="text-left py-2 px-2 text-app-text-muted">Mặt hàng</th>
                <th class="text-right py-2 px-2 text-app-text-muted">SL</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Đơn giá</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Tổng giá</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Giá vốn</th>
                <th class="text-left py-2 px-2 text-app-text-muted">Lot</th>
              </tr></thead>
              <tbody>
                <tr v-for="item in doc.items_in_consumed" :key="item.name" class="border-b border-app-border/50 hover:bg-app-bg/50">
                  <td class="py-2 px-2 font-bold text-app-text-primary">{{ itemName(item.currency_item) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-red-600 font-bold">-{{ formatQty(item.qty) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-muted">{{ formatMoney(item.market_value_per_unit, doc.output_currency) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-secondary">{{ formatMoney(item.market_value_total, doc.output_currency) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-muted">{{ formatMoney(item.cost_native, item.native_currency) }}</td>
                  <td class="py-2 px-2 text-app-text-muted font-mono text-[10px]">{{ item.lot || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="text-right text-xs text-app-text-muted mt-2 font-bold"> Tổng giá trị vào: {{ formatMoney(doc.total_value_in_market, doc.output_currency) }}</div>
        </div>

        <!-- Output items -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-5 mb-4 shadow-sm">
          <h3 class="text-sm font-bold text-app-text-primary mb-3">📤 Hàng đầu ra</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead><tr class="border-b border-app-border">
                <th class="text-left py-2 px-2 text-app-text-muted">Mặt hàng</th>
                <th class="text-right py-2 px-2 text-app-text-muted">SL</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Đơn giá</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Tổng giá</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Giá vốn</th>
                <th class="text-left py-2 px-2 text-app-text-muted">Lot</th>
              </tr></thead>
              <tbody>
                <tr v-for="item in doc.items_out_final" :key="item.name" class="border-b border-app-border/50 hover:bg-app-bg/50">
                  <td class="py-2 px-2 font-bold text-app-text-primary">{{ itemName(item.currency_item) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-emerald-600 font-bold">+{{ formatQty(item.qty) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-muted">{{ formatMoney(item.market_value_per_unit, doc.output_currency) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-secondary">{{ formatMoney(item.market_value_total, doc.output_currency) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-muted">{{ formatMoney(item.cost_native, item.native_currency) }}</td>
                  <td class="py-2 px-2 text-app-text-muted font-mono text-[10px]">{{ item.lot || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="text-right text-xs text-app-text-muted mt-2 font-bold"> Tổng giá trị ra: {{ formatMoney(doc.total_value_out_market, doc.output_currency) }}</div>
        </div>

        <!-- Summary -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-5 mb-4 shadow-sm">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-1 opacity-50">Giá vốn (TC)</p>
              <p class="text-app-text-primary font-bold font-mono">{{ formatMoney(doc.total_cost_output_currency, doc.output_currency) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-1 opacity-50">Người thực hiện</p>
              <p class="text-app-text-primary font-bold">{{ userName(doc.executed_by) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-1 opacity-50">Ngày submit</p>
              <p class="text-app-text-primary font-bold">{{ doc.submitted_at ? formatDate(doc.submitted_at) : '—' }}</p>
            </div>
          </div>
          <div v-if="doc.cancelled_at" class="mt-3 pt-3 border-t border-app-border">
            <p class="text-xs text-red-500"><b>Đã hủy:</b> {{ formatDate(doc.cancelled_at) }}</p>
            <p v-if="doc.cancellation_reason" class="text-xs text-red-400 mt-1 italic">{{ doc.cancellation_reason }}</p>
          </div>
        </div>

        <!-- Evidence -->
        <div v-if="evidence.length || doc.status !== 'Submitted'" class="bg-app-surface border border-app-border rounded-2xl p-5 mb-4 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-app-text-primary">📸 Bằng chứng</h3>
            <AppButton v-if="doc.status === 'Submitted' ? false : true" variant="info" size="sm" :loading="uploading" :disabled="uploading" @click="uploadEvidence"> + Thêm ảnh </AppButton>
          </div>
          <div v-if="evidence.length" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div v-for="(url, i) in evidence" :key="i" class="relative group cursor-pointer rounded-xl overflow-hidden border border-app-border aspect-video bg-app-bg flex items-center justify-center" @click="openLightbox(url)">
              <img v-if="isImage(url)" :src="url" class="w-full h-full object-cover">
              <div v-else class="text-center p-2">
                <svg class="w-8 h-8 mx-auto text-app-text-muted mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <span class="text-[10px] text-app-text-muted truncate block">File đính kèm</span>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-app-text-muted italic">Chưa có bằng chứng</p>
          <MediaLightbox :open="lightboxOpen" :item="lightboxItem" @update:open="lightboxOpen = $event" />
        </div>

        <!-- Note -->
        <div v-if="doc.note" class="bg-app-surface border border-app-border rounded-2xl p-5 mb-4 shadow-sm">
          <h3 class="text-sm font-bold text-app-text-primary mb-2">📝 Ghi chú</h3>
          <p class="text-xs text-app-text-secondary italic whitespace-pre-wrap">{{ doc.note }}</p>
        </div>
      </div>
    </template>
  </DetailPageLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getDoc, getList, uploadFile } from '../api/index.js'
import AppButton from '../components/AppButton.vue'
import { useMetadata } from '../composables/useMetadata.js'
import { useRouter } from 'vue-router'
import BackButton from '../components/BackButton.vue'
import { formatMoney, formatDate, formatQty, userName } from '../utils/format.js'
import DetailPageLayout from '../components/DetailPageLayout.vue'
import MediaLightbox from '../components/MediaLightbox.vue'

const route = useRoute()
const { currencyItemMap, contextMap, fetchMetadata } = useMetadata()
const doc = ref(null)
const loading = ref(true)
const lightboxOpen = ref(false)
const lightboxItem = ref(null)
const evidence = ref([])
const uploading = ref(false)

function itemName(id) { return currencyItemMap.value[id]?.item_name || id }
function contextLabel(ctx) { const c = contextMap.value[ctx]; return c && [c.season_or_league, c.mode].filter(Boolean).join(' - ') || ctx }
function conversionType(t) { return { 'Player Flip': 'Flip', 'NPC Vendor': 'NPC', 'Crafting': 'Craft', 'Currency Exchange': 'Đổi tiền' }[t] || t }
function statusColor(s) { return s === 'Submitted' ? 'bg-emerald-500/10 text-emerald-600' : s === 'Cancelled' ? 'bg-red-500/10 text-red-600' : s === 'In Progress' ? 'bg-blue-500/10 text-blue-600' : 'bg-gray-500/10 text-gray-600' }
function isImage(url) { return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url) }
function openLightbox(url) { lightboxItem.value = { type: 'image', url, preview_url: url }; lightboxOpen.value = true }

async function loadEvidence() {
  if (!doc.value) return
  try {
    evidence.value = (await getList('File', { filters: [['attached_to_doctype', '=', 'Trade Conversion'], ['attached_to_name', '=', doc.value.name]], fields: ['file_url', 'file_name'], limit: 50 }) || []).map(f => f.file_url)
  } catch { evidence.value = [] }
}

function uploadEvidence() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*'
  input.multiple = true
  input.onchange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length) {
      uploading.value = true
      try {
        for (const file of files) await uploadFile(file, { doctype: 'Trade Conversion', docname: doc.value.name, fieldname: 'evidence' })
        await loadEvidence()
      } catch (e) { console.error('Upload failed:', e) }
      finally { uploading.value = false }
    }
  }
  input.click()
}

async function loadData() {
  loading.value = true
  try {
    await fetchMetadata()
    doc.value = await getDoc('Trade Conversion', route.params.name)
    await loadEvidence()
  } catch (e) { console.error('Failed to load Trade Conversion:', e) }
  finally { loading.value = false }
}

onMounted(() => { loadData() })
</script>
