import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

// GAM-UI ESLint flat config (ESLint 9) — code-quality baseline.
// Baseline policy: errors = correctness-breaking; warnings = hygiene to clean up gradually.
// `npm run lint` should exit 0 (warnings allowed); CI gate can add `--max-warnings=0` later.
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'deploy/gam-email-worker.bundled.mjs',
      'package-lock.json',
    ],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // --- Hygiene (warn — do not block, clean up over time) ---
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // --- Correctness (error — block) ---
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-unused-private-class-members': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],

      // --- Vue: keep recommended errors, relax stylistic rules that fight the existing code style ---
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      'vue/require-default-prop': 'warn',
      'vue/require-explicit-emits': 'warn',
    },
  },

  // --- Test files: add Vitest + Playwright globals so no-undef stays useful ---
  {
    files: ['tests/unit/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['tests/e2e/**/*.spec.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        test: 'readonly',
        expect: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  // --- Node-only scripts (preflight, deploy helpers, standalone test runners) ---
  {
    files: ['scripts/**/*.{js,mjs}', 'tests/*.mjs', 'vite.config.js', 'vitest.config.js', 'postcss.config.js', 'playwright.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]
