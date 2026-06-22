<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-all duration-500" @click.self="close">
    <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[90vh] transition-all">
      <!-- Header -->
      <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
        <div>
          <h3 class="text-app-text-primary font-black text-xl uppercase tracking-tight">{{ supplierName ? 'Cập nhật Supplier' : 'Tạo Supplier mới' }}</h3>
          <p class="text-app-text-muted text-[11px] font-medium mt-1">Thông tin hồ sơ và phương thức thanh toán đối tác</p>
        </div>
        <button @click="close" class="text-app-text-muted hover:text-app-text-primary transition-colors p-2 hover:bg-app-bg rounded-xl text-xl">✕</button>
      </div>

      <!-- Form Body -->
      <div class="flex-1 overflow-y-auto p-8 space-y-10">
        <!-- General Info Section -->
        <div class="space-y-6">
          <h4 class="text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Thông tin cơ bản</h4>
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2 md:col-span-1">
              <label class="label-text">Mã Supplier (ID) <span class="text-red-500">*</span></label>
              <input v-model="form.supplier_id" type="text" class="supplier-input" placeholder="fb-XXX hoặc dc-XXX" required />
              <p v-if="supplierName && form.supplier_id !== originalId" class="text-amber-500 text-[10px] font-bold mt-1">⚠️ Đổi mã sẽ cập nhật toàn bộ liên kết</p>
            </div>
            <div class="col-span-2 md:col-span-1">
              <label class="label-text">Tên Supplier <span class="text-red-500">*</span></label>
              <input v-model="form.supplier_name" type="text" class="supplier-input" placeholder="Ví dụ: GEGE Game Shop" required />
            </div>
            <div class="col-span-2 md:col-span-1">
              <label class="label-text">Loại Trader</label>
              <select v-model="form.custom_trader_type" class="input-field appearance-none cursor-pointer">
                <option value="">-- Chọn loại --</option>
                <option value="Trader">Trader</option>
                <option value="Farmer">Farmer</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
            <div class="col-span-2 md:col-span-1">
              <label class="label-text">Contact Handle (Zalo/Telegram...)</label>
              <input v-model="form.custom_contact_handle" type="text" class="supplier-input" placeholder="@username hoặc SĐT">
            </div>
            <div class="col-span-2 md:col-span-1">
              <label class="label-text">Facebook URL</label>
              <input v-model="form.custom_facebook_url" type="text" class="supplier-input" placeholder="https://facebook.com/...">
            </div>
            <div class="col-span-2 md:col-span-1">
              <label class="label-text">Discord URL</label>
              <input v-model="form.custom_discord_url" type="text" class="supplier-input" placeholder="https://discord.com/...">
            </div>
          </div>
        </div>

        <!-- Settings Section -->
        <div class="space-y-6">
          <h4 class="text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Cấu hình & Phân cấp</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label-text">Hạng Supplier</label>
              <select v-model="form.custom_supplier_tier" class="input-field appearance-none cursor-pointer">
                <option value="">-- Chọn Tier --</option>
                <option value="Bronze">Bronze</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
              </select>
            </div>
            <div>
              <label class="label-text">Tiền tệ ưu tiên</label>
              <select v-model="form.custom_preferred_currency" class="input-field appearance-none cursor-pointer">
                <option value="VND">VND</option>
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                      <option value="USDT">USDT</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="label-text">Buy Channel mặc định</label>
              <select v-model="form.custom_buy_channel" class="input-field appearance-none cursor-pointer">
                <option v-for="ch in channels" :key="ch.name" :value="ch.name">{{ ch.channel_name || ch.name }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Bank Accounts Section -->
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h4 class="text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Tài khoản ngân hàng</h4>
            <button @click="addBankAccount" class="text-[10px] font-black text-indigo-600 hover:text-indigo-400 uppercase tracking-widest transition-colors">+ Thêm tài khoản</button>
          </div>
          <div v-if="bankAccounts.length === 0" class="text-app-text-muted text-xs text-center py-4 opacity-50">Chưa có tài khoản ngân hàng</div>
          <div v-for="(bank, idx) in bankAccounts" :key="idx" class="bg-app-bg/80 border border-app-border rounded-2xl p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">TK #{{ idx + 1 }}</span>
              <div class="flex items-center gap-3">
                <button @click="openQrScanner(idx)" class="text-indigo-500 hover:text-indigo-400 text-[10px] font-black uppercase tracking-wider transition-colors" title="Quét QR ngân hàng">QR Scan</button>
                <button @click="removeBankAccount(idx)" class="text-app-text-muted hover:text-red-400 text-sm transition-colors">✕</button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label-text">Tên ngân hàng <span class="text-red-500">*</span></label>
                <select v-model="bank.bank_name" class="input-field appearance-none cursor-pointer" @change="onBankSelected(bank)">
                  <option value="">-- Chọn ngân hàng --</option>
                  <option v-for="b in bankOptions" :key="b.bin" :value="b.name">{{ b.name }}</option>
                  <option :value="OTHER_BANK">Khác (nhập tay)</option>
                </select>
                <input v-if="bank.bank_name === OTHER_BANK || (bank.bank_name && !bankOptions.find(b => b.name === bank.bank_name))" v-model="bank.bank_name" type="text" class="supplier-input mt-2" placeholder="Nhập tên ngân hàng..." />
              </div>
              <div>
                <label class="label-text">Mã BIN</label>
                <input v-model="bank.bank_bin_code" type="text" class="supplier-input" placeholder="970436" />
              </div>
              <div>
                <label class="label-text">Số tài khoản <span class="text-red-500">*</span></label>
                <input v-model="bank.account_number" type="text" class="supplier-input" placeholder="1234567890" />
              </div>
              <div>
                <label class="label-text">Chủ tài khoản <span class="text-red-500">*</span></label>
                <input v-model="bank.account_holder" type="text" class="supplier-input" :class="{'!border-red-500': bankTouched && !bank.account_holder}" placeholder="NGUYEN VAN A" @input="bankTouched = true" />
              </div>
              <div>
                <label class="label-text">Tiền tệ</label>
                <select v-model="bank.currency" class="input-field appearance-none cursor-pointer">
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                      <option value="USDT">USDT</option>
                </select>
              </div>
              <div class="flex items-end">
                <label class="flex items-center gap-2 cursor-pointer pb-2">
                  <input v-model="bank.is_default" type="checkbox" class="w-4 h-4 rounded border-app-border text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs text-app-text-secondary font-bold">Mặc định</span>
                </label>
              </div>
            </div>
            <div>
              <label class="label-text">Ghi chú</label>
              <input v-model="bank.note" type="text" class="supplier-input" placeholder="Chi nhánh, ghi chú thêm..." />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-8 py-6 border-t border-app-border bg-app-bg/50 flex gap-4">
        <AppButton variant="neutral" size="lg" class="flex-1" @click="close">Huỷ bỏ</AppButton>
        <AppButton variant="primary" size="lg" class="flex-1" :loading="saving" @click="save">{{ supplierName ? 'Cập nhật' : 'Tạo Supplier' }}</AppButton>
      </div>
    </div>

    <QrScannerModal :isOpen="qrScannerOpen" @close="qrScannerOpen = false" @scanned="onQrScanned" />
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import AppButton from './AppButton.vue'
import QrScannerModal from './QrScannerModal.vue'
import { getDoc, createDoc, updateDoc, getList, frappeCall } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import { getBankBinByName } from '../utils/vietqr.js'

const props = defineProps({
  isOpen: Boolean,
  supplierName: String,
})

const emit = defineEmits(['close', 'saved'])

const { success, error, warn } = useNotify()
const saving = ref(false)
const bankTouched = ref(false)
const channels = ref([])
const bankAccounts = ref([])
const originalBankNames = ref(new Set())
const qrScannerOpen = ref(false)
const bankOptions = ref([])
const OTHER_BANK = '__other__'
const qrTargetIdx = ref(null)
const originalId = ref('')

const form = reactive({
  supplier_id: '',
  supplier_name: '',
  supplier_group: 'All Supplier Groups',
  custom_trader_type: '',
  custom_contact_handle: '',
  custom_facebook_url: '',
  custom_discord_url: '',
  custom_supplier_tier: 'Normal',
  custom_preferred_currency: 'VND',
  custom_buy_channel: '',
})

// Auto-fill Facebook/Discord URL from supplier_id pattern
watch(() => form.supplier_id, (val) => {
  if (!val || props.supplierName) return
  const fbMatch = val.match(/^fb-(\d+)$/i)
  const dcMatch = val.match(/^dc-(\d+)$/i)
  if (fbMatch) form.custom_facebook_url = `https://www.facebook.com/messages/e2ee/t/${fbMatch[1]}`
  if (dcMatch) form.custom_discord_url = `https://discord.com/channels/@me/${dcMatch[1]}`
})

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    resetForm()
    try { channels.value = await getList('Channel', { fields: ['name', 'channel_name'], limit: 100 }) } catch {}
    // Load banks from server API
    try {
      const banks = await frappeCall('gege_custom.gege_custom.doctype.cashier_bank_account.cashier_bank_account.get_banks') || []
      bankOptions.value = banks.map(b => ({ name: b.bank_name || b.name, bin: b.custom_bank_bin || '' }))
    } catch {}
    if (props.supplierName) {
      await loadSupplier()
    }
  }
}, { immediate: false })

async function loadSupplier() {
  try {
    const doc = await getDoc('Supplier', props.supplierName)
    originalId.value = doc.name
    form.supplier_id = doc.name
    Object.keys(form).forEach(key => {
      if (doc[key] !== undefined) form[key] = doc[key]
    })
    form.supplier_id = doc.name

    // Universal Sanitization
    Object.keys(form).forEach(key => {
      const val = form[key]
      if (typeof val === 'string' && val.includes('\n')) {
        console.warn(`Dọn dẹp dữ liệu lỗi tại trường ${key}:`, val)
        form[key] = ''
      }
    })

    bankAccounts.value = (doc.supplier_bank_accounts || []).map(b => ({
      name: b.name || '',
      bank_name: b.bank_name || '',
      account_number: b.account_number || '',
      account_holder: b.account_holder || '',
      currency: b.currency || 'VND',
      is_default: b.is_default || false,
      bank_bin_code: b.bank_bin_code || '',
      note: b.note || '',
    }))
    originalBankNames.value = new Set(bankAccounts.value.map(b => b.name).filter(Boolean))
  } catch (e) {
    console.error('Lỗi load supplier:', e)
  }
}

function resetForm() {
  form.supplier_id = ''
  form.supplier_name = ''
  form.custom_trader_type = ''
  form.custom_contact_handle = ''
  form.custom_facebook_url = ''
  form.custom_discord_url = ''
  form.custom_supplier_tier = 'Normal'
  form.custom_preferred_currency = 'VND'
  form.custom_buy_channel = ''
  bankAccounts.value = []
}

function addBankAccount() {
  bankAccounts.value.push({
    bank_name: '', account_number: '', account_holder: '',
    currency: 'VND', is_default: false, bank_bin_code: '', note: '',
  })
}

function removeBankAccount(idx) {
  bankAccounts.value.splice(idx, 1)
}

function openQrScanner(idx) {
  qrTargetIdx.value = idx
  qrScannerOpen.value = true
}

function onBankSelected(bank) {
  if (bank.bank_name && bank.bank_name !== OTHER_BANK) {
    const bin = getBankBinByName(bank.bank_name)
    if (bin) bank.bank_bin_code = bin
  }
}

function onQrScanned(data) {
  const idx = qrTargetIdx.value
  if (idx == null || !bankAccounts.value[idx]) return
  const bank = bankAccounts.value[idx]
  if (data.bankBin) bank.bank_bin_code = data.bankBin
  if (data.accountNumber) bank.account_number = data.accountNumber
  if (data.accountName) bank.account_holder = data.accountName
  if (data.bankName) {
    const normalize = s => (s || '').replace(/\s+/g, '').toLowerCase()
    const qrNorm = normalize(data.bankName)
    const match = bankOptions.value.find(b =>
      (data.bankBin && b.bin === data.bankBin) ||
      normalize(b.name) === qrNorm ||
      normalize(b.name).includes(qrNorm) ||
      qrNorm.includes(normalize(b.name))
    )
    bank.bank_name = match ? match.name : data.bankName
  }
  if (!bank.currency) bank.currency = 'VND'
}

async function save() {
  if (!props.supplierName && !form.supplier_id.trim()) return warn('Vui lòng nhập mã Supplier (ID)')
  if (!form.supplier_name) return warn('Vui lòng nhập tên Supplier')

  bankTouched.value = true
  const incompleteBank = bankAccounts.value.find(b =>
    (b.bank_name || b.account_number) && !b.account_holder
  )
  if (incompleteBank) {
    return warn('Chủ tài khoản là bắt buộc cho mỗi tài khoản ngân hàng')
  }

  saving.value = true
  try {
    let docName = props.supplierName

    // Handle rename if supplier_id changed
    if (props.supplierName && form.supplier_id && form.supplier_id.trim() !== originalId.value) {
      const newId = form.supplier_id.trim()
      await frappeCall('gege_custom.gege_custom.api.helpers.rename_supplier', {
        old_name: originalId.value,
        new_name: newId,
      })
      docName = newId
    }

    const payload = { ...form }
    if (!props.supplierName && form.supplier_id) {
      payload.__newname = form.supplier_id.trim()
    }
    delete payload.supplier_id

    // Attach bank accounts as child table
    const validBanks = bankAccounts.value
      .filter(b => b.bank_name && b.account_number && b.account_holder)
    if (validBanks.length) {
      payload.supplier_bank_accounts = validBanks.map(b => {
        const row = {
          doctype: 'Supplier Bank Account',
          bank_name: b.bank_name,
          account_number: b.account_number,
          account_holder: b.account_holder,
          currency: b.currency,
          is_default: b.is_default ? 1 : 0,
          bank_bin_code: b.bank_bin_code,
          note: b.note,
        }
        if (b.name) row.name = b.name
        return row
      })
    } else {
      payload.supplier_bank_accounts = []
    }

    // Detect deleted child rows
    if (docName && originalBankNames.value.size > 0) {
      const keptNames = new Set(validBanks.map(b => b.name).filter(Boolean))
      const deleted = [...originalBankNames.value].filter(n => !keptNames.has(n))
      if (deleted.length) {
        payload.__deleted_childs = { supplier_bank_accounts: deleted }
      }
    }

    if (docName) {
      await updateDoc('Supplier', docName, payload)
    } else {
      await createDoc('Supplier', payload)
    }
    emit('saved')
    success('Lưu Supplier thành công')
    close()
  } catch (e) {
    error('Lỗi khi lưu: ' + e.message)
  } finally {
    saving.value = false
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.label-text {
  display: block;
  font-size: 0.65rem;
  font-weight: 900;
  color: var(--app-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
  margin-left: 0.25rem;
  opacity: 0.8;
}

.supplier-input {
  width: 100%;
  background: var(--app-bg);
  border: 1px solid var(--app-border);
  color: var(--app-text-primary);
  border-radius: 1rem;
  padding: 0.875rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.03);
}

.input-field:focus {
  border-color: #4f46e5;
  background: var(--app-surface);
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1), inset 0 2px 4px 0 rgba(0, 0, 0, 0.03);
  transform: translateY(-1px);
}

.input-field::placeholder {
  color: var(--app-text-muted);
  opacity: 0.4;
}

.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--app-bg);
}
</style>
