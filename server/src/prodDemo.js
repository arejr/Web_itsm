/**
 * ทดสอบโหมด production บนเครื่อง — เสิร์ฟ frontend ที่ build แล้วจากเซิร์ฟเวอร์เดียว
 * ใช้ MongoDB in-memory เพื่อไม่ต้องติดตั้งฐานข้อมูล:  node src/prodDemo.js
 */
require('dotenv').config();
const http = require('http');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'itsm' } });
  process.env.MONGODB_URI = mongod.getUri('itsm');
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = process.env.JWT_SECRET_PROD || 'local-production-smoke-test-secret';
  process.env.CLIENT_ORIGIN = `http://localhost:${process.env.PORT || 4000}`;

  const app = require('./app');
  const { connectDB } = require('./config/db');
  const { initSockets } = require('./sockets');
  const { seedDatabase } = require('./seed');

  await connectDB();
  await seedDatabase();

  const server = http.createServer(app);
  app.set('io', initSockets(server));

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => console.log(`[prod-smoke] http://localhost:${PORT}`));

  const stop = async () => { await mongod.stop(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => { console.error(e); process.exit(1); });
