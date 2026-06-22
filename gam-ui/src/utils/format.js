/**
 * Generic formatting utilities for GAM UI.
 * (Trader-domain helpers were dropped during the F0 fork.)
 */

export function formatQty(n) {
  if (!n) return '0'
  return Number(n).toLocaleString('vi-VN')
}

const CURRENCY_LABELS = { VND: ' VND', USD: ' USD', CNY: ' CNY' }
export function formatMoney(n, currency = 'VND') {
  if (!n) return '—'
  const num = Number(n)
  const symbol = CURRENCY_LABELS[currency] || currency
  const formatted = num.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
  return `${formatted}${symbol}`
}

/**
 * Centralized server-datetime parser. Frappe returns naive "YYYY-MM-DD HH:MM:SS"
 * strings in the configured server timezone (Asia/Ho_Chi_Minh, UTC+7). We inject
 * the +07:00 offset when the string carries no zone marker so the browser treats
 * it as absolute. Strings already carrying Z / ±offset are left untouched.
 * Returns epoch milliseconds, or NaN for falsy input.
 */
const SERVER_TZ_OFFSET = '+07:00'
export function toEpochMs(d) {
  if (!d) return NaN
  let str = String(d)
  if (str.includes(' ') && !str.includes('Z') && !str.includes('+')) {
    str = str.replace(' ', 'T')
  }
  // Only add the server offset if the value is truly naive (no trailing zone).
  if (!/([Zz]|[+-]\d{2}:?\d{2})$/.test(str)) str += SERVER_TZ_OFFSET
  return new Date(str).getTime()
}

export function formatDate(d) {
  if (!d) return ''
  const dt = new Date(toEpochMs(d))
  const pad = v => String(v).padStart(2, '0')
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export function formatDateFull(d) {
  if (!d) return ''
  const dt = new Date(toEpochMs(d))
  const pad = v => String(v).padStart(2, '0')
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

/**
 * Human-readable countdown for a code/expiry timestamp. Returns
 * { label, severity } where severity ∈ 'ok' | 'soon' | 'expired' for styling.
 */
export function humanizeCountdown(expiresAt) {
  const diff = toEpochMs(expiresAt) - Date.now()
  if (!Number.isFinite(diff) || diff <= 0) {
    return { label: 'đã hết hạn', severity: 'expired' }
  }
  const m = Math.floor(diff / 60000)
  const label = m > 0 ? `còn ${m} phút` : `còn ${Math.floor(diff / 1000)} giây`
  const severity = diff < 5 * 60000 ? 'soon' : 'ok'
  return { label, severity }
}

export function userName(email) {
  if (!email) return ''
  return email.split('@')[0]
}

/**
 * Status → badge color classes. Oriented to GAM account/email-code,
 * email-inbound-log and account-usage states. Unknown states fall back
 * to a neutral gray.
 */
export function statusBadge(state) {
  switch (state) {
    case 'Available':
    case 'AVAILABLE':
      return 'bg-green-500/20 text-green-400'
    case 'In Use':
    case 'IN_USE':
      return 'bg-blue-500/20 text-blue-400'
    case 'Claimed':
    case 'CLAIMED':
      return 'bg-amber-500/20 text-amber-400'
    case 'Expired':
    case 'EXPIRED':
      return 'bg-gray-500/20 text-gray-400'
    case 'Used':
    case 'USED':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'Verified':
    case 'Forward Verified':
      return 'bg-green-500/20 text-green-400'
    case 'Pending':
    case 'PENDING':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'Failed':
    case 'FAILED':
      return 'bg-red-500/20 text-red-400'
    case 'Disabled':
      return 'bg-red-500/20 text-red-400'
    // Email Inbound Log (Design §3.1.16)
    case 'OK':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'NO_MATCH':
      return 'bg-amber-500/20 text-amber-400'
    case 'DUPLICATE':
      return 'bg-indigo-500/20 text-indigo-400'
    case 'PARSE_ERROR':
    case 'INACTIVE':
      return 'bg-red-500/20 text-red-400'
    case 'PAYLOAD_TRUNCATED':
      return 'bg-yellow-500/20 text-yellow-400'
    // Account Usage (Design §3.1.15)
    case 'RELEASED':
      return 'bg-gray-500/20 text-gray-400'
    case 'FORCE_RELEASED':
      return 'bg-red-500/20 text-red-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

export function isImage(url) {
  if (!url) return false
  if (url.startsWith('data:image/')) return true
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)
}

export function isVideo(url) {
  if (!url) return false
  if (url.startsWith('data:video/')) return true
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}

export function formatTimeAgo(d) {
  if (!d) return ''
  // Handle Frappe's timezone format
  const dt = (typeof d === 'string' && !d.includes('Z') && !d.includes('+')) ? d + '+07:00' : d
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

export function normalizeName(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>?/gm, '').trim()
}

export function linkify(text) {
  if (!text) return ''
  const urlRe = /(https?:\/\/[^\s<>"')\]]+)/g
  const parts = text.split(urlRe)
  return parts.map(p => urlRe.test(p) ? `<a href="${p}" target="_blank" rel="noopener noreferrer" class="text-indigo-500 underline hover:text-indigo-400">${p}</a>` : p).join('')
}

export function formatUsd(n) {
  if (!n) return '0 USD'
  return `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
}
