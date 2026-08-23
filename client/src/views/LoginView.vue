<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { HOME_BY_ROLE } from '@/router';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const username = ref('');
const password = ref('');
const showPass = ref(false);
const remember = ref(true);
const error = ref('');

// บัญชีตัวอย่างสำหรับทดสอบระบบ (ตรงกับข้อมูลใน seed)
const demoAccounts = [
  { role: 'ผู้ดูแลระบบ', email: 'waraporn.c@company.co.th' },
  { role: 'IT Helpdesk', email: 'pimchanok.d@company.co.th' },
  { role: 'เจ้าหน้าที่ IT', email: 'thanawat.s@company.co.th' },
  { role: 'พนักงานบริษัท', email: 'asniya.n@company.co.th' }
];

function fill(email) {
  username.value = email;
  password.value = 'Password123!';
  error.value = '';
}

async function submit() {
  error.value = '';
  if (!username.value.trim() || !password.value.trim()) {
    error.value = 'กรุณากรอกรหัสพนักงานและรหัสผ่านให้ครบถ้วน';
    return;
  }
  const res = await auth.login(username.value.trim(), password.value);
  if (!res.ok) {
    error.value = res.message;
    return;
  }
  const target = route.query.redirect || { name: HOME_BY_ROLE[auth.role] || 'dashboard' };
  router.replace(target);
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <!-- ฝั่งซ้าย: แบรนด์ -->
      <div class="login-brand">
        <div class="d-flex align-items-center gap-3">
          <div class="login-mark mono">IT</div>
          <div class="d-flex flex-column">
            <span class="login-brand__name">IT Service Desk</span>
            <span class="login-brand__sub mono">Incident &amp; Ticket Management</span>
          </div>
        </div>

        <div class="login-brand__body">
          <h1 class="login-brand__headline">
            ระบบแจ้งปัญหาทางเทคโนโลยีสารสนเทศ<br />และบริหารจัดการตั๋วงาน
          </h1>
          <p class="login-brand__text">
            แจ้งปัญหา ติดตามสถานะ และประสานงานกับเจ้าหน้าที่ IT ได้ในที่เดียว
            เข้าสู่ระบบด้วยบัญชีพนักงานขององค์กร
          </p>
        </div>

        <div class="login-brand__foot mono">© 2026 Information Technology Department</div>
      </div>

      <!-- ฝั่งขวา: ฟอร์ม -->
      <div class="login-form-wrap">
        <form class="login-form" @submit.prevent="submit">
          <div class="d-flex flex-column gap-1">
            <span class="login-form__title">เข้าสู่ระบบ</span>
            <span class="login-form__sub">ใช้บัญชีพนักงาน (Active Directory) ขององค์กร</span>
          </div>

          <div v-if="error" class="login-error" role="alert">{{ error }}</div>

          <div>
            <label class="field-label" for="login-user">รหัสพนักงาน หรือ อีเมล</label>
            <input
              id="login-user"
              v-model="username"
              class="input"
              type="text"
              autocomplete="username"
              placeholder="employee.id@company.co.th"
              @input="error = ''"
            />
          </div>

          <div>
            <label class="field-label" for="login-pass">รหัสผ่าน</label>
            <div class="pass-wrap">
              <input
                id="login-pass"
                v-model="password"
                :type="showPass ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                @input="error = ''"
              />
              <button type="button" class="pass-toggle" @click="showPass = !showPass">
                {{ showPass ? 'ซ่อน' : 'แสดง' }}
              </button>
            </div>
          </div>

          <div class="d-flex align-items-center gap-2">
            <label class="remember flex-fill">
              <input v-model="remember" type="checkbox" /> จดจำการเข้าสู่ระบบบนเครื่องนี้
            </label>
            <a href="#" @click.prevent>ลืมรหัสผ่าน?</a>
          </div>

          <button class="btn-brand w-100 py-3" type="submit" :disabled="auth.loading">
            {{ auth.loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ' }}
          </button>

          <div class="demo-box">
            <div class="demo-box__label mono">DEMO ACCOUNTS · รหัสผ่าน Password123!</div>
            <div class="demo-box__grid">
              <button v-for="a in demoAccounts" :key="a.email" type="button" class="chip" @click="fill(a.email)">
                {{ a.role }}
              </button>
            </div>
          </div>

          <p class="login-help">
            หากเข้าใช้งานไม่ได้ ติดต่อศูนย์บริการ IT ต่อ 1150 หรืออีเมล servicedesk@company.co.th
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--sidebar-bg);
  display: flex; justify-content: center;
  padding: 24px;
  overflow: auto;
}
.login-card {
  width: 100%; max-width: 920px; margin: auto;
  display: grid; grid-template-columns: 1.05fr 0.95fr;
  border-radius: 16px; overflow: hidden;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.4);
}
.login-brand {
  background: #1b2f42; color: var(--sidebar-fg);
  padding: 44px; display: flex; flex-direction: column;
}
.login-mark {
  width: 38px; height: 38px; border-radius: 7px; background: var(--sidebar-mark);
  display: flex; align-items: center; justify-content: center;
  font: 600 15px var(--font-mono); color: #dbe7f0; letter-spacing: 0.5px;
}
.login-brand__name { font: 600 16px var(--font-th); color: #fff; letter-spacing: 0.2px; }
.login-brand__sub { font: 400 11px var(--font-mono); color: var(--sidebar-muted); }
.login-brand__body { margin-top: auto; padding-top: 44px; display: flex; flex-direction: column; gap: 18px; max-width: 430px; }
.login-brand__headline { font: 600 26px/1.4 var(--font-th); color: #fff; letter-spacing: -0.4px; margin: 0; }
.login-brand__text { font: 400 13.5px/1.9 var(--font-th); color: #8fa0af; margin: 0; }
.login-brand__foot { margin-top: 28px; font: 400 10.5px var(--font-mono); color: #57646f; }

.login-form-wrap { display: flex; align-items: center; justify-content: center; padding: 40px 38px; background: #fff; }
.login-form { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 18px; }
.login-form__title { font: 600 23px var(--font-th); letter-spacing: -0.3px; }
.login-form__sub { font: 400 12.5px var(--font-th); color: var(--muted); }
.login-error {
  padding: 10px 12px; border-radius: var(--radius);
  background: var(--danger-soft); border: 1px solid #f2c9c4;
  font: 400 12px var(--font-th); color: var(--danger-ink);
}
.pass-wrap {
  display: flex; align-items: center; gap: 6px;
  padding: 0 10px 0 13px;
  border: 1px solid var(--line-input); border-radius: var(--radius); background: #fff;
}
.pass-wrap:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(20, 119, 107, 0.14); }
.pass-wrap input { flex: 1; padding: 12px 0; border: 0; outline: 0; font: 400 13px var(--font-th); background: transparent; min-width: 0; }
.pass-toggle {
  padding: 5px 9px; border-radius: var(--radius-sm); border: 0;
  background: var(--surface-3); color: var(--ink-3); cursor: pointer;
  font: 500 11px var(--font-th);
}
.remember {
  display: flex; align-items: center; gap: 8px;
  font: 400 12px var(--font-th); color: var(--ink-3); cursor: pointer; margin: 0;
}
.remember input { accent-color: var(--brand); width: 14px; height: 14px; }

.demo-box {
  padding: 12px; border-radius: var(--radius);
  background: var(--surface-2); border: 1px solid rgba(16, 24, 32, 0.07);
  display: flex; flex-direction: column; gap: 8px;
}
.demo-box__label { font: 500 9.5px var(--font-mono); color: var(--muted-3); letter-spacing: 0.8px; }
.demo-box__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.demo-box__grid .chip { width: 100%; }

.login-help { font: 400 11.5px/1.8 var(--font-th); color: var(--muted-3); text-align: center; margin: 0; }

@media (max-width: 860px) {
  .login-card { grid-template-columns: 1fr; max-width: 460px; }
  .login-brand { padding: 28px; }
  .login-brand__body { padding-top: 24px; }
  .login-brand__headline { font-size: 20px; }
  .login-brand__foot { display: none; }
  .login-form-wrap { padding: 28px 24px 34px; }
}
</style>
