import { getList, frappeCall } from '../api/index.js'

const CREATED_FALLBACK = 'Đơn hàng được tạo ra trên hệ thống'

function isCancelledStatus(order) {
  const s = order.status || order.workflow_state || ''
  return s === 'Cancelled' || s === 'Cancellation Requested'
}

function extractCancelReason(logs) {
  for (const log of logs) {
    if (log.action === 'Cancel Request' && log.note) return log
  }
  return null
}

export function useLatestLogs(getOrdersFn) {
  async function assignLatestLogs(ordersOrGetter) {
    const getter = ordersOrGetter || getOrdersFn
    const orders = getter()
    const names = orders.map(o => o.name)
    if (!names.length) return

    try {
      const logsMap = await frappeCall(
        'gege_custom.gege_custom.utils.get_latest_order_logs',
        { reference_names: names }
      )
      for (const o of getter()) {
        o.latest_activity = logsMap[o.name]
          || { action: 'Created', note: CREATED_FALLBACK, creation: o.creation, owner: o.owner || '—' }
      }
    } catch {
      for (const o of getter()) {
        o.latest_activity ||= { action: 'Created', note: CREATED_FALLBACK, creation: o.creation, owner: o.owner || '—' }
      }
    }
  }

  async function assignSingleLog(doctype, order) {
    try {
      const logs = await getList('Order Log', {
        fields: ['action', 'note', 'owner', 'creation'],
        filters: [
          ['reference_doctype', '=', doctype],
          ['reference_name', '=', order.name]
        ],
        order_by: 'creation desc',
        limit: 50
      })
      order.latest_activity = logs[0]
        || { action: 'Created', note: CREATED_FALLBACK, creation: order.creation, owner: order.owner || '—' }
      if (isCancelledStatus(order)) {
        const reason = extractCancelReason(logs)
        if (reason) order.cancel_reason = reason
      }
    } catch {
      order.latest_activity = { action: 'Created', note: CREATED_FALLBACK, creation: order.creation, owner: order.owner || '—' }
    }
  }

  async function refreshLatestLogs() {
    const orders = getOrdersFn()
    const names = orders.map(o => o.name)
    if (!names.length) return
    try {
      const logsMap = await frappeCall(
        'gege_custom.gege_custom.utils.get_latest_order_logs',
        { reference_names: names }
      )
      for (const o of getOrdersFn()) {
        if (logsMap[o.name]) o.latest_activity = logsMap[o.name]
      }
    } catch { /* silent */ }
  }

  return { assignLatestLogs, assignSingleLog, refreshLatestLogs }
}
