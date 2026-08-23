import { defineStore } from 'pinia';
import api from '@/services/api';
import { onSocket } from '@/services/socket';

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    items: [],
    unread: 0,
    open: false,
    bound: false
  }),
  actions: {
    async load() {
      const { data } = await api.get('/notifications');
      this.items = data.items;
      this.unread = data.unread;
    },
    // รับการแจ้งเตือนแบบเรียลไทม์ผ่าน socket
    bind() {
      if (this.bound) return;
      this.bound = true;
      onSocket('notification:new', (n) => {
        this.items.unshift(n);
        this.items = this.items.slice(0, 50);
        this.unread += 1;
      });
    },
    async markRead(id) {
      const item = this.items.find((n) => n._id === id);
      if (item && !item.read) {
        item.read = true;
        this.unread = Math.max(0, this.unread - 1);
        await api.patch(`/notifications/${id}/read`).catch(() => {});
      }
    },
    async markAllRead() {
      this.items.forEach((n) => { n.read = true; });
      this.unread = 0;
      await api.patch('/notifications/read-all').catch(() => {});
    },
    toggle(force) {
      this.open = force === undefined ? !this.open : force;
    },
    reset() {
      this.items = [];
      this.unread = 0;
    }
  }
});
