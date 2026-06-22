/**
 * Shared validation for sell order items editing.
 * Used by both OrderCard (inline) and OrderDetailView (modal).
 */

/**
 * Validate edited items before saving.
 * @param {Array} items - Array of { currency_item, quantity, unit_price, delivered_quantity }
 * @param {Object} order - The sell order object
 * @param {Function} warn - Warning function from useNotify
 * @returns {string|null} Error message or null if valid
 */
export function validateSellItems(items, order, warn, currencyItemMap = null) {
  const nameOf = (id) => {
    if (!id) return id
    if (currencyItemMap && currencyItemMap[id]) return currencyItemMap[id].item_name || id
    return id
  }

  // Basic field checks
  for (const item of items) {
    if (!item.currency_item) return warn('Chọn mặt hàng cho tất cả các dòng')
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) return warn('Số lượng phải là số nguyên lớn hơn 0')
    if (item.unit_price < 0) return warn('Đơn giá không được âm')
  }

  // Duplicate items
  const seen = new Set()
  for (const item of items) {
    if (seen.has(item.currency_item)) return warn(`Mặt hàng ${nameOf(item.currency_item)} bị trùng`)
    seen.add(item.currency_item)
  }

  // Delivered quantity check
  for (const item of items) {
    if (item.delivered_quantity > 0 && item.quantity < item.delivered_quantity) {
      return warn(`SL không được nhỏ hơn SL đã giao (${item.delivered_quantity})`)
    }
  }

  return null
}
