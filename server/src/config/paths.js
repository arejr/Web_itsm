const fs = require('fs');
const path = require('path');

/**
 * ที่เก็บไฟล์แนบ
 * ค่าเริ่มต้นคือ server/uploads ในโปรเจกต์
 * ตั้ง UPLOAD_DIR เพื่อชี้ไปยัง persistent volume ได้ เช่นบน Railway ตั้งเป็น /data/uploads
 * (ถ้าไม่ทำ ไฟล์แนบจะหายทุกครั้งที่ deploy ใหม่)
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

module.exports = { UPLOAD_DIR, ensureUploadDir };
