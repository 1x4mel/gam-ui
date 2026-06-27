<template>
  <!--
    Thin wrapper kept for back-compat: the canonical UI now lives inside the
    /admin/settings "Code Patterns" tab (AdminSettingsPatternsTab). The route
    /admin/code-patterns redirects there; this view simply re-hosts the same
    component in its own page shell so any direct programmatic import still
    renders correctly.
  -->
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Code Patterns" subtitle="Quy tắc nhận diện email & trích mã theo game/platform" icon="🧩" :connected="connected" @refresh="reload" />
    <div class="flex-1 overflow-y-auto custom-scrollbar max-w-4xl mx-auto w-full">
      <AdminSettingsPatternsTab ref="tab" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import AdminSettingsPatternsTab from '../components/AdminSettingsPatternsTab.vue'
import { useRealtime } from '../composables/useRealtime.js'

defineOptions({ name: 'CodePatternsView' })

const { connected } = useRealtime()
const tab = ref(null)
function reload() { tab.value?.reload?.() }
</script>
