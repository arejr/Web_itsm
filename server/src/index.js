require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSockets } = require('./sockets');
const { platformOrigins } = require('./config/origins');

const PORT = process.env.PORT || 4000;

/**
 * ตรวจการตั้งค่าที่จำเป็น — คืนรายการปัญหาที่พบ ไม่สั่งปิดโปรเซส
 *
 * ห้าม process.exit() ตรงนี้เด็ดขาด เพราะถ้าโปรเซสตายก่อนเปิดพอร์ต
 * PaaS จะขึ้นแค่ "Healthcheck failure / Service offline" โดยไม่มีทางรู้ว่าขาดค่าไหน
 * จึงต้องเปิดเซิร์ฟเวอร์ให้ได้ก่อน แล้วรายงานปัญหาผ่าน /api/health แทน
 */
function checkProductionConfig() {
  const problems = [];
  if (process.env.NODE_ENV !== 'production') return problems;

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this')) {
    problems.push({
      key: 'JWT_SECRET',
      message: 'ยังไม่ได้ตั้ง JWT_SECRET (หรือยังเป็นค่าเริ่มต้น)',
      fix: 'สร้างค่าสุ่มด้วย: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))" แล้วนำไปใส่ใน Variables'
    });
  }

  if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
    problems.push({
      key: 'MONGO_URL',
      message: 'ไม่พบทั้ง MONGODB_URI และ MONGO_URL — ระบบไม่รู้ว่าจะต่อฐานข้อมูลที่ไหน',
      fix: 'Railway: เพิ่ม MongoDB ด้วยปุ่ม + New บน Canvas แล้วที่ service เว็บไปที่ Variables → Add Variable Reference → เลือก MONGO_URL'
    });
  }

  const auto = platformOrigins();
  if (auto.length) {
    console.log(`[web] โดเมนที่อนุญาตอัตโนมัติ: ${auto.join(', ')}`);
  } else if (!process.env.CLIENT_ORIGIN) {
    console.warn('[warn] ไม่พบทั้ง CLIENT_ORIGIN และโดเมนที่ host ตั้งให้');
    console.warn('[warn] คำขอจากโดเมนเดียวกับที่เสิร์ฟหน้าเว็บยังใช้ได้ แต่ถ้าแยก host กันต้องตั้ง CLIENT_ORIGIN');
  }

  return problems;
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
 * ปรับข้อมูลเก่าให้เข้ากับค่าที่ระบบใช้อยู่ตอนนี้ — ทำทุกครั้งที่ต่อฐานข้อมูลสำเร็จ
 * ตั๋วเก่าบนฐานข้อมูลจริงยังถือค่าเดิมอยู่ ถ้าไม่ปรับ หน้าเว็บจะแสดงคำเก่าปนกัน
 * และสถานะที่เลิกใช้แล้วจะทำให้ mongoose ตีว่าค่าไม่ถูกต้องตอนบันทึกครั้งถัดไป
 */
async function runMigrations() {
  const Ticket = require('./models/Ticket');

  const status = await Ticket.updateMany(
    { status: 'pending' },
    { $set: { status: 'inprogress', statusReason: 'กำลังดำเนินการ' } }
  );
  if (status.modifiedCount) {
    console.log(`[migrate] ย้ายตั๋วจากสถานะรอข้อมูลไปกำลังดำเนินการ ${status.modifiedCount} รายการ`);
  }

  const type = await Ticket.updateMany(
    { incidentType: 'User Service Restoration' },
    { $set: { incidentType: 'Incident' } }
  );
  if (type.modifiedCount) {
    console.log(`[migrate] เปลี่ยนประเภทเหตุการณ์เป็น Incident ${type.modifiedCount} รายการ`);
  }
}

/**
 * ต่อฐานข้อมูลแบบพยายามซ้ำ
 * แยกออกจากการเปิดเซิร์ฟเวอร์ เพื่อไม่ให้โปรเซสดับทันทีเมื่อฐานข้อมูลยังไม่พร้อม
 * (บน PaaS ฐานข้อมูลมักสตาร์ตช้ากว่าแอป และถ้าโปรเซสดับ healthcheck จะไม่มีวันผ่าน
 *  ทำให้เห็นแค่ "Healthcheck failure" โดยไม่รู้สาเหตุที่แท้จริง)
 */
async function connectWithRetry() {
  const MAX_DELAY = 30000;
  let attempt = 0;

  for (;;) {
    attempt += 1;
    try {
      await connectDB();
      app.set('dbError', null);
      await runMigrations();
      await seedIfEmpty();
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
  const problems = checkProductionConfig();
  app.set('configErrors', problems);

  const server = http.createServer(app);
  const io = initSockets(server);
  app.set('io', io);

  // เปิดเซิร์ฟเวอร์ก่อนเสมอ เพื่อให้ /api/health ตอบได้และบอกสาเหตุได้ทันที
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[api] listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);

  if (problems.length) {
    console.error('┌─────────────────────────────────────────────────────────────');
    console.error('│ ตั้งค่าไม่ครบ — เว็บจะเปิดได้แต่ยังใช้งานไม่ได้จนกว่าจะแก้');
    problems.forEach((p, i) => {
      console.error(`│ ${i + 1}. [${p.key}] ${p.message}`);
      console.error(`│    วิธีแก้: ${p.fix}`);
    });
    console.error('│ ดูสถานะล่าสุดได้ที่ /api/health');
    console.error('└─────────────────────────────────────────────────────────────');
    return; // ไม่ต่อฐานข้อมูล แต่ยังเปิดพอร์ตค้างไว้ให้ตรวจสอบได้
  }

  await connectWithRetry();
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
