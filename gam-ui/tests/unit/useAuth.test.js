import { describe, it, expect, beforeEach, vi } from 'vitest'

// useAuth boots through getGamSession — mock the whole api module so the test
// runs in pure node with no fetch / document.
vi.mock('../../src/api/index.js', () => ({
  getGamSession: vi.fn(),
}))

import { getGamSession } from '../../src/api/index.js'
import { useAuth } from '../../src/composables/useAuth.js'
import { useAccessGrants } from '../../src/composables/useAccessGrants.js'

describe('useAuth (P2.5)', () => {
  beforeEach(() => {
    getGamSession.mockReset()
    useAuth().clearAuth()
    useAccessGrants().reset()
  })

  it('dedups concurrent fetchUser() into a single getGamSession round-trip', async () => {
    let resolveSession
    getGamSession.mockImplementation(
      () => new Promise((resolve) => { resolveSession = resolve })
    )

    const auth = useAuth()
    const p1 = auth.fetchUser(true)
    const p2 = auth.fetchUser(true)

    // Both callers share one in-flight boot promise → only one API call.
    expect(getGamSession).toHaveBeenCalledTimes(1)

    resolveSession({ user: 'admin@x', full_name: 'Admin', roles: ['GAM Admin'] })
    await expect(p1).resolves.toBe('admin@x')
    await expect(p2).resolves.toBe('admin@x')
  })

  it('seeds access grants from the boot payload', async () => {
    getGamSession.mockResolvedValue({
      user: 'member@x',
      full_name: 'Member',
      roles: ['GAM Member'],
      access: {
        is_admin: false,
        default_policy: 'match_role',
        grants: [{ scope: 'SECTION', key: 'DASHBOARD' }],
      },
    })

    const auth = useAuth()
    await auth.fetchUser(true)

    expect(useAccessGrants().grantKeys.value.has('SECTION|DASHBOARD')).toBe(true)
  })

  it('clearAuth() resets the access-grant cache so grants do not leak after logout', async () => {
    getGamSession.mockResolvedValue({
      user: 'member@x',
      full_name: 'Member',
      roles: ['GAM Member'],
      access: {
        is_admin: false,
        default_policy: 'match_role',
        grants: [{ scope: 'SECTION', key: 'DASHBOARD' }],
      },
    })

    const auth = useAuth()
    await auth.fetchUser(true)
    expect(useAccessGrants().grantKeys.value.size).toBe(1)

    auth.clearAuth()

    expect(useAccessGrants().grantKeys.value.size).toBe(0)
    expect(auth.user.value).toBe('')
    expect(auth.roles.value).toEqual([])
  })
})
