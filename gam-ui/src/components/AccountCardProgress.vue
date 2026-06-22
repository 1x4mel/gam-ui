<template>
  <!--
    AccountCardProgress — the soft-cap progress bar used inside AccountCard's
    live state band. `tier` is the bundle returned by elapsedTier() and carries
    both the colour key and the fill percent.
  -->
  <div
    class="h-1.5 rounded-full bg-app-bg overflow-hidden"
    role="progressbar"
    :aria-valuenow="tier.percent"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="`Đã dùng ${tier.percent}% thời gian`"
  >
    <div
      class="h-full rounded-full transition-all duration-1000 ease-linear"
      :class="`bg-tier-${tier.tier}`"
      :style="{ width: Math.max(4, tier.percent) + '%' }"
    ></div>
  </div>
</template>

<script setup>
defineProps({
  /** elapsedTier() result: { tier, percent, remainingMs, ... }. */
  tier: { type: Object, required: true },
})
</script>
