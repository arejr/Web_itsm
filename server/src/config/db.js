const mongoose = require('mongoose');

async function connectDB() {
  // Railway ตั้ง MONGO_URL ให้เองเมื่อผูก MongoDB service เข้ากับ project
  // จึงรองรับทั้งสองชื่อ โดย MONGODB_URI มาก่อนถ้าตั้งไว้เอง
  const raw = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/itsm';

  // MONGO_URL ของ Railway ไม่ได้ระบุชื่อฐานข้อมูลมาด้วย — เติม /itsm ให้
  const uri = /\/[^/?]+(\?|$)/.test(raw.replace(/^mongodb(\+srv)?:\/\//, ''))
    ? raw
    : raw.replace(/\/?(\?|$)/, '/itsm$1');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`[db] connected: ${uri.replace(/\/\/.*@/, '//***@')}`);
  return mongoose.connection;
}

module.exports = { connectDB };
