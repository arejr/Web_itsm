const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function thaiDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${hh}:${mm}`;
}

// แปลงจำนวนนาทีเป็นข้อความกำหนดเสร็จ เช่น "เหลือ 46 นาที" / "เกินกำหนด 2 ชม."
function slaText(minutes, status) {
  if (minutes === null || minutes === undefined) return '—';
  if (status === 'resolved') return minutes >= 0 ? 'ปิดตรงเวลา' : 'ปิดเกินกำหนด';
  if (status === 'cancelled') return 'ยกเลิกแล้ว';
  const abs = Math.abs(minutes);
  const prefix = minutes < 0 ? 'เกินกำหนด ' : 'เหลือ ';
  if (abs < 60) return `${prefix}${abs} นาที`;
  if (abs < 1440) return `${prefix}${Math.round(abs / 60)} ชม.`;
  return `${prefix}${Math.round(abs / 1440)} วัน`;
}

module.exports = { thaiDateTime, slaText, TH_MONTHS };
