const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function thDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${hh}:${mm}`;
}

export function thDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function timeOnly(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "2 นาทีที่แล้ว" / "3 ชั่วโมงที่แล้ว"
export function relTime(value) {
  if (!value) return '';
  const diff = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (diff < 1) return 'เมื่อสักครู่';
  if (diff < 60) return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.round(diff / 60)} ชั่วโมงที่แล้ว`;
  if (diff < 2880) return 'เมื่อวาน';
  return thDateTime(value);
}

export function minutesText(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} นาที`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} ชม.`;
  return `${Math.round(minutes / 1440)} วัน`;
}

export function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
