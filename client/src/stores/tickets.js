import { defineStore } from 'pinia';
import api from '@/services/api';
import { onSocket } from '@/services/socket';

export const useTicketStore = defineStore('tickets', {
  state: () => ({
    items: [],
    current: null,
    loading: false,
    bound: false
  }),
  actions: {
    async load(params = {}) {
      this.loading = true;
      try {
        const { data } = await api.get('/tickets', { params });
        this.items = data;
        return data;
      } finally {
        this.loading = false;
      }
    },
    async fetchOne(id) {
      const { data } = await api.get(`/tickets/${id}`);
      this.current = data;
      return data;
    },
    // อัปเดตรายการในหน่วยความจำเมื่อได้รับ event จาก socket
    upsert(ticket) {
      const idx = this.items.findIndex((t) => t._id === ticket._id);
      if (idx >= 0) this.items.splice(idx, 1, ticket);
      else this.items.unshift(ticket);
      if (this.current?._id === ticket._id) this.current = ticket;
    },
    // เอาตั๋วที่ถูกลบออกจากรายการในหน่วยความจำ
    remove(id) {
      this.items = this.items.filter((t) => t._id !== id);
      if (this.current?._id === id) this.current = null;
    },
    // ผูกครั้งเดียวตลอดอายุหน้า — onSocket จะผูกให้ใหม่เองถ้า socket ถูกสร้างใหม่
    bind() {
      if (this.bound) return;
      this.bound = true;
      onSocket('ticket:created', (t) => this.upsert(t));
      onSocket('ticket:updated', (t) => this.upsert(t));
      onSocket('ticket:deleted', ({ _id }) => this.remove(_id));
    },
    // ไม่รีเซ็ต bound — handler อยู่ในทะเบียนของ socket service และใช้ได้ข้ามเซสชัน
    reset() {
      this.items = [];
      this.current = null;
    }
  }
});
