import { ref, onScopeDispose } from 'vue'
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
  const loc = typeof window !== 'undefined' ? window.location : null
  const port = loc ? loc.port : ''
  const isProduction = !port || port === '80' || port === '443'
  if (isProduction) return undefined
  if (RT_SOCKETIO_PORT) {
    const proto = loc && loc.protocol === 'https:' ? 'https' : 'http'
    const host = loc ? loc.hostname : 'localhost'
    return `${proto}://${host}:${RT_SOCKETIO_PORT}`
  }
  return undefined
}

let socket = null
const connected = ref(false)

// Reference counts for server-side subscribe/unsubscribe emits. The socket.io
// backend dedups by socket connection, but we only want to `doctype_unsubscribe`
// once the LAST local consumer leaves — otherwise unmounting one component would
// stop server-side updates for every other component still subscribed.
const listCount = {}   // doctype -> active instance count
const docCount = {}    // `${doctype}__${docname}` -> active instance count

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
      connected.value = true
    })

    socket.on('disconnect', () => {
      connected.value = false
    })

    socket.on('connect_error', () => {
      connected.value = false
    })

  } catch (err) {
    console.error('Failed to init socket:', err)
  }

  return socket
}

/** Tear down the singleton socket and reset reference counts + the connected
 * flag. Used on logout so a stale (previously-authenticated) socket can't keep
 * receiving events for the old session. Safe to call when no socket exists. */
export function disconnect() {
  if (socket) {
    try { socket.removeAllListeners() } catch {}
    try { socket.disconnect() } catch {}
    socket = null
  }
  for (const k of Object.keys(listCount)) delete listCount[k]
  for (const k of Object.keys(docCount)) delete docCount[k]
  connected.value = false
}

export function useRealtime() {
  const s = getSocket()

  // Per-instance registry: each consumer only ever removes the handlers it
  // registered itself, so co-existing components don't steal each other's
  // listeners on unmount. Maps: doctype -> Set<handler>.
  const ownList = new Map()      // doctype -> Set<handler>
  const ownDoc = new Map()       // `${doctype}__${docname}` -> Set<handler>
  const ownCustom = new Map()    // event -> Set<callback>

  function track(map, key, fn) {
    let set = map.get(key)
    if (!set) {
      set = new Set()
      map.set(key, set)
    }
    set.add(fn)
    return fn
  }

  function forget(map, key, fn) {
    const set = map.get(key)
    if (!set) return
    if (fn) set.delete(fn)
    if (!fn || set.size === 0) map.delete(key)
  }

  // --- List Subscriptions (list_update) ---
  function subscribe(doctype, callback) {
    if (!s) return () => {}
    const handler = (data) => {
      if (data.doctype === doctype) callback(data)
    }
    s.on('list_update', handler)
    track(ownList, doctype, handler)

    listCount[doctype] = (listCount[doctype] || 0) + 1
    if (listCount[doctype] === 1) s.emit('doctype_subscribe', doctype)

    // Disposer — removes only THIS instance's handler + decrements refcount.
    return () => unsubscribe(doctype)
  }

  function unsubscribe(doctype) {
    if (!s) return
    const set = ownList.get(doctype)
    if (set) {
      for (const handler of set) s.off('list_update', handler)
      ownList.delete(doctype)
    }
    listCount[doctype] = Math.max(0, (listCount[doctype] || 0) - 1)
    if (listCount[doctype] === 0) {
      delete listCount[doctype]
      s.emit('doctype_unsubscribe', doctype)
    }
  }

  // --- Doc Subscriptions (doc_update) ---
  function subscribeDoc(doctype, docname, callback) {
    if (!s) return () => {}
    const handler = (data) => {
      if (data.doctype === doctype && data.name === docname) callback(data)
    }
    s.on('doc_update', handler)
    const key = `${doctype}__${docname}`
    track(ownDoc, key, handler)

    docCount[key] = (docCount[key] || 0) + 1
    if (docCount[key] === 1) s.emit('doc_subscribe', doctype, docname)

    return () => unsubscribeDoc(doctype, docname)
  }

  function unsubscribeDoc(doctype, docname) {
    if (!s) return
    const key = `${doctype}__${docname}`
    const set = ownDoc.get(key)
    if (set) {
      for (const handler of set) s.off('doc_update', handler)
      ownDoc.delete(key)
    }
    docCount[key] = Math.max(0, (docCount[key] || 0) - 1)
    if (docCount[key] === 0) {
      delete docCount[key]
      s.emit('doc_unsubscribe', doctype, docname)
    }
  }

  // --- Custom event subscriptions (no server subscribe/unsubscribe needed) ---
  function on(event, callback) {
    if (!s) return
    s.on(event, callback)
    track(ownCustom, event, callback)
  }

  function off(event, callback) {
    if (!s) return
    s.off(event, callback)
    forget(ownCustom, event, callback)
  }

  // Auto-cleanup when the owning scope (component setup() or effectScope) is
  // disposed. onScopeDispose also fires on normal component unmount, so a single
  // hook covers both. This guarantees an unmounted component can never "take"
  // another component's handler with it.
  onScopeDispose(() => {
    for (const doctype of [...ownList.keys()]) unsubscribe(doctype)
    for (const key of [...ownDoc.keys()]) {
      const [doctype, docname] = key.split('__')
      unsubscribeDoc(doctype, docname)
    }
    for (const [event, set] of ownCustom) {
      for (const cb of set) s && s.off(event, cb)
    }
    ownCustom.clear()
  })

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
