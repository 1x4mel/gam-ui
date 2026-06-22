/**
 * Shared formatting utilities for Trader UI
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

export function formatDate(d) {
  if (!d) return ''
  let str = String(d)
  if (str.includes(' ') && !str.includes('Z') && !str.includes('+')) {
    str = str.replace(' ', 'T')
  }
  const dt = new Date(str)
  const pad = v => String(v).padStart(2, '0')
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export function formatDateFull(d) {
  if (!d) return ''
  let str = String(d)
  if (str.includes(' ') && !str.includes('Z') && !str.includes('+')) {
    str = str.replace(' ', 'T')
  }
  const dt = new Date(str)
  const pad = v => String(v).padStart(2, '0')
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

export function userName(email) {
  if (!email) return ''
  return email.split('@')[0]
}

export function statusBadge(state) {
  if (state === 'Completed') return 'bg-green-500/20 text-green-400'
  if (state === 'Claimed') return 'bg-blue-500/20 text-blue-400'
  if (state === 'Receiving' || state === 'In Delivery') return 'bg-orange-500/20 text-orange-400'
  if (state === 'Delivered') return 'bg-emerald-500/20 text-emerald-400'
  if (state === 'Evidence Uploaded') return 'bg-green-500/20 text-green-400'
  if (state === 'Failed') return 'bg-red-500/20 text-red-400'
  if (state === 'Cancelled') return 'bg-gray-500/20 text-gray-400'
  if (state === 'Disputed') return 'bg-yellow-500/20 text-yellow-400'
  if (state === 'Refunded') return 'bg-purple-500/20 text-purple-400'
  if (state === 'Payment Pending') return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  if (state === 'Queued') return 'bg-yellow-500/20 text-yellow-400'
  if (state === 'Pending ML') return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  return 'bg-gray-500/20 text-gray-400'
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

export function currencyName(name, itemMap = null) {
  if (!name) return ''
  if (itemMap && itemMap[name]) return itemMap[name].item_name || name
  const parts = name.split(' - ')
  return parts.length > 1 ? parts.slice(1).join(' - ') : name
}

export function tierColor(tier) {
  if (tier === 'Platinum') return 'text-indigo-400 font-bold'
  if (tier === 'Gold') return 'text-yellow-400 font-medium'
  if (tier === 'Silver') return 'text-gray-300 font-medium'
  if (tier === 'Bronze') return 'text-orange-400 font-medium'
  if (tier === 'Blocked' || tier === 'Blacklist') return 'text-red-400 font-medium'
  return 'text-gray-500'
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

export function gameIcon(title) {
  if (title === 'Diablo 4') return '🔥'
  if (title === 'Path of Exile 1') return '⚔️'
  if (title === 'Path of Exile 2') return '🗡️'
  return '🎮'
}

export function formatItemsSummary(order) {
  if (order.items && order.items.length > 0) {
    return order.items.map(i =>
      `${currencyName(i.currency_item)} x ${Number(i.quantity || 0).toLocaleString('vi-VN')}`
    ).join(' | ')
  }
  if (order.currency_item) {
    return `${currencyName(order.currency_item)} x ${Number(order.quantity || 0).toLocaleString('vi-VN')}`
  }
  return '—'
}

export function getOrderDoctype(name) {
  return name.startsWith('SO') ? 'Sell Order' : 'Buy Order'
}

export function getOrderType(name) {
  return name.startsWith('SO') ? 'sell' : 'buy'
}

export function getOrderCurrency(order) {
  return order.transaction_currency || order.sale_currency || 'VND'
}

export const GAME_TITLES = ['Diablo 4', 'Path of Exile', 'Path of Exile 2']

export function formatUsd(n) {
  if (!n) return '0 USD'
  return `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
}
