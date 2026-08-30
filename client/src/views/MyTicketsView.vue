<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTicketStore } from '@/stores/tickets';
import StatusBadge from '@/components/StatusBadge.vue';
import EmptyState from '@/components/EmptyState.vue';
import LoadingRows from '@/components/LoadingRows.vue';
import { thDateTime, relTime } from '@/services/format';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const store = useTicketStore();

const tab = ref('open');
const search = ref(route.query.q || '');

onMounted(() => store.load(auth.isEmployee ? {} : { scope: 'reported' }));
watch(() => route.query.q, (q) => { search.value = q || ''; });

const CLOSED = ['resolved', 'cancelled'];

const tabs = computed(() => {
  const list = store.items;
  return [
    { key: 'open', label: 'กำลังดำเนินการ', count: list.filter((t) => !CLOSED.includes(t.status)).length },
    { key: 'closed', label: 'ปิดแล้ว', count: list.filter((t) => CLOSED.includes(t.status)).length },
    { key: 'all', label: 'ทั้งหมด', count: list.length }
  ];
});

const rows = computed(() => {
  const q = String(search.value).trim().toLowerCase();
  return store.items.filter((t) => {
    const byTab = tab.value === 'all' ? true : tab.value === 'open' ? !CLOSED.includes(t.status) : CLOSED.includes(t.status);
    if (!byTab) return false;
    if (!q) return true;
    return [t.code, t.title, t.categoryLabel].some((v) => String(v || '').toLowerCase().includes(q));
  });
});

function open(t) {
  router.push({ name: 'ticket-detail', params: { id: t._id } });
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex gap-2 flex-wrap align-items-center">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="chip chip--lg"
        :class="{ 'is-active': tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }} · {{ t.count }}
      </button>
    </div>

    <LoadingRows v-if="store.loading" :rows="4" :height="86" />

    <EmptyState
      v-else-if="!rows.length"
      title="ยังไม่มีตั๋วงานในหมวดนี้"
      sub="เมื่อคุณแจ้งปัญหาเข้ามา รายการจะแสดงที่นี่พร้อมสถานะล่าสุด"
    />

    <div
      v-for="t in rows"
      :key="t._id"
      class="card-surface mine-row"
      role="button"
      tabindex="0"
      @click="open(t)"
      @keydown.enter="open(t)"
    >
      <div class="d-flex flex-column gap-1 min-w-0">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="mono mine-row__code">{{ t.code }}</span>
          <span class="pill" style="background: var(--surface-3); color: var(--ink-3); font-size: 10.5px">
            {{ t.categoryLabel }}
          </span>
        </div>
        <span class="mine-row__title">{{ t.title }}</span>
        <span class="mine-row__meta">
          แจ้งเมื่อ {{ thDateTime(t.createdAt) }} · อัปเดตล่าสุด {{ relTime(t.updatedAt) }}
        </span>
      </div>

      <StatusBadge :value="t.status" />

      <div class="d-flex flex-column gap-1">
        <span class="meta-label">ผู้รับผิดชอบ</span>
        <span style="font: 400 12.5px var(--font-th); color: var(--ink-2)">{{ t.assigneeName }}</span>
      </div>

      <span class="mine-row__sla mono" :class="{ 'is-risk': t.slaRisk }">{{ t.slaText }}</span>
    </div>
  </div>
</template>

<style scoped>
.mine-row {
  display: grid; grid-template-columns: minmax(0, 1fr) 150px 150px 110px;
  gap: 16px; align-items: center;
  padding: 15px 18px; cursor: pointer;
}
.mine-row:hover { box-shadow: 0 4px 14px rgba(16, 24, 32, 0.08); }
.mine-row__code { font: 500 11px var(--font-mono); color: var(--muted-2); }
.mine-row__title { font: 500 13.5px var(--font-th); }
.mine-row__meta { font: 400 11.5px var(--font-th); color: var(--muted-2); }
.mine-row__sla { justify-self: end; font: 500 11.5px var(--font-mono); color: var(--muted); }
.mine-row__sla.is-risk { color: var(--danger-ink); }
.min-w-0 { min-width: 0; }

@media (max-width: 767.98px) {
  .mine-row { grid-template-columns: 1fr auto; gap: 10px; }
  .mine-row__sla { justify-self: start; }
}
</style>
