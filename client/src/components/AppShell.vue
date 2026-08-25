<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMetaStore } from '@/stores/meta';
import { useUiStore } from '@/stores/ui';
import { useTicketStore } from '@/stores/tickets';
import AppSidebar from '@/components/AppSidebar.vue';
import NotificationBell from '@/components/NotificationBell.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const meta = useMetaStore();
const ui = useUiStore();
const tickets = useTicketStore();

const search = ref('');
const searchOpen = ref(false);
const logoutState = ref(null); // null | 'confirm' | 'done'
const bannerDismissed = ref(false);

const pageTitle = computed(() => route.meta.title || 'IT Service Desk');
const pageSub = computed(() => {
  if (route.name === 'ticket-detail' && tickets.current) {
    return `${tickets.current.code} · ${tickets.current.title}`;
  }
  return route.meta.sub || '';
});

const banner = computed(() => (bannerDismissed.value ? null : meta.activeBanner));

function runSearch() {
  const q = search.value.trim();
  if (!q) return;
  router.push({ name: auth.isEmployee ? 'my-tickets' : 'queue', query: { q } });
  searchOpen.value = false;
}

function confirmLogout() {
  // สลับไปหน้าจอ "ออกจากระบบแล้ว" ก่อน แล้วค่อยล้างเซสชัน
  // เพื่อไม่ให้ข้อมูลผู้ใช้ที่กล่องนี้อ้างถึงหายไปกลางคัน
  logoutState.value = 'done';
  auth.logout();
}

function backToLogin() {
  logoutState.value = null;
  router.replace({ name: 'login' });
}

// กันไว้กรณีผู้ใช้กด Esc หรือปิดกล่องไปโดยที่เซสชันถูกล้างไปแล้ว
watch(
  () => auth.isAuthed,
  (authed) => {
    if (!authed && logoutState.value === null) router.replace({ name: 'login' });
  }
);
</script>

<template>
  <div class="shell">
    <!-- ฉากหลังเมนูบนจอเล็ก -->
    <div v-if="ui.sidebarOpen" class="shell__scrim d-lg-none" @click="ui.toggleSidebar(false)"></div>

    <div class="shell__sidebar" :class="{ 'is-open': ui.sidebarOpen }">
      <AppSidebar @sign-out="logoutState = 'confirm'" />
    </div>

    <main class="shell__main">
      <header class="topbar">
        <button class="topbar__burger d-lg-none" type="button" aria-label="เปิดเมนู" @click="ui.toggleSidebar(true)">
          <span></span><span></span><span></span>
        </button>

        <div class="topbar__titles">
          <div class="topbar__title text-truncate">{{ pageTitle }}</div>
          <div class="topbar__sub text-truncate">{{ pageSub }}</div>
        </div>

        <div class="flex-fill"></div>

        <form class="topbar__search" :class="{ 'is-open': searchOpen }" @submit.prevent="runSearch">
          <span class="mono topbar__search-icon">⌕</span>
          <input v-model="search" type="search" placeholder="ค้นหาเลขตั๋ว, ผู้แจ้ง, คำสำคัญ" aria-label="ค้นหา" />
        </form>
        <button class="topbar__icon d-md-none" type="button" aria-label="ค้นหา" @click="searchOpen = !searchOpen">⌕</button>

        <NotificationBell />

        <RouterLink v-if="!auth.isEmployee" :to="{ name: 'new-ticket' }" class="btn-brand topbar__cta">
          + แจ้งปัญหาใหม่
        </RouterLink>
        <RouterLink v-else :to="{ name: 'new-ticket' }" class="btn-brand topbar__cta">+ แจ้งปัญหาใหม่</RouterLink>
      </header>

      <div v-if="banner" class="banner">
        <span class="banner__tag mono">ประกาศ</span>
        <span class="banner__text">
          {{ banner.title }}<template v-if="banner.whenText"> — {{ banner.whenText }}</template>
        </span>
        <button class="banner__close" type="button" aria-label="ปิดประกาศ" @click="bannerDismissed = true">×</button>
      </div>

      <div class="shell__content">
        <slot />
      </div>
    </main>

    <!-- กล่องยืนยันการออกจากระบบ -->
    <div v-if="logoutState" class="logout-overlay">
      <div class="logout-card">
        <div class="d-flex align-items-center gap-2 mb-2">
          <div class="logout-mark mono">IT</div>
          <span class="fw-semibold" style="font-size: 14px">IT Service Desk</span>
        </div>

        <template v-if="logoutState === 'confirm'">
          <h2 class="logout-title">ต้องการออกจากระบบใช่หรือไม่</h2>
          <p class="logout-text">
            คุณกำลังเข้าใช้งานในชื่อ <strong>{{ auth.user?.name }}</strong> ({{ auth.roleLabel }}) —
            งานที่ยังไม่บันทึกในแบบฟอร์มจะหายไป
          </p>
          <div class="d-flex gap-2">
            <button class="btn-ghost flex-fill py-3" type="button" @click="logoutState = null">กลับไปทำงานต่อ</button>
            <button class="btn-slate flex-fill py-3" type="button" @click="confirmLogout">ออกจากระบบ</button>
          </div>
        </template>

        <template v-else>
          <h2 class="logout-title">ออกจากระบบเรียบร้อยแล้ว</h2>
          <button class="btn-brand w-100 py-3" type="button" @click="backToLogin">เข้าสู่ระบบอีกครั้ง</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell { display: flex; min-height: 100vh; background: var(--app-bg); }

.shell__sidebar { position: sticky; top: 0; height: 100vh; z-index: 40; }
.shell__scrim { position: fixed; inset: 0; background: rgba(10, 18, 26, 0.5); z-index: 39; }

.shell__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.topbar {
  position: sticky; top: 0; z-index: 20;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(8px);
  border-bottom: 2px solid var(--accent);
  padding: 12px 18px;
  display: flex; align-items: center; gap: 12px;
}
.topbar__burger {
  width: 36px; height: 36px; flex: none;
  border: 1px solid var(--line-strong); border-radius: var(--radius);
  background: #fff; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
}
.topbar__burger span { display: block; width: 15px; height: 1.6px; background: var(--ink-3); border-radius: 2px; }
.topbar__titles { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.topbar__title { font: 600 16px var(--font-th); letter-spacing: -0.1px; }
.topbar__sub { font: 400 12px var(--font-th); color: var(--muted); max-width: 46vw; }

.topbar__search {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 12px; width: 270px;
  border: 1px solid var(--line-strong); border-radius: var(--radius);
  background: #fff;
}
.topbar__search input { border: 0; outline: 0; flex: 1; font: 400 12.5px var(--font-th); background: transparent; min-width: 0; }
.topbar__search-icon { font: 400 12px var(--font-mono); color: var(--muted-3); }

.topbar__icon {
  width: 36px; height: 36px; flex: none;
  border: 1px solid var(--line-strong); border-radius: var(--radius);
  background: #fff; cursor: pointer; color: var(--ink-3);
}
.topbar__cta { white-space: nowrap; text-decoration: none; }
.topbar__cta:hover { color: #fff; text-decoration: none; }

.banner {
  margin: 16px 18px 0;
  padding: 11px 14px;
  border-radius: 9px;
  background: var(--amber-soft);
  border: 1px solid #f1d9a8;
  display: flex; align-items: center; gap: 11px;
}
.banner__tag {
  font: 600 10px var(--font-mono);
  padding: 3px 7px; border-radius: 5px;
  background: var(--amber-ink); color: #fff; letter-spacing: 0.6px; flex: none;
}
.banner__text { font: 400 12.5px var(--font-th); color: #6a4a09; flex: 1; }
.banner__close { border: 0; background: transparent; color: #8a5a08; font-size: 20px; line-height: 1; cursor: pointer; }

.shell__content { padding: 18px; display: flex; flex-direction: column; gap: 16px; flex: 1; }

.logout-overlay {
  position: fixed; inset: 0; z-index: 1060;
  background: var(--sidebar-bg);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.logout-card {
  width: 100%; max-width: 420px; background: #fff;
  border-radius: var(--radius-xl); padding: 30px 30px 26px;
  display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}
.logout-mark {
  width: 34px; height: 34px; border-radius: 7px; background: var(--sidebar-mark);
  display: flex; align-items: center; justify-content: center;
  font: 600 13px var(--font-mono); color: #dbe7f0;
}
.logout-title { font: 600 19px var(--font-th); letter-spacing: -0.2px; margin: 0; }
.logout-text { font: 400 12.5px/1.85 var(--font-th); color: var(--muted); margin: 0; }

@media (min-width: 1200px) {
  .shell__content { padding: 22px 28px 44px; gap: 18px; }
  .topbar { padding: 14px 28px; gap: 18px; }
  .banner { margin: 16px 28px 0; }
}

@media (max-width: 991.98px) {
  .shell__sidebar {
    position: fixed; top: 0; left: 0;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
  }
  .shell__sidebar.is-open { transform: none; }
  .topbar__search { display: none; }
  .topbar__search.is-open {
    display: flex;
    position: absolute; top: 100%; left: 12px; right: 12px;
    width: auto; z-index: 25;
    box-shadow: 0 12px 28px rgba(16, 24, 32, 0.16);
  }
}

@media (max-width: 575.98px) {
  .topbar__cta { padding: 9px 11px; font-size: 12px; }
  .topbar__sub { display: none; }
}
</style>
