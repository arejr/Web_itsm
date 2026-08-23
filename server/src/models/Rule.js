const mongoose = require('mongoose');

// กฎมอบหมายอัตโนมัติ / กฎยกระดับ (Escalation) — ทำงานตามลำดับ order จากบนลงล่าง
const ruleSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['ASSIGN', 'ESCALATE'], default: 'ASSIGN' },
    when: { type: String, required: true },
    then: { type: String, required: true },

    // เงื่อนไขที่เครื่องอ่านได้ (ใช้กับกฎ ASSIGN)
    matchCategoryKey: { type: String, default: '' },
    matchPriority: { type: String, default: '' },
    matchLocationLike: { type: String, default: '' },

    // ผลลัพธ์
    assignTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignGroup: { type: String, default: '' },

    // สำหรับ ESCALATE: ยกระดับเมื่อเหลือ SLA ต่ำกว่า % ที่กำหนด หรือค้างเกิน N นาที
    slaRemainingPercent: { type: Number },
    idleMinutes: { type: Number },

    hits: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rule', ruleSchema);
