const { slaText, thaiDateTime } = require('./format');

// เติมฟิลด์ที่คำนวณแล้วให้ frontend ใช้ได้ทันที
function serializeTicket(doc) {
  if (!doc) return null;
  const t = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
  const minutes = t.slaRemainingMinutes ?? null;
  return {
    ...t,
    categoryKey: t.category?.key || null,
    categoryLabel: t.category?.label || 'อื่น ๆ',
    categoryColor: t.category?.color || '#69737b',
    assigneeName: t.assignee?.name || 'ยังไม่มอบหมาย',
    assigneeInitial: (t.assignee?.name || '—').charAt(0),
    requesterDisplay: t.requester?.name || t.requesterName || 'ไม่ระบุชื่อผู้แจ้ง',
    requesterInitial: (t.requester?.name || t.requesterName || '?').charAt(0),
    slaMinutes: minutes,
    slaText: slaText(minutes, t.status),
    createdText: thaiDateTime(t.createdAt),
    updatedText: thaiDateTime(t.updatedAt),
    reportedText: thaiDateTime(t.createdAt)
  };
}

module.exports = { serializeTicket };
