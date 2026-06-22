import { ref, computed, watchEffect } from 'vue'

const theme = ref(localStorage.getItem('theme') || 'dark')

export function useTheme() {
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    localStorage.setItem('theme', theme.value)
  }

  const setTheme = (newTheme) => {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
  }

  // Update document root whenever theme changes
  watchEffect(() => {
    const root = document.documentElement
    if (theme.value === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  })

  const isDark = computed(() => theme.value === 'dark')

  return {
    theme,
    toggleTheme,
    setTheme,
    isDark
  }
}
