<script setup>
/**
 * กล่องยืนยันของแอปเอง — ใช้แทน window.confirm()
 *
 * เบราว์เซอร์ที่ฝังอยู่ในแอปอื่น (เช่นหน้าตัวอย่างในเครื่องมือพัฒนา) มักบล็อกกล่อง
 * มาตรฐานของเบราว์เซอร์และคืนค่า false ให้เงียบ ๆ ทำให้ปุ่มอย่าง "ยกเลิกตั๋วงาน"
 * กดแล้วไม่มีอะไรเกิดขึ้นเลย จึงต้องวาดกล่องยืนยันเองเพื่อให้ทำงานได้ทุกที่
 */
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div v-if="ui.confirmBox" class="confirm-overlay" @click.self="ui.resolveConfirm(false)">
    <div class="confirm-card" role="alertdialog" aria-modal="true">
      <h2 class="confirm-title">{{ ui.confirmBox.title }}</h2>
      <p v-if="ui.confirmBox.text" class="confirm-text">{{ ui.confirmBox.text }}</p>
      <div class="d-flex gap-2">
        <button class="btn-ghost flex-fill py-3" type="button" @click="ui.resolveConfirm(false)">
          {{ ui.confirmBox.cancelLabel }}
        </button>
        <button
          class="flex-fill py-3"
          :class="ui.confirmBox.danger ? 'btn-danger' : 'btn-brand'"
          type="button"
          @click="ui.resolveConfirm(true)"
        >
          {{ ui.confirmBox.okLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed; inset: 0; z-index: 1080;
  background: rgba(10, 18, 26, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.confirm-card {
  width: 100%; max-width: 400px; background: #fff;
  border-radius: var(--radius-xl); padding: 26px 26px 22px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}
.confirm-title { font: 600 17px var(--font-th); letter-spacing: -0.2px; margin: 0; }
.confirm-text { font: 400 12.5px/1.85 var(--font-th); color: var(--muted); margin: 0; }
.btn-danger {
  border: 1px solid var(--danger-ink); border-radius: var(--radius-md);
  background: var(--danger-ink); color: #fff;
  font: 600 13px var(--font-th); cursor: pointer;
}
.btn-danger:hover { filter: brightness(1.08); }
</style>
