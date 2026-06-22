import { ref } from 'vue'
import { frappeCall } from '../api/index.js'

export function useItemPrice() {
  const prices = ref([])
  const loading = ref(false)
  const total = ref(0)

  async function fetchPrices(priceType = null, gameContext = null, currency = null, start = 0, pageSize = 20, search = null) {
    loading.value = true
    try {
      const res = await frappeCall('gege_custom.gege_custom.api.market_leader.get_all_prices', {
        price_type: priceType,
        game_context: gameContext,
        currency: currency,
        limit_start: start,
        limit_page_length: pageSize,
        search: search,
      })
      prices.value = res.data || []
      total.value = res.total || 0
    } finally {
      loading.value = false
    }
  }

  async function getItemPrice(currencyItem, gameContext, currency, priceType = 'Mua') {
    return await frappeCall('gege_custom.gege_custom.api.market_leader.get_item_price', {
      currency_item: currencyItem,
      game_context: gameContext,
      currency: currency,
      price_type: priceType,
    })
  }

  return { prices, loading, total, fetchPrices, getItemPrice }
}
