import { ref, computed, unref } from 'vue'
import { getList, frappeCall } from '../api'

// Singleton state
const channels = ref([])
const gameContexts = ref([])
const gameAccounts = ref([])
const currencyItems = ref([])
const itemCategoryOpts = ref([])
const gameTitles = ref([])
const isLoading = ref(false)
const lastFetched = ref(0)
const CACHE_TTL = 1000 * 60 * 10 // 10 minutes
let fetchPromise = null

export function useMetadata() {
  async function fetchMetadata(force = false) {
    const now = Date.now()
    if (!force && lastFetched.value && (now - lastFetched.value < CACHE_TTL)) {
      return
    }
    if (!force && fetchPromise) {
      return fetchPromise
    }

    fetchPromise = (async () => {
      isLoading.value = true
      try {
        const results = await Promise.allSettled([
          getList('Channel', { fields: ['name', 'channel_name', 'channel_group'], filters: [['is_active', '=', 1]], limit: 100 }),
          getList('Game Context', { fields: ['name', 'game_title', 'server', 'season_or_league', 'mode'], filters: [['is_active', '=', 1]], limit: 100 }),
          getList('Game Account', { fields: ['name', 'account_name', 'game_title'], filters: [['is_active', '=', 1]], limit: 200 }),
          getList('Currency Item', { fields: ['name', 'item_name', 'game_title', 'unit_label', 'item_category'], filters: [['is_active', '=', 1]], limit: 200 }),
          getList('Game Title', { fields: ['name', 'title_name', 'short_code'], limit: 100 }),
        ])

        const [ch, gc, ga, it, gt] = results.map(r => r.status === 'fulfilled' ? r.value : [])
        results.forEach((r, i) => {
          if (r.status === 'rejected') console.warn(`Metadata fetch ${i} failed:`, r.reason)
        })

        channels.value = ch
        gameContexts.value = gc
        gameAccounts.value = ga
        currencyItems.value = it
        gameTitles.value = gt

        // Fetch item_category options from doctype meta
        try {
          const res = await fetch('/api/method/frappe.desk.form.load.getdoctype?doctype=Currency+Item&with_parent=0', { credentials: 'include' })
          const data = await res.json()
          const doctype = (data.docs || [])[0]
          const catField = (doctype?.fields || []).find(f => f.fieldname === 'item_category')
          if (catField && catField.options) {
            itemCategoryOpts.value = catField.options.split('\n').filter(Boolean).map(v => ({ label: v, value: v }))
          }
        } catch {}
        lastFetched.value = Date.now()
      } catch (e) {
        console.error('Failed to fetch metadata:', e)
      } finally {
        isLoading.value = false
        fetchPromise = null
      }
    })()

    return fetchPromise
  }

  async function searchLink(doctype, txt, pageLength = 20, searchfields = null) {
    const params = { doctype, txt, page_length: pageLength }
    if (searchfields) params.searchfields = searchfields.join('\n')
    return (await frappeCall('frappe.desk.search.search_link', params) || []).map(r => ({
      label: (r.description || r.value).split(',')[0].trim(),
      value: r.value,
    }))
  }

  return {
    // State
    channels,
    gameContexts,
    gameAccounts,
    currencyItems,
    gameTitles,
    itemCategoryOpts,
    isLoading,

    // Actions
    fetchMetadata,

    // Search Functions
    supplierSearchFn: async (txt) => [
      { label: '+ Tạo Supplier mới', value: '__new__' },
      ...(await searchLink('Supplier', txt, 20, ['name', 'supplier_name', 'supplier_id'])).map(r => ({ ...r, description: r.value })),
    ],
    customerSearchFn: async (txt) => [
      { label: '+ Tạo Customer mới', value: '__new__' },
      ...await searchLink('Customer', txt),
    ],

    // Computed Helpers
    channelOpts: computed(() => channels.value.map(c => ({ label: c.channel_name, value: c.name }))),
    gameContextOpts: computed(() => gameContexts.value.map(g => ({ label: g.name, value: g.name }))),
    gameTitleOpts: computed(() => gameTitles.value.map(t => ({ label: t.title_name, value: t.name }))),
    getItemOpts: (gameTitle) => computed(() => {
        const title = unref(gameTitle)
        if (!title) return currencyItems.value.map(i => ({ label: i.item_name, value: i.name }))
        return currencyItems.value
            .filter(i => i.game_title === title)
            .map(i => ({ label: i.item_name, value: i.name }))
    }),
    currencyItemMap: computed(() => {
        const map = {}
        for (const item of currencyItems.value) {
          map[item.name] = { item_name: item.item_name, game_title: item.game_title, unit_label: item.unit_label }
        }
        return map
    }),
    channelMap: computed(() => {
        const map = {}
        for (const ch of channels.value) {
          map[ch.name] = { channel_name: ch.channel_name, channel_group: ch.channel_group }
        }
        return map
    }),
    contextMap: computed(() => {
        const map = {}
        for (const ctx of gameContexts.value) {
          map[ctx.name] = { game_title: ctx.game_title, server: ctx.server, season_or_league: ctx.season_or_league, mode: ctx.mode }
        }
        return map
    })
  }
}
