<script setup>
import { computed } from 'vue';
import { prio } from '@/services/lookups';

const props = defineProps({
  value: { type: String, default: 'medium' },
  variant: { type: String, default: 'solid' } // solid | dot | square
});
const p = computed(() => prio(props.value));
</script>

<template>
  <span v-if="variant === 'dot'" class="pill" :style="{ color: p.fg }">
    <span class="dot" :style="{ background: p.dot }"></span>{{ p.label }}
  </span>
  <span v-else class="pill" :style="{ background: p.bg, color: p.fg }">{{ p.label }}</span>
</template>
