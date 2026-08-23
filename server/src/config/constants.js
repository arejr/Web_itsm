// ค่าคงที่ที่ใช้ร่วมกันทั้งระบบ (สอดคล้องกับดีไซน์)
const ROLES = ['admin', 'helpdesk', 'tech', 'employee'];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

// เวลาตอบสนองตาม SLA (นาที) ต่อระดับความรุนแรง
const PRIORITY_SLA_MINUTES = {
  critical: 60,        // 1 ชม.
  high: 240,           // 4 ชม.
  medium: 1440,        // 1 วัน
  low: 4320            // 3 วัน
};

const STATUSES = ['new', 'assigned', 'inprogress', 'pending', 'resolved', 'cancelled'];

// ลำดับความคืบหน้าที่ใช้วาดแถบสถานะในหน้ารายละเอียดตั๋ว
const STATUS_TRACK = ['new', 'assigned', 'inprogress', 'pending', 'resolved'];

const CHANNELS = ['เว็บไซต์', 'โทรศัพท์', 'Walk-in', 'อีเมล', 'LINE / แชท'];

module.exports = { ROLES, PRIORITIES, PRIORITY_LABEL, PRIORITY_SLA_MINUTES, STATUSES, STATUS_TRACK, CHANNELS };
