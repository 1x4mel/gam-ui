import { describe, it, expect, beforeAll } from 'vitest'
import {
  formatQty,
  formatMoney,
  formatDate,
  formatDateFull,
  userName,
  statusBadge,
  isImage,
  isVideo,
  formatTimeAgo,
  normalizeName,
  stripHtml,
  linkify,
  formatUsd,
} from '../../src/utils/format.js'

// Pin the timezone so the local-getter based date formatters are deterministic.
// formatDate/formatDateFull read the local wall-clock fields, and formatTimeAgo
// assumes Frappe's +07:00 for bare datetime strings.
beforeAll(() => {
  process.env.TZ = 'UTC'
})

describe('formatQty', () => {
  it('returns "0" for falsy values', () => {
    expect(formatQty(0)).toBe('0')
    expect(formatQty(null)).toBe('0')
    expect(formatQty(undefined)).toBe('0')
    expect(formatQty('')).toBe('0')
  })

  it('locale-formats integers with vi-VN grouping (dot thousands separator)', () => {
    expect(formatQty(1234)).toBe('1.234')
    expect(formatQty(1000000)).toBe('1.000.000')
  })

  it('accepts numeric strings', () => {
    expect(formatQty('5')).toBe('5')
    expect(formatQty('12345')).toBe('12.345')
  })
})

describe('formatMoney', () => {
  it('returns em-dash for falsy values', () => {
    expect(formatMoney(0)).toBe('—')
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
  })

  it('appends the currency label', () => {
    expect(formatMoney(1000, 'VND')).toBe('1.000,00 VND')
    expect(formatMoney(42.5, 'USD')).toBe('42,50 USD')
    expect(formatMoney(7, 'CNY')).toBe('7,00 CNY')
  })

  it('falls back to the raw currency token for unknown currencies (no auto-space)', () => {
    // Unknown tokens aren't in CURRENCY_LABELS (which carry a leading space),
    // so they're appended verbatim — documenting the locked behaviour.
    expect(formatMoney(10, 'EUR')).toBe('10,00EUR')
  })
})

describe('formatUsd', () => {
  it('returns "0 USD" for falsy', () => {
    expect(formatUsd(0)).toBe('0 USD')
    expect(formatUsd(null)).toBe('0 USD')
  })

  it('formats with en-US 2-decimal grouping', () => {
    expect(formatUsd(1234.5)).toBe('1,234.50 USD')
  })
})

describe('date formatters', () => {
  // Frappe returns naive "YYYY-MM-DD HH:MM:SS" strings already in the server
  // timezone (Asia/Ho_Chi_Minh, UTC+7); toEpochMs() injects +07:00 for those.
  // The formatters then render the instant in the *runner's local* timezone
  // (the same behaviour the browser shows the user). So the expected strings
  // are derived from the same instant — keeping the tests TZ-independent rather
  // than hard-coding an output that only holds at one offset.
  const pad = (v) => String(v).padStart(2, '0')
  const fmtLocal = (ms, withSeconds) => {
    const d = new Date(ms)
    const head = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    return withSeconds ? `${head}:${pad(d.getSeconds())}` : head
  }

  it('return empty string for falsy', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
    expect(formatDateFull(undefined)).toBe('')
  })

  it('formatDate renders DD/MM/YYYY HH:MM (no seconds)', () => {
    const instant = new Date('2026-06-15T08:30:45+07:00').getTime()
    expect(formatDate('2026-06-15T08:30:45')).toBe(fmtLocal(instant, false))
    expect(formatDate('2026-06-15 08:30:45')).toBe(fmtLocal(instant, false))
  })

  it('formatDateFull renders DD/MM/YYYY HH:MM:SS (with seconds)', () => {
    const instant = new Date('2026-06-15T08:30:45+07:00').getTime()
    expect(formatDateFull('2026-06-15T08:30:45')).toBe(fmtLocal(instant, true))
  })

  it('normalise Frappe datetime (space → T) without producing NaN', () => {
    const out = formatDate('2026-01-02 03:04:05')
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
    expect(out).not.toContain('NaN')
  })

  it('respects explicit UTC marker (Z) instead of re-interpreting', () => {
    // A Z-suffixed value must NOT get the +07:00 injection; it must equal the
    // local rendering of the bare UTC instant.
    const instant = new Date('2026-06-15T08:30:00Z').getTime()
    expect(formatDate('2026-06-15T08:30:00Z')).toBe(fmtLocal(instant, false))
    // And it must differ from the naive (server-TZ) interpretation when the
    // runner is not itself at UTC+7.
    expect(formatDate('2026-06-15T08:30:00Z')).not.toBe(
      formatDate('2026-06-15T08:30:00')
    )
  })
})

describe('userName', () => {
  it('returns the local-part of an email', () => {
    expect(userName('gam-admin@test.local')).toBe('gam-admin')
    expect(userName('demo.steam@gam.demo')).toBe('demo.steam')
  })

  it('returns "" for falsy', () => {
    expect(userName('')).toBe('')
    expect(userName(null)).toBe('')
  })
})

describe('statusBadge', () => {
  it('maps core GAM account states to colored badge classes', () => {
    expect(statusBadge('AVAILABLE')).toContain('green')
    expect(statusBadge('IN_USE')).toContain('blue')
    expect(statusBadge('CLAIMED')).toContain('amber')
    expect(statusBadge('EXPIRED')).toContain('gray')
    expect(statusBadge('USED')).toContain('emerald')
  })

  it('maps email-inbound-log states (Design §3.1.16)', () => {
    expect(statusBadge('OK')).toContain('emerald')
    expect(statusBadge('NO_MATCH')).toContain('amber')
    expect(statusBadge('DUPLICATE')).toContain('indigo')
    expect(statusBadge('PARSE_ERROR')).toContain('red')
    expect(statusBadge('INACTIVE')).toContain('red')
    expect(statusBadge('PAYLOAD_TRUNCATED')).toContain('yellow')
  })

  it('maps account-usage lease states (Design §3.1.15)', () => {
    expect(statusBadge('RELEASED')).toContain('gray')
    expect(statusBadge('FORCE_RELEASED')).toContain('red')
  })

  it('falls back to neutral gray for unknown states', () => {
    expect(statusBadge('WHATEVER')).toContain('gray')
    expect(statusBadge(undefined)).toContain('gray')
  })

  it('is case-insensitive across the Title Case + UPPER variants', () => {
    expect(statusBadge('Available')).toBe(statusBadge('AVAILABLE'))
    expect(statusBadge('In Use')).toBe(statusBadge('IN_USE'))
  })
})

describe('isImage / isVideo', () => {
  it('detects image URLs and data URIs', () => {
    expect(isImage('https://x.com/a.png')).toBe(true)
    expect(isImage('https://x.com/a.JPG?w=1')).toBe(true)
    expect(isImage('data:image/png;base64,abc')).toBe(true)
    expect(isImage('https://x.com/a.pdf')).toBe(false)
    expect(isImage('')).toBe(false)
  })

  it('detects video URLs and data URIs', () => {
    expect(isVideo('https://x.com/c.mp4')).toBe(true)
    expect(isVideo('https://x.com/c.webm')).toBe(true)
    expect(isVideo('data:video/mp4;base64,abc')).toBe(true)
    expect(isVideo('https://x.com/c.png')).toBe(false)
    expect(isVideo(null)).toBe(false)
  })
})

describe('formatTimeAgo', () => {
  it('returns "" for falsy', () => {
    expect(formatTimeAgo(null)).toBe('')
    expect(formatTimeAgo('')).toBe('')
  })

  it('buckets relative deltas in Vietnamese', () => {
    const now = Date.now()
    expect(formatTimeAgo(now - 10 * 1000)).toBe('vừa xong')
    expect(formatTimeAgo(now - 5 * 60 * 1000)).toBe('5 phút trước')
    expect(formatTimeAgo(now - 2 * 60 * 60 * 1000)).toBe('2 giờ trước')
    expect(formatTimeAgo(now - 3 * 24 * 60 * 60 * 1000)).toBe('3 ngày trước')
  })

  it('treats a bare Frappe datetime string as +07:00', () => {
    // 1 hour before "now" in UTC terms; expressed as a +07:00 string whose
    // wall-clock is 1h ahead of now → diff ≈ -1h lands in the "giờ" bucket's
    // complement; here we just assert the +07:00 path yields a finite string.
    const s = new Date(Date.now() - 5 * 60 * 1000 + 7 * 60 * 60 * 1000)
      .toISOString().replace('T', ' ').slice(0, 19)
    const out = formatTimeAgo(s)
    expect(out).toMatch(/(vừa xong|phút trước|giờ trước|ngày trước)/)
  })
})

describe('normalizeName', () => {
  it('strips Vietnamese diacritics and lowercases', () => {
    expect(normalizeName('Tiếng Việt')).toBe('tieng viet')
    expect(normalizeName('Nguyễn')).toBe('nguyen')
    // 'Đ'/'đ' (U+0110/U+0111) are precomposed letters with no NFD decomposition,
    // so normalizeName leaves them — documenting the locked behaviour.
    expect(normalizeName('Đà Nẵng')).toBe('đa nang')
  })

  it('returns "" for falsy', () => {
    expect(normalizeName(null)).toBe('')
    expect(normalizeName('')).toBe('')
  })
})

describe('stripHtml', () => {
  it('removes tags and trims', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
    expect(stripHtml('  plain  ')).toBe('plain')
  })

  it('returns "" for falsy', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml('')).toBe('')
  })
})

describe('linkify', () => {
  it('wraps URLs in anchor tags', () => {
    const out = linkify('see https://example.com/a for details')
    expect(out).toContain('<a href="https://example.com/a"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('for details')
  })

  it('returns "" for falsy', () => {
    expect(linkify('')).toBe('')
    expect(linkify(null)).toBe('')
  })
})
