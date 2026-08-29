/* ตารางแปลงค่าคงที่ → ป้ายกำกับและสีตามดีไซน์ */

export const PRIORITY = {
  critical: { label: 'Critical', dot: '#c0392b', fg: '#a12626', bg: '#fdecec', th: 'วิกฤต' },
  high: { label: 'High', dot: '#d97706', fg: '#9a5b06', bg: '#fdf3e3', th: 'สูง' },
  medium: { label: 'Medium', dot: '#14776b', fg: '#0f6a5f', bg: '#e4f1ee', th: 'ปานกลาง' },
  low: { label: 'Low', dot: '#6cb33f', fg: '#4a7f22', bg: '#eef6e4', th: 'ต่ำ' }
};
export const PRIORITY_ORDER = ['low', 'medium', 'high', 'critical'];

export const STATUS = {
  new: { label: 'ตั๋วใหม่', fg: '#9a5b06', bg: '#fdf3e3', dot: '#d97706' },
  assigned: { label: 'มอบหมายแล้ว', fg: '#0f6a5f', bg: '#e4f1ee', dot: '#14776b' },
  inprogress: { label: 'กำลังดำเนินการ', fg: '#0f6a5f', bg: '#e4f1ee', dot: '#14776b' },
  resolved: { label: 'แก้ไขสำเร็จ', fg: '#5a9c33', bg: '#eef6e4', dot: '#5a9c33' },
  cancelled: { label: 'ยกเลิก', fg: '#545e66', bg: '#f2f4f6', dot: '#8a939b' }
};
export const STATUS_TRACK = [
  { key: 'new', label: 'รับเรื่อง' },
  { key: 'assigned', label: 'มอบหมาย' },
  { key: 'inprogress', label: 'ดำเนินการ' },
  { key: 'resolved', label: 'ปิดงาน' }
];

export const ROLE_LABEL = {
  admin: 'ผู้ดูแลระบบ',
  helpdesk: 'เจ้าหน้าที่รับแจ้งและคัดกรอง',
  tech: 'เจ้าหน้าที่ฝ่าย IT',
  employee: 'พนักงานบริษัท'
};
export const ROLE_LABEL_EN = {
  admin: 'System Administrator',
  helpdesk: 'IT Helpdesk Officer',
  tech: 'IT Support Technician',
  employee: 'Employee'
};
export const ROLE_TINT = {
  admin: { bg: '#fdf3e3', fg: '#9a5b06' },
  helpdesk: { bg: '#e4f1ee', fg: '#0f6a5f' },
  tech: { bg: '#eef6e4', fg: '#4a7f22' },
  employee: { bg: '#f2f4f6', fg: '#4a545c' }
};

export const CHANNELS = ['เว็บไซต์', 'โทรศัพท์', 'Walk-in', 'อีเมล', 'LINE / แชท'];

export const NOTIF_TINT = {
  SLA: { bg: '#fdecec', fg: '#a12626', dot: '#c0392b' },
  Escalation: { bg: '#fdf3e3', fg: '#9a5b06', dot: '#d97706' },
  มอบหมาย: { bg: '#e4f1ee', fg: '#0f6a5f', dot: '#14776b' },
  ข้อความ: { bg: '#e4f1ee', fg: '#0f6a5f', dot: '#14776b' },
  ตั๋วใหม่: { bg: '#fff6e5', fg: '#8a5a08', dot: '#d97706' },
  สถานะ: { bg: '#f2f4f6', fg: '#4a545c', dot: '#69737b' },
  ปิดงาน: { bg: '#eef6e4', fg: '#4a7f22', dot: '#6cb33f' },
  ระบบ: { bg: '#f2f4f6', fg: '#545e66', dot: '#8a939b' }
};

export function prio(key) {
  return PRIORITY[key] || PRIORITY.medium;
}
export function stat(key) {
  return STATUS[key] || STATUS.new;
}
export function notifTint(tag) {
  return NOTIF_TINT[tag] || NOTIF_TINT['ระบบ'];
}
