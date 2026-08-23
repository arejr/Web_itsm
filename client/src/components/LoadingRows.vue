<script setup>
defineProps({ rows: { type: Number, default: 4 }, height: { type: Number, default: 58 } });
</script>

<template>
  <div class="d-flex flex-column gap-2 p-3">
    <div v-for="i in rows" :key="i" class="skeleton" :style="{ height: height + 'px' }"></div>
  </div>
</template>
