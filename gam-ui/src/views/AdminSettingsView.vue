<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Cài đặt GAM" subtitle="Ngưỡng quản trị · online / nghỉ / cảnh báo" icon="🛠️" :connected="connected" @refresh="load" />

    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div class="max-w-3xl mx-auto w-full space-y-6 pb-8">
        <!-- Governance thresholds -->
        <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight mb-1">Ngưỡng sử dụng</h3>
          <p class="text-app-text-muted text-[11px] mb-5">Áp dụng toàn app: cảnh báo online quá lâu, tag "đã nghỉ đủ", và tự force-release khi vượt hạn cứng.</p>

          <div v-if="loading" class="py-8 flex items-center justify-center">
            <span class="w-5 h-5 border-2 border-app-border border-t-indigo-600 rounded-full animate-spin"></span>
          </div>
          <div v-else class="space-y-4">
            <div>
              <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Max Online Hours — cảnh báo</label>
              <input v-model.number="form.max_online_hours" type="number" min="1" max="168" class="w-full input-field px-3 py-2.5 text-sm" placeholder="8" />
              <p class="text-[11px] text-app-text-muted mt-1">Quá số giờ này, user đang checkin sẽ thấy popup nhắc checkout.</p>
            </div>
            <div>
              <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Min Rested Hours — tag "đã nghỉ đủ"</label>
              <input v-model.number="form.min_rested_hours" type="number" min="0" max="720" class="w-full input-field px-3 py-2.5 text-sm" placeholder="8" />
              <p class="text-[11px] text-app-text-muted mt-1">Tài khoản tự do sau khi nghỉ đủ số giờ này sẽ hiện badge 😴 nghỉ đủ.</p>
            </div>
            <div>
              <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Hard Cap Online Hours — tự force-release</label>
              <input v-model.number="form.hard_cap_online_hours" type="number" min="1" max="168" class="w-full input-field px-3 py-2.5 text-sm" placeholder="12" />
              <p class="text-[11px] text-app-text-muted mt-1">Hạn cứng: lease sẽ tự động kết thúc khi vượt qua. Nên lớn hơn hoặc bằng Max Online.</p>
            </div>

            <div class="flex items-center justify-between gap-3 pt-1">
              <div class="min-w-0">
                <p class="text-app-text-primary text-sm font-bold">Cảnh báo khi đăng xuất còn lease</p>
                <p class="text-app-text-muted text-[11px]">Hiện popup nhắc (không block cứng) khi user đăng xuất mà còn phiên checkin.</p>
              </div>
              <button
                type="button" @click="form.block_logout_with_active_lease = form.block_logout_with_active_lease ? 0 : 1"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0"
                :class="form.block_logout_with_active_lease ? 'bg-indigo-600' : 'bg-app-border'"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition"
                  :class="form.block_logout_with_active_lease ? 'translate-x-6' : 'translate-x-1'"
                ></span>
              </button>
            </div>

            <p v-if="error" class="text-xs text-red-500 font-medium">{{ error }}</p>
            <div class="flex justify-end">
              <button
                @click="save" :disabled="saving"
                class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
              >
                <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Lưu cài đặt
              </button>
            </div>
          </div>
        </div>

        <!-- Behaviour reference -->
        <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight mb-3">Cách hoạt động</h3>
          <ul class="text-app-text-muted text-[12px] space-y-2 leading-relaxed list-disc pl-5">
            <li><b class="text-app-text-secondary">Online quá lâu</b>: popup cảnh báo có nút bypass — không ép buộc.</li>
            <li><b class="text-app-text-secondary">Hard cap</b>: máy chủ tự force-release khi lease vượt hạn cứng (an toàn khi user quên checkout).</li>
            <li><b class="text-app-text-secondary">Đăng xuất</b>: chỉ cảnh báo, luôn cho bypass để không kẹt user.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { frappeCall } from '../api/index.js'

defineOptions({ name: 'AdminSettingsView' })

const { connected } = useRealtime()
const { success, error: notifyError } = useNotify()
// After saving we refresh the shared singleton so the rest of the app
// (sidebar badges, online watcher, detail rested badge) picks up new thresholds.
const { refresh: refreshActive } = useActiveUsage()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const form = ref({
  max_online_hours: 8,
  min_rested_hours: 8,
  hard_cap_online_hours: 12,
  block_logout_with_active_lease: 1,
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const s = await frappeCall('gam.api.get_gam_settings')
    form.value = {
      max_online_hours: Number(s.max_online_hours) || 8,
      min_rested_hours: Number(s.min_rested_hours) || 8,
      hard_cap_online_hours: Number(s.hard_cap_online_hours) || 12,
      block_logout_with_active_lease: s.block_logout_with_active_lease ? 1 : 0,
    }
  } catch (e) {
    error.value = e.message || 'Không tải được cài đặt'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const s = await frappeCall('gam.api.save_gam_settings', {
      max_online_hours: form.value.max_online_hours,
      min_rested_hours: form.value.min_rested_hours,
      hard_cap_online_hours: form.value.hard_cap_online_hours,
      block_logout_with_active_lease: form.value.block_logout_with_active_lease ? 1 : 0,
    })
    form.value = {
      max_online_hours: Number(s.max_online_hours) || 8,
      min_rested_hours: Number(s.min_rested_hours) || 8,
      hard_cap_online_hours: Number(s.hard_cap_online_hours) || 12,
      block_logout_with_active_lease: s.block_logout_with_active_lease ? 1 : 0,
    }
    await refreshActive()
    success('Đã lưu cài đặt GAM')
  } catch (e) {
    error.value = e.message || 'Lưu thất bại'
    notifyError(e.message || 'Lưu thất bại')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
