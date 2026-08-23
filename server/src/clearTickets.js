/**
 * ล้างตั๋วงานทั้งหมดออกจากฐานข้อมูล
 *   npm run clear:tickets
 *
 * ลบ: ตั๋วงาน · ข้อความแชทในตั๋ว · การแจ้งเตือนที่ผูกกับตั๋ว · ตัวนับเลขตั๋ว
 * เก็บไว้: ผู้ใช้งาน · หมวดหมู่ · ประกาศ · กฎอัตโนมัติ · ฐานความรู้
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
  console.log('[clear] คงไว้: ผู้ใช้งาน · หมวดหมู่ · ประกาศ · กฎอัตโนมัติ · ฐานความรู้');
}

module.exports = { clearTickets };

if (require.main === module) {
  connectDB()
    .then(clearTickets)
    .then(() => mongoose.disconnect())
    .then(() => console.log('\n[clear] เสร็จสิ้น'))
    .catch((err) => {
      console.error('[clear] ล้มเหลว:', err.message);
      process.exit(1);
    });
}
