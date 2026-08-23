import { defineStore } from 'pinia';

let seq = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    sidebarOpen: false
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
    toggleSidebar(force) {
      this.sidebarOpen = force === undefined ? !this.sidebarOpen : force;
    }
  }
});
