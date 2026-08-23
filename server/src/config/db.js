const mongoose = require('mongoose');

const DEFAULT_DB = process.env.MONGODB_DB || 'itsm';

/**
 * ทำให้ connection string ใช้งานได้ไม่ว่าจะมาจากที่ไหน
 *
 * Railway ให้ MONGO_URL มาแบบไม่ระบุชื่อฐานข้อมูล เช่น
 *   mongodb://mongo:pass@mongodb.railway.internal:27017
 * ถ้าเติม /itsm เข้าไปเฉย ๆ ไดรเวอร์จะไปยืนยันรหัสผ่านกับฐานข้อมูล itsm
 * แต่ผู้ใช้ root ของ MongoDB อยู่ใน admin จึงขึ้น "Authentication failed"
 * จึงต้องระบุ authSource=admin ไปด้วยเมื่อเราเป็นฝ่ายเติมชื่อฐานข้อมูลเอง
 */
function normalizeUri(raw) {
  let uri = raw;

  // ตัด scheme ออกก่อนเพื่อดูว่ามีชื่อฐานข้อมูลต่อท้าย host หรือยัง
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const hasDbName = /\/[^/?]+(\?|$)/.test(withoutScheme);
  const hasCredentials = /^[^/@]+:[^/@]*@/.test(withoutScheme);

  let appendedDb = false;
  if (!hasDbName) {
    uri = uri.replace(/\/?(\?|$)/, `/${DEFAULT_DB}$1`);
    appendedDb = true;
  }

  // เติม authSource เฉพาะกรณีที่เราเติมชื่อฐานข้อมูลเอง มีรหัสผ่าน และยังไม่ได้ระบุไว้
  if (appendedDb && hasCredentials && !/[?&]authSource=/i.test(uri)) {
    uri += (uri.includes('?') ? '&' : '?') + `authSource=${process.env.MONGODB_AUTH_SOURCE || 'admin'}`;
  }

  return uri;
}

// ซ่อนรหัสผ่านก่อนเขียนลง log
function maskUri(uri) {
  return uri.replace(/\/\/([^:/@]+):([^@]*)@/, '//$1:****@');
}

async function connectDB() {
  // Railway ตั้ง MONGO_URL ให้เองเมื่อผูก MongoDB service เข้ากับ project
  // จึงรองรับทั้งสองชื่อ โดย MONGODB_URI มาก่อนถ้าตั้งไว้เอง
  const raw = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/itsm';
  const uri = normalizeUri(raw);

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`[db] connected: ${maskUri(uri)}`);
  return mongoose.connection;
}

module.exports = { connectDB, normalizeUri, maskUri };
