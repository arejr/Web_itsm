<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import api, { errMsg } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useTicketStore } from '@/stores/tickets';
import { useUiStore } from '@/stores/ui';
import { PRIORITY } from '@/services/lookups';
import EmptyState from '@/components/EmptyState.vue';

const router = useRouter();
const auth = useAuthStore();
const store = useTicketStore();
const ui = useUiStore();

// เจ้าหน้าที่ IT เห็นเฉพาะงานของตัวเองเป็นค่าเริ่มต้น
const scope = ref(auth.isTech ? 'mine' : 'all');
const dragging = ref(null);

const COLUMNS = [
  { key: 'assigned', label: 'รอรับงาน', color: '#d97706', accepts: ['new', 'assigned'] },
  { key: 'inprogress', label: 'กำลังดำเนินการ', color: '#14776b', accepts: ['inprogress'] },
  { key: 'resolved', label: 'แก้ไขสำเร็จ', color: '#5a9c33', accepts: ['resolved'] }
];

async function reload() {
  await store.load(scope.value === 'mine' ? { scope: 'mine' } : {});
}
onMounted(reload);

function setScope(v) {
  scope.value = v;
  reload();
}

const columns = computed(() =>
  COLUMNS.map((col) => ({
    ...col,
    items: store.items.filter((t) => col.accepts.includes(t.status))
  }))
);

function open(t) {
  router.push({ name: 'ticket-detail', params: { id: t._id } });
}

/* ---------- ลากการ์ดเพื่อเปลี่ยนสถานะ ---------- */
function onDragStart(t) {
  if (!auth.isStaff) return;
  dragging.value = t;
}
async function onDrop(col) {
  const t = dragging.value;
  dragging.value = null;
  if (!t || col.key === t.status) return;
  if (col.key === 'resolved') {
    ui.error('การปิดตั๋วต้องบันทึกวิธีแก้ปัญหา — เปิดตั๋วเพื่อบันทึก Resolution Note');
    open(t);
    return;
  }
  try {
    const { data } = await api.patch(`/tickets/${t._id}/status`, { status: col.key });
    store.upsert(data);
    ui.success(`ย้าย ${data.code} → ${col.label}`);
  } catch (err) {
    ui.error(errMsg(err));
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div v-if="!auth.isEmployee" class="d-flex gap-2 flex-wrap align-items-center">
      <button class="chip chip--lg" :class="{ 'is-active': scope === 'mine' }" type="button" @click="setScope('mine')">
        งานของฉัน
      </button>
      <button class="chip chip--lg" :class="{ 'is-active': scope === 'all' }" type="button" @click="setScope('all')">
        งานทั้งทีม
      </button>
      <span class="text-muted-3" style="font-size: 11.5px">ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนสถานะการทำงาน</span>
    </div>

    <div class="board">
      <div
        v-for="col in columns"
        :key="col.key"
        class="board__col"
        @dragover.prevent
        @drop.prevent="onDrop(col)"
      >
        <div class="board__head">
          <span class="dot dot--sq" :style="{ background: col.color, width: '8px', height: '8px' }"></span>
          <span class="board__label">{{ col.label }}</span>
          <span class="mono board__count">{{ col.items.length }}</span>
        </div>

        <EmptyState v-if="!col.items.length" title="ไม่มีงานในคอลัมน์นี้" />

        <div
          v-for="t in col.items"
          :key="t._id"
          class="board__card"
          :style="{ borderLeftColor: PRIORITY[t.priority].dot }"
          :draggable="auth.isStaff"
          role="button"
          tabindex="0"
          @dragstart="onDragStart(t)"
          @click="open(t)"
          @keydown.enter="open(t)"
        >
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="mono board__code">{{ t.code }}</span>
            <span class="pill" style="background: var(--surface-3); color: var(--ink-3); font-size: 10.5px">
              {{ t.categoryLabel }}
            </span>
          </div>
          <span class="board__title">{{ t.title }}</span>
          <div class="d-flex align-items-center gap-2">
            <span class="board__requester flex-fill text-truncate">{{ t.requesterDisplay }}</span>
            <span class="mono board__sla" :class="{ 'is-risk': t.slaRisk }">{{ t.slaText }}</span>
          </div>
          <div v-if="scope === 'all' && t.assignee" class="board__assignee">
            <span class="avatar avatar--sm" style="width: 20px; height: 20px; font-size: 9px">{{ t.assigneeInitial }}</span>
            {{ t.assigneeName }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: start; }
.board__col {
  background: #f4f6f8;
  border: 1px solid rgba(16, 24, 32, 0.08);
  border-radius: var(--radius-lg);
  padding: 11px;
  display: flex; flex-direction: column; gap: 9px;
  min-height: 320px;
}
.board__head { display: flex; align-items: center; gap: 8px; padding: 2px 4px; }
.board__label { font: 600 12.5px var(--font-th); }
.board__count { font: 500 11px var(--font-mono); color: var(--muted-2); }

.board__card {
  display: flex; flex-direction: column; gap: 8px;
  text-align: left; padding: 12px;
  border: 1px solid rgba(16, 24, 32, 0.09);
  border-left: 3px solid var(--brand);
  border-radius: 9px; background: #fff; cursor: pointer;
}
.board__card:hover { box-shadow: 0 4px 14px rgba(16, 24, 32, 0.1); }
.board__code { font: 500 11px var(--font-mono); color: var(--muted-2); }
.board__title { font: 500 12.5px/1.45 var(--font-th); }
.board__requester { font: 400 11px var(--font-th); color: var(--muted-2); }
.board__sla { font: 500 10.5px var(--font-mono); color: var(--muted); }
.board__sla.is-risk { color: var(--danger-ink); }
.board__assignee {
  display: flex; align-items: center; gap: 6px;
  padding-top: 7px; border-top: 1px solid var(--line-2);
  font: 400 11px var(--font-th); color: var(--muted);
}

@media (max-width: 1199.98px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 575.98px) { .board { grid-template-columns: 1fr; } .board__col { min-height: auto; } }
</style>
