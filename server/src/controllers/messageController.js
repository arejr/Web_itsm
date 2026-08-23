const Message = require('../models/Message');
const Ticket = require('../models/Ticket');
const { notify } = require('../utils/notify');

function canAccess(user, ticket) {
  if (user.role !== 'employee') return true;
  return String(ticket.requester) === String(user._id);
}

// GET /api/tickets/:id/messages
exports.list = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });
    if (!canAccess(req.user, ticket)) return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ดูแชทนี้' });

    const messages = await Message.find({ ticket: ticket._id }).sort({ createdAt: 1 });

    // ทำเครื่องหมายว่าอ่านแล้วสำหรับผู้ใช้ปัจจุบัน
    await Message.updateMany(
      { ticket: ticket._id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json(messages);
  } catch (err) {
    next(err);
  }
};

// POST /api/tickets/:id/messages
exports.create = async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'กรุณาพิมพ์ข้อความ' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });
    if (!canAccess(req.user, ticket)) return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ส่งข้อความในตั๋วนี้' });

    const message = await Message.create({
      ticket: ticket._id,
      sender: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      text,
      readBy: [req.user._id]
    });

    const io = req.app.get('io');
    io?.to(`ticket:${ticket._id}`).emit('message:new', message.toJSON());

    const targets = [ticket.requester, ticket.assignee].filter(
      (id) => id && String(id) !== String(req.user._id)
    );
    await notify(io, {
      userIds: targets,
      tag: 'ข้อความ',
      title: `ข้อความใหม่ในตั๋ว ${ticket.code}`,
      body: `${req.user.name}: ${text.slice(0, 90)}`,
      ticket: ticket._id,
      ticketCode: ticket.code
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};
