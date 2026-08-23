require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSockets } = require('./sockets');
const { startSlaMonitor } = require('./jobs/slaMonitor');
const { platformOrigins } = require('./config/origins');

const PORT = process.env.PORT || 4000;

function checkProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const weak = !process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this');
  if (weak) {
    console.error('[fatal] ต้องตั้งค่า JWT_SECRET ให้เป็นค่าลับของตัวเองก่อนใช้งานจริง');
    console.error('[fatal] สร้างด้วย: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
    console.error('[fatal] ไม่พบทั้ง MONGODB_URI และ MONGO_URL — ระบบไม่รู้ว่าจะต่อฐานข้อมูลที่ไหน');
    console.error('[fatal] Railway: ผูก MongoDB service เข้ากับ project แล้วเพิ่ม Variable Reference ชื่อ MONGO_URL');
    process.exit(1);
  }

  const auto = platformOrigins();
  if (!process.env.CLIENT_ORIGIN && !auto.length) {
    console.warn('[warn] ไม่พบทั้ง CLIENT_ORIGIN และโดเมนที่ host ตั้งให้');
    console.warn('[warn] คำขอจากโดเมนเดียวกับที่เสิร์ฟหน้าเว็บยังใช้ได้ แต่ถ้าแยก host กันต้องตั้ง CLIENT_ORIGIN');
  } else if (auto.length) {
    console.log(`[web] โดเมนที่อนุญาตอัตโนมัติ: ${auto.join(', ')}`);
  }
}

// ใส่ข้อมูลตั้งต้นให้ครั้งเดียวตอนฐานข้อมูลยังว่าง (Railway/Render แพ็กเกจฟรีไม่มี shell ให้รัน seed เอง)
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

/**
 * ต่อฐานข้อมูลแบบพยายามซ้ำ
 * แยกออกจากการเปิดเซิร์ฟเวอร์ เพื่อไม่ให้โปรเซสดับทันทีเมื่อฐานข้อมูลยังไม่พร้อม
 * (บน PaaS ฐานข้อมูลมักสตาร์ตช้ากว่าแอป และถ้าโปรเซสดับ healthcheck จะไม่มีวันผ่าน
 *  ทำให้เห็นแค่ "Healthcheck failure" โดยไม่รู้สาเหตุที่แท้จริง)
 */
async function connectWithRetry(io) {
  const MAX_DELAY = 30000;
  let attempt = 0;

  for (;;) {
    attempt += 1;
    try {
      await connectDB();
      app.set('dbError', null);
      await seedIfEmpty();
      startSlaMonitor(io);
      return;
    } catch (err) {
      app.set('dbError', err.message);
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 5), MAX_DELAY);
      console.error(`[db] ต่อฐานข้อมูลไม่สำเร็จ (ครั้งที่ ${attempt}): ${err.message}`);
      console.error(`[db] ตรวจว่า MONGO_URL หรือ MONGODB_URI ถูกต้อง แล้วจะลองใหม่ใน ${delay / 1000} วินาที`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function main() {
  checkProductionConfig();

  const server = http.createServer(app);
  const io = initSockets(server);
  app.set('io', io);

  // เปิดเซิร์ฟเวอร์ก่อน เพื่อให้ /api/health ตอบได้และบอกสถานะฐานข้อมูลได้ทันที
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[api] listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);

  await connectWithRetry(io);
}

// ปิดอย่างเรียบร้อยเมื่อ PaaS ส่งสัญญาณให้หยุด
['SIGTERM', 'SIGINT'].forEach((sig) =>
  process.on(sig, async () => {
    console.log(`[api] ได้รับ ${sig} — กำลังปิดการเชื่อมต่อ`);
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  })
);

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
