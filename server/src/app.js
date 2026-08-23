const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { UPLOAD_DIR, ensureUploadDir } = require('./config/paths');
const { isOriginAllowed } = require('./config/origins');

const app = express();

// อยู่หลัง reverse proxy (Render / Railway / Nginx) — ให้ Express อ่าน IP และ protocol ที่แท้จริง
app.set('trust proxy', 1);

app.use(
  cors((req, cb) =>
    cb(null, { origin: isOriginAllowed(req.headers.origin, req.headers.host), credentials: true })
  )
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ไฟล์แนบ
ensureUploadDir();
app.use('/uploads', express.static(UPLOAD_DIR));

// healthcheck — ตอบ 200 เมื่อโปรเซสทำงานอยู่ พร้อมบอกสถานะฐานข้อมูล
// (ถ้าให้ตอบ 503 ตอนต่อฐานข้อมูลไม่ได้ PaaS จะรีสตาร์ตวนไปเรื่อย ๆ จนไม่มีใครเห็นสาเหตุ)
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || 'unknown';

  res.json({
    ok: true,
    service: 'itsm-api',
    time: new Date(),
    db: dbState,
    dbError: dbState === 'connected' ? null : req.app.get('dbError') || null,
    // จำนวน socket ที่เชื่อมต่ออยู่ — ใช้ตรวจว่าแชทเรียลไทม์ทำงานอยู่จริง
    sockets: req.app.get('io')?.engine?.clientsCount ?? 0
  });
});

// กันไม่ให้คำขอค้างเมื่อฐานข้อมูลยังไม่พร้อม — ตอบ 503 พร้อมสาเหตุแทน
app.use('/api', (req, res, next) => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState === 1) return next();
  res.status(503).json({
    message: 'ระบบยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง',
    detail: req.app.get('dbError') || 'กำลังเชื่อมต่อ'
  });
});

app.use('/api', routes);

/* ------------------------------------------------------------------
   เสิร์ฟไฟล์ frontend ที่ build แล้ว (deploy แบบเซิร์ฟเวอร์เดียว)
   สร้างด้วย `npm run build` แล้วไฟล์จะอยู่ที่ client/dist
   ถ้าไม่มีโฟลเดอร์นี้ (เช่น deploy แยก host) จะข้ามส่วนนี้ไป
------------------------------------------------------------------- */
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
const hasClientBuild = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

if (hasClientBuild) {
  app.use(express.static(CLIENT_DIST, { maxAge: '1y', index: false }));

  // ทุกเส้นทางที่ไม่ใช่ /api หรือ /uploads ให้ส่ง index.html กลับไปให้ Vue Router จัดการ
  app.get(/^\/(?!api|uploads|socket\.io).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
  console.log('[web] เสิร์ฟไฟล์ frontend จาก client/dist');
} else {
  app.get('/', (req, res) =>
    res.json({
      service: 'itsm-api',
      message: 'API พร้อมใช้งาน — ยังไม่พบไฟล์ frontend ที่ build แล้ว (รัน npm run build ก่อนหากต้องการเสิร์ฟจากเซิร์ฟเวอร์เดียวกัน)'
    })
  );
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
