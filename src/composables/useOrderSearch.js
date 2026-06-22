import { userName, currencyName } from '../utils/format.js'

/**
 * Check if an order matches a search query.
 * Directly checks fields without building intermediate arrays/strings.
 * O(n * fields) per keystroke — fast enough for ~10k orders.
 */
export function matchesSearch(order, query) {
  if (!query) return true
  const q = query.toLowerCase()

  const has = v => v != null && String(v).toLowerCase().includes(q)

  // Identity
  if (has(order.name)) return true
  if (has(order.external_order_id)) return true
  if (has(order.status)) return true

  // Game context
  if (has(order.game_context)) return true
  if (has(order.currency_item)) return true
  if (order.currency_item && has(currencyName(order.currency_item))) return true

  // Channels
  if (has(order.sell_channel)) return true
  if (has(order.buy_channel)) return true

  // People
  if (has(order.created_by) || has(userName(order.created_by))) return true
  if (has(order.claimed_by) || has(userName(order.claimed_by))) return true
  if (has(order.assigned_trader2) || has(userName(order.assigned_trader2))) return true
  if (has(order.owner) || has(userName(order.owner))) return true

  // Customer (Sell)
  if (has(order.customer)) return true
  if (has(order.customer_name_snapshot)) return true
  if (has(order.customer_btag_snapshot)) return true
  if (has(order.customer_handle_snapshot)) return true
  if (has(order.customer_ingame_name_snapshot)) return true

  // Supplier (Buy)
  if (has(order.supplier)) return true

  // Order title / custom
  if (has(order.order_item_title)) return true
  if (has(order.custom_item_name)) return true

  // Other
  if (has(order.note)) return true
  if (has(order.order_url)) return true
  if (has(order.sale_currency)) return true
  if (has(order.transaction_currency)) return true

  // Game accounts
  if (has(order.target_game_account)) return true
  if (has(order.delivery_game_account)) return true

  // Child items
  if (order.items) {
    for (const i of order.items) {
      if (has(i.currency_item)) return true
      if (has(currencyName(i.currency_item))) return true
      if (has(i.quantity)) return true
      if (has(i.target_game_account)) return true
    }
  }

  // Latest activity
  if (order.latest_activity) {
    if (has(order.latest_activity.action)) return true
    if (has(order.latest_activity.note)) return true
    if (has(userName(order.latest_activity.owner))) return true
  }

  return false
}
