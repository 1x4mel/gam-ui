import { describe, it, expect, beforeEach } from 'vitest'
import { useAccessGrants } from '../../src/composables/useAccessGrants.js'

/**
 * useAccessGrants — unit tests for the L2 client cache. The composable holds
 * module-level singleton state, so every case resets + reseeds explicitly
 * (mirrors how useAuth seeds it at boot). `load()` (the only network path) is
 * never called, so no frappe/fetch wiring is needed in the node test env.
 */
describe('useAccessGrants', () => {
  let api

  beforeEach(() => {
    api = useAccessGrants()
    api.reset()
    api.setFrappeRoles([])
  })

  describe('admin bypass', () => {
    it('sees everything regardless of grants', () => {
      api.seed({ is_admin: true, default_policy: 'none', grants: [] })
      expect(api.hasRoleGame('Booster', 'poe2')).toBe(true)
      expect(api.hasRoleGame('Anything', 'whatever')).toBe(true)
      expect(api.canSection('active')).toBe(true)
      expect(api.canSection('accounts')).toBe(true)
      expect(api.hasAccess('ROLE_GAME', 'X|Y')).toBe(true)
    })
  })

  describe('explicit-grant mode', () => {
    it('allows only the granted (scope,key) pairs and disables the fallback', () => {
      api.seed({
        is_admin: false,
        default_policy: 'match_role',
        grants: [{ scope: 'ROLE_GAME', key: 'Booster|poe2' }],
      })
      // granted combo
      expect(api.hasRoleGame('Booster', 'poe2')).toBe(true)
      // same role, different game → not granted
      expect(api.hasRoleGame('Booster', 'd4')).toBe(false)
      // a section that was not granted is now blocked (fallback disabled because
      // the user has >=1 grant)
      expect(api.canSection('active')).toBe(false)
      expect(api.hasAnyGrant.value).toBe(true)
    })

    it('treats a section grant independently from role/game grants', () => {
      api.seed({
        is_admin: false,
        default_policy: 'match_role',
        grants: [
          { scope: 'SECTION', key: 'active' },
          { scope: 'SECTION', key: 'emails' },
        ],
      })
      expect(api.canSection('active')).toBe(true)
      expect(api.canSection('emails')).toBe(true)
      expect(api.canSection('accounts')).toBe(false)
      // no ROLE_GAME grant → nothing visible even under the role list
      expect(api.hasRoleGame('Booster', 'poe2')).toBe(false)
    })
  })

  describe('match_role fallback (zero grants)', () => {
    it('exposes the whole role when the Frappe role matches the VALUE', () => {
      api.setFrappeRoles(['Booster'])
      api.seed({ is_admin: false, default_policy: 'match_role', grants: [] })
      expect(api.hasRoleGame('Booster', 'poe2')).toBe(true) // value match
      expect(api.hasRoleGame('Booster', 'd4')).toBe(true) // whole role visible
      expect(api.hasRoleGame('Trader', 'x')).toBe(false) // role not held
    })

    it('also matches the GAM List Option LABEL (legacy sidebar behaviour)', () => {
      // value 'BST' is not a Frappe role, but its option label 'Booster' is.
      api.setFrappeRoles(['Booster'])
      api.seed({ is_admin: false, default_policy: 'match_role', grants: [] })
      expect(api.hasRoleGame('BST', 'poe2', 'Booster')).toBe(true)
      expect(api.hasRoleGame('BST', 'poe2')).toBe(false) // without the label it cannot match
    })

    it('shows all grantable sections under the fallback', () => {
      api.setFrappeRoles(['GAM Member'])
      api.seed({ is_admin: false, default_policy: 'match_role', grants: [] })
      expect(api.canSection('active')).toBe(true)
      expect(api.canSection('accounts')).toBe(true)
      expect(api.canSection('emails')).toBe(true)
    })

    it('honours default_policy "none" (deny everything when no grants)', () => {
      api.setFrappeRoles(['Booster'])
      api.seed({ is_admin: false, default_policy: 'none', grants: [] })
      expect(api.hasRoleGame('Booster', 'poe2')).toBe(false)
      expect(api.canSection('active')).toBe(false)
    })
  })

  describe('seed / reset lifecycle', () => {
    it('grantKeys is built from the seeded grants', () => {
      api.seed({
        is_admin: false,
        default_policy: 'match_role',
        grants: [
          { scope: 'ROLE_GAME', key: 'Booster|poe2' },
          { scope: 'SECTION', key: 'active' },
        ],
      })
      expect(api.grantKeys.value.has('ROLE_GAME|Booster|poe2')).toBe(true)
      expect(api.grantKeys.value.has('SECTION|active')).toBe(true)
      expect(api.grantKeys.value.size).toBe(2)
    })

    it('reset() clears the cache back to the safe defaults', () => {
      api.seed({ is_admin: true, grants: [{ scope: 'SECTION', key: 'active' }] })
      expect(api.isAdmin.value).toBe(true)
      api.reset()
      expect(api.isAdmin.value).toBe(false)
      expect(api.hasAnyGrant.value).toBe(false)
      expect(api.defaultPolicy.value).toBe('match_role')
    })
  })
})
