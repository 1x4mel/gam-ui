import { ref } from 'vue'

export function useEditNote() {
  const showEditNoteModal = ref(false)
  const editingOrder = ref(null)

  function openNoteEditor(order) {
    editingOrder.value = order
    showEditNoteModal.value = true
  }

  return { showEditNoteModal, editingOrder, openNoteEditor }
}
