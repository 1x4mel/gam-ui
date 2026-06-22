import { ref, nextTick } from 'vue'

const lastViewedObjectId = ref(null)

export function useScrollMemory() {
  const setLastViewed = (id) => {
    lastViewedObjectId.value = id
  }

  const clearLastViewed = () => {
    lastViewedObjectId.value = null
  }

  const handleScrollRestoration = async (options = {}) => {
    const {
      behavior = 'smooth',
      block = 'center',
      delay = 300,
      highlightClass = ['ring-4', 'ring-indigo-500', 'transition-all', 'duration-500', 'z-10'],
      highlightDuration = 2000,
      container = null,
    } = options

    if (!lastViewedObjectId.value) return

    await nextTick()

    setTimeout(() => {
      const el = document.getElementById(lastViewedObjectId.value)
      if (!el) return

      if (container) {
        const containerRect = container.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const offset = elRect.top - containerRect.top + container.scrollTop - containerRect.height / 2 + elRect.height / 2
        container.scrollTo({ top: offset, behavior })
      } else {
        el.scrollIntoView({ behavior, block })
      }

      if (highlightClass && highlightClass.length > 0) {
        el.classList.add(...highlightClass)
        setTimeout(() => {
          el.classList.remove(...highlightClass)
        }, highlightDuration)
      }

      clearLastViewed()
    }, delay)
  }

  return {
    lastViewedObjectId,
    setLastViewed,
    clearLastViewed,
    handleScrollRestoration
  }
}
