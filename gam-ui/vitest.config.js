import { defineConfig } from 'vitest/config'

// Dedicated Vitest config — takes priority over vite.config.js so the build
// plugins (@tailwindcss/vite, @vitejs/plugin-vue, dev proxy) don't interfere
// with the test runner. The unit tests are pure logic + composables in plain
// `.js`, so neither the Vue SFC compiler nor Tailwind is needed here.
//
// environment: 'node' + isolate:false — this dev sandbox cannot initialise any
// vitest DOM environment (jsdom aborts with an opaque
// "Cannot read properties of undefined (reading 'push')" while loading the DOM
// library) and cannot spin up vitest's per-file isolated worker registries.
// The composable tests therefore exercise `useTotpCode()` directly (no DOM
// mount): `ref`/`setInterval`/`crypto.subtle` all work in node, and Vue's
// `onUnmounted` simply no-ops outside a setup() context. This is safe — every
// file imports pure functions / standalone composables with no shared mutable
// module state, and intervals are torn down per test via stop()/reset().
//
// Tests import { describe, it, expect, vi } from 'vitest' explicitly, so
// `globals: true` is intentionally left off (it triggers the sandbox crash).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    isolate: false,
  },
})
