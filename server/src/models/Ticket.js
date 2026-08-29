const mongoose = require('mongoose');
const { PRIORITIES, STATUSES, CHANNELS } = require('../config/constants');

const attachmentSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    by: { type: String, default: 'ระบบ' },
    byUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kind: { type: String, default: 'info' }, // info | status | assign | priority | resolve | cancel | transfer
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true }, // INC-2026-004182
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    priority: { type: String, enum: PRIORITIES, default: 'medium', index: true },
    status: { type: String, enum: STATUSES, default: 'new', index: true },
    statusReason: { type: String, default: 'รอคัดกรอง' },

    // ผู้แจ้ง — เก็บทั้ง ref และ snapshot เผื่อกรณี Helpdesk ออกตั๋วแทนคนนอกระบบ
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requesterName: { type: String, default: '' },
    requesterDept: { type: String, default: '' },
    requesterEmail: { type: String, default: '' },
    requesterPhone: { type: String, default: '' },
    contact: { type: String, default: '' },
    company: { type: String, default: 'สำนักงานใหญ่' },
    orgCode: { type: String, default: '' },

    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    group: { type: String, default: '' },

    // ข้อมูลเชิงเทคนิคของ Incident record
    incidentType: { type: String, default: 'Incident' },
    service: { type: String, default: '' },
    opCategory: { type: String, default: 'Failure' },
    productCategory: { type: String, default: '' },
    asset: { type: String, default: '' },
    location: { type: String, default: '' },
    channel: { type: String, enum: CHANNELS, default: 'เว็บไซต์' },

    attachments: [attachmentSchema],
    timeline: [timelineSchema],

    // กำหนดเสร็จ
    slaDueAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    firstResponseAt: { type: Date },

    resolutionNote: { type: String, default: '' },
    publishedToKb: { type: Boolean, default: false },

    isDraft: { type: Boolean, default: false }
  },
  { timestamps: true }
);

ticketSchema.index({ title: 'text', description: 'text', code: 'text', requesterName: 'text' });

// เวลาที่เหลือก่อนถึงกำหนดเสร็จ (นาที) — ค่าลบคือเกินกำหนดแล้ว
ticketSchema.virtual('slaRemainingMinutes').get(function () {
  if (!this.slaDueAt) return null;
  const ref = this.resolvedAt || new Date();
  return Math.round((this.slaDueAt.getTime() - ref.getTime()) / 60000);
});

ticketSchema.virtual('slaBreached').get(function () {
  const m = this.slaRemainingMinutes;
  return m !== null && m < 0;
});

// ใกล้เกินกำหนด เมื่อเหลือน้อยกว่า 4 ชั่วโมง หรือเลยกำหนดแล้ว
ticketSchema.virtual('slaRisk').get(function () {
  if (['resolved', 'cancelled'].includes(this.status)) return false;
  const m = this.slaRemainingMinutes;
  if (m === null) return false;
  return m < 0 || m <= 240;
});

ticketSchema.set('toJSON', { virtuals: true });
ticketSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Ticket', ticketSchema);
