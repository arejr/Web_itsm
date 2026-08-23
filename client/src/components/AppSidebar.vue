<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTicketStore } from '@/stores/tickets';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tickets = useTicketStore();
const ui = useUiStore();

const emit = defineEmits(['sign-out']);

// เมนูตามบทบาท — ตรงตามโครงสร้างในไฟล์ดีไซน์
const NAV_BY_ROLE = {
  admin: [
    { name: 'dashboard', label: 'แดชบอร์ดภาพรวม', en: 'Dashboard' },
    { name: 'queue', label: 'ตั๋วงานทั้งหมด', en: 'All Tickets', badge: 'open' },
    { name: 'board', label: 'คิวงานตามสถานะ', en: 'Board' },
    { name: 'users', label: 'จัดการผู้ใช้งาน', en: 'User Management' },
    { name: 'settings', label: 'ตั้งค่าระบบ', en: 'System Settings' },
    { name: 'kb', label: 'ฐานความรู้', en: 'Knowledge Base' }
  ],
  helpdesk: [
    { name: 'dashboard', label: 'แดชบอร์ดภาพรวม', en: 'Dashboard' },
    { name: 'queue', label: 'คิวคัดกรอง', en: 'Triage Queue', badge: 'new' },
    { name: 'board', label: 'ภาระงานทีม', en: 'Team Workload' },
    { name: 'kb', label: 'ฐานความรู้', en: 'Knowledge Base' }
  ],
  tech: [
    { name: 'board', label: 'งานที่ได้รับมอบหมาย', en: 'My Assignments', badge: 'mine' },
    { name: 'dashboard', label: 'ภาพรวมงานของฉัน', en: 'Dashboard' },
    { name: 'queue', label: 'ตั๋วงานทั้งหมด', en: 'All Tickets' },
    { name: 'kb', label: 'ฐานความรู้', en: 'Knowledge Base' }
  ],
  employee: [
    { name: 'new-ticket', label: 'แจ้งปัญหาใหม่', en: 'Submit a Ticket' },
    { name: 'my-tickets', label: 'ตั๋วงานของฉัน', en: 'My Tickets', badge: 'reported' },
    { name: 'kb', label: 'ฐานความรู้', en: 'Knowledge Base' }
  ]
};

const OPEN = ['new', 'assigned', 'inprogress', 'pending'];

function badgeCount(kind) {
  const list = tickets.items;
  if (!list.length) return '';
  if (kind === 'open') return String(list.filter((t) => OPEN.includes(t.status)).length);
  if (kind === 'new') return String(list.filter((t) => t.status === 'new').length);
  if (kind === 'mine') {
    return String(list.filter((t) => t.assignee?._id === auth.user?._id && OPEN.includes(t.status)).length);
  }
  if (kind === 'reported') return String(list.filter((t) => OPEN.includes(t.status)).length);
  return '';
}

const navItems = computed(() =>
  (NAV_BY_ROLE[auth.role] || NAV_BY_ROLE.employee).map((item) => ({
    ...item,
    active: route.name === item.name,
    count: item.badge ? badgeCount(item.badge) : ''
  }))
);

function go(name) {
  router.push({ name });
  ui.toggleSidebar(false);
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <div class="sidebar__mark mono">IT</div>
      <div class="d-flex flex-column">
        <span class="sidebar__title">IT Service Desk</span>
        <span class="sidebar__subtitle mono">Incident &amp; Ticket Management</span>
      </div>
      <button class="sidebar__close d-lg-none" type="button" aria-label="ปิดเมนู" @click="ui.toggleSidebar(false)">×</button>
    </div>

    <div class="sidebar__label mono">NAVIGATION</div>
    <nav class="sidebar__nav">
      <button
        v-for="item in navItems"
        :key="item.name"
        type="button"
        class="nav-item"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="go(item.name)"
      >
        <span class="nav-item__dot"></span>
        <span class="nav-item__label">
          {{ item.label }}
          <small class="nav-item__en mono">{{ item.en }}</small>
        </span>
        <span v-if="item.count" class="nav-item__badge mono">{{ item.count }}</span>
      </button>
    </nav>

    <div class="sidebar__foot">
      <div class="sidebar__label mono mb-2">SIGNED IN AS</div>
      <div class="sidebar__me">
        <div class="sidebar__avatar">{{ auth.initial }}</div>
        <div class="d-flex flex-column flex-fill min-w-0">
          <span class="sidebar__me-name text-truncate">{{ auth.user?.name }}</span>
          <span class="sidebar__me-role text-truncate">{{ auth.roleLabelEn }}</span>
        </div>
        <button class="sidebar__icon-btn mono" type="button" title="บัญชีของฉัน" @click="go('profile')">☰</button>
        <button class="sidebar__icon-btn mono" type="button" title="ออกจากระบบ" @click="emit('sign-out')">⏻</button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex: none;
  background: var(--sidebar-bg);
  color: var(--sidebar-fg);
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-right: 1px solid rgba(0, 0, 0, 0.25);
  overflow-y: auto;
}
.sidebar__brand {
  padding: 20px 18px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.sidebar__mark {
  width: 30px; height: 30px; flex: none;
  border-radius: var(--radius-sm);
  background: var(--sidebar-mark);
  display: flex; align-items: center; justify-content: center;
  font: 600 13px var(--font-mono);
  color: #dbe7f0;
  letter-spacing: 0.5px;
}
.sidebar__title { font: 600 13.5px var(--font-th); color: #fff; letter-spacing: 0.2px; }
.sidebar__subtitle { font: 400 10.5px var(--font-mono); color: var(--sidebar-muted); }
.sidebar__close {
  margin-left: auto; border: 0; background: transparent;
  color: #8c9aa6; font-size: 26px; line-height: 1; cursor: pointer; padding: 0 4px;
}
.sidebar__label {
  padding: 16px 14px 8px;
  font: 500 10px var(--font-mono);
  color: var(--sidebar-label);
  letter-spacing: 1.4px;
}
.sidebar__foot .sidebar__label { padding: 0; }
.sidebar__nav { display: flex; flex-direction: column; gap: 2px; padding: 0 10px; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; text-align: left;
  padding: 9px 11px; border: 0; border-radius: 7px;
  cursor: pointer;
  font: 500 13px var(--font-th);
  background: transparent;
  color: var(--sidebar-fg);
}
.nav-item:hover { background: rgba(255, 255, 255, 0.05); color: #e6ebef; }
.nav-item.is-active { background: rgba(255, 255, 255, 0.09); color: #fff; }
.nav-item__dot { width: 7px; height: 7px; flex: none; border-radius: 2px; background: #33424f; }
.nav-item.is-active .nav-item__dot { background: var(--sidebar-active-dot); }
.nav-item__label { flex: 1; display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
.nav-item__en { font: 400 9.5px var(--font-mono); color: #6e7b87; }
.nav-item.is-active .nav-item__en { color: #93a7b6; }
.nav-item__badge {
  font: 500 10.5px var(--font-mono);
  padding: 1px 7px; border-radius: 20px;
  background: rgba(255, 255, 255, 0.06); color: #8895a1;
}
.nav-item.is-active .nav-item__badge { background: rgba(61, 132, 184, 0.28); color: #cfe2f0; }

.sidebar__foot {
  margin-top: auto;
  padding: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.sidebar__me { display: flex; align-items: center; gap: 9px; }
.sidebar__avatar {
  width: 28px; height: 28px; flex: none; border-radius: 50%;
  background: #24384a; display: flex; align-items: center; justify-content: center;
  font: 600 11px var(--font-th); color: var(--sidebar-fg);
}
.sidebar__me-name { font: 500 12px var(--font-th); color: #e6ebef; }
.sidebar__me-role { font: 400 10.5px var(--font-th); color: var(--sidebar-muted); }
.sidebar__icon-btn {
  width: 28px; height: 28px; flex: none; border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: transparent; color: #94a3af; cursor: pointer;
  font: 500 12px var(--font-mono);
}
.sidebar__icon-btn:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.min-w-0 { min-width: 0; }
</style>
