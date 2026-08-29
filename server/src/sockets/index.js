const { Server } = require('socket.io');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');
const Ticket = require('../models/Ticket');
const { isOriginAllowed } = require('../config/origins');

// ตั้งค่า Socket.IO สำหรับแชทเรียลไทม์และการแจ้งเตือน
function initSockets(httpServer) {
  const io = new Server(httpServer, {
    // cors.origin ของ socket.io ไม่ได้รับ req จึงตรวจ same-origin ไม่ได้
    // ปล่อยให้ allowRequest เป็นผู้ตัดสินแทน โดยใช้กฎเดียวกับฝั่ง HTTP
    cors: { origin: true, credentials: true },
    allowRequest: (req, cb) => {
      const ok = isOriginAllowed(req.headers.origin, req.headers.host);
      cb(ok ? null : 'origin ไม่ได้รับอนุญาต', ok);
    }
  });

  // ตรวจ token ก่อนอนุญาตให้เชื่อมต่อ
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select('name role active');
      if (!user || !user.active) return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // ห้องส่วนตัวสำหรับการแจ้งเตือนรายบุคคล
    socket.join(`user:${socket.user._id}`);
    socket.join(`role:${socket.user.role}`);

    // เข้า/ออกห้องแชทของตั๋วงาน
    socket.on('ticket:join', (ticketId) => {
      if (ticketId) socket.join(`ticket:${ticketId}`);
    });
    socket.on('ticket:leave', (ticketId) => {
      if (ticketId) socket.leave(`ticket:${ticketId}`);
    });

    // ส่งข้อความผ่าน socket โดยตรง (ทางเลือกนอกจาก REST)
    socket.on('message:send', async ({ ticketId, text }, ack) => {
      try {
        const clean = String(text || '').trim();
        if (!ticketId || !clean) return ack?.({ ok: false, message: 'ข้อความว่าง' });

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return ack?.({ ok: false, message: 'ไม่พบตั๋วงาน' });
        // ใช้กฎเดียวกับ REST: เฉพาะผู้ที่เกี่ยวข้องกับตั๋วใบนั้นจึงส่งข้อความได้
        if (socket.user.role === 'employee' && String(ticket.requester) !== String(socket.user._id)) {
          return ack?.({ ok: false, message: 'ไม่มีสิทธิ์' });
        }
        if (socket.user.role === 'tech' && String(ticket.assignee || '') !== String(socket.user._id)) {
          return ack?.({ ok: false, message: 'ตั๋วงานนี้ไม่ได้มอบหมายให้คุณ จึงตอบแชทไม่ได้' });
        }

        const message = await Message.create({
          ticket: ticket._id,
          sender: socket.user._id,
          senderName: socket.user.name,
          senderRole: socket.user.role,
          text: clean,
          readBy: [socket.user._id]
        });

        io.to(`ticket:${ticket._id}`).emit('message:new', message.toJSON());
        [ticket.requester, ticket.assignee]
          .filter((id) => id && String(id) !== String(socket.user._id))
          .forEach((id) => io.to(`user:${id}`).emit('message:ping', { ticketId: String(ticket._id) }));

        ack?.({ ok: true, message: message.toJSON() });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    // แสดงสถานะ "กำลังพิมพ์…"
    socket.on('typing', ({ ticketId, typing }) => {
      if (!ticketId) return;
      socket.to(`ticket:${ticketId}`).emit('typing', { name: socket.user.name, typing: !!typing });
    });
  });

  return io;
}

module.exports = { initSockets };
