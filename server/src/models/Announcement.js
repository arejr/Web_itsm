const mongoose = require('mongoose');

// ประกาศเตือนการปิดปรับปรุงระบบชั่วคราว
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
    tag: { type: String, default: 'กำลังจะถึง' }, // กำลังจะถึง | ร่าง | กำลังดำเนินการ | เสร็จสิ้น
    startAt: { type: Date },
    endAt: { type: Date },
    whenText: { type: String, default: '' },
    published: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
