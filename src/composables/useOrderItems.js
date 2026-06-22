import { frappeCall } from '../api/index.js'

const BATCH_SIZE = 50

export function useOrderItems() {
  async function fetchOrderItems(orders, parentType = 'Sell Order') {
    const names = orders.map(o => o.name)
    if (names.length === 0) return

    const isBuy = parentType === 'Buy Order'
    const mapItem = i => {
      const item = { currency_item: i.currency_item, quantity: i.quantity, unit_price: i.unit_price }
      if (i.currency_item_name) item.currency_item_name = i.currency_item_name
      if (isBuy) item.target_game_account = i.target_game_account
      return item
    }

    const batches = []
    for (let i = 0; i < names.length; i += BATCH_SIZE) {
      batches.push(names.slice(i, i + BATCH_SIZE))
    }

    const allItems = (await Promise.all(
      batches.map(batch => frappeCall('gege_custom.gege_custom.utils.get_order_items', {
        parent_doctype: parentType,
        parent_names: batch,
      }))
    )).flat()

    const itemsMap = {}
    allItems.forEach(i => {
      if (!itemsMap[i.parent]) itemsMap[i.parent] = []
      itemsMap[i.parent].push(mapItem(i))
    })

    orders.forEach(o => {
      o.items = itemsMap[o.name] || []
    })
  }

  async function fetchAllOrderItems(sellOrders, buyOrders) {
    await Promise.all([
      fetchOrderItems(sellOrders, 'Sell Order'),
      fetchOrderItems(buyOrders, 'Buy Order'),
    ])
  }

  return { fetchOrderItems, fetchAllOrderItems }
}
