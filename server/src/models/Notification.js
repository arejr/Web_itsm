const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tag: { type: String, default: 'ระบบ' }, // ตั๋วใหม่ | มอบหมาย | สถานะ | ข้อความ | ปิดงาน | ระบบ
    title: { type: String, required: true },
    body: { type: String, default: '' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    ticketCode: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
