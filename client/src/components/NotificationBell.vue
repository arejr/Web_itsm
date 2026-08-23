<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notifications';
import { notifTint } from '@/services/lookups';
import { relTime } from '@/services/format';

const router = useRouter();
const store = useNotificationStore();
const root = ref(null);

// ปิดกล่องแจ้งเตือนเมื่อคลิกนอกพื้นที่
function onDocDown(e) {
  if (!store.open) return;
  if (root.value && !root.value.contains(e.target)) store.toggle(false);
}
onMounted(() => document.addEventListener('mousedown', onDocDown, true));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown, true));

async function openItem(n) {
  await store.markRead(n._id);
  store.toggle(false);
  const id = n.ticket?._id || n.ticket;
  if (id) router.push({ name: 'ticket-detail', params: { id } });
}
</script>

<template>
  <div ref="root" class="bell-wrap">
    <button
      type="button"
      class="bell-btn"
      :class="{ 'is-open': store.open }"
      :aria-expanded="store.open"
      aria-label="ศูนย์แจ้งเตือน"
      @click="store.toggle()"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3.6 6.4a4.4 4.4 0 0 1 8.8 0c0 3.1.9 4.3 1.4 4.8H2.2c.5-.5 1.4-1.7 1.4-4.8Z" />
        <path d="M6.6 13.4a1.6 1.6 0 0 0 2.8 0" />
      </svg>
      <span v-if="store.unread" class="bell-badge mono">{{ store.unread > 99 ? '99+' : store.unread }}</span>
    </button>

    <div v-if="store.open" class="bell-panel">
      <div class="bell-panel__head">
        <span class="card-title-sm">ศูนย์แจ้งเตือน</span>
        <span v-if="store.unread" class="pill pill--mono" style="background: #fdecec; color: #a12626">
          {{ store.unread }} ใหม่
        </span>
        <div class="flex-fill"></div>
        <button type="button" class="link-btn" @click="store.markAllRead()">อ่านทั้งหมด</button>
      </div>

      <div class="bell-panel__list">
        <p v-if="!store.items.length" class="empty-state mb-0">ยังไม่มีการแจ้งเตือน</p>
        <button
          v-for="n in store.items"
          :key="n._id"
          type="button"
          class="bell-item"
          :class="{ 'is-unread': !n.read }"
          @click="openItem(n)"
        >
          <span class="bell-item__dot" :style="{ background: n.read ? '#d2d8dd' : notifTint(n.tag).dot }"></span>
          <span class="d-flex flex-column gap-1 min-w-0">
            <span class="d-flex align-items-center gap-2">
              <span class="pill pill--mono" :style="{ background: notifTint(n.tag).bg, color: notifTint(n.tag).fg }">{{ n.tag }}</span>
              <span class="mono bell-item__time">{{ relTime(n.createdAt) }}</span>
            </span>
            <span class="bell-item__title">{{ n.title }}</span>
            <span class="bell-item__body">{{ n.body }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bell-wrap { position: relative; }
.bell-btn {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: var(--radius);
  border: 1px solid var(--line-strong); background: #fff;
  cursor: pointer; color: var(--ink-3);
}
.bell-btn.is-open { background: var(--brand-tint); border-color: var(--brand); }
.bell-badge {
  position: absolute; top: -5px; right: -5px;
  min-width: 17px; height: 17px; padding: 0 4px;
  border-radius: 20px; background: var(--danger); color: #fff;
  font: 600 10px var(--font-mono);
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #fff;
}
.bell-panel {
  position: absolute; top: 44px; right: 0;
  width: min(380px, calc(100vw - 32px));
  z-index: 30;
  background: #fff;
  border: 1px solid rgba(16, 24, 32, 0.12);
  border-radius: var(--radius-lg);
  box-shadow: 0 18px 44px rgba(16, 24, 32, 0.2);
  overflow: hidden;
}
.bell-panel__head {
  padding: 13px 16px;
  border-bottom: 1px solid rgba(16, 24, 32, 0.08);
  display: flex; align-items: center; gap: 10px;
}
.bell-panel__list { max-height: 390px; overflow: auto; display: flex; flex-direction: column; }
.bell-item {
  display: grid; grid-template-columns: 8px 1fr; gap: 11px;
  align-items: start; text-align: left;
  padding: 13px 16px; border: 0;
  border-bottom: 1px solid rgba(16, 24, 32, 0.06);
  background: #fff; cursor: pointer;
}
.bell-item.is-unread { background: var(--surface-4); }
.bell-item:hover { background: var(--surface-3); }
.bell-item__dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; }
.bell-item__time { font: 400 10.5px var(--font-mono); color: var(--muted-3); }
.bell-item__title { font: 500 12.5px var(--font-th); line-height: 1.5; }
.bell-item__body { font: 400 11.5px var(--font-th); color: var(--muted-2); line-height: 1.6; }
.link-btn { padding: 0; border: 0; background: transparent; cursor: pointer; font: 500 11.5px var(--font-th); color: var(--brand-ink); }
.min-w-0 { min-width: 0; }
</style>
