import { defineStore } from 'pinia';
import api from '@/services/api';

// ข้อมูลอ้างอิงที่ใช้ร่วมกันทุกหน้า: หมวดหมู่, ประกาศ, เจ้าหน้าที่
export const useMetaStore = defineStore('meta', {
  state: () => ({
    categories: [],
    technicians: [],
    announcements: [],
    loaded: false
  }),
  getters: {
    activeBanner: (s) => s.announcements.find((a) => a.published) || null,
    categoryByKey: (s) => Object.fromEntries(s.categories.map((c) => [c.key, c])),
    categoryById: (s) => Object.fromEntries(s.categories.map((c) => [c._id, c]))
  },
  actions: {
    async load(force = false) {
      if (this.loaded && !force) return;
      const [cats, anns] = await Promise.all([
        api.get('/categories').catch(() => ({ data: [] })),
        api.get('/announcements', { params: { active: true } }).catch(() => ({ data: [] }))
      ]);
      this.categories = cats.data;
      this.announcements = anns.data;
      this.loaded = true;
    },
    async loadTechnicians() {
      const { data } = await api.get('/users/technicians').catch(() => ({ data: [] }));
      this.technicians = data;
      return data;
    },
    async loadAnnouncements(all = false) {
      const { data } = await api.get('/announcements', { params: all ? {} : { active: true } });
      this.announcements = data;
      return data;
    }
  }
});
