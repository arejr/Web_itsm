import { defineStore } from 'pinia';

let seq = 0;
let pendingConfirm = null;

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    sidebarOpen: false,
    confirmBox: null
  }),
  actions: {
    toast(message, kind = 'info', ms = 3800) {
      const id = ++seq;
      this.toasts.push({ id, message, kind });
      setTimeout(() => this.dismiss(id), ms);
    },
    success(message) { this.toast(message, 'ok'); },
    error(message) { this.toast(message, 'err', 5000); },
    dismiss(id) { this.toasts = this.toasts.filter((t) => t.id !== id); },
    /**
     * ถามยืนยันด้วยกล่องของแอปเอง แล้วคืนค่า true/false แบบ await ได้
     * ใช้แทน window.confirm() ที่เบราว์เซอร์ฝังในแอปอื่นมักบล็อกจนกดปุ่มแล้วไม่มีอะไรเกิดขึ้น
     */
    confirm({ title, text = '', okLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก', danger = false }) {
      this.resolveConfirm(false); // ปิดกล่องเดิมที่ยังค้างอยู่ก่อน
      this.confirmBox = { title, text, okLabel, cancelLabel, danger };
      return new Promise((resolve) => { pendingConfirm = resolve; });
    },
    resolveConfirm(answer) {
      const done = pendingConfirm;
      pendingConfirm = null;
      this.confirmBox = null;
      if (done) done(answer);
    },
    toggleSidebar(force) {
      this.sidebarOpen = force === undefined ? !this.sidebarOpen : force;
    }
  }
});
