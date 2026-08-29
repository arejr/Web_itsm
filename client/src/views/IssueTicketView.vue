<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import api, { errMsg } from '@/services/api';
import { useMetaStore } from '@/stores/meta';
import { useTicketStore } from '@/stores/tickets';
import { useUiStore } from '@/stores/ui';
import { PRIORITY, PRIORITY_ORDER, CHANNELS } from '@/services/lookups';

const router = useRouter();
const meta = useMetaStore();
const store = useTicketStore();
const ui = useUiStore();

const busy = ref(false);

// ตั๋วที่ Helpdesk ออกแทนผู้ที่แจ้งเข้ามาทางโทรศัพท์ Walk-in อีเมล หรือ LINE
const draft = ref({
  channel: 'โทรศัพท์', requesterName: '', requesterDept: '', title: '', description: '',
  categoryId: '', priority: 'medium', assigneeId: '', location: ''
});

onMounted(async () => {
  await meta.load();
  await meta.loadTechnicians();
  if (meta.categories.length) draft.value.categoryId = meta.categories[0]._id;
});

const createHint = computed(() => {
  const tech = meta.technicians.find((x) => x._id === draft.value.assigneeId);
  return tech
    ? `ตั๋วจะถูกออกในนามผู้แจ้ง ระบุช่องทาง “${draft.value.channel}” และมอบหมายให้ ${tech.name}`
    : `ตั๋วจะถูกออกในนามผู้แจ้ง ระบุช่องทาง “${draft.value.channel}” แล้วเข้าคิวคัดกรอง`;
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
    router.push({ name: 'ticket-detail', params: { id: data._id } });
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="issue-layout">
    <div class="card-surface issue-form">
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

      <div class="issue-form__row">
        <div class="d-flex flex-column gap-2">
          <label class="section-label">ชื่อ–สกุล ผู้แจ้ง</label>
          <input v-model="draft.requesterName" class="input input--sm" placeholder="เช่น สมหญิง ใจดี" />
        </div>
        <div class="d-flex flex-column gap-2">
          <label class="section-label">แผนก / หน่วยงาน</label>
          <input v-model="draft.requesterDept" class="input input--sm" placeholder="เช่น ฝ่ายจัดซื้อ" />
        </div>
      </div>

      <div class="d-flex flex-column gap-2">
        <label class="section-label">เรื่องที่แจ้ง *</label>
        <input v-model="draft.title" class="input input--sm" placeholder="สรุปอาการสั้น ๆ" />
        <textarea
          v-model="draft.description"
          class="input input--sm"
          rows="4"
          placeholder="รายละเอียดที่สอบถามจากผู้แจ้ง"
        ></textarea>
        <input v-model="draft.location" class="input input--sm" placeholder="สถานที่เกิดเหตุ (อาคาร / ชั้น / ห้อง)" />
      </div>

      <div class="issue-form__row">
        <div class="d-flex flex-column gap-2">
          <span class="section-label">หมวดหมู่ปัญหา</span>
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
        </div>
        <div class="d-flex flex-column gap-2">
          <span class="section-label">ระดับความสำคัญ</span>
          <div class="prio-grid">
            <button
              v-for="p in PRIORITY_ORDER"
              :key="p"
              type="button"
              class="prio-btn"
              :style="draft.priority === p ? { background: PRIORITY[p].bg, color: PRIORITY[p].fg, borderColor: PRIORITY[p].dot } : {}"
              @click="draft.priority = p"
            >
              {{ PRIORITY[p].label }}
            </button>
          </div>
        </div>
      </div>

      <div class="d-flex flex-column gap-2">
        <span class="section-label">มอบหมายงานให้ (ไม่บังคับ)</span>
        <div class="tech-grid">
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
      </div>

      <div class="issue-form__foot">
        <p class="issue-hint mb-0">{{ createHint }}</p>
        <button class="btn-brand px-4 py-3" type="button" :disabled="busy || !draft.title.trim()" @click="createTicket">
          {{ busy ? 'กำลังออกตั๋ว…' : 'ออกตั๋วงานและมอบหมาย' }}
        </button>
      </div>
    </div>

    <div class="d-flex flex-column gap-3">
      <div class="card-surface p-3 d-flex flex-column gap-2">
        <div class="card-title-xs">ใช้หน้านี้เมื่อไหร่</div>
        <p class="issue-note mb-0">
          เมื่อผู้ใช้แจ้งปัญหาเข้ามาทางช่องทางอื่นที่ไม่ใช่หน้าเว็บ เช่น โทรศัพท์ เดินมาแจ้งที่เคาน์เตอร์
          อีเมล หรือ LINE ให้บันทึกเรื่องเข้าระบบแทนผู้แจ้ง เพื่อให้ทุกเรื่องมีเลขตั๋วและติดตามได้
        </p>
      </div>

      <div class="card-surface p-3 d-flex flex-column gap-2">
        <div class="card-title-xs">ข้อควรทราบ</div>
        <p class="issue-note mb-0">
          ตั๋วจะถูกบันทึกในนามผู้แจ้งที่คุณกรอก พร้อมระบุช่องทางที่รับแจ้งไว้ในประวัติ
          หากยังไม่เลือกผู้รับผิดชอบ ตั๋วจะเข้าคิวคัดกรองให้มอบหมายภายหลังได้
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.issue-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; align-items: start; }
.issue-form { padding: 20px 22px; display: flex; flex-direction: column; gap: 18px; }
.issue-form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.issue-form__foot {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding-top: 14px; border-top: 1px solid rgba(16, 24, 32, 0.08);
}
.issue-hint { flex: 1; font: 400 11.5px/1.6 var(--font-th); color: var(--muted-2); min-width: 220px; }
.issue-note { font: 400 12px/1.75 var(--font-th); color: var(--muted); }

.prio-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.prio-btn {
  padding: 8px; border-radius: 7px;
  border: 1px solid var(--line-strong); background: #fff; color: var(--muted);
  cursor: pointer; font: 500 11.5px var(--font-mono);
}

.tech-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.tech-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 11px; border-radius: var(--radius);
  border: 1px solid rgba(16, 24, 32, 0.1); background: #fff;
  cursor: pointer; width: 100%;
}
.tech-btn.is-active { background: var(--brand-tint); border-color: var(--brand); }
.tech-btn__name { font: 500 12.5px var(--font-th); }
.tech-btn__skill { font: 400 11px var(--font-th); color: var(--muted-2); }
.min-w-0 { min-width: 0; }

@media (max-width: 1199.98px) { .issue-layout { grid-template-columns: 1fr; } }
@media (max-width: 767.98px) {
  .issue-form__row, .tech-grid { grid-template-columns: 1fr; }
  .prio-grid { grid-template-columns: 1fr 1fr; }
  .issue-form { padding: 18px 16px; }
}
</style>
