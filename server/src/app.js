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

// healthcheck — ตอบ 200 เมื่อโปรเซสทำงานอยู่ พร้อมบอกสาเหตุเมื่อระบบยังใช้งานไม่ได้
// (ถ้าให้ตอบ 503 หรือปิดโปรเซสตอนตั้งค่าไม่ครบ PaaS จะขึ้นแค่ "Healthcheck failure"
//  โดยไม่มีทางรู้ว่าขาดค่าไหน จึงต้องตอบ 200 แล้วรายงานปัญหาออกมาแทน)
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || 'unknown';
  const configErrors = req.app.get('configErrors') || [];

  res.json({
    ok: true,
    service: 'itsm-api',
    time: new Date(),
    ready: configErrors.length === 0 && dbState === 'connected',
    db: dbState,
    dbError: dbState === 'connected' ? null : req.app.get('dbError') || null,
    configErrors,
    // จำนวน socket ที่เชื่อมต่ออยู่ — ใช้ตรวจว่าแชทเรียลไทม์ทำงานอยู่จริง
    sockets: req.app.get('io')?.engine?.clientsCount ?? 0
  });
});

// ปิดกั้น API ที่เหลือจนกว่าระบบจะพร้อม
// สำคัญด้านความปลอดภัย: ถ้า JWT_SECRET ยังไม่ถูกตั้ง ต้องไม่ออก token ให้ใครเด็ดขาด
app.use('/api', (req, res, next) => {
  const configErrors = req.app.get('configErrors') || [];
  if (configErrors.length) {
    return res.status(503).json({
      message: 'ระบบยังตั้งค่าไม่ครบ กรุณาติดต่อผู้ดูแลระบบ',
      configErrors
    });
  }

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
