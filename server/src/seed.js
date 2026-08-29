/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');

const User = require('./models/User');
const Category = require('./models/Category');
const Ticket = require('./models/Ticket');
const Message = require('./models/Message');
const Article = require('./models/Article');
const Announcement = require('./models/Announcement');
const Notification = require('./models/Notification');
const Counter = require('./models/Counter');

const { PRIORITY_SLA_MINUTES, PRIORITY_LABEL } = require('./config/constants');

const DEFAULT_PASSWORD = 'Password123!';
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

async function seedDatabase() {
  console.log('[seed] ล้างข้อมูลเดิม...');
  await Promise.all([
    User.deleteMany({}), Category.deleteMany({}), Ticket.deleteMany({}),
    Message.deleteMany({}), Article.deleteMany({}), Announcement.deleteMany({}),
    Notification.deleteMany({}), Counter.deleteMany({})
  ]);

  /* ---------- หมวดหมู่ปัญหา ---------- */
  const categories = await Category.create([
    { key: 'hardware', label: 'Hardware', color: '#c0392b', slaHours: 4, order: 0,
      description: 'เครื่องคอม อุปกรณ์ต่อพ่วง เครื่องพิมพ์', defaultGroup: 'Desktop Support' },
    { key: 'software', label: 'Software', color: '#14776b', slaHours: 8, order: 1,
      description: 'โปรแกรมองค์กร ระบบภายใน', defaultGroup: 'Application Support' },
    { key: 'network', label: 'Network', color: '#7b5cd6', slaHours: 4, order: 2,
      description: 'เครือข่าย Wi-Fi VPN', defaultGroup: 'Infrastructure' },
    { key: 'account', label: 'บัญชี/สิทธิ์', color: '#d97706', slaHours: 24, order: 3,
      description: 'สิทธิ์เข้าถึง รหัสผ่าน อีเมล', defaultGroup: 'Infrastructure' },
    { key: 'other', label: 'อื่น ๆ', color: '#69737b', slaHours: 48, order: 4,
      description: 'ที่ไม่เข้าหมวดข้างต้น', defaultGroup: 'IT Helpdesk' }
  ]);
  const cat = Object.fromEntries(categories.map((c) => [c.key, c]));
  console.log(`[seed] หมวดหมู่ ${categories.length} รายการ`);

  /* ---------- ผู้ใช้งาน ---------- */
  const userSpecs = [
    { employeeId: 'ADM001', name: 'วราภรณ์ ชัยพร', email: 'waraporn.c@company.co.th', role: 'admin',
      department: 'ศูนย์บริการ IT', group: 'IT Management', phone: '02-535-1100', contact: 'ต่อ 1100', orgCode: 'BKKIT' },
    { employeeId: 'HD001', name: 'พิมพ์ชนก ดีใจ', email: 'pimchanok.d@company.co.th', role: 'helpdesk',
      department: 'ศูนย์บริการ IT', group: 'IT Helpdesk', skill: 'คัดกรอง / แก้ปัญหาเบื้องต้น',
      phone: '02-535-1150', contact: 'ต่อ 1150', orgCode: 'BKKIT' },
    { employeeId: 'HD002', name: 'ชนกันต์ พูลสุข', email: 'chanakan.p@company.co.th', role: 'helpdesk',
      department: 'ศูนย์บริการ IT', group: 'IT Helpdesk', skill: 'คัดกรอง / ประสานงาน',
      phone: '02-535-1151', contact: 'ต่อ 1151', orgCode: 'BKKIT' },
    { employeeId: 'IT001', name: 'ธนวัฒน์ ศรีสุข', email: 'thanawat.s@company.co.th', role: 'tech',
      department: 'ศูนย์บริการ IT', group: 'Desktop Support', skill: 'Desktop / Hardware',
      phone: '02-535-1201', contact: 'ต่อ 1201', orgCode: 'BKKIT' },
    { employeeId: 'IT002', name: 'ปิยะพงษ์ วรกุล', email: 'piyapong.w@company.co.th', role: 'tech',
      department: 'ศูนย์บริการ IT', group: 'Application Support', skill: 'Application / ERP',
      phone: '02-535-1202', contact: 'ต่อ 1202', orgCode: 'BKKIT' },
    { employeeId: 'IT003', name: 'ศิริพร มณีรัตน์', email: 'siriporn.m@company.co.th', role: 'tech',
      department: 'ศูนย์บริการ IT', group: 'Infrastructure', skill: 'Network / Wi-Fi',
      phone: '02-535-1203', contact: 'ต่อ 1203', orgCode: 'BKKIT' },
    { employeeId: 'EMP101', name: 'อัสนียา นาคสิงห์', email: 'asniya.n@company.co.th', role: 'employee',
      department: 'ฝ่ายบัญชี', phone: '02-535-3240', contact: 'ต่อ 1313 / LINE: asniya', orgCode: 'BKKDB' },
    { employeeId: 'EMP102', name: 'กฤต จุฑา', email: 'krit.c@company.co.th', role: 'employee',
      department: 'ฝ่ายบุคคล', phone: '02-535-7420', contact: 'ต่อ 1220', orgCode: 'BKKDX' },
    { employeeId: 'EMP103', name: 'สุชาดา ทองแท้', email: 'suchada.t@company.co.th', role: 'employee',
      department: 'ฝ่ายการตลาด', phone: '02-535-3399', contact: 'ต่อ 1702', orgCode: 'BKKMK' },
    { employeeId: 'EMP104', name: 'ณัฐพล อินทรา', email: 'nattapon.i@company.co.th', role: 'employee',
      department: 'ฝ่ายการเงิน', phone: '02-535-3120', contact: 'ต่อ 1408', orgCode: 'BKKFN' },
    { employeeId: 'EMP105', name: 'สมชาย ใจดี', email: 'somchai.j@company.co.th', role: 'employee',
      department: 'ฝ่ายคลังสินค้า', phone: '02-535-3550', contact: 'ต่อ 1905', orgCode: 'BKKWH', active: false }
  ];

  const users = [];
  for (const spec of userSpecs) {
    users.push(await User.create({ ...spec, password: DEFAULT_PASSWORD }));
  }
  const by = Object.fromEntries(users.map((u) => [u.employeeId, u]));
  console.log(`[seed] ผู้ใช้งาน ${users.length} คน (รหัสผ่านเริ่มต้น: ${DEFAULT_PASSWORD})`);

  /* ---------- ประกาศ ---------- */
  await Announcement.create([
    { title: 'ปิดปรับปรุงระบบ HR Portal', tag: 'กำลังจะถึง', published: true,
      whenText: 'เสาร์ 29 ส.ค. 22:00 – อาทิตย์ 02:00 น.',
      body: 'ปิดปรับปรุงระบบ HR Portal ระหว่างนี้ตั๋วงานที่เกี่ยวข้องจะถูกพักไว้อัตโนมัติ',
      startAt: new Date('2026-08-29T22:00:00+07:00'), endAt: new Date('2026-08-30T02:00:00+07:00'),
      createdBy: by.ADM001._id },
    { title: 'อัปเกรดสวิตช์เครือข่ายอาคาร 2', tag: 'ร่าง', published: false, whenText: 'ยังไม่กำหนดวันเวลา',
      body: 'เตรียมอัปเกรด core switch อาคาร 2 คาดว่าใช้เวลา 2 ชั่วโมง', createdBy: by.ADM001._id }
  ]);

  /* ---------- ตั๋วงาน ----------
     ระบบเริ่มต้นด้วยคิวงานว่าง — ตั๋วงานจะถูกสร้างจากการใช้งานจริงเท่านั้น
     (พนักงานแจ้งปัญหา หรือ Helpdesk ออกตั๋วแทนผู้แจ้ง)
     เลขตั๋วจะเริ่มนับจาก INC-<ปี>-000001
  */
  console.log('[seed] ตั๋วงาน 0 รายการ (เริ่มต้นด้วยคิวงานว่าง)');


  /* ---------- ฐานความรู้ ----------
     เริ่มต้นด้วยฐานความรู้ว่าง — บทความจะถูกสร้างจากการใช้งานจริง
     โดยติ๊ก "เผยแพร่เข้าฐานความรู้ (KB)" ตอนบันทึก Resolution Note ปิดตั๋วงาน
     หรือกดปุ่ม "+ เพิ่มบทความ" ในหน้าฐานความรู้
  */
  console.log('[seed] บทความฐานความรู้ 0 รายการ (เริ่มต้นด้วยฐานความรู้ว่าง)');


  /* ---------- การแจ้งเตือน ----------
     ไม่สร้างแจ้งเตือนตั้งต้น — ศูนย์แจ้งเตือนจะมีเฉพาะเรื่องที่ผูกกับตั๋วงานจริง
     ประกาศของระบบแสดงเป็นแบนเนอร์บนหัวเว็บอยู่แล้ว ไม่ต้องซ้ำในแจ้งเตือน
  */

  console.log('\n=== บัญชีสำหรับทดสอบ (รหัสผ่านเดียวกันทุกบัญชี: ' + DEFAULT_PASSWORD + ') ===');
  console.log('ผู้ดูแลระบบ      : waraporn.c@company.co.th');
  console.log('IT Helpdesk      : pimchanok.d@company.co.th');
  console.log('เจ้าหน้าที่ IT    : thanawat.s@company.co.th');
  console.log('พนักงานบริษัท    : asniya.n@company.co.th');

  console.log('\n[seed] เสร็จสิ้น');
}

module.exports = { seedDatabase, DEFAULT_PASSWORD };

// เรียกจากบรรทัดคำสั่งโดยตรง:  npm run seed
if (require.main === module) {
  connectDB()
    .then(seedDatabase)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('[seed] ล้มเหลว:', err);
      process.exit(1);
    });
}
