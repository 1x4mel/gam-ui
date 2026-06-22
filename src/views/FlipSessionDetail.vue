<template>
  <DetailPageLayout :loading="loading" loading-text="Đang tải Flip Session...">
    <template #toolbar>
      <BackButton @click="$router.push('/flip')" />
    </template>
    <template #default v-if="session">
      <div class="max-w-4xl mx-auto px-4 pb-8 space-y-4">
        <!-- Header -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
          <div class="flex flex-wrap items-center gap-3 mb-3">
            <span :class="[statusColor(session.status), 'text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg border border-current/10']">{{ session.status }}</span>
            <span class="text-app-text-primary font-black text-sm">{{ session.name }}</span>
            <span class="text-app-text-muted text-xs">{{ session.game_account }}</span>
            <span class="text-[10px] text-app-text-muted bg-app-bg px-2 py-0.5 rounded-lg">{{ session.game_context }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs text-app-text-muted">
            <span>{{ formatDate(session.session_date) }}</span>
            <span v-if="session.output_currency">Output: <b class="text-app-text-primary">{{ session.output_currency }}</b></span>
            <span v-if="session.total_cost_input">Cost: <b class="text-app-text-primary">{{ formatMoney(session.total_cost_input, session.output_currency) }}</b></span>
          </div>
          <!-- Actions -->
          <div v-if="session.status === 'Open'" class="flex flex-wrap gap-2 mt-4">
            <AppButton variant="primary" size="sm" @click="showAddRound = true">+ Thêm Round</AppButton>
            <AppButton variant="success" size="sm" :loading="completing" @click="completeSession">Complete</AppButton>
            <AppButton variant="warning" size="sm" @click="pauseSession">Pause</AppButton>
            <AppButton variant="danger-ghost" size="sm" @click="cancelSession">Cancel</AppButton>
          </div>
          <div v-else-if="session.status === 'Paused'" class="flex flex-wrap gap-2 mt-4">
            <AppButton variant="primary" size="sm" @click="resumeSession">Resume</AppButton>
            <AppButton variant="success" size="sm" :loading="completing" @click="completeSession">Complete</AppButton>
            <AppButton variant="danger-ghost" size="sm" @click="cancelSession">Cancel</AppButton>
          </div>
        </div>

        <!-- Input Lots -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
          <h3 class="text-sm font-bold text-app-text-primary mb-3">📥 Input Lots (Locked)</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead><tr class="border-b border-app-border">
                <th class="text-left py-2 px-2 text-app-text-muted">Mặt hàng</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Locked</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Consumed</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Còn lại</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Cost/unit</th>
                <th class="text-left py-2 px-2 text-app-text-muted">Lot</th>
              </tr></thead>
              <tbody>
                <tr v-for="lot in session.input_lots" :key="lot.lot" class="border-b border-app-border/50">
                  <td class="py-2 px-2 font-bold text-app-text-primary">{{ itemName(lot.currency_item) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-amber-600 font-bold">{{ formatQty(lot.qty_locked) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-red-600 font-bold">{{ formatQty(lot.qty_consumed) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-muted">{{ formatQty(lot.qty_remaining_locked) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-muted">{{ formatMoney(lot.cost_per_unit, lot.native_currency) }}</td>
                  <td class="py-2 px-2 text-app-text-muted font-mono text-[10px]">{{ lot.lot }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Rounds -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
          <h3 class="text-sm font-bold text-app-text-primary mb-3">🔄 Rounds ({{ session.rounds.length }})</h3>
          <div v-if="session.rounds.length === 0" class="text-xs text-app-text-muted italic">Chưa có round nào</div>
          <div v-else class="space-y-4">
            <div v-for="round in session.rounds" :key="round.round_no" class="border border-app-border/50 rounded-xl p-4">
              <div class="text-xs font-black text-indigo-600 mb-2">Round {{ round.round_no }}</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div class="text-[10px] font-black text-red-500 uppercase mb-1">Tiêu hao</div>
                  <div v-for="item in round.items_in" :key="item.lot" class="text-xs flex justify-between py-0.5">
                    <span class="text-app-text-primary font-bold">{{ itemName(item.currency_item) }}</span>
                    <span class="font-mono text-red-600">-{{ formatQty(item.qty) }}</span>
                  </div>
                </div>
                <div>
                  <div class="text-[10px] font-black text-emerald-600 uppercase mb-1">Nhận được</div>
                  <div v-for="item in round.items_out" :key="item.currency_item" class="text-xs flex justify-between py-0.5">
                    <span class="text-app-text-primary font-bold">{{ itemName(item.currency_item) }}</span>
                    <span class="font-mono text-emerald-600">+{{ formatQty(item.qty) }}</span>
                  </div>
                </div>
              </div>
              <div v-if="round.evidence && round.evidence.length" class="flex gap-2 mt-2">
                <img v-for="(ev, i) in round.evidence" :key="i" :src="ev.file_url" class="h-12 w-16 object-cover rounded-lg border border-app-border cursor-pointer" @click="openLightbox(ev.file_url)">
              </div>
            </div>
          </div>
        </div>

        <!-- Output Lots -->
        <div v-if="session.output_lots && session.output_lots.length" class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
          <h3 class="text-sm font-bold text-app-text-primary mb-3">📤 Output Lots</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead><tr class="border-b border-app-border">
                <th class="text-left py-2 px-2 text-app-text-muted">Mặt hàng</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Qty</th>
                <th class="text-right py-2 px-2 text-app-text-muted">Cost Allocated</th>
                <th class="text-left py-2 px-2 text-app-text-muted">Lot</th>
              </tr></thead>
              <tbody>
                <tr v-for="lot in session.output_lots" :key="lot.output_lot" class="border-b border-app-border/50">
                  <td class="py-2 px-2 font-bold text-app-text-primary">{{ itemName(lot.currency_item) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-emerald-600 font-bold">{{ formatQty(lot.qty) }}</td>
                  <td class="py-2 px-2 text-right font-mono text-app-text-muted">{{ formatMoney(lot.cost_allocated, lot.native_currency) }}</td>
                  <td class="py-2 px-2 text-app-text-muted font-mono text-[10px]">{{ lot.output_lot }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Add Round Modal -->
      <div v-if="showAddRound" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showAddRound = false">
        <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-2xl max-h-[80vh] overflow-y-auto space-y-4 shadow-2xl">
          <h3 class="text-sm font-black text-app-text-primary uppercase tracking-widest">Thêm Round</h3>
          <!-- Consumed items -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-red-500 text-[10px] font-black uppercase tracking-[0.2em]">Tiêu hao</h4>
              <button @click="consumedItems.push({ currency_item: '', qty: '' })" class="text-[10px] font-black text-indigo-600 hover:text-indigo-400 uppercase tracking-widest">+ Thêm</button>
            </div>
            <div v-for="(item, idx) in consumedItems" :key="'c-' + idx" class="flex items-center gap-2">
              <select v-model="item.currency_item" class="flex-1 bg-app-bg border border-app-border rounded-xl px-3 py-2 text-app-text-primary text-xs outline-none focus:border-indigo-600">
                <option value="">Chọn item</option>
                <option v-for="lot in availableInputLots" :key="lot.currency_item + lot.lot" :value="lot.currency_item + '|' + lot.lot">{{ itemName(lot.currency_item) }} ({{ formatQty(lot.qty_remaining_locked) }}) — {{ lot.lot }}</option>
              </select>
              <input v-model.number="item.qty" type="number" placeholder="SL" min="0" class="w-20 bg-app-bg border border-app-border rounded-xl px-2 py-2 text-app-text-primary text-xs outline-none focus:border-indigo-600 font-bold">
              <button v-if="consumedItems.length > 1" @click="consumedItems.splice(idx, 1)" class="text-app-text-muted hover:text-red-400 text-sm">&#10005;</button>
            </div>
          </div>
          <!-- Received items -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em]">Nhận được</h4>
              <button @click="receivedItems.push({ currency_item: '', qty: '', valuation_price_per_unit: '', _priceSource: 'none' })" class="text-[10px] font-black text-indigo-600 hover:text-indigo-400 uppercase tracking-widest">+ Thêm</button>
            </div>
            <div v-for="(item, idx) in receivedItems" :key="'r-' + idx" class="flex items-center gap-2">
              <SearchableSelect v-model="item.currency_item" :options="allItemOptions" placeholder="Chọn item..." compact class="flex-1" @update:model-value="onItemSelect(item)" />
              <input v-model.number="item.qty" type="number" placeholder="SL" min="0" class="w-20 bg-app-bg border border-app-border rounded-xl px-2 py-2 text-app-text-primary text-xs outline-none focus:border-indigo-600 font-bold">
              <div class="w-28 relative">
                <input v-model.number="item.valuation_price_per_unit" type="number" :placeholder="item._priceSource === 'none' ? 'Nhập giá...' : 'Giá ref.'" min="0"
                  :class="['w-full bg-app-bg border rounded-xl px-2 py-2 text-app-text-primary text-xs outline-none font-bold', item._priceSource === 'auto' ? 'border-emerald-600/40 focus:border-emerald-600' : item._priceSource === 'none' ? 'border-amber-500/40 focus:border-amber-500' : 'border-app-border focus:border-indigo-600']">
                <span v-if="item._priceSource === 'auto'" class="absolute -top-1.5 right-1 text-[8px] font-black text-emerald-600 bg-emerald-600/10 px-1 rounded">AUTO</span>
              </div>
              <button v-if="receivedItems.length > 1" @click="receivedItems.splice(idx, 1)" class="text-app-text-muted hover:text-red-400 text-sm">&#10005;</button>
            </div>
          </div>
          <!-- Evidence -->
          <div>
            <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2">Bằng chứng (ảnh)</label>
            <input type="file" multiple accept="image/*" @change="onEvidenceSelect" class="w-full text-sm text-app-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-amber-500/10 file:text-amber-600 hover:file:bg-amber-500/20 cursor-pointer">
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <AppButton variant="neutral" size="md" @click="showAddRound = false">Huỷ</AppButton>
            <AppButton variant="primary" size="md" :loading="addingRound" :disabled="addingRound" @click="addRound">Thêm Round</AppButton>
          </div>
        </div>
      </div>

      <MediaLightbox :open="lightboxOpen" :item="lightboxItem" @update:open="lightboxOpen = $event" />
    </template>
  </DetailPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { frappeCall, uploadFile, getList } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import AppButton from '../components/AppButton.vue'
import { useMetadata } from '../composables/useMetadata.js'
import BackButton from '../components/BackButton.vue'
import { formatMoney, formatDate, formatQty } from '../utils/format.js'
import SearchableSelect from '../components/SearchableSelect.vue'
import DetailPageLayout from '../components/DetailPageLayout.vue'
import MediaLightbox from '../components/MediaLightbox.vue'

const route = useRoute()
const { success, error, warn } = useNotify()
const { currencyItems, fetchMetadata, currencyItemMap } = useMetadata()
const loading = ref(true)
const session = ref(null)
const completing = ref(false)
const addingRound = ref(false)
const showAddRound = ref(false)
const lightboxOpen = ref(false)
const lightboxItem = ref({})
const consumedItems = ref([{ currency_item: '', qty: '' }])
const receivedItems = ref([{ currency_item: '', qty: '', valuation_price_per_unit: '', _priceSource: 'none' }])
const evidenceFiles = ref([])
const refPrices = ref({})

function itemName(id) { return currencyItemMap.value[id]?.item_name || id || '' }

const availableInputLots = computed(() =>
  session.value ? session.value.input_lots.filter(l => (l.qty_remaining_locked || 0) > 0) : []
)

const allItemOptions = computed(() =>
  currencyItems.value.map(i => ({ value: i.name, label: i.item_name || i.name }))
)

function onItemSelect(item) {
  if (item.currency_item && refPrices.value[item.currency_item]) {
    item.valuation_price_per_unit = refPrices.value[item.currency_item]
    item._priceSource = 'auto'
  } else {
    item.valuation_price_per_unit = ''
    item._priceSource = 'none'
  }
}

function onEvidenceSelect(e) { evidenceFiles.value = Array.from(e.target.files || []) }

function openLightbox(url) {
  lightboxItem.value = { attachment: url }
  lightboxOpen.value = true
}

async function loadSession() {
  loading.value = true
  try {
    await fetchMetadata()
    session.value = await frappeCall('gege_custom.gege_custom.api.flip_session.get_flip_session_detail', { name: route.params.name })
    if (session.value.game_context) {
      try { refPrices.value = await frappeCall('gege_custom.gege_custom.api.flip_session.get_reference_prices', { game_context: session.value.game_context }) } catch {}
    }
  } catch (e) { error('Lỗi tải session: ' + (e.message || e)) }
  finally { loading.value = false }
}

async function addRound() {
  const consumed = consumedItems.value.filter(i => i.currency_item && Number(i.qty) > 0)
  const received = receivedItems.value.filter(i => i.currency_item && Number(i.qty) > 0)
  if (consumed.length === 0) return warn('Cần ít nhất 1 item tiêu hao.')
  if (received.length === 0) return warn('Cần ít nhất 1 item nhận.')
  addingRound.value = true
  try {
    const evidenceUrls = []
    for (const file of evidenceFiles.value) {
      const res = await uploadFile(file, { doctype: 'Flip Session', docname: session.value.name, fieldname: 'evidence' })
      if (res?.file_url) evidenceUrls.push(res.file_url)
    }
    const itemsConsumed = consumed.map(i => { const [ci] = i.currency_item.split('|'); return { currency_item: ci, qty: Number(i.qty) } })
    const itemsReceived = received.map(i => ({ currency_item: i.currency_item, qty: Number(i.qty), valuation_price_per_unit: Number(i.valuation_price_per_unit) || 0 }))
    await frappeCall('gege_custom.gege_custom.api.flip_session.add_flip_round', {
      session_name: session.value.name, items_consumed: itemsConsumed, items_received: itemsReceived, evidence_files: evidenceUrls,
    })
    success('Thêm round thành công!')
    showAddRound.value = false
    consumedItems.value = [{ currency_item: '', qty: '' }]
    receivedItems.value = [{ currency_item: '', qty: '', valuation_price_per_unit: '', _priceSource: 'none' }]
    evidenceFiles.value = []
    loadSession()
  } catch (e) { error('Lỗi thêm round: ' + (e.message || e)) }
  finally { addingRound.value = false }
}

async function pauseSession() { try { await frappeCall('gege_custom.gege_custom.api.flip_session.pause_flip_session', { session_name: session.value.name }); success('Session đã Pause.'); loadSession() } catch (e) { error(e.message || e) } }
async function resumeSession() { try { await frappeCall('gege_custom.gege_custom.api.flip_session.resume_flip_session', { session_name: session.value.name }); success('Session đã Resume.'); loadSession() } catch (e) { error(e.message || e) } }
async function completeSession() { completing.value = true; try { await frappeCall('gege_custom.gege_custom.api.flip_session.complete_flip_session', { session_name: session.value.name }); success('Session đã Complete! Output lots đã tạo.'); loadSession() } catch (e) { error('Lỗi complete: ' + (e.message || e)) } finally { completing.value = false } }
async function cancelSession() { if (confirm('Hủy session? Tất cả lot sẽ được unlock.')) try { await frappeCall('gege_custom.gege_custom.api.flip_session.cancel_flip_session', { session_name: session.value.name }); success('Session đã Cancel.'); loadSession() } catch (e) { error(e.message || e) } }

function statusColor(s) {
  return { Open: 'text-emerald-600', Paused: 'text-amber-600', Completed: 'text-blue-600', Cancelled: 'text-red-600' }[s] || 'text-app-text-muted'
}

onMounted(() => { loadSession() })
</script>
