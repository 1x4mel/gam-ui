/**
 * Smart synchronization of arrays to preserve reactivity and object references.
 * @param {Array} currentArray - The Vue reactive array (e.g., targetRef.value)
 * @param {Array} newArray - The fresh array from API
 * @param {String} key - The unique identifier field (default: 'name')
 */
export function syncArray(currentArray, newArray, key = 'name') {
  if (!currentArray || !newArray) return

  // 1. Remove items that no longer exist in newArray
  const incomingKeys = new Set(newArray.map(item => item[key]))
  for (let i = currentArray.length - 1; i >= 0; i--) {
    if (!incomingKeys.has(currentArray[i][key])) {
      currentArray.splice(i, 1)
    }
  }

  // 2. Map existing items for quick lookup
  const currentMap = new Map()
  currentArray.forEach(item => {
    currentMap.set(item[key], item)
  })

  // 3. Update existing or push new items
  newArray.forEach((newItem) => {
    const existing = currentMap.get(newItem[key])
    if (existing) {
      for (const prop in newItem) {
        if (existing[prop] !== newItem[prop]) {
          existing[prop] = newItem[prop]
        }
      }
    } else {
      currentArray.push(newItem)
      currentMap.set(newItem[key], newItem)
    }
  })

  // 4. Reorder to match incoming array order
  const incomingOrder = new Map(newArray.map((item, index) => [item[key], index]))
  let needsSort = currentArray.length !== newArray.length
  if (!needsSort) {
    for (let i = 0; i < currentArray.length; i++) {
      const expected = newArray[i][key]
      if (currentArray[i][key] !== expected) {
        needsSort = true
        break
      }
    }
  }
  if (needsSort) {
    currentArray.sort((a, b) => (incomingOrder.get(a[key]) ?? 0) - (incomingOrder.get(b[key]) ?? 0))
  }
}
