import { generateTotp } from '../src/utils/totp.js'

// RFC 6238 Appendix B test vectors.
// Key (SHA-1) = ASCII "12345678901234567890" → base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
// T0 = 0, X = 30s, digits = 8.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
const VECTORS = [
  { t: 59, expected: '94287082' },
  { t: 1111111109, expected: '07081804' },
  { t: 1111111111, expected: '14050471' },
  { t: 1234567890, expected: '89005924' },
  { t: 2000000000, expected: '69279037' },
  { t: 20000000000, expected: '65353130' },
]

let ok = true
for (const v of VECTORS) {
  const code = await generateTotp(SECRET, { period: 30, digits: 8, timestamp: v.t * 1000 })
  const pass = code === v.expected
  ok = ok && pass
  console.log(`t=${String(v.t).padStart(11)}  got=${code}  expected=${v.expected}  ${pass ? '✓' : '✗ FAIL'}`)
}
console.log(ok ? '\nALL TOTP VECTORS PASS' : '\nSOME VECTORS FAILED')
process.exit(ok ? 0 : 1)
