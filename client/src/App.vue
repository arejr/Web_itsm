<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMetaStore } from '@/stores/meta';
import { useNotificationStore } from '@/stores/notifications';
import { useTicketStore } from '@/stores/tickets';
import { useUiStore } from '@/stores/ui';
import AppShell from '@/components/AppShell.vue';
import ToastStack from '@/components/ToastStack.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const meta = useMetaStore();
const notifications = useNotificationStore();
const tickets = useTicketStore();
const ui = useUiStore();

// ใช้เฉพาะ meta ของเส้นทางเท่านั้น — ถ้าอิง auth.isAuthed ด้วย AppShell จะถูกถอดออก
// ทันทีที่กดออกจากระบบ ทำให้กล่อง "ออกจากระบบเรียบร้อยแล้ว" หายไปและค้างอยู่หน้าเดิม
// การพาผู้ใช้ที่ยังไม่ล็อกอินไปหน้าเข้าสู่ระบบเป็นหน้าที่ของ router guard
const blank = computed(() => route.meta.layout === 'blank');

// โหลดข้อมูลอ้างอิงและผูก socket เมื่อเข้าสู่ระบบสำเร็จ
watch(
  () => auth.isAuthed,
  async (authed) => {
    if (authed) {
      await meta.load(true);
      await notifications.load().catch(() => {});
      notifications.bind();
      tickets.bind();
    } else {
      notifications.reset();
      tickets.reset();
      meta.loaded = false;
    }
  },
  { immediate: true }
);

// เซสชันหมดอายุกลางคัน (API ตอบ 401) — ล้างสถานะแล้วพากลับหน้าเข้าสู่ระบบ
function onUnauthorized() {
  if (!auth.isAuthed) return;
  auth.logout();
  ui.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
  router.replace({ name: 'login' });
}

onMounted(() => {
  auth.restore();
  window.addEventListener('itsm:unauthorized', onUnauthorized);
});
onBeforeUnmount(() => window.removeEventListener('itsm:unauthorized', onUnauthorized));
</script>

<template>
  <RouterView v-if="blank" v-slot="{ Component }">
    <component :is="Component" />
  </RouterView>

  <AppShell v-else>
    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>
  </AppShell>

  <ConfirmDialog />
  <ToastStack />
</template>
