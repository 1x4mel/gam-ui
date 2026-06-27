<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Hub layout: [shared PageHeader (title reflects active tab)] → [UnderlineTab]
         → [active view body]. The three sub-views render headerless in embedded
         mode so the title + tabs live here, exactly once, with tabs BELOW the
         title (as requested). Audit Timeline already aggregates the other two;
         they are tabs, not separate nav entries. -->
    <div class="max-w-6xl mx-auto w-full shrink-0">
      <PageHeader
        :title="currentMeta.title"
        :subtitle="currentMeta.subtitle"
        :icon="currentMeta.icon"
        :connected="connected"
        @refresh="reloadActive"
      />
      <UnderlineTab :tabs="TABS" :model-value="activeTab" @update:model-value="onTab" />
    </div>
    <!-- flex-1 + min-h-0 so the embedded view (h-full) scrolls instead of the
         whole page. KeepAlive caches each tab's state/filters when switching. -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <KeepAlive>
        <component :is="componentMap[activeTab]" ref="childRef" embedded />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup>
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import { useRealtime } from '../composables/useRealtime.js'
import AuditTimelineView from './AuditTimelineView.vue'
import CodeRequestLogView from './CodeRequestLogView.vue'
import RevealLogView from './RevealLogView.vue'

defineOptions({ name: 'ActivityView' })

const route = useRoute()
const router = useRouter()
const { connected } = useRealtime()

// tab key → view component. Each view runs headerless in embedded mode; its
// title/subtitle/icon are mirrored in META below so the hub renders one shared
// header (with refresh wired to the active view's reload()).
const componentMap = {
  timeline: AuditTimelineView,
  'code-requests': CodeRequestLogView,
  reveals: RevealLogView,
}

const META = {
  timeline: { title: 'Audit Timeline', subtitle: 'Ai đã làm gì, với tài khoản/game nào, từ IP nào, khi nào', icon: '🛡️' },
  'code-requests': { title: 'Yêu cầu mã', subtitle: 'Lịch sử yêu cầu verification code', icon: '📝' },
  reveals: { title: 'Nhật ký Reveal', subtitle: 'Lịch sử xem / copy mật khẩu', icon: '🔓' },
}

const TABS = [
  { key: 'timeline', label: 'Timeline', icon: '🛡️' },
  { key: 'code-requests', label: 'Yêu cầu mã', icon: '📝' },
  { key: 'reveals', label: 'Reveal', icon: '🔓' },
]

const VALID = Object.keys(componentMap)
const activeTab = shallowRef(VALID.includes(route.query.tab) ? route.query.tab : 'timeline')
const currentMeta = computed(() => META[activeTab.value] || META.timeline)

// Keep the URL shareable & back-compat-friendly: ?tab= reflects the active tab
// so a redirect like /admin/audit → /admin/activity?tab=timeline lands right.
watch(() => route.query.tab, (t) => {
  if (VALID.includes(t) && t !== activeTab.value) activeTab.value = t
})

function onTab(key) {
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

// Forward the hub Refresh button to whichever tab is mounted. Each child
// exposes a uniform reload() via defineExpose.
const childRef = shallowRef(null)
function reloadActive() {
  childRef.value?.reload?.()
}
</script>
