<script setup>
import { computed, onMounted, ref } from 'vue';
import api, { errMsg } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { ROLE_LABEL, ROLE_TINT } from '@/services/lookups';
import EmptyState from '@/components/EmptyState.vue';
import LoadingRows from '@/components/LoadingRows.vue';

const auth = useAuthStore();
const ui = useUiStore();

const users = ref([]);
const loading = ref(true);
const search = ref('');
const roleFilter = ref('');
const showForm = ref(false);
const editing = ref(null);
const busy = ref(false);

const blank = () => ({
  name: '', email: '', employeeId: '', password: '', role: 'employee',
  department: '', group: '', skill: '', phone: '', contact: '', orgCode: ''
});
const form = ref(blank());

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/users');
    users.value = data;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return users.value.filter((u) => {
    if (roleFilter.value && u.role !== roleFilter.value) return false;
    if (!q) return true;
    return [u.name, u.email, u.department, u.employeeId].some((v) => String(v || '').toLowerCase().includes(q));
  });
});

const counts = computed(() => ({
  all: users.value.length,
  admin: users.value.filter((u) => u.role === 'admin').length,
  helpdesk: users.value.filter((u) => u.role === 'helpdesk').length,
  tech: users.value.filter((u) => u.role === 'tech').length,
  employee: users.value.filter((u) => u.role === 'employee').length,
  suspended: users.value.filter((u) => !u.active).length
}));

function startCreate() {
  editing.value = null;
  form.value = blank();
  showForm.value = true;
}

function startEdit(u) {
  editing.value = u;
  form.value = {
    name: u.name, email: u.email, employeeId: u.employeeId || '', password: '',
    role: u.role, department: u.department || '', group: u.group || '',
    skill: u.skill || '', phone: u.phone || '', contact: u.contact || '', orgCode: u.orgCode || ''
  };
  showForm.value = true;
}

async function save() {
  if (!form.value.name.trim() || !form.value.email.trim()) {
    ui.error('กรุณากรอกชื่อ–สกุลและอีเมล');
    return;
  }
  busy.value = true;
  try {
    if (editing.value) {
      const body = { ...form.value };
      if (!body.password) delete body.password;
      const { data } = await api.patch(`/users/${editing.value._id}`, body);
      const i = users.value.findIndex((u) => u._id === data._id);
      if (i >= 0) users.value.splice(i, 1, data);
      ui.success('บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว');
    } else {
      const { data } = await api.post('/users', form.value);
      users.value.unshift(data);
      ui.success(`เพิ่มผู้ใช้ ${data.name} เรียบร้อยแล้ว (รหัสผ่านเริ่มต้น: ${form.value.password || 'Password123!'})`);
    }
    showForm.value = false;
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

// ระงับ / เปิดใช้งานบัญชีตามกฎระเบียบองค์กร
async function toggleActive(u) {
  const verb = u.active ? 'ระงับ' : 'เปิดใช้งาน';
  if (!window.confirm(`ต้องการ${verb}บัญชีของ ${u.name} ใช่หรือไม่?`)) return;
  try {
    const { data } = await api.patch(`/users/${u._id}/status`, { active: !u.active });
    const i = users.value.findIndex((x) => x._id === data._id);
    if (i >= 0) users.value.splice(i, 1, data);
    ui.success(`${verb}บัญชี ${data.name} แล้ว`);
  } catch (err) {
    ui.error(errMsg(err));
  }
}

async function remove(u) {
  if (!window.confirm(`ต้องการลบบัญชีของ ${u.name} อย่างถาวรใช่หรือไม่?`)) return;
  try {
    await api.delete(`/users/${u._id}`);
    users.value = users.value.filter((x) => x._id !== u._id);
    ui.success('ลบผู้ใช้งานเรียบร้อยแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="stat-strip">
      <div class="card-surface stat"><span>ทั้งหมด</span><strong>{{ counts.all }}</strong></div>
      <div class="card-surface stat"><span>ผู้ดูแลระบบ</span><strong>{{ counts.admin }}</strong></div>
      <div class="card-surface stat"><span>IT Helpdesk</span><strong>{{ counts.helpdesk }}</strong></div>
      <div class="card-surface stat"><span>เจ้าหน้าที่ IT</span><strong>{{ counts.tech }}</strong></div>
      <div class="card-surface stat"><span>พนักงาน</span><strong>{{ counts.employee }}</strong></div>
      <div class="card-surface stat"><span>ถูกระงับ</span><strong style="color: var(--danger-ink)">{{ counts.suspended }}</strong></div>
    </div>

    <div class="card-surface card-surface--flush">
      <div class="card-head">
        <div class="card-title-sm">สมาชิกในระบบ</div>
        <input v-model="search" class="input input--sm" style="width: 200px" type="search" placeholder="ค้นหาชื่อ / อีเมล / แผนก" />
        <select v-model="roleFilter" class="input input--sm" style="width: 170px">
          <option value="">ทุกบทบาท</option>
          <option v-for="(label, key) in ROLE_LABEL" :key="key" :value="key">{{ label }}</option>
        </select>
        <div class="flex-fill"></div>
        <button class="btn-slate" type="button" @click="startCreate">+ เพิ่มผู้ใช้งาน</button>
      </div>

      <div class="users-head d-none d-lg-grid">
        <span>ชื่อ–สกุล</span><span>บทบาท</span><span>แผนก / กลุ่มงาน</span><span>สถานะ</span><span class="text-end">การจัดการ</span>
      </div>

      <LoadingRows v-if="loading" :rows="5" />
      <EmptyState v-else-if="!filtered.length" title="ไม่พบผู้ใช้งานตามเงื่อนไข" />

      <div v-for="u in filtered" :key="u._id" class="users-row">
        <div class="d-flex align-items-center gap-2 min-w-0">
          <div class="avatar avatar--sm">{{ u.name.charAt(0) }}</div>
          <div class="d-flex flex-column min-w-0">
            <span class="users-row__name text-truncate">{{ u.name }}</span>
            <span class="mono users-row__email text-truncate">{{ u.email }}</span>
          </div>
        </div>

        <span class="pill pill--round" :style="{ background: ROLE_TINT[u.role].bg, color: ROLE_TINT[u.role].fg }">
          {{ ROLE_LABEL[u.role] }}
        </span>

        <span class="users-row__dept text-truncate">
          {{ u.department || '—' }}<template v-if="u.group"> · {{ u.group }}</template>
        </span>

        <span class="users-row__status" :style="{ color: u.active ? 'var(--ok-ink)' : 'var(--danger-ink)' }">
          <span class="dot" :style="{ background: u.active ? '#6cb33f' : '#c0392b' }"></span>
          {{ u.active ? 'ใช้งานอยู่' : 'ถูกระงับ' }}
        </span>

        <div class="users-row__actions">
          <button
            type="button"
            class="btn-ghost btn-xs"
            :style="{ color: u.active ? 'var(--danger-ink)' : 'var(--ok-ink)' }"
            :disabled="u._id === auth.user?._id"
            @click="toggleActive(u)"
          >
            {{ u.active ? 'ระงับบัญชี' : 'เปิดใช้งาน' }}
          </button>
          <button type="button" class="btn-ghost btn-xs" @click="startEdit(u)">แก้ไข</button>
          <button
            type="button"
            class="btn-ghost btn-xs"
            style="color: var(--danger-ink)"
            :disabled="u._id === auth.user?._id"
            @click="remove(u)"
          >
            ลบ
          </button>
        </div>
      </div>
    </div>

    <!-- ฟอร์มเพิ่ม / แก้ไขผู้ใช้ -->
    <div v-if="showForm" class="modal-back" @click.self="showForm = false">
      <form class="modal-card" @submit.prevent="save">
        <div class="d-flex align-items-center gap-2 mb-1">
          <h2 class="modal-title">{{ editing ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่' }}</h2>
          <div class="flex-fill"></div>
          <button type="button" class="modal-close" aria-label="ปิด" @click="showForm = false">×</button>
        </div>

        <div class="form-grid">
          <div><label class="field-label">ชื่อ–สกุล *</label><input v-model="form.name" class="input input--sm" /></div>
          <div><label class="field-label">อีเมล *</label><input v-model="form.email" class="input input--sm" type="email" /></div>
          <div><label class="field-label">รหัสพนักงาน</label><input v-model="form.employeeId" class="input input--sm" /></div>
          <div>
            <label class="field-label">บทบาท</label>
            <select v-model="form.role" class="input input--sm">
              <option v-for="(label, key) in ROLE_LABEL" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div><label class="field-label">แผนก</label><input v-model="form.department" class="input input--sm" /></div>
          <div><label class="field-label">กลุ่มงานที่ดูแล</label><input v-model="form.group" class="input input--sm" placeholder="Desktop Support / Network" /></div>
          <div><label class="field-label">ความเชี่ยวชาญ</label><input v-model="form.skill" class="input input--sm" placeholder="Desktop / Hardware" /></div>
          <div><label class="field-label">เบอร์ติดต่อ</label><input v-model="form.phone" class="input input--sm" /></div>
          <div><label class="field-label">ช่องทางติดต่อสำรอง</label><input v-model="form.contact" class="input input--sm" /></div>
          <div><label class="field-label">รหัสองค์กร</label><input v-model="form.orgCode" class="input input--sm" /></div>
          <div class="form-grid__full">
            <label class="field-label">{{ editing ? 'ตั้งรหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)' : 'รหัสผ่านเริ่มต้น (ค่าเริ่มต้น Password123!)' }}</label>
            <input v-model="form.password" class="input input--sm" type="text" autocomplete="new-password" />
          </div>
        </div>

        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn-ghost" @click="showForm = false">ยกเลิก</button>
          <button type="submit" class="btn-brand" :disabled="busy">{{ busy ? 'กำลังบันทึก…' : 'บันทึก' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.stat-strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.stat { padding: 12px 14px; display: flex; flex-direction: column; gap: 3px; }
.stat span { font: 500 11px var(--font-th); color: var(--muted); }
.stat strong { font: 600 20px var(--font-th); letter-spacing: -0.4px; }

.users-head, .users-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 170px minmax(0, 1fr) 130px 230px;
  gap: 14px; align-items: center;
}
.users-head { padding: 10px 20px; background: var(--surface-2); border-bottom: 1px solid rgba(16, 24, 32, 0.07); font: 500 11px var(--font-th); color: var(--muted); }
.users-row { padding: 12px 20px; border-bottom: 1px solid var(--line-2); }
.users-row:hover { background: var(--surface-2); }
.users-row__name { font: 500 13px var(--font-th); }
.users-row__email { font: 400 11px var(--font-mono); color: var(--muted-2); }
.users-row__dept { font: 400 12.5px var(--font-th); color: var(--ink-3); }
.users-row__status { display: flex; align-items: center; gap: 7px; font: 400 12.5px var(--font-th); }
.users-row__actions { justify-self: end; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.btn-xs { padding: 6px 10px; font-size: 11.5px; }

.modal-back { position: fixed; inset: 0; z-index: 1050; background: rgba(16, 24, 32, 0.55); display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-card {
  width: 100%; max-width: 640px; max-height: 88vh; overflow: auto;
  background: #fff; border-radius: var(--radius-xl); padding: 22px;
  display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
}
.modal-title { font: 600 17px var(--font-th); margin: 0; }
.modal-close { border: 0; background: transparent; font-size: 24px; line-height: 1; color: var(--muted); cursor: pointer; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid__full { grid-column: 1 / -1; }
.min-w-0 { min-width: 0; }

@media (max-width: 1199.98px) {
  .stat-strip { grid-template-columns: repeat(3, 1fr); }
  .users-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 8px; }
  .users-row__actions { grid-column: 1 / -1; justify-self: start; }
}
@media (max-width: 575.98px) {
  .stat-strip { grid-template-columns: repeat(2, 1fr); }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
