<template>
  <div class="w-full overflow-x-auto scrollbar-hide -mx-1 px-1">
    <div class="flex gap-4 sm:gap-6 border-b border-app-border w-full pb-[1px] min-w-max">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="$emit('update:modelValue', tab.key)"
        class="pb-3 text-xs sm:text-sm font-bold transition relative group flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
        :class="modelValue === tab.key ? 'text-indigo-600' : 'text-app-text-muted hover:text-app-text-secondary'"
      >
        <span v-if="tab.icon" class="text-base sm:text-xl leading-none">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.count != null && tab.count > 0"
          class="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black border"
          :class="modelValue === tab.key ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-app-bg text-app-text-muted border-app-border'"
        >{{ tab.count }}</span>
        <div
          class="absolute bottom-[0px] left-0 right-0 h-[3px] bg-indigo-600 rounded-t-full transition-all duration-300"
          :class="modelValue === tab.key ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-50'"
        ></div>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tabs: { type: Array, required: true },
  modelValue: { type: String, required: true },
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
