import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// getList() runs in pure node: the GET path only needs global fetch (no CSRF /
// DOM helpers). We stub fetch per test.
function mockResponse(payload, status = 200) {
  return {
    status,
    ok: status < 400,
    json: async () => payload,
    clone: () => mockResponse(payload, status),
  }
}

describe('getList (P2.1)', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns the data array on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: [{ name: 'x' }] }))
    const { getList } = await import('../../src/api/index.js')

    const rows = await getList('GAM Email', { fields: ['name'] })
    expect(rows).toEqual([{ name: 'x' }])
  })

  it('throws a parsed error instead of silently swallowing backend errors', async () => {
    // Frappe _server_messages = JSON-encoded array of JSON-encoded message objects.
    const serverMessages = JSON.stringify([JSON.stringify({ message: 'No permission' })])
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({ exc: 'Traceback (most recent call last): ...', _server_messages: serverMessages })
    )
    const { getList } = await import('../../src/api/index.js')

    await expect(getList('GAM Email')).rejects.toThrow('No permission')
  })
})
