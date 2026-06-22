<template>
  <ModalWrapper v-model="visible" size="md" :z-index="70">
    <template #header>
      <div class="px-8 pt-8 pb-4">
        <h3 class="text-app-text-primary font-black text-xl flex items-center gap-2">
          <span class="text-yellow-600">✏️ Chỉnh sửa Legacy Note</span>
        </h3>
      </div>
    </template>

    <div class="px-8 py-4">
      <textarea
      v-model="noteText"
      placeholder="Nhập nội dung ghi chú đơn hàng..."
      class="w-full bg-app-surface border border-app-border rounded-xl px-4 py-4 text-app-text-primary text-sm resize-none outline-none focus:border-yellow-500 transition min-h-[150px]"
      rows="5"
    ></textarea>
    </div>

    <template #footer>
      <AppButton variant="neutral" size="md" @click="visible = false">Quay lại</AppButton>
      <AppButton variant="warning" size="md" :loading="saving" :disabled="saving" @click="saveNote">Lưu thay đổi</AppButton>
    </template>
  </ModalWrapper>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import AppButton from './AppButton.vue'
import { frappeCall } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  order: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { success, error } = useNotify()

const noteText = ref('')
const saving = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

watch(() => props.order, (o) => {
  if (o) noteText.value = o.note || ''
}, { immediate: true })

async function saveNote() {
  if (!props.order) return
  saving.value = true
  try {
    const doctype = props.order.name.startsWith('BO') ? 'Buy Order' : 'Sell Order'
    await frappeCall('gege_custom.gege_custom.utils.update_order_note', {
      doctype,
      name: props.order.name,
      note: noteText.value,
    })
    visible.value = false
    emit('saved')
    success('Đã cập nhật Legacy Note')
  } catch (e) {
    error('Lỗi khi lưu ghi chú: ' + (e.message || e))
  } finally {
    saving.value = false
  }
}
</script>
