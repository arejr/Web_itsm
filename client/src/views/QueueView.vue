<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMetaStore } from '@/stores/meta';
import { PRIORITY } from '@/services/lookups';
import { useTicketStore } from '@/stores/tickets';

import EmptyState from '@/components/EmptyState.vue';
import LoadingRows from '@/components/LoadingRows.vue';

const route = useRoute();
const router = useRouter();
const meta = useMetaStore();
const store = useTicketStore();

const tab = ref('all');
const search = ref(route.query.q || '');

onMounted(async () => {
  await meta.load();
  await store.load();
});

watch(() => route.query.q, (q) => { search.value = q || ''; });

const tabs = computed(() => {
  const list = store.items;
  return [
    { key: 'all', label: 'ทั้งหมด', count: list.length },
    { key: 'new', label: 'รอคัดกรอง', count: list.filter((t) => t.status === 'new').length },
    { key: 'active', label: 'กำลังทำ', count: list.filter((t) => ['assigned', 'inprogress'].includes(t.status)).length },
    { key: 'closed', label: 'ปิดแล้ว', count: list.filter((t) => ['resolved', 'cancelled'].includes(t.status)).length }
  ];
});

const rows = computed(() => {
  const q = String(search.value).trim().toLowerCase();
  return store.items.filter((t) => {
    const byTab =
      tab.value === 'all' ? true
      : tab.value === 'active' ? ['assigned', 'inprogress'].includes(t.status)
      : tab.value === 'closed' ? ['resolved', 'cancelled'].includes(t.status)
      : t.status === tab.value;
    if (!byTab) return false;
    if (!q) return true;
    return [t.code, t.title, t.requesterDisplay, t.requesterDept, t.location, t.assigneeName]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });
});


function open(t) {
  router.push({ name: 'ticket-detail', params: { id: t._id } });
}
</script>

<template>
  <div class="queue-layout">
    <!-- ตารางคิว -->
    <div class="card-surface card-surface--flush">
      <div class="queue-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="chip"
          :class="{ 'is-active': tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.label }} · {{ t.count }}
        </button>
        <div class="flex-fill"></div>
        <input v-model="search" class="input input--sm queue-search" type="search" placeholder="ค้นหาในคิว…" />
      </div>

      <div class="queue-head d-none d-lg-grid">
        <span>เลขตั๋ว</span><span>เรื่อง / ผู้แจ้ง</span><span>หมวดหมู่</span>
        <span>ความสำคัญ</span><span>ผู้รับผิดชอบ</span><span class="text-end">กำหนดเสร็จ</span>
      </div>

      <LoadingRows v-if="store.loading" :rows="5" />
      <EmptyState v-else-if="!rows.length" title="ไม่พบตั๋วงานในเงื่อนไขนี้" sub="ลองเปลี่ยนแท็บหรือคำค้นหา" />

      <div
        v-for="t in rows"
        :key="t._id"
        class="queue-row"
        :class="{ 'is-new': t.status === 'new' }"
        role="button"
        tabindex="0"
        @click="open(t)"
        @keydown.enter="open(t)"
      >
        <span class="tag-code">{{ t.code }}</span>
        <span class="d-flex flex-column min-w-0">
          <span class="queue-row__title text-truncate">{{ t.title }}</span>
          <span class="queue-row__meta text-truncate">
            {{ t.requesterDisplay }} · {{ t.requesterDept }} · {{ t.createdText }}
          </span>
        </span>
        <span class="pill" style="background: var(--surface-3); color: var(--ink-3)">{{ t.categoryLabel }}</span>
        <span class="pill" :style="{ color: PRIORITY[t.priority].fg }">
          <span class="dot" :style="{ background: PRIORITY[t.priority].dot }"></span>{{ PRIORITY[t.priority].label }}
        </span>
        <span class="queue-row__assignee text-truncate" :class="{ 'is-none': !t.assignee }">{{ t.assigneeName }}</span>
        <span class="queue-row__sla mono" :class="{ 'is-risk': t.slaRisk }">{{ t.slaText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-layout { display: flex; flex-direction: column; }

.queue-tabs {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  padding: 12px 16px; border-bottom: 1px solid rgba(16, 24, 32, 0.08);
}
.queue-search { width: 190px; }

.queue-head {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 110px 106px 122px 92px;
  gap: 12px; padding: 10px 16px;
  background: var(--surface-2);
  border-bottom: 1px solid rgba(16, 24, 32, 0.07);
  font: 500 11px var(--font-th); color: var(--muted);
}

.queue-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 110px 106px 122px 92px;
  gap: 12px; align-items: center;
  width: 100%; text-align: left;
  padding: 12px 16px; border: 0;
  border-bottom: 1px solid var(--line-2);
  background: #fff; cursor: pointer; position: relative;
  color: inherit;
}
.queue-row.is-new { background: #fffdf7; }
.queue-row:hover { background: var(--surface-2); }
.queue-row__title { font: 500 13px var(--font-th); }
.queue-row__meta { font: 400 11.5px var(--font-th); color: var(--muted-2); }
.queue-row__assignee { font: 400 12px var(--font-th); color: var(--muted); }
.queue-row__assignee.is-none { color: var(--danger); }
.queue-row__sla { justify-self: end; font: 500 11.5px var(--font-mono); color: var(--muted); }
.queue-row__sla.is-risk { color: var(--danger-ink); }
.min-w-0 { min-width: 0; }

@media (max-width: 991.98px) {
  .queue-row {
    grid-template-columns: 1fr auto;
    grid-template-areas: 'code sla' 'title title' 'cat prio' 'assignee assignee';
    gap: 5px 10px; padding: 14px 16px;
  }
  .queue-row > :nth-child(1) { grid-area: code; }
  .queue-row > :nth-child(2) { grid-area: title; }
  .queue-row > :nth-child(3) { grid-area: cat; justify-self: start; }
  .queue-row > :nth-child(4) { grid-area: prio; justify-self: end; }
  .queue-row > :nth-child(5) { grid-area: assignee; }
  .queue-row > :nth-child(6) { grid-area: sla; justify-self: end; }
  .queue-search { width: 100%; }
}
</style>
