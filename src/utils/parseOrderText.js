/**
 * Parse raw order text (pasted from Discord, platform messages, etc.)
 * Extracts BTag, customer name, and item lines.
 */
export function parseOrderText(rawText) {
  if (!rawText || !rawText.trim()) return { btag: null, customerName: null, items: [], unmatched: [] }

  const text = rawText.trim()
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // 1. Extract BTag (format: Name#1234)
  const btagRe = /([\w.]+#\d{4,6})/
  let btag = null
  let customerName = null

  for (const line of lines) {
    const m = line.match(btagRe)
    if (m) {
      btag = m[1]
      // Customer name = text before the btag on the same line
      const before = line.slice(0, line.indexOf(m[1])).replace(/[:\-\s]+$/, '').trim()
      if (before) customerName = before
      break
    }
  }

  // 2. Extract item lines (patterns: "100 ruby", "50x gold", "100x Ruby", "100 Ruby")
  const itemRe = /^(\d[\d,.]*)\s*x?\s+(.+)$/i
  const items = []
  const unmatched = []

  for (const line of lines) {
    if (line === btag) continue
    const m = line.match(itemRe)
    if (m) {
      const qty = parseFloat(m[1].replace(/[,]/g, ''))
      const label = m[2].trim()
      if (qty > 0 && label) {
        items.push({ raw: line, quantity: qty, label: label.toLowerCase() })
      }
    } else if (line !== btag && !line.match(btagRe)) {
      // Skip lines that are just the btag or empty
      if (line.length > 2 && line.length < 100) {
        unmatched.push(line)
      }
    }
  }

  // If no customer name found, try first unmatched line as customer name
  if (!customerName && unmatched.length > 0 && !btag?.startsWith(unmatched[0])) {
    const candidate = unmatched[0]
    // Only use as name if it doesn't look like an item or URL
    if (!candidate.match(/^\d/) && !candidate.match(/^https?:\/\//)) {
      customerName = candidate
      unmatched.shift()
    }
  }

  return { btag, customerName, items, unmatched }
}

/**
 * Match extracted items to actual Currency Item options.
 * @param {Array} extractedItems - [{ label, quantity, raw }]
 * @param {Array} itemOpts - [{ label, value }] from useMetadata
 * @returns {Array} - [{ currency_item, quantity, unit_price: null, total: null }]
 */
export function matchExtractedItems(extractedItems, itemOpts) {
  if (!extractedItems?.length || !itemOpts?.length) return []

  return extractedItems.map(ext => {
    const extLabel = ext.label.toLowerCase()

    // Exact match first
    let match = itemOpts.find(o => o.label.toLowerCase() === extLabel)

    // Partial match: opt label contains extracted label or vice versa
    if (!match) {
      match = itemOpts.find(o => {
        const optLabel = o.label.toLowerCase()
        return optLabel.includes(extLabel) || extLabel.includes(optLabel)
      })
    }

    return {
      currency_item: match ? match.value : '',
      quantity: ext.quantity,
      unit_price: null,
      total: null,
    }
  })
}
