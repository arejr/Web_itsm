<script setup>
import { computed } from 'vue';
import { stat } from '@/services/lookups';

const props = defineProps({ value: { type: String, default: 'new' } });
const s = computed(() => stat(props.value));
</script>

<template>
  <span class="pill pill--round" :style="{ background: s.bg, color: s.fg }">{{ s.label }}</span>
</template>
