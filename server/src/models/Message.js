const mongoose = require('mongoose');

// ข้อความแชทแบบเรียลไทม์ภายในตั๋วงาน
const messageSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String, default: '' },
    senderRole: { type: String, default: 'employee' },
    text: { type: String, required: true },
    // ผู้ใช้ที่อ่านข้อความนี้แล้ว
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    system: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
