/**
 * Normalize BE DocType field names to FE-expected field names.
 *
 * Buy Order:  buy_items→items, notes→note, owner→created_by, grand_total_native→total_vnd
 * Sell Order: sell_items→items, notes→note, owner→created_by,
 */

export function normalizeOrderInPlace(order, orderType) {
  if (!order) return order

  // Common: Frappe standard → FE aliases
  if (order.owner) order.created_by = order.owner
  if (order.notes !== undefined) order.note = order.notes

  // Buy Order: status is the authoritative workflow state field
  // Sell Order: workflow_state is the authoritative field
  if (orderType === 'buy') {
    // Buy Order: keep status as-is (it's the real state), fill workflow_state if missing
    if (!order.status && order.workflow_state) order.status = order.workflow_state
  } else {
    // Sell Order: workflow_state is authoritative, map to status for FE
    if (order.workflow_state) order.status = order.workflow_state
  }

  if (orderType === 'buy') {
    if (order.buy_items) order.items = order.buy_items
    if (order.grand_total_native !== undefined) order.total_vnd = order.grand_total_native
    if (order['supplier.supplier_name']) order.supplier_name = order['supplier.supplier_name']
  } else {
    // sell
    if (order.sell_items) order.items = order.sell_items
    if (order.withdraw_fee_native !== undefined) order.withdraw_fee_vnd = order.withdraw_fee_native
    if (order.channel_fee_native !== undefined) order.channel_fee_vnd = order.channel_fee_native
    if (order.other_cost_native !== undefined) order.other_cost_vnd = order.other_cost_native
    if (!order.customer_name_snapshot) {
      order.customer_name_snapshot = order['customer.customer_name'] || order.customer || ''
    }
    if (!order.customer_handle_snapshot && order.customer_ingame_name_snapshot) {
      order.customer_handle_snapshot = order.customer_ingame_name_snapshot
    }
  }

  // Compute derived fields from items
  const items = order.items
  if (items && items.length > 0) {
    order.total_quantity = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    if (orderType === 'sell') {
      order.gross_sale_vnd = Math.round(items.reduce((s, i) =>
        s + (Number(i.total) || Number(i.unit_price) * Number(i.quantity) || 0), 0) * 100) / 100
    }
    if (!order.currency_item) order.currency_item = items[0]?.currency_item
    if (!order.quantity) order.quantity = order.total_quantity
  }
  // Fallback: use earning_native when items are not available (e.g. getList doesn't return child tables)
  if (orderType === 'sell') {
    if (!order.gross_sale_vnd && order.earning_native) {
      order.gross_sale_vnd = order.earning_native
    }
    if (order.earning_native) {
      order.earning_vnd = order.earning_native
    }
  }
  // Custom order fields: always set from webhook data (regardless of items)
  if (orderType === 'sell' && order.order_item_title) {
    order.custom_item_name = order.order_item_title
    order.custom_qty = Number(order.order_quantity) || 0
  }

  return order
}

export function normalizeOrder(order, orderType) {
  if (!order) return order
  return normalizeOrderInPlace({ ...order }, orderType)
}

export function normalizeOrderByDoc(order, doctype) {
  if (!order || !doctype) return order
  return normalizeOrderInPlace(order, doctype === 'Buy Order' ? 'buy' : 'sell')
}

export function normalizeOrderAuto(order) {
  if (!order || !order.name) return order
  return normalizeOrderInPlace(order, order.name.startsWith('BO') ? 'buy' : 'sell')
}
