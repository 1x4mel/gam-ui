import { ref } from 'vue'
import { getDoc } from '../api/index.js'
import { encodeVietQR, removeAccents } from '../utils/vietqr.js'
import { formatQty, currencyName } from '../utils/format.js'

export function useQrPayment(notifyError, currencyItemMap = null) {
  const showQrModal = ref(false)
  const qrValue = ref('')
  const qrLoading = ref(false)
  const qrOrder = ref(null)
  const qrBankInfo = ref(null)
  const qrDescription = ref('')

  function getPaymentDesc(order) {
    if (!order) return ''
    if (order.items && order.items.length > 0) {
      const item = order.items[0]
      return `${currencyName(item.currency_item, currencyItemMap)} ${formatQty(item.quantity)}`.trim()
    }
    if (order.currency_item) {
      return `${currencyName(order.currency_item, currencyItemMap)} ${formatQty(order.quantity)}`.trim()
    }
    return ''
  }

  async function openQrPayment(order) {
    qrOrder.value = order
    qrLoading.value = true
    showQrModal.value = true
    qrBankInfo.value = null
    qrValue.value = ''
    qrDescription.value = ''

    try {
      const supplier = await getDoc('Supplier', order.supplier)

      const banks = supplier.supplier_bank_accounts || []
      const vndBank = banks.find(b => b.currency === 'VND' && b.is_default) || banks.find(b => b.currency === 'VND') || banks[0]

      if (!vndBank || !vndBank.bank_bin_code) {
        throw new Error('Supplier chưa có thông tin ngân hàng VND. Vui lòng thêm tài khoản ngân hàng trong hồ sơ Supplier.')
      }

      qrBankInfo.value = vndBank

      const refCode = order.payment_reference_code || removeAccents(getPaymentDesc(order))
      const desc = getDeterministicMemo(refCode)
      qrDescription.value = desc
      qrValue.value = encodeVietQR({
        bankBin: vndBank.bank_bin_code,
        accountNumber: vndBank.account_number,
        amount: order.total_vnd || order.gross_sale_vnd,
        description: desc,
        accountName: vndBank.account_holder
      })
    } catch (e) {
      if (notifyError) notifyError('Lỗi tạo QR: ' + e.message)
      showQrModal.value = false
    } finally {
      qrLoading.value = false
    }
  }

  return { showQrModal, qrValue, qrLoading, qrOrder, qrBankInfo, qrDescription, getPaymentDesc, openQrPayment }
}

function getDeterministicMemo(referenceCode) {
  if (!referenceCode) return ''
  const prefixes = ['CK', 'TT', 'TT DON', 'CK DON', 'THANHTOAN', 'CHUYEN']
  let hash = 0
  for (let i = 0; i < referenceCode.length; i++) {
    hash = ((hash << 5) - hash + referenceCode.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % prefixes.length
  return `${prefixes[idx]} ${referenceCode}`
}
