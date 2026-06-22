import { ref, watch } from 'vue'

export function useFavorites(key = 'trader1_favorites') {
  const defaultFavs = {
    buy_channel: [],
    sell_channel: [],
    supplier: [],
    customer: [],
    game_context: [],
    currency_item: []
  }

  let initial = defaultFavs
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      initial = { ...defaultFavs, ...JSON.parse(raw) }
    }
  } catch (e) {
    console.error('Error parsing favorites', e)
  }

  const favorites = ref(initial)

  watch(favorites, (newVal) => {
    localStorage.setItem(key, JSON.stringify(newVal))
  }, { deep: true })

  function renderFavs(fieldKey, optsArr) {
    return (favorites.value[fieldKey] || []).map(val => {
      const opt = optsArr.find(o => String(o.value) === String(val))
      return opt ? { label: opt.label, value: opt.value } : null
    }).filter(Boolean)
  }

  return { favorites, renderFavs }
}
