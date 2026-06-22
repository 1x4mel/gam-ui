import { ref } from 'vue'
import { uploadFile, createDoc } from '../api/index.js'

export function useEvidenceUpload() {
  const uploading = ref(false)
  const uploadError = ref('')
  const uploadProgress = ref({ done: 0, total: 0 })

  function resetError() {
    uploadError.value = ''
  }

  async function submitEvidence({ file, files, note, referenceDoctype, referenceName, channel, beforeUpload }) {
    uploadError.value = ''

    const fileArray = files || (file ? [file] : [])
    if (!fileArray.length) {
      uploadError.value = 'Vui lòng chọn file'
      return false
    }

    const ch = (channel || '').toLowerCase()
    const maxSizeMB = ch.includes('eldorado') ? 100 : 500
    const maxSize = maxSizeMB * 1024 * 1024

    for (const f of fileArray) {
      if (f.size > maxSize) {
        uploadError.value = `File "${f.name}" quá lớn (${(f.size / 1024 / 1024).toFixed(0)}MB). Giới hạn ${maxSizeMB}MB.`
        return false
      }
    }

    uploading.value = true
    uploadProgress.value = { done: 0, total: fileArray.length }

    try {
      if (beforeUpload) await beforeUpload()

      for (let i = 0; i < fileArray.length; i++) {
        const f = fileArray[i]

        const uploaded = await uploadFile(f)
        if (!uploaded || !uploaded.file_url) {
          throw new Error(`Upload failed for "${f.name}": no file URL returned`)
        }
        await createDoc('Order Evidence', {
          reference_doctype: referenceDoctype,
          reference_name: referenceName,
          attachment: uploaded.file_url,
          note,
          status: 'Pending',
        })
        uploadProgress.value.done = i + 1
      }
      return true
    } catch (e) {
      const msg = e.message || String(e)
      if (msg.includes('CONNECTION_ABORTED') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        uploadError.value = 'Upload bị ngắt — file có thể quá lớn. Thử lại hoặc dùng file nhỏ hơn.'
      } else {
        uploadError.value = msg
      }
      return false
    } finally {
      uploading.value = false
    }
  }

  // Upload a single file without creating Order Evidence (for preview flow)
  async function uploadFileOnly(file) {
    uploadError.value = ''
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      uploadError.value = `File quá lớn (${(file.size / 1024 / 1024).toFixed(0)}MB). Giới hạn 500MB.`
      return null
    }

    uploading.value = true
    try {
      const uploaded = await uploadFile(file)
      if (!uploaded || !uploaded.file_url) {
        throw new Error('Upload failed: no file URL returned')
      }
      return {
        file_url: uploaded.file_url,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      }
    } catch (e) {
      uploadError.value = e.message || String(e)
      return null
    } finally {
      uploading.value = false
    }
  }

  // Create Order Evidence after user confirms preview
  async function confirmEvidence({ fileUrl, note, referenceDoctype, referenceName }) {
    uploadError.value = ''
    try {
      await createDoc('Order Evidence', {
        reference_doctype: referenceDoctype,
        reference_name: referenceName,
        attachment: fileUrl,
        note: note || '',
        status: 'Pending',
      })
      return true
    } catch (e) {
      uploadError.value = e.message || String(e)
      return false
    }
  }

  return { uploading, uploadError, uploadProgress, resetError, submitEvidence, uploadFileOnly, confirmEvidence }
}
