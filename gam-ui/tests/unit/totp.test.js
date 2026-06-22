import { describe, it, expect } from 'vitest'
import { base32Decode, parseTotpSecret, generateTotp, totpWindowInfo } from '../../src/utils/totp.js'

describe('base32Decode', () => {
  it('decodes a canonical RFC 4648 base32 string', () => {
    // "JBSWY3DP" → "Hello" (the classic base32 example seed)
    const bytes = base32Decode('JBSWY3DP')
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]) // "Hello"
  })

  it('is case-insensitive', () => {
    expect(Array.from(base32Decode('jbswy3dp'))).toEqual(Array.from(base32Decode('JBSWY3DP')))
  })

  it('ignores spaces and padding (=)', () => {
    expect(Array.from(base32Decode('JBSW Y3DP===='))).toEqual([72, 101, 108, 108, 111])
  })

  it('skips unknown characters gracefully', () => {
    // '0','1','8','9' are not in the base32 alphabet → ignored.
    expect(Array.from(base32Decode('JBSWY3DP-!09'))).toEqual([72, 101, 108, 108, 111])
  })

  it('returns an empty Uint8Array for empty/garbage input', () => {
    expect(base32Decode('').length).toBe(0)
    expect(base32Decode('0000').length).toBe(0)
    expect(base32Decode(null).length).toBe(0)
  })
})

describe('parseTotpSecret', () => {
  it('returns a bare secret unchanged', () => {
    expect(parseTotpSecret('JBSWY3DP')).toBe('JBSWY3DP')
  })

  it('extracts the secret from an otpauth:// provisioning URL', () => {
    const url = 'otpauth://totp/GAM:demo%40gam.demo?secret=JBSWY3DP&issuer=GAM&period=30&digits=6'
    expect(parseTotpSecret(url)).toBe('JBSWY3DP')
  })

  it('handles otpauth:// URLs case-insensitively', () => {
    const url = 'OTPAUTH://totp/x?secret=KRSXG5A='
    expect(parseTotpSecret(url)).toBe('KRSXG5A=')
  })

  it('returns "" for falsy', () => {
    expect(parseTotpSecret('')).toBe('')
    expect(parseTotpSecret(null)).toBe('')
    expect(parseTotpSecret(undefined)).toBe('')
  })

  it('falls back to the raw value when otpauth URL has no secret param', () => {
    const url = 'otpauth://totp/x?issuer=GAM'
    expect(parseTotpSecret(url)).toBe('otpauth://totp/x?issuer=GAM')
  })
})

describe('generateTotp — RFC 6238 Appendix B vectors (SHA-1, period 30, 8 digits)', () => {
  // Key = ASCII "12345678901234567890" → base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  const VECTORS = [
    { t: 59, expected: '94287082' },
    { t: 1111111109, expected: '07081804' },
    { t: 1111111111, expected: '14050471' },
    { t: 1234567890, expected: '89005924' },
    { t: 2000000000, expected: '69279037' },
    { t: 20000000000, expected: '65353130' },
  ]

  for (const v of VECTORS) {
    it(`matches RFC vector at t=${v.t}`, async () => {
      const code = await generateTotp(SECRET, { period: 30, digits: 8, timestamp: v.t * 1000 })
      expect(code).toBe(v.expected)
    })
  }

  it('produces a 6-digit zero-padded code by default', async () => {
    const code = await generateTotp('JBSWY3DP', { timestamp: 59 * 1000 })
    expect(code).toMatch(/^\d{6}$/)
  })

  it('returns "" for empty/invalid secret', async () => {
    expect(await generateTotp('', { timestamp: 59 * 1000 })).toBe('')
    expect(await generateTotp(null)).toBe('')
    // alphabet-only garbage decodes to 0 bytes → ''
    expect(await generateTotp('!!!!!', { timestamp: 59 * 1000 })).toBe('')
  })

  it('accepts an otpauth:// URL directly', async () => {
    const url = `otpauth://totp/x?secret=${SECRET}`
    const a = await generateTotp(url, { period: 30, digits: 8, timestamp: 59 * 1000 })
    expect(a).toBe('94287082')
  })

  it('is stable within a 30s window and changes across windows', async () => {
    const c1 = await generateTotp(SECRET, { period: 30, digits: 8, timestamp: 60 * 1000 })
    const c2 = await generateTotp(SECRET, { period: 30, digits: 8, timestamp: 89 * 1000 })
    const c3 = await generateTotp(SECRET, { period: 30, digits: 8, timestamp: 90 * 1000 })
    expect(c1).toBe(c2) // same window [60s, 90s)
    expect(c1).not.toBe(c3) // window rolls at 90s
  })
})

describe('totpWindowInfo', () => {
  it('computes counter, secondsLeft and progress for period 30', () => {
    // timestamp 89_999ms → second 89 → counter 2, remaining = 30 - (89 % 30) = 30 - 29 = 1
    const info = totpWindowInfo(30, 89_999)
    expect(info.counter).toBe(2)
    expect(info.secondsLeft).toBe(1)
    expect(info.progress).toBeCloseTo(1 / 30, 5)
  })

  it('wraps progress back to 1 at a window boundary', () => {
    const info = totpWindowInfo(30, 60_000)
    expect(info.counter).toBe(2)
    expect(info.secondsLeft).toBe(30)
    expect(info.progress).toBeCloseTo(1, 5)
  })

  it('defaults period to 30 and uses current time when omitted', () => {
    const info = totpWindowInfo()
    expect(info.secondsLeft).toBeGreaterThan(0)
    expect(info.secondsLeft).toBeLessThanOrEqual(30)
    expect(info.progress).toBeGreaterThan(0)
    expect(info.progress).toBeLessThanOrEqual(1)
  })
})
