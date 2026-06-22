import { ref, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

const RT_SITE = import.meta.env.VITE_FRAPPE_SITE || ''
const RT_SOCKETIO_PORT = import.meta.env.VITE_SOCKETIO_PORT || ''

function getNsp() {
  // Must match frappe's socketio_client.js: host + "/" + sitename
  if (!RT_SITE) return '/'
  return '/' + RT_SITE
}

function getSocketUrl() {
  // Production (nginx on port 80/443): /socket.io is proxied → same origin (return undefined)
  // Dev (Vite on port 5173, bench start): socketio runs on separate port → use VITE_SOCKETIO_PORT
  const port = window.location.port
  const isProduction = !port || port === '80' || port === '443'
  if (isProduction) return undefined
  if (RT_SOCKETIO_PORT) {
    const proto = window.location.protocol === 'https:' ? 'https' : 'http'
    return `${proto}://${window.location.hostname}:${RT_SOCKETIO_PORT}`
  }
  return undefined
}

let socket = null
const connected = ref(false)
const listSubscribers = {}
const docSubscribers = {}
const customSubscribers = {}

function getSocket() {
  if (socket) return socket

  try {
    const baseUrl = getSocketUrl()
    const nsp = getNsp()
    // Full URL → baseUrl + nsp; no baseUrl → just nsp (uses window.location.origin)
    const url = baseUrl ? baseUrl + nsp : nsp

    socket = io(url, {
      path: '/socket.io',
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 20,
      transports: ['polling', 'websocket'],
      autoConnect: true,
      extraHeaders: {
        'x-frappe-site-name': RT_SITE,
      },
    })

    socket.on('connect', () => { 
      console.log('Realtime connected')
      connected.value = true 
    })
    
    socket.on('disconnect', () => { 
      console.warn('Realtime disconnected')
      connected.value = false 
    })
    
    socket.on('connect_error', (error) => {
      console.error('Realtime connection error:', error)
      connected.value = false
    })

  } catch (err) {
    console.error('Failed to init socket:', err)
  }

  return socket
}

export function useRealtime() {
  const s = getSocket()

  // --- List Subscriptions (list_update) ---
  function subscribe(doctype, callback) {
    if (!s) return
    s.emit('doctype_subscribe', doctype)

    const handler = (data) => {
      if (data.doctype === doctype) callback(data)
    }

    s.on('list_update', handler)

    if (!listSubscribers[doctype]) listSubscribers[doctype] = []
    listSubscribers[doctype].push(handler)
  }

  function unsubscribe(doctype) {
    if (!s) return
    s.emit('doctype_unsubscribe', doctype)
    if (listSubscribers[doctype]) {
      for (const handler of listSubscribers[doctype]) {
        s.off('list_update', handler)
      }
      delete listSubscribers[doctype]
    }
  }

  // --- Doc Subscriptions (doc_update) ---
  function subscribeDoc(doctype, docname, callback) {
    if (!s) return
    s.emit('doc_subscribe', doctype, docname)

    const handler = (data) => {
      if (data.doctype === doctype && data.name === docname) callback(data)
    }

    s.on('doc_update', handler)

    const key = `${doctype}_${docname}`
    if (!docSubscribers[key]) docSubscribers[key] = []
    docSubscribers[key].push({ handler, doctype, docname })
  }

  function unsubscribeDoc(doctype, docname) {
    if (!s) return
    s.emit('doc_unsubscribe', doctype, docname)
    const key = `${doctype}_${docname}`
    if (docSubscribers[key]) {
      for (const item of docSubscribers[key]) {
        s.off('doc_update', item.handler)
      }
      delete docSubscribers[key]
    }
  }

  // --- Custom event subscriptions (no permission check needed) ---
  function on(event, callback) {
    if (!s) return
    s.on(event, callback)
    if (!customSubscribers[event]) customSubscribers[event] = []
    customSubscribers[event].push(callback)
  }

  function off(event, callback) {
    if (!s) return
    s.off(event, callback)
    if (customSubscribers[event]) {
      customSubscribers[event] = customSubscribers[event].filter(fn => fn !== callback)
    }
  }

  return {
    connected,
    subscribe,
    unsubscribe,
    subscribeDoc,
    unsubscribeDoc,
    on,
    off,
  }
}
