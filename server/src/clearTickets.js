/**
 * ล้างข้อมูลการใช้งานออกจากฐานข้อมูล
 *   npm run clear:tickets   ล้างตั๋วงาน (พร้อมแชทและการแจ้งเตือนที่ผูกอยู่)
 *   npm run clear:kb        ล้างบทความฐานความรู้
 *   npm run clear:all       ล้างทั้งสองอย่าง
 *
 * เก็บไว้เสมอ: ผู้ใช้งาน · หมวดหมู่ · ประกาศ
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');

const Ticket = require('./models/Ticket');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const Counter = require('./models/Counter');
const Article = require('./models/Article');

async function clearTickets() {
  const before = await Ticket.countDocuments();

  const [tickets, messages, notifs] = await Promise.all([
    Ticket.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({ ticket: { $ne: null } })
  ]);

  // ตัดการอ้างอิงตั๋วต้นทางออกจากบทความฐานความรู้ที่ยังเก็บไว้
  await Article.updateMany({ sourceTicket: { $ne: null } }, { $unset: { sourceTicket: 1 } });

  // รีเซ็ตตัวนับ เพื่อให้เลขตั๋วเริ่มนับใหม่จาก 000001
  await Counter.deleteMany({ _id: /^ticket-/ });

  console.log(`[clear] ลบตั๋วงาน ${tickets.deletedCount} รายการ (เดิมมี ${before})`);
  console.log(`[clear] ลบข้อความแชท ${messages.deletedCount} รายการ`);
  console.log(`[clear] ลบการแจ้งเตือนที่ผูกกับตั๋ว ${notifs.deletedCount} รายการ`);
  console.log('[clear] รีเซ็ตตัวนับเลขตั๋ว — ตั๋วใบถัดไปจะเริ่มที่ 000001');
  console.log('[clear] คงไว้: ผู้ใช้งาน · หมวดหมู่ · ประกาศ · ฐานความรู้');
}

async function clearArticles() {
  const before = await Article.countDocuments();
  const res = await Article.deleteMany({});

  // ตัดสถานะ "เผยแพร่เข้า KB แล้ว" ออกจากตั๋วงาน เพื่อไม่ให้ชี้ไปยังบทความที่ถูกลบ
  await Ticket.updateMany({ publishedToKb: true }, { $set: { publishedToKb: false } });

  // รีเซ็ตตัวนับ เพื่อให้เลขบทความเริ่มนับใหม่จาก KB-0001
  await Counter.deleteMany({ _id: 'kb' });

  console.log(`[clear] ลบบทความฐานความรู้ ${res.deletedCount} รายการ (เดิมมี ${before})`);
  console.log('[clear] รีเซ็ตตัวนับ — บทความถัดไปจะเริ่มที่ KB-0001');
  console.log('[clear] คงไว้: ตั๋วงาน · ผู้ใช้งาน · หมวดหมู่ · ประกาศ');
}

module.exports = { clearTickets, clearArticles };

if (require.main === module) {
  const what = process.argv[2] || 'tickets'; // tickets | kb | all
  const run = async () => {
    if (what === 'tickets' || what === 'all') await clearTickets();
    if (what === 'kb' || what === 'all') await clearArticles();
  };

  connectDB()
    .then(run)
    .then(() => mongoose.disconnect())
    .then(() => console.log('\n[clear] เสร็จสิ้น'))
    .catch((err) => {
      console.error('[clear] ล้มเหลว:', err.message);
      process.exit(1);
    });
}
