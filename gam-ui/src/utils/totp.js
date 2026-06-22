/**
 * Client-side TOTP (RFC 6238) generation via the Web Crypto API.
 *
 * Design §5.6: the GAM Account's `totp_secret` is revealed once through the
 * audited `gam.api.reveal_password` call, then the 6-digit code is generated
 * on the client and refreshed every 30 seconds (§8.2 step 5).
 *
 * No third-party dependency — HMAC-SHA1 is provided natively by
 * `crypto.subtle`, which keeps the bundle small and avoids pulling in
 * Node-oriented libs (otplib) that are heavy and rely on Node shims.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * RFC 4648 base32 decode (case-insensitive; ignores spaces + padding).
 * Unknown characters are skipped so provisioned secrets with stray chars
 * (e.g. ` ` grouping) still decode.
 * @param {string} input
 * @returns {Uint8Array}
 */
export function base32Decode(input) {
  const cleaned = String(input || '').toUpperCase().replace(/[\s=]/g, '')
  let bits = ''
  for (const ch of cleaned) {
    const v = BASE32_ALPHABET.indexOf(ch)
    if (v === -1) continue
    bits += v.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return new Uint8Array(bytes)
}

/**
 * Extract a raw base32 secret from a value that may be a bare secret or an
 * `otpauth://totp/...?secret=...` provisioning URL.
 * @param {string} raw
 * @returns {string}
 */
export function parseTotpSecret(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^otpauth:\/\//i.test(value)) {
    try {
      const secret = new URL(value).searchParams.get('secret')
      if (secret) return secret
    } catch {
      /* not a valid URL — fall through to raw value */
    }
  }
  return value
}

/** @param {Uint8Array} keyBytes @param {Uint8Array} messageBytes @returns {Promise<Uint8Array>} */
async function hmacSha1(keyBytes, messageBytes) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes)
  return new Uint8Array(signature)
}

/** 8-byte big-endian encoding of a 64-bit counter (RFC 4226 §5.1). */
function counterToBytes(counter) {
  const bytes = new Uint8Array(8)
  let value = counter
  for (let i = 7; i >= 0; i--) {
    bytes[i] = value & 0xff
    // Use division so values above 2^31 still encode correctly (future-proof).
    value = Math.floor(value / 256)
  }
  return bytes
}

/**
 * HOTP (RFC 4226) for a given counter.
 * @param {Uint8Array} key
 * @param {number} counter
 * @param {number} digits
 * @returns {Promise<string>}
 */
async function hotp(key, counter, digits) {
  const hmac = await hmacSha1(key, counterToBytes(counter))
  const offset = hmac[hmac.length - 1] & 0x0f
  // 31-bit big-endian dynamic truncation
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  const modulo = 10 ** digits
  return String(binary % modulo).padStart(digits, '0')
}

/**
 * Generate a TOTP code (RFC 6238).
 *
 * @param {string} rawSecret base32 secret (or `otpauth://` URL)
 * @param {{ period?: number, digits?: number, timestamp?: number }} [opts]
 * @returns {Promise<string>} numeric code, or '' if the secret is empty/invalid
 */
export async function generateTotp(rawSecret, opts = {}) {
  const { period = 30, digits = 6, timestamp = Date.now() } = opts
  const secret = parseTotpSecret(rawSecret)
  if (!secret) return ''
  const key = base32Decode(secret)
  if (!key.length) return ''
  const counter = Math.floor(timestamp / 1000 / period)
  return hotp(key, counter, digits)
}

/**
 * Metadata for the current time-step window.
 * @param {number} [period]
 * @param {number} [timestamp] epoch ms
 * @returns {{ counter: number, secondsLeft: number, progress: number }}
 */
export function totpWindowInfo(period = 30, timestamp = Date.now()) {
  const seconds = Math.floor(timestamp / 1000)
  const remaining = period - (seconds % period)
  return {
    counter: Math.floor(seconds / period),
    secondsLeft: remaining,
    progress: remaining / period,
  }
}
