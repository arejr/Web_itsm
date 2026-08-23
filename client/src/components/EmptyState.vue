<script setup>
defineProps({
  title: { type: String, default: 'ยังไม่มีข้อมูล' },
  sub: { type: String, default: '' }
});
</script>

<template>
  <div class="empty-state">
    <div class="fw-medium" style="color: var(--ink-3); font-size: 13.5px">{{ title }}</div>
    <div v-if="sub" class="mt-1">{{ sub }}</div>
    <slot />
  </div>
</template>
