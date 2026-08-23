/**
 * โหมดสาธิต — รัน MongoDB แบบ in-memory แล้วใส่ข้อมูลตัวอย่างให้อัตโนมัติ
 * ใช้เมื่อยังไม่ได้ติดตั้ง MongoDB บนเครื่อง:  npm run dev:memory
 * ข้อมูลจะหายเมื่อปิดโปรเซส — สำหรับใช้งานจริงให้ชี้ MONGODB_URI ไปที่ MongoDB ปกติ
 */
require('dotenv').config();
const http = require('http');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'itsm' } });
  process.env.MONGODB_URI = mongod.getUri('itsm');
  console.log(`[dev] in-memory MongoDB: ${process.env.MONGODB_URI}`);

  const app = require('./app');
  const { connectDB } = require('./config/db');
  const { initSockets } = require('./sockets');
  const { startSlaMonitor } = require('./jobs/slaMonitor');
  const { seedDatabase } = require('./seed');

  await connectDB();
  await seedDatabase();

  const server = http.createServer(app);
  const io = initSockets(server);
  app.set('io', io);
  startSlaMonitor(io);

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT} (demo mode)`));

  const shutdown = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
