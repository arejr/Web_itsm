<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import api, { errMsg } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useMetaStore } from '@/stores/meta';
import { useTicketStore } from '@/stores/tickets';
import { useUiStore } from '@/stores/ui';
import { fileSize } from '@/services/format';

const router = useRouter();
const auth = useAuthStore();
const meta = useMetaStore();
const store = useTicketStore();
const ui = useUiStore();

const form = ref({
  title: '', description: '', categoryId: '', location: '', asset: '',
  assigneeId: '', channel: 'เว็บไซต์', requesterEmployeeId: ''
});

// ค้นหาพนักงานจากรหัสที่กรอก เพื่อยืนยันว่าออกตั๋วให้ถูกคนก่อนกดส่ง
const requesterInfo = ref(null);
const requesterError = ref('');
const lookingUp = ref(false);
let lookupTimer = null;

async function lookupRequester() {
  const code = form.value.requesterEmployeeId.trim();
  requesterInfo.value = null;
  requesterError.value = '';
  if (!code) return;
  lookingUp.value = true;
  try {
    const { data } = await api.get('/users/lookup', { params: { employeeId: code } });
    requesterInfo.value = data;
  } catch (err) {
    requesterError.value = errMsg(err);
  } finally {
    lookingUp.value = false;
  }
}

// หน่วงไว้ก่อนยิงค้นหา จะได้ไม่ยิงทุกตัวอักษรที่พิมพ์
watch(() => form.value.requesterEmployeeId, () => {
  requesterInfo.value = null;
  requesterError.value = '';
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(lookupRequester, 400);
});
onBeforeUnmount(() => clearTimeout(lookupTimer));

// ช่องทางที่ผู้แจ้งติดต่อเข้ามา — ตรงกับ CHANNELS ฝั่งเซิร์ฟเวอร์
const CHANNELS = ['เว็บไซต์', 'โทรศัพท์', 'Walk-in', 'อีเมล', 'LINE / แชท'];

// Helpdesk ที่ออกตั๋วเองมอบหมายผู้รับผิดชอบได้เลย ไม่ต้องรอคัดกรองอีกรอบ
const canAssign = computed(() => auth.isHelpdesk);
// แผงแนะนำให้ลองแก้เองก่อนและสายด่วน IT มีไว้สำหรับพนักงาน ไม่ใช่ทีม IT เอง
const showSelfHelp = computed(() => !auth.isHelpdesk);
const files = ref([]);
const previews = ref([]);
const busy = ref(false);
const fileInput = ref(null);
const dragOver = ref(false);

onMounted(async () => {
  await meta.load();
  form.value.categoryId = meta.categories[0]?._id || '';
  if (canAssign.value) await meta.loadTechnicians();
});

const selfHelp = [
  { title: 'ลืมรหัสผ่านเข้าเครื่อง', sub: 'รีเซ็ตเองผ่านหน้า Self-service ได้ทันที' },
  { title: 'เครื่องพิมพ์ไม่ตอบสนอง', sub: 'ตรวจคิวงานค้างและรีสตาร์ต spooler' },
  { title: 'ต่อ Wi-Fi องค์กรไม่ได้', sub: 'ลืมเครือข่ายเดิมแล้วเชื่อมต่อใหม่ด้วยบัญชีบริษัท' }
];

const canSubmit = computed(() => form.value.title.trim() && form.value.description.trim());

function addFiles(list) {
  const incoming = Array.from(list || []).filter((f) => f.size <= 10 * 1024 * 1024);
  if (incoming.length !== (list?.length || 0)) ui.error('ไฟล์บางรายการเกิน 10 MB จึงไม่ถูกเพิ่ม');
  files.value = [...files.value, ...incoming].slice(0, 5);
  previews.value = files.value.map((f) => ({
    name: f.name,
    size: f.size,
    url: f.type.startsWith('image/') ? URL.createObjectURL(f) : ''
  }));
}

function removeFile(i) {
  files.value.splice(i, 1);
  previews.value.splice(i, 1);
}

async function submit() {
  if (!canSubmit.value) {
    ui.error('กรุณากรอกชื่อปัญหาและรายละเอียดให้ครบถ้วน');
    return;
  }
  busy.value = true;
  try {
    const body = new FormData();
    Object.entries(form.value).forEach(([k, v]) => {
      if (k === 'assigneeId' && !v) return; // ไม่เลือกผู้รับผิดชอบ = ส่งเข้าคิวคัดกรองตามปกติ
      if (k === 'channel' && !canAssign.value) return; // พนักงานแจ้งผ่านหน้าเว็บเสมอ
      if (k === 'requesterEmployeeId' && (!canAssign.value || !v.trim())) return; // ไม่ระบุ = ออกตั๋วในชื่อตัวเอง
      body.append(k, v);
    });
    files.value.forEach((f) => body.append('attachments', f));

    const { data } = await api.post('/tickets', body, { headers: { 'Content-Type': 'multipart/form-data' } });
    store.upsert(data);
    ui.success(
      data.requesterName && requesterInfo.value
        ? `ออกตั๋ว ${data.code} ให้ ${data.requesterName} แล้ว`
        : data.assignee
          ? `ออกตั๋ว ${data.code} และมอบหมายให้ ${data.assignee.name} แล้ว`
          : `ส่งเรื่องเรียบร้อย — เลขตั๋วของคุณคือ ${data.code}`
    );
    router.push({ name: 'ticket-detail', params: { id: data._id } });
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="new-layout">
    <form class="card-surface new-form" @submit.prevent="submit">
      <div v-if="canAssign">
        <label class="field-label" for="nt-requester">รหัสพนักงานผู้แจ้ง (ถ้าเว้นว่าง จะออกตั๋วในชื่อคุณเอง)</label>
        <input
          id="nt-requester"
          v-model="form.requesterEmployeeId"
          class="input"
          placeholder="พิมพ์รหัสพนักงาน แล้วระบบจะค้นชื่อให้อัตโนมัติ"
          autocomplete="off"
        />
        <p v-if="lookingUp" class="requester-hint mb-0">กำลังค้นหา…</p>
        <p v-else-if="requesterError" class="requester-hint requester-hint--err mb-0">{{ requesterError }}</p>
        <div v-else-if="requesterInfo" class="requester-card">
          <span class="avatar avatar--sm">{{ requesterInfo.name.charAt(0) }}</span>
          <span class="d-flex flex-column min-w-0">
            <span class="requester-card__name text-truncate">{{ requesterInfo.name }}</span>
            <span class="requester-card__sub text-truncate">
              {{ requesterInfo.department || 'ไม่ระบุแผนก' }} · {{ requesterInfo.email }}
            </span>
          </span>
        </div>
      </div>

      <div>
        <label class="field-label" for="nt-title">ชื่อปัญหา *</label>
        <input id="nt-title" v-model="form.title" class="input" placeholder="เช่น เครื่องพิมพ์ชั้น 3 พิมพ์งานไม่ออก" />
      </div>

      <div>
        <label class="field-label" for="nt-desc">รายละเอียดปัญหา *</label>
        <textarea
          id="nt-desc"
          v-model="form.description"
          class="input"
          rows="5"
          placeholder="อธิบายอาการ ช่วงเวลาที่เกิด และสิ่งที่ลองแก้ไขแล้ว"
        ></textarea>
      </div>

      <div class="new-form__row">
        <div>
          <span class="field-label">หมวดหมู่</span>
          <div class="d-flex flex-wrap gap-1">
            <button
              v-for="c in meta.categories"
              :key="c._id"
              type="button"
              class="chip"
              :class="{ 'is-active': form.categoryId === c._id }"
              @click="form.categoryId = c._id"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="field-label" for="nt-loc">สถานที่เกิดเหตุ</label>
          <input id="nt-loc" v-model="form.location" class="input" placeholder="อาคาร / ชั้น / ห้อง" />
        </div>
      </div>

      <div>
        <label class="field-label" for="nt-asset">อุปกรณ์ที่เกี่ยวข้อง (ถ้ามี)</label>
        <input id="nt-asset" v-model="form.asset" class="input" placeholder="เช่น PRN-3F-02, NB-HR-0142" />
      </div>

      <div v-if="canAssign">
        <span class="field-label">ช่องทางการรับเรื่อง</span>
        <div class="d-flex flex-wrap gap-1">
          <button
            v-for="ch in CHANNELS"
            :key="ch"
            type="button"
            class="chip"
            :class="{ 'is-active': form.channel === ch }"
            @click="form.channel = ch"
          >
            {{ ch }}
          </button>
        </div>
      </div>

      <div v-if="canAssign">
        <label class="field-label" for="nt-assignee">มอบหมายเจ้าหน้าที่ (ถ้ายังไม่เลือก จะเข้าคิวคัดกรอง)</label>
        <select id="nt-assignee" v-model="form.assigneeId" class="input">
          <option value="">— ยังไม่มอบหมาย —</option>
          <option v-for="tech in meta.technicians" :key="tech._id" :value="tech._id">
            {{ tech.name }} · {{ tech.skill }} ({{ tech.load }} งาน)
          </option>
        </select>
      </div>

      <div>
        <span class="field-label">แนบรูปภาพหลักฐาน</span>
        <div class="d-flex gap-2 flex-wrap">
          <button
            type="button"
            class="dropzone"
            :class="{ 'is-over': dragOver }"
            @click="fileInput.click()"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent="dragOver = false; addFiles($event.dataTransfer.files)"
          >
            <span class="dropzone__title">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</span>
            <span class="dropzone__hint mono">JPG · PNG · PDF · ไม่เกิน 10 MB (สูงสุด 5 ไฟล์)</span>
          </button>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept="image/*,application/pdf"
            class="d-none"
            @change="addFiles($event.target.files)"
          />

          <div v-for="(p, i) in previews" :key="i" class="preview">
            <img v-if="p.url" :src="p.url" :alt="p.name" />
            <span v-else class="preview__file mono">PDF</span>
            <span class="preview__name mono">{{ p.name }} · {{ fileSize(p.size) }}</span>
            <button type="button" class="preview__remove" aria-label="ลบไฟล์" @click.stop="removeFile(i)">×</button>
          </div>
        </div>
      </div>

      <div class="new-form__foot">
        <span class="flex-fill" style="font: 400 11.5px var(--font-th); color: var(--muted-2)">
          ระบบจะออกเลขตั๋วอัตโนมัติและแจ้งเตือนคุณทุกครั้งที่สถานะเปลี่ยน
        </span>
        <button class="btn-brand px-4 py-3" type="submit" :disabled="busy || !canSubmit">
          {{ busy ? 'กำลังส่ง…' : 'ส่งเรื่องแจ้งปัญหา' }}
        </button>
      </div>
    </form>

    <div v-if="showSelfHelp" class="d-flex flex-column gap-3">
      <div class="card-surface p-3 d-flex flex-column gap-2">
        <div class="card-title-xs">ปัญหาที่พบบ่อย — ลองแก้เองก่อน</div>
        <div v-for="s in selfHelp" :key="s.title" class="selfhelp">
          <span class="selfhelp__title">{{ s.title }}</span>
          <span class="selfhelp__sub">{{ s.sub }}</span>
        </div>
        <RouterLink :to="{ name: 'kb' }" class="btn-dashed text-center mt-1">ดูฐานความรู้ทั้งหมด</RouterLink>
      </div>

      <div class="urgent-card">
        <div class="urgent-card__title">ต้องการด่วนตอนนี้?</div>
        <p class="urgent-card__text mb-0">
          กรณีระบบหลักล่มหรือกระทบผู้ใช้จำนวนมาก โทรสายด่วน IT ต่อ 0000
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.new-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; align-items: start; }
/* ไม่มีแผงช่วยเหลือด้านข้าง (Helpdesk) ให้ฟอร์มกินเต็มความกว้าง */
.new-layout:has(> :only-child) { grid-template-columns: minmax(0, 1fr); }
.new-form { padding: 22px 24px; display: flex; flex-direction: column; gap: 18px; }
.requester-hint { margin-top: 6px; font: 400 11.5px var(--font-th); color: var(--muted-2); }
.requester-hint--err { color: var(--danger-ink); }
.requester-card {
  margin-top: 8px; display: flex; align-items: center; gap: 10px;
  padding: 9px 11px; border-radius: var(--radius);
  background: var(--brand-tint); border: 1px solid var(--brand);
}
.requester-card__name { font: 500 12.5px var(--font-th); }
.requester-card__sub { font: 400 11px var(--font-th); color: var(--muted); }
.new-form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.new-form__foot {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding-top: 12px; border-top: 1px solid rgba(16, 24, 32, 0.08);
}

.dropzone {
  flex: 1; min-width: 220px; height: 104px;
  border: 1px dashed rgba(16, 24, 32, 0.22); border-radius: 9px;
  background: repeating-linear-gradient(135deg, #fbfcfd 0 8px, #f4f6f8 8px 16px);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
  cursor: pointer;
}
.dropzone.is-over { border-color: var(--brand); background: var(--brand-tint); }
.dropzone__title { font: 500 12px var(--font-th); color: var(--ink-3); }
.dropzone__hint { font: 400 10.5px var(--font-mono); color: var(--muted-3); }

.preview {
  position: relative; width: 104px; height: 104px;
  border-radius: 9px; overflow: hidden;
  border: 1px solid rgba(16, 24, 32, 0.1); background: #eef2f5;
  display: flex; flex-direction: column; justify-content: flex-end;
}
.preview img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.preview__file { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); }
.preview__name {
  position: relative; z-index: 1;
  font-size: 9px; color: var(--ink-3);
  background: rgba(255, 255, 255, 0.92); padding: 4px 5px;
  word-break: break-all;
}
.preview__remove {
  position: absolute; top: 4px; right: 4px; z-index: 2;
  width: 20px; height: 20px; border-radius: 50%;
  border: 0; background: rgba(16, 24, 32, 0.65); color: #fff;
  font-size: 14px; line-height: 1; cursor: pointer;
}

.selfhelp {
  padding: 11px 12px; border-radius: var(--radius);
  background: var(--surface-2); border: 1px solid rgba(16, 24, 32, 0.07);
  display: flex; flex-direction: column; gap: 3px;
}
.selfhelp__title { font: 500 12px var(--font-th); }
.selfhelp__sub { font: 400 11px var(--font-th); color: var(--muted-2); }

.urgent-card { background: var(--slate); border-radius: var(--radius-lg); padding: 17px 18px; display: flex; flex-direction: column; gap: 8px; }
.urgent-card__title { font: 600 12.5px var(--font-th); color: #fff; }
.urgent-card__text { font: 400 11.5px/1.7 var(--font-th); color: #9aa8b4; }

@media (max-width: 1199.98px) { .new-layout { grid-template-columns: 1fr; } }
@media (max-width: 575.98px) {
  .new-form { padding: 18px 16px; }
  .new-form__row { grid-template-columns: 1fr; }
}
</style>
