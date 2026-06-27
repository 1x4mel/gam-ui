/**
 * GAM — Cloudflare Email Worker (inbound → gam.api.receive_email_webhook)
 *
 * Wire-up (Cloudflare dashboard → Email → Email Routing):
 *   1. Enable Email Routing on the domain that owns the `webhook_email` inbox
 *      (the address configured in `GAM Webhook Config`).
 *   2. Add a routing rule:  catch-all (or the exact address) → "Send to a Worker"
 *      → select this deployed worker.
 *
 * Worker bindings (set via `wrangler secret put` or the dashboard):
 *   GAM_WEBHOOK_URL     https://<your-public-host>/api/method/gam.api.receive_email_webhook
 *   GAM_WEBHOOK_SECRET   the value stored in `GAM Webhook Config.webhook_secret`
 *
 * Requires: `npm install postal-mime` (MIME parser that runs in the Workers
 * runtime). The parsed plain-text body + subject are regex-matched server-side
 * against the seeded Code Patterns (STEAM / BATTLENET / POE).
 *
 * Payload posted to Frappe (matches gam.api.receive_email_webhook contract):
 *   { email_account, from, subject, body, html, message_id, received_at, raw }
 */
import PostalMime from 'postal-mime'

/** Strip HTML tags for a best-effort plain-text body fallback. */
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve the ORIGINAL recipient of a (possibly forwarded) message.
 *
 * Cloudflare Email Routing rewrites the envelope so `message.to` is the routing
 * destination (the webhook inbox), not the real owner. For auto-forwards the
 * original recipient survives in trace headers — pull it so the backend can link
 * the code to the correct GAM Email even when the forwarded body carries no
 * plain-text `To:` line (HTML-only forwards).
 */
function extractOriginalTo(message, parsed) {
  const headers = message.headers || {}
  const direct =
    headers.get('x-original-to') ||
    headers.get('x-forwarded-to') ||
    headers.get('delivered-to') ||
    ''
  if (direct) return String(direct).trim()
  // `Received: ... for <addr>; ...` carries the final delivery target.
  const received = headers.get('received')
  if (received) {
    const m = String(received).match(/for\s+<([^>]+)>/i)
    if (m) return m[1].trim()
  }
  // Last resort: the parsed top-level To (useful for direct, non-forwarded mail).
  return (parsed.to?.text || '').trim()
}

export default {
  async email(message, env) {
    // `payload` is built inside try; on transient failure we buffer it into the
    // GAM_DLQ KV namespace so the message is NOT permanently bounced by
    // Cloudflare (Phase 4.2). Definitive 4xx errors still setReject.
    let payload = null
    let responseStatus = 200
    try {
      // `message.raw` is a ReadableStream of the full RFC 5322 message.
      const rawBuf = await new Response(message.raw).arrayBuffer()
      const parsed = await PostalMime.parse(rawBuf)

      const toAddr = (message.to || parsed.to?.text || '').trim()
      const dateHeader = message.headers.get('date')
      const originalTo = extractOriginalTo(message, parsed)

      // Keep a short snippet of the raw text as a debugging aid for forwarded
      // header blocks (backend caps @ 5000). `rawBuf` is the full RFC5322 bytes.
      let rawSnippet = ''
      try {
        rawSnippet = new TextDecoder('utf-8').decode(rawBuf.slice(0, 2000))
      } catch {
        rawSnippet = ''
      }

      payload = {
        email_account: toAddr,
        original_to: originalTo,
        from: parsed.from?.text || message.from || '',
        subject: parsed.subject || '',
        body: parsed.text || stripHtml(parsed.html) || '',
        html: parsed.html || '',
        message_id: message.headers.get('message-id') || '',
        received_at: dateHeader || new Date().toISOString(),
        raw: rawSnippet,
      }

      const webhookUrl = env.GAM_WEBHOOK_URL
      const webhookSecret = env.GAM_WEBHOOK_SECRET
      if (!webhookUrl || !webhookSecret) {
        console.error('GAM worker missing GAM_WEBHOOK_URL / GAM_WEBHOOK_SECRET binding')
        responseStatus = 500
      } else {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhookSecret,
          },
          body: JSON.stringify(payload),
        })
        responseStatus = res.status
        if (!res.ok) {
          console.error(`GAM webhook non-OK: HTTP ${res.status}`)
        }
      }
    } catch (err) {
      console.error('GAM worker error', err)
      responseStatus = 500
    }

    // Phase 4.2 — definitive vs transient failure handling:
    //   * 4xx: the webhook responded with a permanent client error (bad auth /
    //     validation) — bounce the email so Cloudflare does not retry forever.
    //   * 5xx (Frappe down / DB lock / etc.): transient — DO NOT bounce. The
    //     message is buffered into the GAM_DLQ KV namespace and the worker
    //     returns success; an operator drains it via the fetch() handler once
    //     Frappe is healthy. This prevents permanent loss of verification codes.
    const isDefinitive = responseStatus >= 400 && responseStatus < 500
    if (isDefinitive) {
      message.setReject(`GAM webhook rejected: HTTP ${responseStatus}`)
      return
    }
    if (responseStatus >= 500 && payload && env.GAM_DLQ) {
      // Key by message-id (falls back to a timestamp) so re-deliveries de-dup
      // and drain can iterate. TTL 7d keeps the DLQ from growing unbounded.
      const key = `dlq:${payload.message_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
      try {
        await env.GAM_DLQ.put(key, JSON.stringify({ payload, status: responseStatus, ts: Date.now() }), { expirationTtl: 7 * 24 * 3600 })
        console.warn(`GAM worker buffered 5xx (HTTP ${responseStatus}) to DLQ key ${key}`)
      } catch (kvErr) {
        // KV is best-effort; never crash the email handler. A transient 5xx
        // with no DLQ simply gets retried by Cloudflare's own retry policy.
        console.error('GAM worker DLQ put failed', kvErr)
      }
    }
  },

  // Operator drain endpoint (Phase 4.2). POST to the worker URL (with the
  // GAM_DRAIN_TOKEN bearer) to re-submit all buffered 5xx payloads to Frappe
  // via the admin gam.api.drain_email_dlq endpoint, deleting each KV entry on
  // success. GET returns the current DLQ size for monitoring.
  //   Deploy note: also bind GAM_DRAIN_URL (the public Frappe URL for
  //   gam.api.drain_email_dlq) + GAM_DRAIN_TOKEN (a Frappe session/API key)
  //   via `wrangler secret put`.
  async fetch(request, env) {
    if (env.GAM_DRAIN_TOKEN && request.headers.get('authorization') !== `Bearer ${env.GAM_DRAIN_TOKEN}`) {
      return new Response('unauthorized', { status: 401 })
    }
    if (!env.GAM_DLQ) {
      return new Response(JSON.stringify({ error: 'GAM_DLQ KV not bound' }), { status: 500, headers: { 'content-type': 'application/json' } })
    }

    if (request.method === 'GET') {
      const list = await env.GAM_DLQ.list()
      return new Response(JSON.stringify({ count: list.keys.length, keys: list.keys.map((k) => k.name) }), { headers: { 'content-type': 'application/json' } })
    }

    // POST → drain: re-submit each buffered payload, delete KV entry on success.
    const list = await env.GAM_DLQ.list()
    const drained = []
    for (const k of list.keys) {
      const raw = await env.GAM_DLQ.get(k.name)
      if (!raw) continue
      let entry
      try {
        entry = JSON.parse(raw)
      } catch {
        await env.GAM_DLQ.delete(k.name)
        continue
      }
      const res = await fetch(env.GAM_DRAIN_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(env.GAM_DRAIN_TOKEN ? { authorization: `Bearer ${env.GAM_DRAIN_TOKEN}` } : {}),
        },
        body: JSON.stringify({ payloads: [entry.payload] }),
      })
      if (res.ok) {
        await env.GAM_DLQ.delete(k.name)
        drained.push({ key: k.name, ok: true })
      } else {
        drained.push({ key: k.name, ok: false, status: res.status })
      }
    }
    return new Response(JSON.stringify({ drained }), { headers: { 'content-type': 'application/json' } })
  },
}
