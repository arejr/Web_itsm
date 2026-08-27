<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { APP_NAME_FULL } from '@/services/branding';
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
  { role: 'ผู้ดูแลระบบ', sub: 'จัดการผู้ใช้ ตั้งค่าระบบ ดูภาพรวม', email: 'waraporn.c@company.co.th' },
  { role: 'IT Helpdesk', sub: 'คัดกรองและมอบหมายตั๋วงาน', email: 'pimchanok.d@company.co.th' },
  { role: 'เจ้าหน้าที่ IT', sub: 'รับงานและแก้ไขปัญหา', email: 'thanawat.s@company.co.th' },
  { role: 'พนักงานบริษัท', sub: 'แจ้งปัญหาและติดตามสถานะ', email: 'asniya.n@company.co.th' }
];

const demoOpen = ref(false);
const demoRef = ref(null);

function fill(account) {
  username.value = account.email;
  password.value = 'Password123!';
  error.value = '';
  demoOpen.value = false;
}

// ปิดเมนูเมื่อคลิกนอกพื้นที่ หรือกด Esc
function onDocDown(e) {
  if (!demoOpen.value) return;
  if (demoRef.value && !demoRef.value.contains(e.target)) demoOpen.value = false;
}
function onKey(e) {
  if (e.key === 'Escape') demoOpen.value = false;
}
onMounted(() => {
  document.addEventListener('mousedown', onDocDown, true);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocDown, true);
  document.removeEventListener('keydown', onKey);
});

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
          <span class="login-brand__name">{{ APP_NAME_FULL }}</span>
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
          <span class="login-form__title">เข้าสู่ระบบ</span>

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

          <div ref="demoRef" class="demo">
            <button
              type="button"
              class="demo__trigger"
              :class="{ 'is-open': demoOpen }"
              :aria-expanded="demoOpen"
              aria-controls="demo-account-list"
              @click="demoOpen = !demoOpen"
            >
              <span class="demo__trigger-label">เลือกบัญชีสำหรับทดสอบ</span>
              <span class="demo__chevron" aria-hidden="true"></span>
            </button>

            <div v-if="demoOpen" id="demo-account-list" class="demo__menu" role="listbox">
              <button
                v-for="a in demoAccounts"
                :key="a.email"
                type="button"
                class="demo__item"
                role="option"
                :aria-selected="username === a.email"
                @click="fill(a)"
              >
                <span class="demo__item-main">
                  <span class="demo__item-role">{{ a.role }}</span>
                  <span class="demo__item-sub">{{ a.sub }}</span>
                </span>
              </button>
            </div>
          </div>

          <p class="login-help">
            หากเข้าใช้งานไม่ได้ ติดต่อศูนย์บริการ IT ที่เบอร์ 0000 หรืออีเมล @mail.com
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
.login-brand__name { font: 600 16px/1.45 var(--font-th); color: #fff; letter-spacing: 0.2px; max-width: 280px; }
.login-brand__body { margin-top: auto; padding-top: 44px; display: flex; flex-direction: column; gap: 18px; max-width: 430px; }
.login-brand__headline { font: 600 26px/1.4 var(--font-th); color: #fff; letter-spacing: -0.4px; margin: 0; }
.login-brand__text { font: 400 13.5px/1.9 var(--font-th); color: #8fa0af; margin: 0; }
.login-brand__foot { margin-top: 28px; font: 400 10.5px var(--font-mono); color: #57646f; }

.login-form-wrap { display: flex; align-items: center; justify-content: center; padding: 40px 38px; background: #fff; }
.login-form { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 18px; }
.login-form__title { font: 600 23px var(--font-th); letter-spacing: -0.3px; }
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

.demo { position: relative; }

.demo__trigger {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border: 1px dashed rgba(16, 24, 32, 0.22);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--ink-3);
  font: 500 12px var(--font-th);
  cursor: pointer;
}
.demo__trigger:hover { background: var(--surface-3); }
.demo__trigger.is-open { border-style: solid; border-color: var(--brand); background: var(--brand-tint); color: var(--brand-ink); }
.demo__trigger-label { flex: 1; text-align: left; }

.demo__chevron {
  width: 7px; height: 7px; flex: none;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translate(-2px, -2px);
  transition: transform 0.18s ease;
}
.demo__trigger.is-open .demo__chevron { transform: rotate(-135deg) translate(-2px, -2px); }

.demo__menu {
  position: absolute; left: 0; right: 0; bottom: calc(100% + 6px);
  z-index: 20;
  background: #fff;
  border: 1px solid rgba(16, 24, 32, 0.12);
  border-radius: var(--radius-lg);
  box-shadow: 0 14px 36px rgba(16, 24, 32, 0.18);
  overflow: hidden auto;
  /* กันกรณีจอเตี้ยมาก เช่นมือถือแนวนอน ไม่ให้เมนูล้นออกนอกการ์ดที่ตั้ง overflow:hidden ไว้ */
  max-height: min(288px, 46vh);
  overscroll-behavior: contain;
  animation: demo-in 0.14s ease;
}
@keyframes demo-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}

.demo__item {
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
  border: 0; border-bottom: 1px solid rgba(16, 24, 32, 0.06);
  background: #fff; cursor: pointer; text-align: left;
}
.demo__item:last-child { border-bottom: 0; }
.demo__item:hover { background: var(--brand-tint); }
.demo__item[aria-selected='true'] { background: var(--brand-tint); }
.demo__item-main { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.demo__item-role { font: 500 12.5px var(--font-th); color: var(--ink); }
.demo__item-sub { font: 400 10.5px var(--font-th); color: var(--muted-2); }


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
