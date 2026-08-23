const Notification = require('../models/Notification');

// สร้างการแจ้งเตือนและ push ผ่าน socket ไปยังห้องส่วนตัวของผู้ใช้
async function notify(io, { userIds = [], tag, title, body = '', ticket = null, ticketCode = '' }) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  if (!unique.length) return [];

  const docs = await Notification.insertMany(
    unique.map((user) => ({ user, tag, title, body, ticket, ticketCode }))
  );

  if (io) {
    docs.forEach((doc) => {
      io.to(`user:${doc.user}`).emit('notification:new', doc.toJSON());
    });
  }
  return docs;
}

module.exports = { notify };
