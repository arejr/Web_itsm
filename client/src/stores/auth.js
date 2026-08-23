import { defineStore } from 'pinia';
import api, { errMsg } from '@/services/api';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { ROLE_LABEL, ROLE_LABEL_EN } from '@/services/lookups';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('itsm_token') || '',
    loading: false,
    ready: false,
    _restoring: null
  }),
  getters: {
    isAuthed: (s) => !!s.user,
    role: (s) => s.user?.role || 'employee',
    roleLabel: (s) => ROLE_LABEL[s.user?.role] || '',
    roleLabelEn: (s) => ROLE_LABEL_EN[s.user?.role] || '',
    initial: (s) => (s.user?.name || '?').charAt(0),
    isAdmin: (s) => s.user?.role === 'admin',
    isHelpdesk: (s) => s.user?.role === 'helpdesk',
    isTech: (s) => s.user?.role === 'tech',
    isEmployee: (s) => s.user?.role === 'employee',
    // ทีมงาน IT ทั้งหมด (ทำงานกับตั๋วได้)
    isStaff: (s) => ['admin', 'helpdesk', 'tech'].includes(s.user?.role)
  },
  actions: {
    async login(username, password) {
      this.loading = true;
      try {
        const { data } = await api.post('/auth/login', { username, password });
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('itsm_token', data.token);
        connectSocket(data.token);
        return { ok: true };
      } catch (err) {
        return { ok: false, message: errMsg(err, 'เข้าสู่ระบบไม่สำเร็จ') };
      } finally {
        this.loading = false;
      }
    },

    // เรียกตอนเปิดแอปเพื่อกู้เซสชันจาก token ที่เก็บไว้
    // ถูกเรียกทั้งจาก router guard และ onMounted — ต้องกันไม่ให้ทำงานซ้อนกัน
    // ไม่งั้นจะต่อ socket สองครั้งจนตัวแรกถูกตัดทิ้งพร้อม listener ที่ผูกไว้
    async restore() {
      if (this._restoring) return this._restoring;
      if (this.ready) return;
      this._restoring = this._doRestore().finally(() => { this._restoring = null; });
      return this._restoring;
    },

    async _doRestore() {
      if (!this.token) {
        this.ready = true;
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        this.user = data.user;
        connectSocket(this.token);
      } catch {
        this.token = '';
        localStorage.removeItem('itsm_token');
      } finally {
        this.ready = true;
      }
    },

    logout() {
      this.user = null;
      this.token = '';
      localStorage.removeItem('itsm_token');
      disconnectSocket();
    }
  }
});
