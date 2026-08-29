const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    color: { type: String, default: '#69737b' },
    // กำหนดเสร็จเริ่มต้นของหมวดหมู่ (ชั่วโมง) — ใช้แสดงผลในหน้าตั้งค่าระบบ
    slaHours: { type: Number, default: 24 },
    // กลุ่มงานที่รับผิดชอบหมวดหมู่นี้เป็นค่าเริ่มต้น
    defaultGroup: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
