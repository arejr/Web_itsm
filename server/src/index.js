require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSockets } = require('./sockets');
const { startSlaMonitor } = require('./jobs/slaMonitor');

const PORT = process.env.PORT || 4000;

function checkProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const weak = !process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this');
  if (weak) {
    console.error('[fatal] ต้องตั้งค่า JWT_SECRET ให้เป็นค่าลับของตัวเองก่อนใช้งานจริง');
    process.exit(1);
  }
  if (!process.env.CLIENT_ORIGIN) {
    console.warn('[warn] ยังไม่ได้ตั้ง CLIENT_ORIGIN — ระบบจะอนุญาตเฉพาะ localhost:5173 เท่านั้น');
  }
}

// Render แพ็กเกจฟรีไม่มี shell ให้รัน `npm run seed` เอง
// ตั้ง SEED_ON_START=true ไว้ ระบบจะใส่ข้อมูลตั้งต้นให้ครั้งเดียวตอนฐานข้อมูลยังว่าง
async function seedIfEmpty() {
  if (String(process.env.SEED_ON_START).toLowerCase() !== 'true') return;
  const User = require('./models/User');
  const count = await User.estimatedDocumentCount();
  if (count > 0) {
    console.log('[seed] มีข้อมูลอยู่แล้ว — ข้ามการใส่ข้อมูลตั้งต้น');
    return;
  }
  console.log('[seed] ฐานข้อมูลว่าง — กำลังใส่ข้อมูลตั้งต้น');
  const { seedDatabase } = require('./seed');
  await seedDatabase();
}

async function main() {
  checkProductionConfig();
  await connectDB();
  await seedIfEmpty();

  const server = http.createServer(app);
  const io = initSockets(server);
  app.set('io', io);

  startSlaMonitor(io);

  // ไม่ระบุ host — Node จะฟังทุก interface แบบ dual-stack (รับได้ทั้ง IPv4 และ IPv6)
  // ถ้าระบุ '0.0.0.0' จะรับเฉพาะ IPv4 ทำให้ไคลเอนต์ที่ต่อผ่าน ::1 เชื่อมไม่ได้
  server.listen(PORT, () => {
    console.log(`[api] listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
