/**
 * VietQR Utility for EMVCo QR Code standard
 * Spec: https://vietqr.net/portal-service/download/documents/VietQR-Service-User-Guide-v1.0-202106.pdf
 */

export const BANKS = [
  { bin: '970425', name: 'ABBank', shortName: 'ABB' },
  { bin: '970416', name: 'ACB', shortName: 'ACB' },
  { bin: '970405', name: 'Agribank', shortName: 'VBA' },
  { bin: '970409', name: 'BacABank', shortName: 'BAB' },
  { bin: '970438', name: 'BaoVietBank', shortName: 'BVB' },
  { bin: '970454', name: 'VietCapitalBank', shortName: 'VCCB' },
  { bin: '970418', name: 'BIDV', shortName: 'BIDV' },
  { bin: '546034', name: 'CAKE by VPBank', shortName: 'CAKE' },
  { bin: '970444', name: 'CBBank', shortName: 'CB' },
  { bin: '422589', name: 'CIMB', shortName: 'CIMB' },
  { bin: '970446', name: 'CoopBank', shortName: 'COOP' },
  { bin: '796500', name: 'DBS Bank', shortName: 'DBS' },
  { bin: '970431', name: 'Eximbank', shortName: 'EIB' },
  { bin: '970408', name: 'GPBank', shortName: 'GPB' },
  { bin: '970437', name: 'HDBank', shortName: 'HDB' },
  { bin: '970442', name: 'HongLeongBank', shortName: 'HLB' },
  { bin: '458761', name: 'HSBC Vietnam', shortName: 'HSBC' },
  { bin: '970456', name: 'IBK HCM', shortName: 'IBK' },
  { bin: '970455', name: 'IBK HN', shortName: 'IBK' },
  { bin: '970434', name: 'IndovinaBank', shortName: 'IVB' },
  { bin: '668888', name: 'Kasikornbank', shortName: 'KBank' },
  { bin: '970452', name: 'KienLongBank', shortName: 'KLB' },
  { bin: '970463', name: 'KookminBank HCM', shortName: 'KBHCM' },
  { bin: '970462', name: 'KookminBank HN', shortName: 'KBHN' },
  { bin: '970449', name: 'LPBank', shortName: 'LPB' },
  { bin: '963369', name: 'Liobank', shortName: 'LIO' },
  { bin: '970422', name: 'MBBank', shortName: 'MB' },
  { bin: '970414', name: 'OceanBank', shortName: 'OJB' },
  { bin: '970426', name: 'MSB', shortName: 'MSB' },
  { bin: '970428', name: 'NamABank', shortName: 'NAB' },
  { bin: '970419', name: 'NCB', shortName: 'NCB' },
  { bin: '801011', name: 'NonghyupBank', shortName: 'NH' },
  { bin: '970448', name: 'OCB', shortName: 'OCB' },
  { bin: '970430', name: 'PGBank', shortName: 'PGB' },
  { bin: '970439', name: 'PublicBank', shortName: 'PBB' },
  { bin: '970412', name: 'PVcomBank', shortName: 'PVC' },
  { bin: '970403', name: 'Sacombank', shortName: 'STB' },
  { bin: '970400', name: 'SaigonBank', shortName: 'SGB' },
  { bin: '970429', name: 'SCB', shortName: 'SCB' },
  { bin: '970440', name: 'SeABank', shortName: 'SEA' },
  { bin: '970443', name: 'SHB', shortName: 'SHB' },
  { bin: '970424', name: 'ShinhanBank', shortName: 'SHN' },
  { bin: '970410', name: 'StandardChartered', shortName: 'SC' },
  { bin: '970407', name: 'Techcombank', shortName: 'TCB' },
  { bin: '963388', name: 'Timo', shortName: 'TIMO' },
  { bin: '970423', name: 'TPBank', shortName: 'TPB' },
  { bin: '546035', name: 'Ubank by VPBank', shortName: 'UBANK' },
  { bin: '970458', name: 'UOB Vietnam', shortName: 'UOB' },
  { bin: '970441', name: 'VIB', shortName: 'VIB' },
  { bin: '970427', name: 'VietABank', shortName: 'VAB' },
  { bin: '970433', name: 'VietBank', shortName: 'VVB' },
  { bin: '970436', name: 'Vietcombank', shortName: 'VCB' },
  { bin: '970415', name: 'VietinBank', shortName: 'CTG' },
  { bin: '970406', name: 'VikkiBank', shortName: 'VIKKI' },
  { bin: '970432', name: 'VPBank', shortName: 'VPB' },
  { bin: '970421', name: 'VietNgaBank', shortName: 'VRB' },
  { bin: '970457', name: 'WooriBank', shortName: 'WB' },
]

/**
 * Provider GUID mapping
 */
const PROVIDER_GUIDS = {
  A000000727: 'VietQR',
  A000000775: 'VNPay',
}

/**
 * Additional provider mapping (extensible)
 */
const ADDITIONAL_PROVIDERS = {}

/**
 * Tag constants for EMVCo QR
 */
const TAG = {
  VERSION: '00',
  INIT_METHOD: '01',
  VIETQR: '38',
  CATEGORY: '52',
  CURRENCY: '53',
  AMOUNT: '54',
  NATION: '58',
  MERCHANT_NAME: '59',
  ADDITIONAL_DATA: '62',
  CRC: '63',
}

const SUB_TAG = {
  GUID: '00',
  DATA: '01',
  SERVICE: '02',
}

const BANK_TAG = {
  BANK_BIN: '00',
  BANK_NUMBER: '01',
}

const PURPOSE_TAG = {
  PURPOSE: '08',
}

const VIETQR_GUID = 'A000000727'
const VNPAY_GUID = 'A000000775'
const SERVICE_TRANSFER = 'QRIBFTTA'

/**
 * Remove Vietnamese accents and convert to Uppercase ASCII
 */
export function removeAccents(str) {
  if (!str) return ''
  return str.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .trim()
}

/**
 * CRC16 CCITT-FALSE lookup table for fast computation
 */
const CRC_TABLE = new Int32Array([
  0, 4129, 8258, 12387, 16516, 20645, 24774, 28903, 33032, 37161, 41290, 45419,
  49548, 53677, 57806, 61935, 4657, 528, 12915, 8786, 21173, 17044, 29431,
  25302, 37689, 33560, 45947, 41818, 54205, 50076, 62463, 58334, 9314, 13379,
  1056, 5121, 25830, 29895, 17572, 21637, 42346, 46411, 34088, 38153, 58862,
  62927, 50604, 54669, 13907, 9842, 5649, 1584, 30423, 26358, 22165, 18100,
  46939, 42874, 38681, 34616, 63455, 59390, 55197, 51132, 18628, 22757, 26758,
  30887, 2112, 6241, 10242, 14371, 51660, 55789, 59790, 63919, 35144, 39273,
  43274, 47403, 23285, 19156, 31415, 27286, 6769, 2640, 14899, 10770, 56317,
  52188, 64447, 60318, 39801, 35672, 47931, 43802, 27814, 31879, 19684, 23749,
  11298, 15363, 3168, 7233, 60846, 64911, 52716, 56781, 44330, 48395, 36200,
  40265, 32407, 28342, 24277, 20212, 15891, 11826, 7761, 3696, 65439, 61374,
  57309, 53244, 48923, 44858, 40793, 36728, 37256, 33193, 45514, 41451, 53516,
  49453, 61774, 57711, 4224, 161, 12482, 8419, 20484, 16421, 28742, 24679,
  33721, 37784, 41979, 46042, 49981, 54044, 58239, 62302, 689, 4752, 8947,
  13010, 16949, 21012, 25207, 29270, 46570, 42443, 38312, 34185, 62830, 58703,
  54572, 50445, 13538, 9411, 5280, 1153, 29798, 25671, 21540, 17413, 42971,
  47098, 34713, 38840, 59231, 63358, 50973, 55100, 9939, 14066, 1681, 5808,
  26199, 30326, 17941, 22068, 55628, 51565, 63758, 59695, 39368, 35305, 47498,
  43435, 22596, 18533, 30726, 26663, 6336, 2273, 14466, 10403, 52093, 56156,
  60223, 64286, 35833, 39896, 43963, 48026, 19061, 23124, 27191, 31254, 2801,
  6864, 10931, 14994, 64814, 60687, 56684, 52557, 48554, 44427, 40424, 36297,
  31782, 27655, 23652, 19525, 15522, 11395, 7392, 3265, 61215, 65342, 53085,
  57212, 44955, 49082, 36825, 40952, 28183, 32310, 20053, 24180, 11923, 16050,
  3793, 7920,
])

/**
 * Calculate CRC16 CCITT-FALSE using lookup table
 */
function calculateCRC16(data) {
  let crc = 0xFFFF
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[((crc >> 8) ^ data.charCodeAt(i)) & 0xFF] ^ (crc << 8)) & 0xFFFF
  }
  return crc
}

function crcToString(data) {
  return ('0000' + calculateCRC16(data).toString(16).toUpperCase()).slice(-4)
}

/**
 * Format helper for TLV (Tag-Length-Value)
 */
function f(tag, value) {
  if (!tag || tag.length !== 2 || !value) return ''
  const valStr = String(value)
  return tag + ('00' + valStr.length).slice(-2) + valStr
}

/**
 * Get provider name by GUID
 */
function getProviderByGuid(guid) {
  if (!guid) return null
  const upper = guid.toUpperCase()
  return PROVIDER_GUIDS[upper] ? PROVIDER_GUIDS[upper] : ADDITIONAL_PROVIDERS[upper] ? ADDITIONAL_PROVIDERS[upper] : null
}

/**
 * Simple EMVCo Parser
 */
function parseTLV(data) {
  const tlv = []
  let p = 0
  while (p < data.length) {
    const t = data.substring(p, p + 2)
    const l = parseInt(data.substring(p + 2, p + 4))
    const v = data.substring(p + 4, p + 4 + l)
    if (isNaN(l) || t === '') break
    tlv.push({ t, l, v })
    p += 4 + l
  }
  return tlv
}

/**
 * Encode VietQR EMVCo string (NAPAS Standard)
 */
export function encodeVietQR({ bankBin, accountNumber, amount, description, accountName }) {
  // Tag 00: Payload Format Indicator (Fixed "01")
  let version = f(TAG.VERSION, '01')

  // Tag 01: Point of Initiation Method (11 for Static, 12 for Dynamic/Pre-filled)
  let initMethod = f(TAG.INIT_METHOD, amount ? '12' : '11')

  // Tag 38: Merchant Account Information (VietQR / NAPAS)
  const guid = f(SUB_TAG.GUID, VIETQR_GUID)
  const providerData = f(BANK_TAG.BANK_BIN, bankBin) + f(BANK_TAG.BANK_NUMBER, accountNumber)
  const service = f(SUB_TAG.SERVICE, SERVICE_TRANSFER)
  const tag38Value = guid + f(SUB_TAG.DATA, providerData) + service
  let merchantInfo = f(TAG.VIETQR, tag38Value)

  // Tag 53: Transaction Currency (Fixed "704" for VND)
  let currency = f(TAG.CURRENCY, '704')

  // Tag 54: Transaction Amount
  let amountTag = amount ? f(TAG.AMOUNT, String(Math.floor(amount))) : ''

  // Tag 58: Country Code (Fixed "VN")
  let nation = f(TAG.NATION, 'VN')

  // Tag 62: Additional Data Field Template (purpose/description)
  let purposeTag = description ? f(PURPOSE_TAG.PURPOSE, removeAccents(description)) : ''
  let additionalData = purposeTag ? f(TAG.ADDITIONAL_DATA, purposeTag) : ''

  // Build payload without CRC
  let payload = version + initMethod + merchantInfo + currency + amountTag + nation + additionalData + TAG.CRC + '04'

  // Tag 63: CRC
  return payload + crcToString(payload)
}

/**
 * Decode VietQR / VNPay EMVCo QR string
 * Enhanced to support multi-provider (VietQR, VNPay, and unknown providers)
 * with CRC validation and fallback extraction
 */
export function decodeVietQR(qrString) {
  if (!qrString) return {}
  const result = {}

  // CRC validation
  const dataWithoutCrc = qrString.slice(0, -4)
  const crcInQr = qrString.slice(-4).toUpperCase()
  result.isValid = crcToString(dataWithoutCrc) === crcInQr

  const rootTags = parseTLV(qrString)
  let providerGuid = null

  rootTags.forEach(tag => {
    const tagNum = parseInt(tag.t)

    // Tag 38 (VietQR) or tags 26-51 (VNPay and other providers)
    if (tag.t === '38' || (tagNum >= 26 && tagNum <= 51)) {
      const subTags = parseTLV(tag.v)
      let currentGuid = null

      subTags.forEach(sub => {
        // Check GUID to identify provider
        if (sub.t === SUB_TAG.GUID) {
          currentGuid = sub.v
          providerGuid = getProviderByGuid(sub.v)
        }

        if (sub.t === SUB_TAG.DATA) {
          if (currentGuid === VIETQR_GUID) {
            // VietQR: standard BIN + account number format
            parseTLV(sub.v).forEach(inner => {
              if (inner.t === BANK_TAG.BANK_BIN && !result.bankBin) result.bankBin = inner.v
              if (inner.t === BANK_TAG.BANK_NUMBER && !result.accountNumber) result.accountNumber = inner.v
            })
          } else if (currentGuid === VNPAY_GUID) {
            // VNPay: merchant ID is the account
            result.merchantId = sub.v
            result.accountNumber = sub.v
          } else {
            // Unknown provider: try to extract bank_bin/bank_number from nested TLV
            const innerTags = parseTLV(sub.v)
            let foundBankInfo = false
            innerTags.forEach(inner => {
              if (inner.t === BANK_TAG.BANK_BIN && !result.bankBin) {
                result.bankBin = inner.v
                foundBankInfo = true
              }
              if (inner.t === BANK_TAG.BANK_NUMBER && !result.accountNumber) {
                result.accountNumber = inner.v
                foundBankInfo = true
              }
            })
            // Fallback: if no structured bank info found and value is long enough, use as account
            if (!foundBankInfo && sub.v.length > 4 && !result.accountNumber) {
              result.accountNumber = sub.v
            }
          }
        }

        if (sub.t === SUB_TAG.SERVICE) {
          result.service = sub.v
        }
      })
    } else if (tag.t === TAG.AMOUNT) {
      result.amount = parseFloat(tag.v)
    } else if (tag.t === TAG.MERCHANT_NAME) {
      result.accountName = tag.v
    } else if (tag.t === TAG.ADDITIONAL_DATA) {
      parseTLV(tag.v).forEach(sub => {
        if (sub.t === PURPOSE_TAG.PURPOSE) result.description = sub.v
      })
    }
  })

  // Set provider info
  if (providerGuid) {
    result.provider = providerGuid
  }

  // Fallback: if no provider detected but looks like a bank transfer (numeric account + QRIBFTTA service)
  if (!providerGuid && result.accountNumber && result.accountNumber.match(/^\d{6,12}$/) && result.service === 'QRIBFTTA') {
    result.provider = 'VNPay'
  }

  // Second pass fallback: try all tags 26-51 if bankBin or accountNumber still missing
  if (!result.bankBin || !result.accountNumber) {
    rootTags.forEach(tag => {
      const tagNum = parseInt(tag.t)
      if ((tag.t === '38' || (tagNum >= 26 && tagNum <= 51)) && (!result.bankBin || !result.accountNumber)) {
        parseTLV(tag.v).forEach(sub => {
          if (sub.v && sub.v.length > 8) {
            parseTLV(sub.v).forEach(inner => {
              if (!result.bankBin && inner.t === BANK_TAG.BANK_BIN) result.bankBin = inner.v
              if (!result.accountNumber && inner.t === BANK_TAG.BANK_NUMBER) result.accountNumber = inner.v
            })
          }
        })
      }
    })
  }

  // Map bankBin to Bank Name
  if (result.bankBin) {
    const bank = BANKS.find(b => b.bin === result.bankBin)
    if (bank) {
      result.bankName = bank.name
      result.provider ||= 'VietQR'
    }
  }

  return result
}

export function getBankNameByBin(bin) {
  const bank = BANKS.find(b => b.bin === bin)
  return bank ? bank.name : null
}

export function getBankBinByName(name) {
  if (!name) return null
  const n = name.toLowerCase()
  const bank = BANKS.find(b =>
    b.name.toLowerCase().includes(n) ||
    (b.shortName && b.shortName.toLowerCase() === n) ||
    (b.shortName && n.includes(b.shortName.toLowerCase()))
  )
  return bank ? bank.bin : null
}
