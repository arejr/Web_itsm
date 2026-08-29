<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { errMsg } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useMetaStore } from '@/stores/meta';
import { useTicketStore } from '@/stores/tickets';
import { useUiStore } from '@/stores/ui';
import { PRIORITY, PRIORITY_ORDER, CHANNELS, prio } from '@/services/lookups';
import EmptyState from '@/components/EmptyState.vue';
import LoadingRows from '@/components/LoadingRows.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const meta = useMetaStore();
const store = useTicketStore();
const ui = useUiStore();

const tab = ref('all');
const search = ref(route.query.q || '');
const panelMode = ref('triage'); // triage | create
const busy = ref(false);

/* ---------- แผงคัดกรอง ---------- */
const selectedId = ref(null);
const triage = ref({ categoryId: '', priority: 'medium', assigneeId: '' });

/* ---------- แผงออกตั๋วเอง ---------- */
const draft = ref({
  channel: 'โทรศัพท์', requesterName: '', requesterDept: '', title: '', description: '',
  categoryId: '', priority: 'medium', assigneeId: '', location: ''
});

onMounted(async () => {
  await meta.load();
  await meta.loadTechnicians();
  await store.load();
  if (meta.categories.length) {
    triage.value.categoryId = meta.categories[0]._id;
    draft.value.categoryId = meta.categories[0]._id;
  }
  pickFirstNew();
});

watch(() => route.query.q, (q) => { search.value = q || ''; });

const OPEN = ['new', 'assigned', 'inprogress', 'pending'];

const tabs = computed(() => {
  const list = store.items;
  return [
    { key: 'all', label: 'ทั้งหมด', count: list.length },
    { key: 'new', label: 'รอคัดกรอง', count: list.filter((t) => t.status === 'new').length },
    { key: 'active', label: 'กำลังทำ', count: list.filter((t) => ['assigned', 'inprogress'].includes(t.status)).length },
    { key: 'pending', label: 'รอดำเนินการ', count: list.filter((t) => t.status === 'pending').length },
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

const newTickets = computed(() => store.items.filter((t) => t.status === 'new'));
const selected = computed(() => store.items.find((t) => t._id === selectedId.value) || null);

function pickFirstNew() {
  if (!selectedId.value || !newTickets.value.some((t) => t._id === selectedId.value)) {
    const first = newTickets.value[0];
    selectedId.value = first?._id || null;
    if (first) {
      triage.value.categoryId = first.category?._id || meta.categories[0]?._id || '';
      triage.value.priority = first.priority || 'medium';
      triage.value.assigneeId = '';
    }
  }
}
watch(newTickets, pickFirstNew);

function selectForTriage(t) {
  panelMode.value = 'triage';
  selectedId.value = t._id;
  triage.value.categoryId = t.category?._id || meta.categories[0]?._id || '';
  triage.value.priority = t.priority || 'medium';
  triage.value.assigneeId = t.assignee?._id || '';
}

function open(t) {
  router.push({ name: 'ticket-detail', params: { id: t._id } });
}

const triageHint = computed(() => {
  const tech = meta.technicians.find((x) => x._id === triage.value.assigneeId);
  const p = prio(triage.value.priority);
  return tech
    ? `จะมอบหมายให้ ${tech.name} · ระดับ ${p.label}`
    : `เลือกเจ้าหน้าที่ผู้รับผิดชอบ · ระดับ ${p.label}`;
});

async function submitTriage() {
  if (!selected.value) return;
  if (!triage.value.assigneeId) {
    ui.error('กรุณาเลือกเจ้าหน้าที่ผู้รับผิดชอบ');
    return;
  }
  busy.value = true;
  try {
    const { data } = await api.patch(`/tickets/${selected.value._id}/triage`, triage.value);
    store.upsert(data);
    ui.success(`มอบหมาย ${data.code} เรียบร้อยแล้ว`);
    selectedId.value = null;
    pickFirstNew();
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

// Helpdesk แก้ปัญหาเบื้องต้นและปิดตั๋วได้ทันที
async function closeMyself() {
  if (!selected.value) return;
  const note = window.prompt('บันทึกวิธีแก้ปัญหา (Resolution Note) ก่อนปิดตั๋วงาน');
  if (!note) return;
  busy.value = true;
  try {
    const { data } = await api.patch(`/tickets/${selected.value._id}/resolve`, { note, publishToKb: false });
    store.upsert(data.ticket);
    ui.success(`ปิดตั๋ว ${data.ticket.code} เรียบร้อยแล้ว`);
    selectedId.value = null;
    pickFirstNew();
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

const createHint = computed(() => {
  const tech = meta.technicians.find((x) => x._id === draft.value.assigneeId);
  return `ตั๋วจะถูกออกในนามผู้แจ้ง โดยระบุช่องทาง “${draft.value.channel}”${tech ? ` และมอบหมายให้ ${tech.name}` : ''}`;
});

async function createTicket() {
  if (!draft.value.title.trim()) {
    ui.error('กรุณาระบุเรื่องที่แจ้ง');
    return;
  }
  busy.value = true;
  try {
    const { data } = await api.post('/tickets', draft.value);
    store.upsert(data);
    ui.success(`ออกตั๋ว ${data.code} เรียบร้อยแล้ว`);
    draft.value.title = '';
    draft.value.description = '';
    draft.value.requesterName = '';
    draft.value.requesterDept = '';
    draft.value.location = '';
    router.push({ name: 'ticket-detail', params: { id: data._id } });
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
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
        role="button"
        tabindex="0"
        :class="{ 'is-new': t.status === 'new', 'is-selected': t._id === selectedId }"
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
        <button
          v-if="t.status === 'new' && auth.isHelpdesk"
          type="button"
          class="queue-row__triage"
          @click.stop="selectForTriage(t)"
        >
          คัดกรอง
        </button>
      </div>
    </div>

    <!-- แผงด้านข้าง: คัดกรอง / ออกตั๋วเอง -->
    <div v-if="auth.isHelpdesk" class="card-surface queue-panel">
      <div class="mode-switch">
        <button type="button" :class="{ 'is-active': panelMode === 'triage' }" @click="panelMode = 'triage'">
          คัดกรองตั๋วเข้า
        </button>
        <button type="button" :class="{ 'is-active': panelMode === 'create' }" @click="panelMode = 'create'">
          ออกตั๋วเอง
        </button>
      </div>

      <!-- โหมดคัดกรอง -->
      <template v-if="panelMode === 'triage'">
        <div class="card-title-xs">ตั๋วเข้าใหม่ที่รอคัดกรอง ({{ newTickets.length }})</div>

        <EmptyState v-if="!selected" title="ไม่มีตั๋วรอคัดกรอง" sub="ตั๋วใหม่จะปรากฏที่นี่ทันทีที่มีผู้แจ้งเข้ามา" />

        <template v-else>
          <div class="panel-ticket">
            <span class="tag-code">{{ selected.code }}</span>
            <span class="panel-ticket__title">{{ selected.title }}</span>
            <span class="panel-ticket__meta">{{ selected.requesterDisplay }} · {{ selected.requesterDept }}</span>
            <span v-if="selected.location" class="panel-ticket__meta">📍 {{ selected.location }}</span>
          </div>

          <div v-if="newTickets.length > 1" class="d-flex flex-wrap gap-1">
            <button
              v-for="t in newTickets"
              :key="t._id"
              type="button"
              class="chip chip--tiny"
              :class="{ 'is-active': t._id === selectedId }"
              @click="selectForTriage(t)"
            >
              {{ t.code.slice(-4) }}
            </button>
          </div>

          <div class="d-flex flex-column gap-2">
            <span class="section-label">จัดหมวดหมู่ปัญหา</span>
            <div class="d-flex flex-wrap gap-1">
              <button
                v-for="c in meta.categories"
                :key="c._id"
                type="button"
                class="chip"
                :class="{ 'is-active': triage.categoryId === c._id }"
                @click="triage.categoryId = c._id"
              >
                {{ c.label }}
              </button>
            </div>
          </div>

          <div class="d-flex flex-column gap-2">
            <span class="section-label">ระดับความสำคัญ</span>
            <div class="prio-grid">
              <button
                v-for="p in PRIORITY_ORDER"
                :key="p"
                type="button"
                class="prio-btn"
                :class="{ 'is-active': triage.priority === p }"
                :style="triage.priority === p ? { background: PRIORITY[p].bg, color: PRIORITY[p].fg, borderColor: PRIORITY[p].dot } : {}"
                @click="triage.priority = p"
              >
                {{ PRIORITY[p].label }}
              </button>
            </div>
          </div>

          <div class="d-flex flex-column gap-2">
            <span class="section-label">มอบหมายเจ้าหน้าที่</span>
            <button
              v-for="tech in meta.technicians"
              :key="tech._id"
              type="button"
              class="tech-btn"
              :class="{ 'is-active': triage.assigneeId === tech._id }"
              @click="triage.assigneeId = tech._id"
            >
              <span class="avatar avatar--sm">{{ tech.initial }}</span>
              <span class="d-flex flex-column flex-fill min-w-0 text-start">
                <span class="tech-btn__name text-truncate">{{ tech.name }}</span>
                <span class="tech-btn__skill text-truncate">{{ tech.skill }}</span>
              </span>
              <span class="pill pill--mono" :style="tech.load > 5 ? { background: '#fdf3e3', color: '#9a5b06' } : { background: '#eef6e4', color: '#4a7f22' }">
                {{ tech.load }} งาน
              </span>
            </button>
          </div>

          <div class="d-flex gap-2">
            <button class="btn-brand flex-fill py-3" type="button" :disabled="busy" @click="submitTriage">
              มอบหมายตั๋วงาน
            </button>
            <button class="btn-ghost" type="button" :disabled="busy" @click="closeMyself">ปิดเอง</button>
          </div>
          <p class="panel-hint">{{ triageHint }}</p>
        </template>
      </template>

      <!-- โหมดออกตั๋วเอง -->
      <template v-else>
        <div class="d-flex flex-column gap-2">
          <span class="section-label">ช่องทางที่รับแจ้ง</span>
          <div class="d-flex flex-wrap gap-1">
            <button
              v-for="c in CHANNELS"
              :key="c"
              type="button"
              class="chip"
              :class="{ 'is-active': draft.channel === c }"
              @click="draft.channel = c"
            >
              {{ c }}
            </button>
          </div>
        </div>

        <div class="d-flex flex-column gap-2">
          <span class="section-label">ผู้แจ้งปัญหา</span>
          <input v-model="draft.requesterName" class="input input--sm" placeholder="ชื่อ–สกุล ผู้แจ้ง" />
          <input v-model="draft.requesterDept" class="input input--sm" placeholder="แผนก / หน่วยงาน" />
        </div>

        <div class="d-flex flex-column gap-2">
          <span class="section-label">เรื่องที่แจ้ง</span>
          <input v-model="draft.title" class="input input--sm" placeholder="สรุปอาการสั้น ๆ" />
          <textarea v-model="draft.description" class="input input--sm" rows="3" placeholder="รายละเอียดที่สอบถามจากผู้แจ้ง"></textarea>
          <input v-model="draft.location" class="input input--sm" placeholder="สถานที่เกิดเหตุ (อาคาร / ชั้น / ห้อง)" />
        </div>

        <div class="d-flex flex-column gap-2">
          <span class="section-label">หมวดหมู่ &amp; ความสำคัญ</span>
          <div class="d-flex flex-wrap gap-1">
            <button
              v-for="c in meta.categories"
              :key="c._id"
              type="button"
              class="chip"
              :class="{ 'is-active': draft.categoryId === c._id }"
              @click="draft.categoryId = c._id"
            >
              {{ c.label }}
            </button>
          </div>
          <div class="prio-grid">
            <button
              v-for="p in PRIORITY_ORDER"
              :key="p"
              type="button"
              class="prio-btn"
              :class="{ 'is-active': draft.priority === p }"
              :style="draft.priority === p ? { background: PRIORITY[p].bg, color: PRIORITY[p].fg, borderColor: PRIORITY[p].dot } : {}"
              @click="draft.priority = p"
            >
              {{ PRIORITY[p].label }}
            </button>
          </div>
        </div>

        <div class="d-flex flex-column gap-2">
          <span class="section-label">มอบหมายงานให้</span>
          <button
            v-for="tech in meta.technicians"
            :key="tech._id"
            type="button"
            class="tech-btn"
            :class="{ 'is-active': draft.assigneeId === tech._id }"
            @click="draft.assigneeId = draft.assigneeId === tech._id ? '' : tech._id"
          >
            <span class="avatar avatar--sm">{{ tech.initial }}</span>
            <span class="d-flex flex-column flex-fill min-w-0 text-start">
              <span class="tech-btn__name text-truncate">{{ tech.name }}</span>
              <span class="tech-btn__skill text-truncate">{{ tech.skill }}</span>
            </span>
            <span class="pill pill--mono" style="background: #eef6e4; color: #4a7f22">{{ tech.load }} งาน</span>
          </button>
        </div>

        <button class="btn-brand w-100 py-3" type="button" :disabled="busy" @click="createTicket">
          ออกตั๋วงานและมอบหมาย
        </button>
        <p class="panel-hint">{{ createHint }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.queue-layout { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 14px; align-items: start; }
/* ไม่มีแผงคัดกรอง (เช่น ผู้ดูแลระบบ) ให้ตารางกินเต็มความกว้าง */
.queue-layout:has(> :only-child) { grid-template-columns: minmax(0, 1fr); }

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
.queue-row.is-selected { box-shadow: inset 3px 0 0 var(--brand); }
.queue-row__title { font: 500 13px var(--font-th); }
.queue-row__meta { font: 400 11.5px var(--font-th); color: var(--muted-2); }
.queue-row__assignee { font: 400 12px var(--font-th); color: var(--muted); }
.queue-row__assignee.is-none { color: var(--danger); }
.queue-row__sla { justify-self: end; font: 500 11.5px var(--font-mono); color: var(--muted); }
.queue-row__sla.is-risk { color: var(--danger-ink); }
.queue-row__triage {
  position: absolute; right: 16px; bottom: 8px;
  padding: 3px 9px; border-radius: 20px;
  border: 1px solid var(--brand); background: var(--brand-tint); color: var(--brand-ink);
  font: 500 10.5px var(--font-th); cursor: pointer;
}

.queue-panel {
  padding: 18px; display: flex; flex-direction: column; gap: 15px;
  position: sticky; top: 88px;
  max-height: calc(100vh - 110px); overflow-y: auto;
}
.mode-switch {
  display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
  padding: 4px; border-radius: 9px; background: var(--surface-3);
}
.mode-switch button {
  padding: 8px 6px; border-radius: 7px; border: 0; cursor: pointer;
  font: 500 12px var(--font-th); background: transparent; color: var(--muted);
}
.mode-switch button.is-active { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(16, 24, 32, 0.14); }

.panel-ticket {
  padding: 12px 13px; border-radius: 9px;
  background: var(--surface-2); border: 1px solid rgba(16, 24, 32, 0.07);
  display: flex; flex-direction: column; gap: 4px;
}
.panel-ticket__title { font: 500 13px var(--font-th); }
.panel-ticket__meta { font: 400 11.5px var(--font-th); color: var(--muted-2); }

.chip--tiny { padding: 3px 8px; font-size: 10.5px; font-family: var(--font-mono); }

.prio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.prio-btn {
  padding: 7px; border-radius: 7px;
  border: 1px solid var(--line-strong); background: #fff; color: var(--muted);
  cursor: pointer; font: 500 11.5px var(--font-mono);
}

.tech-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 11px; border-radius: var(--radius);
  border: 1px solid rgba(16, 24, 32, 0.1); background: #fff;
  cursor: pointer; width: 100%;
}
.tech-btn.is-active { background: var(--brand-tint); border-color: var(--brand); }
.tech-btn__name { font: 500 12.5px var(--font-th); }
.tech-btn__skill { font: 400 11px var(--font-th); color: var(--muted-2); }

.panel-hint { font: 400 11.5px var(--font-th); color: var(--muted-2); text-align: center; margin: 0; }
.min-w-0 { min-width: 0; }

@media (max-width: 1199.98px) {
  .queue-layout { grid-template-columns: 1fr; }
  .queue-panel { position: static; max-height: none; }
}
@media (max-width: 991.98px) {
  .queue-row {
    grid-template-columns: 1fr auto;
    grid-template-areas: 'code sla' 'title title' 'cat prio' 'assignee assignee';
    gap: 5px 10px; padding: 14px 16px 30px;
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
