import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/index.js'

const app = createApp(App)
app.use(router)

// Catch render/lifecycle errors so a single thrown error never blanks the SPA.
app.config.errorHandler = (err, _instance, info) => {
  console.error('[GAM errorHandler]', info, err)
}

// Surface unhandled promise rejections (fire-and-forget awaits) centrally
// instead of letting them die silently / show a bare console trace.
window.addEventListener('unhandledrejection', (e) => {
  console.error('[GAM unhandledrejection]', e.reason)
})

app.mount('#app')
