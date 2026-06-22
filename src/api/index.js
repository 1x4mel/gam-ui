function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

function parseServerMessage(raw) {
  if (!raw) return ''
  try {
    const msgs = JSON.parse(raw)
    const first = typeof msgs[0] === 'string' ? JSON.parse(msgs[0]) : msgs[0]
    return (first.message || '').replace(/<[^>]*>/g, '').trim()
  } catch {
    return ''
  }
}

let _csrfToken = null

const sessionExpiredListeners = []

export function onSessionExpired(fn) {
  sessionExpiredListeners.push(fn)
}

export function offSessionExpired(fn) {
  const idx = sessionExpiredListeners.indexOf(fn)
  if (idx !== -1) sessionExpiredListeners.splice(idx, 1)
}

function notifySessionExpired() {
  sessionExpiredListeners.forEach(fn => fn())
}

export async function initCsrfToken() {
  try {
    const res = await fetch('/api/method/gege_custom.gege_custom.utils.get_session_csrf_token', {
      credentials: 'include',
    })
    const data = await res.json()
    if (data.message) {
      _csrfToken = data.message
      return _csrfToken
    }
  } catch (e) {
    console.error('Failed to init CSRF token', e)
  }
  return null
}

export function csrfToken() {
  // 1. Prioritize In-memory token (reliable for SPAs)
  if (_csrfToken) return _csrfToken
  // 2. Fallback to cookie
  const fromCookie = getCookie('csrf_token')
  if (fromCookie) return fromCookie
  // 3. Fallback to Frappe window
  if (window.frappe && window.frappe.csrf_token) return window.frappe.csrf_token
  // 4. Default fallback
  return 'fetch'
}

/**
 * Internal wrapper for fetch that handles CSRF and retries once on 403
 */
async function authedFetch(url, options = {}) {
  const method = options.method || 'GET'
  
  if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    // Ensure we have a token before making a modifying request
    if (!_csrfToken) await initCsrfToken()
    
    options.headers = {
      ...options.headers,
      'X-Frappe-CSRF-Token': csrfToken(),
    }
  }
  
  options.credentials = 'include'
  
  let res = await fetch(url, options)

  // If 403 or CSRF error, try to refresh token and retry once
  if (!options._isRetry && (res.status === 403 || res.status === 400)) {
    const cloned = res.clone()
    try {
      const body = await cloned.json()
      // PermissionError — not a session issue, just return the response
      if (body.exc_type === 'PermissionError' || (body._error_message && body._error_message.includes('No permission'))) {
        return res
      }
      if (body.exc_type === 'CSRFTokenError' || (body.exc && body.exc.includes('CSRFTokenError'))) {
        console.warn('CSRF error, refreshing token and retrying...')
        _csrfToken = null
        await initCsrfToken()
        return authedFetch(url, { ...options, _isRetry: true, headers: { ...options.headers, 'X-Frappe-CSRF-Token': csrfToken() } })
      }
    } catch {}
    if (res.status === 403) {
      const user = await getLoggedInUser()
      if (user === 'Guest') return res
      console.warn('Received 403, attempting CSRF refresh and retry...')
      await initCsrfToken()
      const retryRes = await authedFetch(url, { ...options, _isRetry: true })
      if (retryRes.status === 403) {
        notifySessionExpired()
      }
      return retryRes
    }
  }

  return res
}

export async function login(usr, pwd) {
  const res = await fetch('/api/method/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ usr, pwd }),
  })
  const data = await res.json()
  // Store token from login response if provided
  if (data.csrf_token) {
    _csrfToken = data.csrf_token
  } else {
    // Otherwise fetch it
    await initCsrfToken()
  }
  return data
}

export async function logout() {
  await authedFetch('/api/method/logout', { method: 'POST' })
  _csrfToken = null
}

export async function getLoggedInUser() {
  try {
    const res = await fetch('/api/method/frappe.auth.get_logged_user', {
      credentials: 'include',
    })
    if (!res.ok) return 'Guest'
    const data = await res.json()
    return data.message || 'Guest'
  } catch {
    return 'Guest'
  }
}

export async function frappeCall(method, args = {}, _retry = false) {
  if (!_csrfToken) await initCsrfToken()
  const res = await authedFetch(`/api/method/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const data = await res.json()
  if (data.exc) {
    // If CSRF error and haven't retried yet, refresh token and retry
    if (!_retry && (data.exc.includes('CSRFTokenError') || data.exc.includes('Invalid Request'))) {
      _csrfToken = null
      await initCsrfToken()
      return frappeCall(method, args, true)
    }
    const cleanMsg = parseServerMessage(data._server_messages) || data._error_message
    if (cleanMsg) {
      throw new Error(cleanMsg)
    }
    // Fallback: strip traceback, keep only last line
    const lastLine = (data.exc || '').split('\n').filter(l => l.trim()).pop() || ''
    const stripped = lastLine.replace(/^(frappe\.\w+\.\w+:\s*)/, '').replace(/<[^>]*>/g, '').trim()
    throw new Error(stripped || 'Có lỗi xảy ra, vui lòng thử lại')
  }
  return data.message
}

export async function getList(doctype, { fields = ['name'], filters = [], or_filters = null, limit = 50, offset = 0, order_by = 'modified desc', parent = null } = {}) {
  const params = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    limit_page_length: limit,
    order_by,
  })
  if (or_filters) params.set('or_filters', JSON.stringify(or_filters))
  if (offset) params.set('limit_start', offset)
  if (parent) params.set('parent', parent)
  const url = `/api/resource/${encodeURIComponent(doctype)}?${params}`
  if (url.length > 4000) {
    const body = { fields, filters, limit_page_length: limit, order_by }
    if (or_filters) body.or_filters = or_filters
    if (offset) body.limit_start = offset
    if (parent) body.parent = parent
    const res = await authedFetch(`/api/resource/${encodeURIComponent(doctype)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HTTP-Method-Override': 'GET' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return data.data || []
  }
  const res = await authedFetch(url)
  const data = await res.json()
  return data.data || []
}

export async function getDoc(doctype, name) {
  if (!name || name === 'undefined') return null
  const res = await authedFetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`)
  const data = await res.json()
  if (data.exc) throw new Error(parseServerMessage(data._server_messages) || `${doctype} ${name} not found`)
  return data.data
}

export async function setValue(doctype, name, fieldname, value) {
  const res = await authedFetch(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [fieldname]: value }),
    }
  )
  const data = await res.json()
  return data.data
}

export async function createDoc(doctype, values) {
  const res = await authedFetch(
    `/api/resource/${encodeURIComponent(doctype)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    }
  )
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`) }
  if (data.exc) throw new Error(parseServerMessage(data._server_messages) || data.exc.replace(/<[^>]*>/g, '').slice(0, 300))
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`)
  return data.data
}

export async function updateDoc(doctype, name, values) {
  const res = await authedFetch(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    }
  )
  const data = await res.json()
  if (data.exc) throw new Error(data._server_messages || data.exc)
  return data.data
}

export async function deleteDoc(doctype, name) {
  const res = await authedFetch(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
    }
  )
  const data = await res.json()
  if (data.exc) throw new Error(data._server_messages || data.exc)
  return data.data
}

export async function uploadFile(file, { doctype, docname, fieldname, isPrivate = 1 } = {}) {
  const fd = new FormData()
  fd.append('file', file)
  if (doctype) fd.append('doctype', doctype)
  if (docname) fd.append('docname', docname)
  if (fieldname) fd.append('fieldname', fieldname)
  fd.append('is_private', isPrivate)

  if (!_csrfToken) await initCsrfToken()

  const res = await authedFetch('/api/method/upload_file', {
    method: 'POST',
    body: fd,
  })
  const data = await res.json()
  if (data.exc) throw new Error(data._server_messages || data.exc)
  return data.message
}

export async function getRoles() {
  try {
    const user = await getLoggedInUser()
    if (!user || user === 'Guest') return []
    return await frappeCall('gege_custom.gege_custom.utils.get_current_user_roles')
  } catch (e) {
    return []
  }
}

export async function getWorkflowActions(doctype, name) {
  if (!name || name === 'undefined') return []
  return await frappeCall('gege_custom.gege_custom.utils.get_order_workflow_actions', {
    doctype,
    name
  })
}

export async function applyWorkflowAction(doctype, name, action, extra = {}) {
  if (!doctype || !name || !action) {
    throw new Error(`applyWorkflowAction missing params: doctype=${doctype}, name=${name}, action=${action}`)
  }
  return await frappeCall('gege_custom.gege_custom.utils.apply_order_workflow_action', {
    doctype,
    name,
    action,
    ...extra
  })
}

export async function markPartialDelivery(sellOrderName, deliveries, note) {
  return await frappeCall('gege_custom.gege_custom.api.partial.mark_partial_delivery', {
    sell_order_name: sellOrderName,
    deliveries,
    note,
  })
}

// Initial pull on library load (optional, but helps avoid delay on first POST)
initCsrfToken();
