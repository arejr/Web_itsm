<script setup>
import { onMounted, ref } from 'vue';
import api, { errMsg } from '@/services/api';
import { useMetaStore } from '@/stores/meta';
import { useUiStore } from '@/stores/ui';
import { PRIORITY } from '@/services/lookups';

const meta = useMetaStore();
const ui = useUiStore();

const announcements = ref([]);
const editingCat = ref(null);
const catForm = ref({ label: '', description: '', color: '#14776b', slaHours: 24, defaultGroup: '' });
const showCatForm = ref(false);
const showAnnForm = ref(false);
const annForm = ref({ title: '', body: '', whenText: '', tag: 'กำลังจะถึง', published: true });

// เวลาตอบสนองตามระดับความรุนแรง (ตรงกับ PRIORITY_SLA_MINUTES ฝั่ง backend)
const prioRules = [
  { key: 'critical', desc: 'ระบบหลักล่ม กระทบทั้งองค์กร', sla: '1 ชม.' },
  { key: 'high', desc: 'กระทบหลายคนหรือหยุดงานสำคัญ', sla: '4 ชม.' },
  { key: 'medium', desc: 'กระทบผู้ใช้รายบุคคล มีทางเลี่ยง', sla: '1 วัน' },
  { key: 'low', desc: 'คำขอทั่วไป ไม่เร่งด่วน', sla: '3 วัน' }
];

async function loadAll() {
  await meta.load(true);
  const { data } = await api.get('/announcements').catch(() => ({ data: [] }));
  announcements.value = data;
}
onMounted(loadAll);

/* ---------- หมวดหมู่ ---------- */
function startCat(c) {
  editingCat.value = c || null;
  catForm.value = c
    ? { label: c.label, description: c.description, color: c.color, slaHours: c.slaHours, defaultGroup: c.defaultGroup }
    : { label: '', description: '', color: '#14776b', slaHours: 24, defaultGroup: '' };
  showCatForm.value = true;
}

async function saveCat() {
  if (!catForm.value.label.trim()) {
    ui.error('กรุณาระบุชื่อหมวดหมู่');
    return;
  }
  try {
    if (editingCat.value) await api.patch(`/categories/${editingCat.value._id}`, catForm.value);
    else await api.post('/categories', catForm.value);
    showCatForm.value = false;
    await meta.load(true);
    ui.success('บันทึกหมวดหมู่เรียบร้อยแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  }
}

async function removeCat(c) {
  if (!window.confirm(`ต้องการลบหมวดหมู่ "${c.label}" ใช่หรือไม่?`)) return;
  try {
    await api.delete(`/categories/${c._id}`);
    await meta.load(true);
    ui.success('ลบหมวดหมู่เรียบร้อยแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  }
}

/* ---------- ประกาศ ---------- */
async function toggleAnn(a) {
  try {
    const { data } = await api.patch(`/announcements/${a._id}`, { published: !a.published });
    const i = announcements.value.findIndex((x) => x._id === data._id);
    if (i >= 0) announcements.value.splice(i, 1, data);
    await meta.loadAnnouncements();
    ui.success(data.published ? 'เผยแพร่ประกาศแล้ว' : 'ปิดการแสดงประกาศแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  }
}

async function saveAnn() {
  if (!annForm.value.title.trim()) {
    ui.error('กรุณาระบุหัวข้อประกาศ');
    return;
  }
  try {
    const { data } = await api.post('/announcements', annForm.value);
    announcements.value.unshift(data);
    showAnnForm.value = false;
    annForm.value = { title: '', body: '', whenText: '', tag: 'กำลังจะถึง', published: true };
    await meta.loadAnnouncements();
    ui.success('สร้างประกาศเรียบร้อยแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  }
}

async function removeAnn(a) {
  if (!window.confirm(`ต้องการลบประกาศ "${a.title}" ใช่หรือไม่?`)) return;
  try {
    await api.delete(`/announcements/${a._id}`);
    announcements.value = announcements.value.filter((x) => x._id !== a._id);
    await meta.loadAnnouncements();
    ui.success('ลบประกาศเรียบร้อยแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  }
}
</script>

<template>
  <div class="settings-grid">
    <!-- หมวดหมู่ปัญหา -->
    <div class="card-surface p-3 d-flex flex-column gap-2">
      <div class="card-title-sm mb-1">หมวดหมู่ปัญหา</div>

      <div v-for="c in meta.categories" :key="c._id" class="cat-row">
        <span class="dot dot--sq" :style="{ background: c.color, width: '9px', height: '9px', borderRadius: '3px' }"></span>
        <div class="d-flex flex-column flex-fill min-w-0">
          <span class="cat-row__label">{{ c.label }}</span>
          <span class="cat-row__sub text-truncate">{{ c.description || '—' }}</span>
        </div>
        <span class="mono cat-row__sla">กำหนดเสร็จ {{ c.slaHours }} ชม.</span>
        <button class="btn-ghost btn-xs" type="button" @click="startCat(c)">แก้ไข</button>
        <button class="btn-ghost btn-xs" style="color: var(--danger-ink)" type="button" @click="removeCat(c)">ลบ</button>
      </div>

      <button class="btn-dashed" type="button" @click="startCat(null)">+ เพิ่มหมวดหมู่</button>

      <div v-if="showCatForm" class="inline-form">
        <input v-model="catForm.label" class="input input--sm" placeholder="ชื่อหมวดหมู่" />
        <input v-model="catForm.description" class="input input--sm" placeholder="คำอธิบายสั้น ๆ" />
        <div class="d-flex gap-2">
          <input v-model="catForm.color" class="input input--sm color-input" type="color" />
          <input v-model.number="catForm.slaHours" class="input input--sm" type="number" min="1" placeholder="กำหนดเสร็จ (ชม.)" />
        </div>
        <input v-model="catForm.defaultGroup" class="input input--sm" placeholder="กลุ่มงานที่รับผิดชอบ" />
        <div class="d-flex gap-2">
          <button class="btn-brand" type="button" @click="saveCat">บันทึก</button>
          <button class="btn-ghost" type="button" @click="showCatForm = false">ยกเลิก</button>
        </div>
      </div>
    </div>

    <div class="d-flex flex-column gap-3">
      <!-- ระดับความรุนแรง -->
      <div class="card-surface p-3 d-flex flex-column gap-2">
        <div class="card-title-sm mb-1">ระดับความรุนแรง &amp; เวลาตอบสนอง</div>
        <div
          v-for="p in prioRules"
          :key="p.key"
          class="prio-row"
          :style="{ background: PRIORITY[p.key].bg }"
        >
          <span class="mono prio-row__label" :style="{ color: PRIORITY[p.key].fg }">{{ PRIORITY[p.key].label }}</span>
          <span class="prio-row__desc">{{ p.desc }}</span>
          <span class="mono prio-row__sla" :style="{ color: PRIORITY[p.key].fg }">{{ p.sla }}</span>
        </div>
      </div>

      <!-- ประกาศ -->
      <div class="card-surface p-3 d-flex flex-column gap-2">
        <div class="d-flex align-items-center gap-2 mb-1">
          <div class="card-title-sm">ประกาศปิดปรับปรุงระบบ</div>
          <div class="flex-fill"></div>
          <button class="btn-ghost btn-xs" type="button" @click="showAnnForm = !showAnnForm">+ สร้างประกาศใหม่</button>
        </div>

        <div v-if="showAnnForm" class="inline-form">
          <input v-model="annForm.title" class="input input--sm" placeholder="หัวข้อประกาศ" />
          <input v-model="annForm.whenText" class="input input--sm" placeholder="ช่วงเวลา เช่น เสาร์ 29 ส.ค. 22:00 – 02:00 น." />
          <textarea v-model="annForm.body" class="input input--sm" rows="2" placeholder="รายละเอียดเพิ่มเติม"></textarea>
          <label class="d-flex align-items-center gap-2" style="font-size: 12px">
            <input v-model="annForm.published" type="checkbox" style="accent-color: var(--brand)" /> เผยแพร่ทันที
          </label>
          <div class="d-flex gap-2">
            <button class="btn-brand" type="button" @click="saveAnn">บันทึกประกาศ</button>
            <button class="btn-ghost" type="button" @click="showAnnForm = false">ยกเลิก</button>
          </div>
        </div>

        <div v-for="a in announcements" :key="a._id" class="ann-row">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span
              class="pill pill--mono"
              :style="a.published ? { background: '#e4f1ee', color: '#0f6a5f' } : { background: '#f2f4f6', color: '#69737b' }"
            >
              {{ a.published ? 'เผยแพร่อยู่' : 'ร่าง' }}
            </span>
            <span class="ann-row__title">{{ a.title }}</span>
            <div class="flex-fill"></div>
            <button class="switch" :class="{ 'is-on': a.published }" type="button" :aria-pressed="a.published" @click="toggleAnn(a)">
              <span></span>
            </button>
            <button class="btn-ghost btn-xs" style="color: var(--danger-ink)" type="button" @click="removeAnn(a)">ลบ</button>
          </div>
          <span class="ann-row__when">{{ a.whenText || '—' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }

.cat-row { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); flex-wrap: wrap; }
.cat-row__label { font: 500 12.5px var(--font-th); }
.cat-row__sub { font: 400 11px var(--font-th); color: var(--muted-2); }
.cat-row__sla { font: 400 11px var(--font-mono); color: var(--muted-2); }

.prio-row { display: grid; grid-template-columns: 100px minmax(0, 1fr) 90px; align-items: center; gap: 12px; padding: 9px 12px; border-radius: var(--radius); }
.prio-row__label { font: 600 12px var(--font-mono); }
.prio-row__desc { font: 400 12px var(--font-th); color: var(--ink-3); }
.prio-row__sla { justify-self: end; font: 500 11.5px var(--font-mono); }

.ann-row { padding: 12px 13px; border: 1px solid var(--line); border-radius: 9px; display: flex; flex-direction: column; gap: 5px; }
.ann-row__title { font: 500 12.5px var(--font-th); }
.ann-row__when { font: 400 11.5px var(--font-th); color: var(--muted); }

.inline-form { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--radius); background: var(--surface-2); border: 1px solid rgba(16, 24, 32, 0.07); }
.color-input { width: 64px; padding: 4px; height: 38px; }
.btn-xs { padding: 5px 10px; font-size: 11.5px; }
.min-w-0 { min-width: 0; }

@media (max-width: 1199.98px) { .settings-grid { grid-template-columns: 1fr; } }
@media (max-width: 575.98px) { .prio-row { grid-template-columns: 80px 1fr; } .prio-row__sla { grid-column: 2; justify-self: start; } }
</style>
