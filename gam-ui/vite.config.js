import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// NOTE: Vite does NOT populate `process.env` from .env files — only
// import.meta.env / loadEnv(). Reading process.env.VITE_* here silently fell
// back to defaults, so VITE_BASE_URL=/gam-ui/ (.env.production) was ignored and
// the prod build rooted assets at '/' (404 behind nginx's /gam-ui/ alias). Use
// loadEnv(mode) so `base` + proxy targets read .env.development (dev) /
// .env.production (prod). Vitest config lives separately in vitest.config.js.
//  - web (gunicorn):    8000  -> proxy /api
//  - socketio (node):   9000  -> proxy /socket.io (ws enabled)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // '' => load all keys (incl. VITE_*), merged with .env.[mode].
  const env = loadEnv(mode, process.cwd(), '')
  const DEV_API_TARGET = env.VITE_DEV_API_TARGET || 'http://localhost:8000'
  const DEV_SOCKETIO_TARGET = env.VITE_DEV_SOCKETIO_TARGET || 'http://localhost:9000'
  const FRAPPE_SITE = env.VITE_FRAPPE_SITE || 'erp.local'

  return {
    // Prod serves at /gam-ui/ (nginx static); dev uses '/'.
    base: env.VITE_BASE_URL || '/',
    plugins: [vue(), tailwindcss()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: DEV_API_TARGET,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('X-Frappe-Site-Name', FRAPPE_SITE)
            })
          },
        },
        '/socket.io': {
          target: DEV_SOCKETIO_TARGET,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('X-Frappe-Site-Name', FRAPPE_SITE)
            })
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      // 'hidden' emits dist/assets/*.js.map for production debugging without
      // injecting a `//# sourceMappingURL=` comment into the bundles (browsers
      // won't auto-fetch them). Upload the maps to your error-tracking service
      // rather than deploying them to the public asset dir.
      sourcemap: 'hidden',
    },
  }
})
