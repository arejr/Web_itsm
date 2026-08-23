<script setup>
import { ref } from 'vue';
import api, { errMsg } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { ROLE_LABEL } from '@/services/lookups';
import { thDateTime } from '@/services/format';

const auth = useAuthStore();
const ui = useUiStore();

const form = ref({ currentPassword: '', newPassword: '', confirm: '' });
const busy = ref(false);

async function changePassword() {
  if (form.value.newPassword.length < 6) {
    ui.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
    return;
  }
  if (form.value.newPassword !== form.value.confirm) {
    ui.error('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
    return;
  }
  busy.value = true;
  try {
    await api.patch('/auth/password', {
      currentPassword: form.value.currentPassword,
      newPassword: form.value.newPassword
    });
    form.value = { currentPassword: '', newPassword: '', confirm: '' };
    ui.success('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="profile-grid">
    <div class="card-surface p-4 d-flex flex-column gap-3">
      <div class="d-flex align-items-center gap-3">
        <div class="avatar avatar--lg">{{ auth.initial }}</div>
        <div class="d-flex flex-column gap-1">
          <span class="meta-label">{{ ROLE_LABEL[auth.role] }}</span>
          <span style="font: 600 20px var(--font-th)">{{ auth.user?.name }}</span>
          <span class="mono" style="font-size: 12px; color: var(--brand-ink)">{{ auth.user?.email }}</span>
        </div>
      </div>

      <div class="profile-fields">
        <div><span class="meta-label">รหัสพนักงาน</span><span class="meta-value mono">{{ auth.user?.employeeId || '—' }}</span></div>
        <div><span class="meta-label">แผนก</span><span class="meta-value">{{ auth.user?.department || '—' }}</span></div>
        <div><span class="meta-label">กลุ่มงานที่ดูแล</span><span class="meta-value">{{ auth.user?.group || '—' }}</span></div>
        <div><span class="meta-label">ความเชี่ยวชาญ</span><span class="meta-value">{{ auth.user?.skill || '—' }}</span></div>
        <div><span class="meta-label">เบอร์ติดต่อ</span><span class="meta-value mono">{{ auth.user?.phone || '—' }}</span></div>
        <div><span class="meta-label">ช่องทางสำรอง</span><span class="meta-value">{{ auth.user?.contact || '—' }}</span></div>
        <div><span class="meta-label">หน่วยงาน</span><span class="meta-value">{{ auth.user?.company || '—' }}</span></div>
        <div><span class="meta-label">เข้าสู่ระบบล่าสุด</span><span class="meta-value">{{ thDateTime(auth.user?.lastLoginAt) }}</span></div>
      </div>
    </div>

    <form class="card-surface p-4 d-flex flex-column gap-3" @submit.prevent="changePassword">
      <div class="card-title-sm">เปลี่ยนรหัสผ่าน</div>
      <div>
        <label class="field-label">รหัสผ่านปัจจุบัน</label>
        <input v-model="form.currentPassword" class="input input--sm" type="password" autocomplete="current-password" />
      </div>
      <div>
        <label class="field-label">รหัสผ่านใหม่</label>
        <input v-model="form.newPassword" class="input input--sm" type="password" autocomplete="new-password" />
      </div>
      <div>
        <label class="field-label">ยืนยันรหัสผ่านใหม่</label>
        <input v-model="form.confirm" class="input input--sm" type="password" autocomplete="new-password" />
      </div>
      <button class="btn-brand" type="submit" :disabled="busy">{{ busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่' }}</button>
    </form>
  </div>
</template>

<style scoped>
.profile-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 14px; align-items: start; }
.profile-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
@media (max-width: 991.98px) { .profile-grid { grid-template-columns: 1fr; } }
@media (max-width: 575.98px) { .profile-fields { grid-template-columns: 1fr; } }
</style>
