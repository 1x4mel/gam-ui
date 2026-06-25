<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Cài đặt" subtitle="Game & DLC · Tuỳ chọn · Ngưỡng quản trị" icon="🛠️" :connected="connected" @refresh="refresh" />

    <!-- Top-level tabs -->
    <div class="flex items-center gap-1 border-b border-app-border mb-4 flex-wrap">
      <button
        v-for="t in TOP_TABS" :key="t.key"
        @click="topTab = t.key"
        class="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider border-b-2 transition -mb-px"
        :class="topTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-app-text-muted hover:text-app-text-primary'"
      >
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar max-w-4xl mx-auto w-full">

      <!-- ===================== Game & DLC tab ===================== -->
      <div v-if="topTab === 'games'" class="pb-8">
        <!-- Sub-tabs: Game / Server / DLC -->
        <div class="flex items-center gap-1 mb-4 flex-wrap">
          <button
            v-for="t in GAME_SUB_TABS" :key="t.key"
            @click="gameSubTab = t.key"
            class="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition"
            :class="gameSubTab === t.key ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary bg-app-surface border border-app-border'"
          >
            {{ t.icon }} {{ t.label }}
          </button>
        </div>

        <!-- Games -->
        <div v-if="gameSubTab === 'games'" class="space-y-2">
          <div class="flex justify-end mb-3">
            <button @click="openForm('game')" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm Game</button>
          </div>
          <LoadingSpinner v-if="loadingGames" size="md" />
          <EmptyState v-else-if="!games.length" icon="🎯" text="Chưa có game" />
          <div v-else class="space-y-2">
            <div v-for="g in games" :key="g.name" class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3">
              <span class="text-xl">🎮</span>
              <div class="flex-1 min-w-0">
                <p class="font-black text-app-text-primary text-sm truncate">{{ g.game_name }}</p>
                <p class="text-[10px] text-app-text-muted">{{ g.publisher || '—' }}</p>
              </div>
              <StatusBadge :status="g.is_active ? 'Available' : 'Expired'" />
              <button @click="toggleActive('GAM Game', g)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">{{ g.is_active ? 'Tắt' : 'Bật' }}</button>
              <button @click="openForm('game', g)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
              <button @click="deleteEntity('GAM Game', g)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
            </div>
          </div>
        </div>

        <!-- Servers -->
        <div v-if="gameSubTab === 'servers'" class="space-y-2">
          <div class="flex justify-end mb-3">
            <button @click="openForm('server')" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm Server</button>
          </div>
          <LoadingSpinner v-if="loadingServers" size="md" />
          <EmptyState v-else-if="!servers.length" icon="🌐" text="Chưa có server" />
          <div v-else class="space-y-2">
            <div v-for="s in servers" :key="s.name" class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3">
              <span class="text-xl">🌐</span>
              <div class="flex-1 min-w-0">
                <p class="font-black text-app-text-primary text-sm truncate">{{ gameName(s.game) }} · {{ s.server_name }}</p>
                <p class="text-[10px] text-app-text-muted">{{ s.notes || '—' }}</p>
              </div>
              <StatusBadge :status="s.is_active ? 'Available' : 'Expired'" />
              <button @click="toggleActive('GAM Game Server', s)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">{{ s.is_active ? 'Tắt' : 'Bật' }}</button>
              <button @click="openForm('server', s)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
              <button @click="deleteEntity('GAM Game Server', s)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
            </div>
          </div>
        </div>

        <!-- DLC -->
        <div v-if="gameSubTab === 'dlc'" class="space-y-2">
          <div class="flex justify-end mb-3">
            <button @click="openForm('dlc')" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm DLC</button>
          </div>
          <LoadingSpinner v-if="loadingDlcs" size="md" />
          <EmptyState v-else-if="!dlcs.length" icon="🧩" text="Chưa có DLC" />
          <div v-else class="space-y-2">
            <div v-for="d in dlcs" :key="d.name" class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3">
              <span class="text-xl">🧩</span>
              <div class="flex-1 min-w-0">
                <p class="font-black text-app-text-primary text-sm truncate">{{ d.dlc_name }}</p>
                <p class="text-[10px] text-app-text-muted">{{ gameName(d.game) }}{{ d.release_date ? ' · ' + formatDate(d.release_date) : '' }}</p>
              </div>
              <button @click="openForm('dlc', d)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
              <button @click="deleteEntity('GAM DLC', d)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================== Tuỳ chọn tab ===================== -->
      <div v-if="topTab === 'options'" class="pb-8">
        <!-- Sub-tabs: Platform / Role / Status -->
        <div class="flex items-center gap-1 mb-4 flex-wrap">
          <button
            v-for="t in OPT_SUB_TABS" :key="t.key"
            @click="optSubTab = t.key"
            class="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition"
            :class="optSubTab === t.key ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary bg-app-surface border border-app-border'"
          >
            {{ t.icon }} {{ t.label }}
          </button>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <p class="text-[11px] text-app-text-muted">
              Tuỳ chỉnh danh sách <span class="font-black text-app-text-primary">{{ currentCategory }}</span>. Thay đổi tại đây sẽ áp dụng cho form tài khoản, bộ lọc và badge toàn ứng dụng.
            </p>
            <button @click="openOptionCreate" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm</button>
          </div>
          <LoadingSpinner v-if="loadingOptions" size="md" />
          <EmptyState v-else-if="!listOptions.length" icon="🏷️" text="Chưa có tuỳ chọn" />
          <div v-else class="space-y-2">
            <div v-for="o in listOptions" :key="o.name || o.value" class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3">
              <span class="text-xl w-7 text-center">{{ o.icon || '•' }}</span>
              <span class="w-3 h-3 rounded-full shrink-0 border border-black/10" :class="optionColorClass(o.color)"></span>
              <div class="flex-1 min-w-0">
                <p class="font-black text-app-text-primary text-sm truncate">
                  {{ o.label }}
                  <span class="text-app-text-muted font-mono text-[10px] font-normal">({{ o.value }})</span>
                  <span v-if="!o.name" class="text-[9px] text-amber-500 font-black ml-1">mặc định</span>
                </p>
                <p class="text-[10px] text-app-text-muted">
                  <template v-if="currentCategory === 'Platform'">code-platform: <span class="font-mono">{{ o.code_platform || '—' }}</span></template>
                  <template v-else>thứ tự: {{ o.sort_order || 0 }}</template>
                </p>
              </div>
              <template v-if="o.name">
                <button @click="openOptionEdit(o)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
                <button @click="deleteOption(o)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================== Ngưỡng tab ===================== -->
      <div v-if="topTab === 'thresholds'" class="pb-8">
        <div class="max-w-3xl mx-auto w-full space-y-6">
          <!-- Governance thresholds -->
          <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
            <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight mb-1">Ngưỡng sử dụng</h3>
            <p class="text-app-text-muted text-[11px] mb-5">Áp dụng toàn app: cảnh báo online quá lâu, tag "đã nghỉ đủ", và tự force-release khi vượt hạn cứng.</p>

            <div v-if="loadingThresholds" class="py-8 flex items-center justify-center">
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
              <div>
                <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Continuous Online Cap Hours — cap chuỗi bàn giao ca</label>
                <input v-model.number="form.continuous_online_cap_hours" type="number" min="1" max="720" class="w-full input-field px-3 py-2.5 text-sm" placeholder="16" />
                <p class="text-[11px] text-app-text-muted mt-1">Hạn online liên tục của cả chuỗi bàn giao ca. Vượt qua: chặn handoff + scheduler tự force-release (tránh ban vì online quá nhiều). Có thể override per-game.</p>
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

    <!-- Create modal (game / server / dlc) -->
    <ModalWrapper v-if="formType" :model-value="true" size="md" persistent @update:model-value="formType = ''">
      <template #header>
        <div class="px-8 pt-8 pb-4 flex items-center justify-between">
          <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">{{ formTitle }}</h3>
          <button @click="formType = ''" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-4">
        <template v-if="formType === 'game'">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Tên game *</label>
            <input v-model="form_game.game_name" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Diablo 4" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Publisher</label>
            <input v-model="form_game.publisher" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Blizzard" />
          </div>
        </template>
        <template v-if="formType === 'server'">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Game *</label>
            <SearchableSelect v-model="form_game.game" :options="gameOptions" placeholder="Chọn game" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Tên server *</label>
            <input v-model="form_game.server_name" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="VD: Asia #1, Server Chim Sẻ, ..." />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ghi chú</label>
            <input v-model="form_game.notes" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Optional" />
          </div>
        </template>
        <template v-if="formType === 'dlc'">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Game *</label>
            <SearchableSelect v-model="form_game.game" :options="gameOptions" placeholder="Chọn game" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Tên DLC *</label>
            <input v-model="form_game.dlc_name" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Vessel of Hatred" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ngày ra mắt</label>
            <input v-model="form_game.release_date" type="date" class="w-full input-field px-3 py-2.5 text-sm" />
          </div>
        </template>
        <p v-if="formError" class="text-xs text-red-500 font-medium">{{ formError }}</p>
      </div>
      <template #footer>
        <button @click="formType = ''" class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
        <button @click="submitForm" :disabled="formSaving" class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
          <span v-if="formSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Lưu
        </button>
      </template>
    </ModalWrapper>

    <!-- List-option create/edit modal -->
    <ModalWrapper v-if="optionFormOpen" :model-value="true" size="md" persistent @update:model-value="optionFormOpen = false">
      <template #header>
        <div class="px-8 pt-8 pb-4 flex items-center justify-between">
          <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">
            {{ optionEditing ? 'Sửa' : 'Thêm' }} {{ currentCategory }}
          </h3>
          <button @click="optionFormOpen = false" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-4">
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Nhãn *</label>
          <input v-model="optionForm.label" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Steam" />
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Value <span class="normal-case font-medium opacity-50">(để trống để tự sinh từ nhãn)</span></label>
          <input v-model="optionForm.value" type="text" class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="STEAM" />
        </div>
        <div v-if="currentCategory === 'Platform'">
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Code platform <span class="normal-case font-medium opacity-50">(dùng để khớp email code)</span></label>
          <select v-model="optionForm.code_platform" class="w-full input-field px-3 py-2.5 text-sm">
            <option v-for="c in CODE_PLATFORM_OPTS" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Icon (emoji)</label>
            <input v-model="optionForm.icon" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="🎮" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Thứ tự</label>
            <input v-model.number="optionForm.sort_order" type="number" class="w-full input-field px-3 py-2.5 text-sm" placeholder="0" />
          </div>
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-2">Màu</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in COLORS" :key="c" type="button" @click="optionForm.color = c"
              class="w-8 h-8 rounded-lg border-2 transition"
              :class="[optionColorClass(c), optionForm.color === c ? 'border-white ring-2 ring-indigo-500' : 'border-transparent']"
            ></button>
          </div>
        </div>
        <p v-if="optionError" class="text-xs text-red-500 font-medium">{{ optionError }}</p>
      </div>
      <template #footer>
        <button @click="optionFormOpen = false" class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
        <button @click="submitOption" :disabled="optionSaving" class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
          <span v-if="optionSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Lưu
        </button>
      </template>
    </ModalWrapper>

    <!-- Generic confirm dialog -->
    <ConfirmDialog
      v-if="confirmState.open" :title="confirmState.title" :message="confirmState.message"
      danger confirm-label="Xoá" @close="confirmState.open = false" @confirm="runConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { useGamMetadata, optionColorClass } from '../composables/useGamMetadata.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { getList, createDoc, updateDoc, deleteDoc, frappeCall } from '../api/index.js'
import { formatDate } from '../utils/format.js'

defineOptions({ name: 'AdminSettingsView' })

const { connected } = useRealtime()
const { success, error: notifyError } = useNotify()
const { loadListOptions } = useGamMetadata()
// After saving thresholds we refresh the shared singleton so the rest of the app
// (sidebar badges, online watcher, detail rested badge) picks up new thresholds.
const { refresh: refreshActive } = useActiveUsage()

// ---- Top-level tabs (plan §3.5) ----
const TOP_TABS = [
  { key: 'games', label: 'Game & DLC', icon: '🎯' },
  { key: 'options', label: 'Tuỳ chọn', icon: '🏷️' },
  { key: 'thresholds', label: 'Ngưỡng', icon: '📊' },
]
const topTab = ref('games')

// ---- Game & DLC sub-tabs ----
const GAME_SUB_TABS = [
  { key: 'games', label: 'Game', icon: '🎮' },
  { key: 'servers', label: 'Server', icon: '🌐' },
  { key: 'dlc', label: 'DLC', icon: '🧩' },
]
const gameSubTab = ref('games')

// ---- Tuỳ chọn sub-tabs (Platform / Role / Status) ----
const OPT_SUB_TABS = [
  { key: 'Platform', label: 'Platform', icon: '🎮' },
  { key: 'Account Role', label: 'Role', icon: '🏷️' },
  { key: 'Account Status', label: 'Status', icon: '📊' },
]
const optSubTab = ref('Platform')
const currentCategory = computed(() => optSubTab.value)

const COLORS = ['blue', 'indigo', 'emerald', 'amber', 'red', 'slate', 'orange', 'gray']
const CODE_PLATFORM_OPTS = ['STEAM', 'BATTLENET', 'POE', 'EPIC', 'XBOX', 'OTHER']

// ---- Games / Servers / DLC data ----
const games = ref([])
const servers = ref([])
const dlcs = ref([])
const loadingGames = ref(false)
const loadingServers = ref(false)
const loadingDlcs = ref(false)

const gameOptions = computed(() => games.value.map(g => ({ value: g.name, label: g.game_name })))
function gameName(link) {
  return games.value.find(g => g.name === link)?.game_name || link || '—'
}

async function loadGames() {
  loadingGames.value = true
  try {
    games.value = await getList('GAM Game', { fields: ['name', 'game_name', 'publisher', 'is_active'], limit: 500, order_by: 'game_name asc' })
  } catch { games.value = [] } finally { loadingGames.value = false }
}
async function loadServers() {
  loadingServers.value = true
  try {
    servers.value = await getList('GAM Game Server', { fields: ['name', 'game', 'server_name', 'is_active', 'notes'], limit: 500, order_by: 'server_name asc' })
  } catch { servers.value = [] } finally { loadingServers.value = false }
}
async function loadDlcs() {
  loadingDlcs.value = true
  try {
    dlcs.value = await getList('GAM DLC', { fields: ['name', 'dlc_name', 'game', 'release_date'], limit: 500, order_by: 'dlc_name asc' })
  } catch { dlcs.value = [] } finally { loadingDlcs.value = false }
}

async function toggleActive(doctype, doc) {
  try {
    await updateDoc(doctype, doc.name, { is_active: doc.is_active ? 0 : 1 })
    doc.is_active = doc.is_active ? 0 : 1
    success('Đã cập nhật')
  } catch (e) { notifyError(e.message || 'Cập nhật thất bại') }
}

// ---- Create / edit form (game / server / dlc) ----
const formType = ref('')
const editingId = ref('')
const formTitle = computed(() => {
  const base = formType.value === 'game' ? 'Game' : formType.value === 'server' ? 'Server' : 'DLC'
  return (editingId.value ? 'Sửa ' : 'Thêm ') + base
})
// NOTE: named `form_game` in template to avoid clashing with the governance `form` ref.
const form_game = ref({})
const formSaving = ref(false)
const formError = ref('')

function openForm(type, doc) {
  formType.value = type
  formError.value = ''
  editingId.value = doc?.name || ''
  if (doc) {
    form_game.value = { ...doc }
  } else if (type === 'game') {
    form_game.value = { game_name: '', publisher: '' }
  } else if (type === 'server') {
    form_game.value = { game: '', server_name: '', notes: '' }
  } else {
    form_game.value = { game: '', dlc_name: '', release_date: '' }
  }
}

async function submitForm() {
  const t = formType.value
  if (t === 'game' && !form_game.value.game_name) return (formError.value = 'Nhập tên game')
  if (t === 'server' && (!form_game.value.game || !form_game.value.server_name)) return (formError.value = 'Chọn game và nhập tên server')
  if (t === 'dlc' && (!form_game.value.game || !form_game.value.dlc_name)) return (formError.value = 'Chọn game và nhập tên DLC')

  formSaving.value = true
  formError.value = ''
  try {
    const doctype = t === 'game' ? 'GAM Game' : t === 'server' ? 'GAM Game Server' : 'GAM DLC'
    const payload = { ...form_game.value }
    // Clean optionals + strip read-only system fields before sending.
    if (!payload.release_date) delete payload.release_date
    if (!payload.publisher) delete payload.publisher
    if (!payload.notes) delete payload.notes
    delete payload.name
    delete payload.creation
    delete payload.modified
    delete payload.owner
    delete payload.modified_by
    if (editingId.value) {
      await updateDoc(doctype, editingId.value, payload)
      success('Đã cập nhật')
    } else {
      payload.is_active = 1
      await createDoc(doctype, payload)
      success('Đã tạo')
    }
    formType.value = ''
    editingId.value = ''
    refreshGamesData()
  } catch (e) {
    formError.value = e.message || 'Lưu thất bại'
  } finally {
    formSaving.value = false
  }
}

function deleteEntity(doctype, doc) {
  const label = doc.game_name || doc.server_name || doc.dlc_name || doc.name
  confirmState.value = {
    open: true,
    title: `Xoá ${label}`,
    message: `Xoá «${label}»? Hành động này không thể hoàn tác.`,
    onConfirm: async () => {
      try {
        await deleteDoc(doctype, doc.name)
        success('Đã xoá')
        refreshGamesData()
      } catch (e) {
        notifyError(e.message || 'Xoá thất bại')
      }
    },
  }
}

// ---- Configurable list options (Platform / Role / Status) ----
const listOptions = ref([])
const loadingOptions = ref(false)

async function loadOptions() {
  if (!currentCategory.value) return
  loadingOptions.value = true
  try {
    listOptions.value = await frappeCall('gam.api.get_list_options', { category: currentCategory.value })
  } catch {
    listOptions.value = []
  } finally {
    loadingOptions.value = false
  }
}

const optionFormOpen = ref(false)
const optionEditing = ref(null)
const optionForm = ref({})
const optionSaving = ref(false)
const optionError = ref('')

function openOptionCreate() {
  optionEditing.value = null
  optionError.value = ''
  optionForm.value = {
    label: '', value: '',
    code_platform: currentCategory.value === 'Platform' ? 'STEAM' : '',
    icon: '', color: 'indigo', sort_order: 0, is_active: 1,
  }
  optionFormOpen.value = true
}
function openOptionEdit(o) {
  optionEditing.value = o.name
  optionError.value = ''
  optionForm.value = {
    label: o.label || '', value: o.value || '',
    code_platform: o.code_platform || '',
    icon: o.icon || '', color: o.color || 'gray',
    sort_order: o.sort_order || 0, is_active: 1,
  }
  optionFormOpen.value = true
}

async function submitOption() {
  if (!optionForm.value.label) return (optionError.value = 'Nhập nhãn')
  optionSaving.value = true
  optionError.value = ''
  try {
    const values = { ...optionForm.value, category: currentCategory.value }
    await frappeCall('gam.api.save_list_option', {
      values: JSON.stringify(values),
      name: optionEditing.value || undefined,
    })
    success('Đã lưu')
    optionFormOpen.value = false
    await loadOptions()
    loadListOptions(true) // refresh app-wide cache (forms, badges, filters)
  } catch (e) {
    optionError.value = e.message || 'Lưu thất bại'
  } finally {
    optionSaving.value = false
  }
}

const confirmState = ref({ open: false, title: '', message: '', onConfirm: null })
function runConfirm() {
  const fn = confirmState.value.onConfirm
  confirmState.value.open = false
  fn?.()
}
function deleteOption(o) {
  confirmState.value = {
    open: true,
    title: `Xoá ${currentCategory.value}`,
    message: `Xoá tuỳ chọn «${o.label}»? Các tài khoản đang dùng giá trị này sẽ giữ nguyên giá trị cũ.`,
    onConfirm: async () => {
      try {
        const res = await frappeCall('gam.api.delete_list_option', { name: o.name })
        success(res.in_use?.length
          ? `Đã xoá. Lưu ý: ${res.in_use.length} tài khoản vẫn còn giá trị "${o.value}".`
          : 'Đã xoá')
        await loadOptions()
        loadListOptions(true)
      } catch (e) {
        notifyError(e.message || 'Xoá thất bại')
      }
    },
  }
}

// ---- Governance thresholds (Ngưỡng) ----
const loadingThresholds = ref(true)
const saving = ref(false)
const error = ref('')
const form = ref({
  max_online_hours: 8,
  min_rested_hours: 8,
  hard_cap_online_hours: 12,
  continuous_online_cap_hours: 16,
  block_logout_with_active_lease: 1,
})

async function loadThresholds() {
  loadingThresholds.value = true
  error.value = ''
  try {
    const s = await frappeCall('gam.api.get_gam_settings')
    form.value = {
      max_online_hours: Number(s.max_online_hours) || 8,
      min_rested_hours: Number(s.min_rested_hours) || 8,
      hard_cap_online_hours: Number(s.hard_cap_online_hours) || 12,
      continuous_online_cap_hours: Number(s.continuous_online_cap_hours) || 16,
      block_logout_with_active_lease: s.block_logout_with_active_lease ? 1 : 0,
    }
  } catch (e) {
    error.value = e.message || 'Không tải được cài đặt'
  } finally {
    loadingThresholds.value = false
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
      continuous_online_cap_hours: form.value.continuous_online_cap_hours,
      block_logout_with_active_lease: form.value.block_logout_with_active_lease ? 1 : 0,
    })
    form.value = {
      max_online_hours: Number(s.max_online_hours) || 8,
      min_rested_hours: Number(s.min_rested_hours) || 8,
      hard_cap_online_hours: Number(s.hard_cap_online_hours) || 12,
      continuous_online_cap_hours: Number(s.continuous_online_cap_hours) || 16,
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

// ---- Refresh helpers ----
async function refreshGamesData() {
  await Promise.all([loadGames(), loadServers(), loadDlcs()])
}

async function refresh() {
  await refreshGamesData()
  await loadThresholds()
  if (topTab.value === 'options') await loadOptions()
}

// ---- Tab watchers ----
watch(optSubTab, () => loadOptions())
// Load thresholds lazily on first visit to the Ngưỡng tab.
watch(topTab, (v) => {
  if (v === 'thresholds' && loadingThresholds.value) loadThresholds()
})

onMounted(() => {
  refreshGamesData()
})
</script>
