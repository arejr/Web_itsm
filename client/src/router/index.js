import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true, layout: 'blank' } },

  // ปล่อยให้ router guard เป็นผู้ตัดสินว่าหน้าแรกของแต่ละบทบาทคือหน้าไหน
  { path: '/', name: 'home' },

  { path: '/dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'),
    meta: { roles: ['admin', 'helpdesk', 'tech'], title: 'แดชบอร์ดภาพรวม', sub: 'สรุปสถานะตั๋วงานและประสิทธิภาพการให้บริการ' } },

  { path: '/users', name: 'users', component: () => import('@/views/UsersView.vue'),
    meta: { roles: ['admin'], title: 'บริหารจัดการผู้ใช้งาน', sub: 'จัดการสมาชิก บทบาท และการเปิด–ระงับบัญชี' } },

  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'),
    meta: { roles: ['admin'], title: 'ตั้งค่าระบบ', sub: 'หมวดหมู่ปัญหา ระดับความรุนแรง และประกาศ' } },

  { path: '/queue', name: 'queue', component: () => import('@/views/QueueView.vue'),
    meta: { roles: ['admin', 'helpdesk', 'tech'], title: 'คิวตั๋วงาน', sub: 'ตรวจสอบ คัดกรอง จัดหมวดหมู่ และมอบหมายงาน' } },

  { path: '/board', name: 'board', component: () => import('@/views/BoardView.vue'),
    meta: { roles: ['helpdesk', 'tech'], title: 'คิวงานตามสถานะ', sub: 'ติดตามงานที่รับผิดชอบแยกตามสถานะการทำงาน' } },

  { path: '/kb', name: 'kb', component: () => import('@/views/KnowledgeBaseView.vue'),
    meta: { title: 'ฐานความรู้ (Knowledge Base)', sub: 'วิธีแก้ปัญหาที่บันทึกจาก Resolution Note' } },

  { path: '/new', name: 'new-ticket', component: () => import('@/views/NewTicketView.vue'),
    meta: { roles: ['employee'], title: 'แจ้งปัญหาใหม่', sub: 'กรอกรายละเอียดให้ครบเพื่อให้ทีม IT แก้ไขได้เร็วขึ้น' } },

  { path: '/my-tickets', name: 'my-tickets', component: () => import('@/views/MyTicketsView.vue'),
    meta: { title: 'ตั๋วงานของฉัน', sub: 'ติดตามสถานะและประวัติการแจ้งปัญหาย้อนหลัง' } },

  { path: '/tickets/:id', name: 'ticket-detail', component: () => import('@/views/TicketDetailView.vue'),
    meta: { title: 'รายละเอียดตั๋วงาน', sub: '' } },

  { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'),
    meta: { title: 'บัญชีของฉัน', sub: 'ข้อมูลส่วนตัวและการเปลี่ยนรหัสผ่าน' } },

  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

// หน้าแรกของแต่ละบทบาทหลังเข้าสู่ระบบ
export const HOME_BY_ROLE = {
  admin: 'dashboard',
  helpdesk: 'queue',
  tech: 'board',
  employee: 'my-tickets'
};

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.restore();

  // ต้องมีทั้งข้อมูลผู้ใช้และ token — ถ้าอย่างใดอย่างหนึ่งหายไปถือว่าเซสชันไม่สมบูรณ์
  const signedIn = auth.isAuthed && !!auth.token;

  if (to.meta.public) {
    if (signedIn) return { name: HOME_BY_ROLE[auth.role] || 'my-tickets' };
    return true;
  }

  if (!signedIn) {
    if (auth.isAuthed) auth.logout();
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  const home = HOME_BY_ROLE[auth.role] || 'my-tickets';

  // เข้าหน้าแรกของเว็บ → พาไปหน้าเริ่มต้นของบทบาทนั้น
  if (to.name === 'home') return { name: home };

  // เข้าหน้าที่ไม่มีสิทธิ์ → พากลับหน้าเริ่มต้นของบทบาท
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) return { name: home };

  return true;
});

export default router;
