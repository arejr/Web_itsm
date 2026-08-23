<script setup>
import { useUiStore } from '@/stores/ui';
const ui = useUiStore();
</script>

<template>
  <div class="toast-stack" aria-live="polite" aria-atomic="true">
    <div
      v-for="t in ui.toasts"
      :key="t.id"
      class="toast-item"
      :class="{ 'toast-item--ok': t.kind === 'ok', 'toast-item--err': t.kind === 'err' }"
      role="status"
    >
      <span class="flex-fill">{{ t.message }}</span>
      <button class="btn-close-plain" type="button" aria-label="ปิด" @click="ui.dismiss(t.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.btn-close-plain {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.btn-close-plain:hover { color: #fff; }
</style>
