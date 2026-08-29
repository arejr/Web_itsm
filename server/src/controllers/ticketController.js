const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const User = require('../models/User');
const Message = require('../models/Message');
const Article = require('../models/Article');
const Notification = require('../models/Notification');
const Counter = require('../models/Counter');
const { nextTicketCode } = require('../utils/ticketCode');
const { serializeTicket } = require('../utils/serialize');
const { notify } = require('../utils/notify');
const { PRIORITY_SLA_MINUTES, PRIORITY_LABEL, STATUSES } = require('../config/constants');

const POPULATE = [
  { path: 'category', select: 'key label color slaHours' },
  { path: 'assignee', select: 'name email role group skill' },
  { path: 'requester', select: 'name email department phone contact company orgCode' }
];

function slaDueFrom(priority, from = new Date()) {
  const minutes = PRIORITY_SLA_MINUTES[priority] ?? PRIORITY_SLA_MINUTES.medium;
  return new Date(from.getTime() + minutes * 60000);
}

function pushTimeline(ticket, title, user, kind = 'info') {
  ticket.timeline.push({ title, by: user?.name || 'ระบบ', byUser: user?._id, kind });
}

// รายชื่อผู้ที่ควรได้รับแจ้งเตือนของตั๋วนี้ (ผู้แจ้ง + ผู้รับผิดชอบ) ยกเว้นคนที่ทำ action เอง
function watchers(ticket, exceptUserId) {
  return [ticket.requester, ticket.assignee]
    .map((v) => (v && v._id ? v._id : v))
    .filter((id) => id && String(id) !== String(exceptUserId));
}

// GET /api/tickets
exports.list = async (req, res, next) => {
  try {
    const { status, priority, category, assignee, q, scope, slaRisk } = req.query;
    const filter = {};

    // จำกัดขอบเขตข้อมูลตามบทบาท
    if (req.user.role === 'employee') {
      filter.requester = req.user._id;
    } else if (scope === 'mine') {
      filter.assignee = req.user._id;
    } else if (scope === 'reported') {
      filter.requester = req.user._id;
    }

    if (status) filter.status = { $in: String(status).split(',') };
    if (priority) filter.priority = { $in: String(priority).split(',') };
    if (category) filter.category = category;
    if (assignee === 'none') filter.assignee = null;
    else if (assignee) filter.assignee = assignee;

    if (q) {
      filter.$or = [
        { code: new RegExp(q, 'i') },
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { requesterName: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') }
      ];
    }

    let tickets = await Ticket.find(filter).populate(POPULATE).sort({ createdAt: -1 }).limit(500);
    let result = tickets.map(serializeTicket);
    if (slaRisk === 'true') result = result.filter((t) => t.slaRisk);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// GET /api/tickets/:id — รับได้ทั้ง _id และเลขตั๋ว (code)
exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { code: id };
    const ticket = await Ticket.findOne(query).populate(POPULATE);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });

    if (req.user.role === 'employee' && String(ticket.requester?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ดูตั๋วงานนี้' });
    }
    res.json(serializeTicket(ticket));
  } catch (err) {
    next(err);
  }
};

// POST /api/tickets — พนักงานแจ้งปัญหา หรือ Helpdesk ออกตั๋วแทน
exports.create = async (req, res, next) => {
  try {
    const {
      title, description, categoryId, priority, location, asset,
      channel, requesterName, requesterDept, requesterId,
      assigneeId, service, isDraft
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อปัญหา' });
    }

    const category = categoryId ? await Category.findById(categoryId) : await Category.findOne({ key: 'other' });
    const onBehalf = ['helpdesk', 'admin'].includes(req.user.role) && (requesterName || requesterId);

    let requester = req.user;
    if (onBehalf && requesterId) requester = (await User.findById(requesterId)) || null;
    else if (onBehalf) requester = null;

    const prio = priority || 'medium';
    const ticket = new Ticket({
      code: await nextTicketCode(),
      title: String(title).trim(),
      description: description || '',
      category: category?._id,
      priority: prio,
      status: 'new',
      statusReason: 'รอคัดกรอง',
      requester: requester?._id,
      requesterName: requester?.name || requesterName || 'ไม่ระบุชื่อผู้แจ้ง',
      requesterDept: requester?.department || requesterDept || 'ไม่ระบุแผนก',
      requesterEmail: requester?.email || '',
      requesterPhone: requester?.phone || '',
      contact: requester?.contact || (onBehalf ? 'บันทึกโดย Helpdesk' : ''),
      company: requester?.company || 'สำนักงานใหญ่',
      orgCode: requester?.orgCode || '',
      location: location || '',
      asset: asset || '',
      service: service || category?.label || '',
      productCategory: category ? `${category.label}` : '',
      channel: channel || 'เว็บไซต์',
      slaDueAt: slaDueFrom(prio),
      isDraft: !!isDraft
    });

    if (Array.isArray(req.files) && req.files.length) {
      ticket.attachments = req.files.map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
        url: `/uploads/${f.filename}`
      }));
    }

    pushTimeline(ticket, 'ผู้ใช้แจ้งปัญหาเข้าระบบ', { name: ticket.requesterName }, 'info');

    // มอบหมายทันทีเฉพาะกรณีที่ผู้ออกตั๋วระบุผู้รับผิดชอบมาพร้อมกัน
    // นอกนั้นตั๋วจะเข้าคิวคัดกรองให้ Helpdesk มอบหมายเอง
    let assignedUser = null;
    if (assigneeId) assignedUser = await User.findById(assigneeId);

    if (assignedUser) {
      ticket.assignee = assignedUser._id;
      ticket.group = assignedUser.group || category?.defaultGroup || '';
      ticket.status = 'assigned';
      ticket.statusReason = 'รอเจ้าหน้าที่รับงาน';
      pushTimeline(ticket, `มอบหมายให้ ${assignedUser.name}`, req.user, 'assign');
    }

    await ticket.save();
    await ticket.populate(POPULATE);

    const io = req.app.get('io');
    io?.emit('ticket:created', serializeTicket(ticket));

    // แจ้งเตือนทีมคัดกรอง หรือผู้รับผิดชอบที่ถูกมอบหมาย
    if (assignedUser) {
      await notify(io, {
        userIds: [assignedUser._id],
        tag: 'มอบหมาย',
        title: 'คุณได้รับมอบหมายตั๋วงานใหม่',
        body: `${ticket.code} · ${ticket.title}`,
        ticket: ticket._id,
        ticketCode: ticket.code
      });
    } else {
      // ตั๋วที่ยังไม่มีผู้รับผิดชอบเป็นหน้าที่ของ Helpdesk ในการคัดกรอง
      // จึงแจ้งเฉพาะ Helpdesk — บทบาทอื่นจะได้รับแจ้งเตือนเฉพาะตั๋วที่ตนเกี่ยวข้องด้วย
      const desk = await User.find({ role: 'helpdesk', active: true }).select('_id');
      await notify(io, {
        userIds: desk.map((u) => u._id),
        tag: 'ตั๋วใหม่',
        title: 'มีตั๋วแจ้งปัญหาเข้าใหม่รอคัดกรอง',
        body: `${ticket.code} · ${ticket.title}`,
        ticket: ticket._id,
        ticketCode: ticket.code
      });
    }

    res.status(201).json(serializeTicket(ticket));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tickets/:id/triage — Helpdesk จัดหมวดหมู่ + กำหนดความสำคัญ + มอบหมาย
exports.triage = async (req, res, next) => {
  try {
    const { categoryId, priority, assigneeId, note } = req.body;
    const ticket = await Ticket.findById(req.params.id).populate(POPULATE);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });

    if (categoryId && String(ticket.category?._id) !== String(categoryId)) {
      const cat = await Category.findById(categoryId);
      ticket.category = cat?._id;
      ticket.productCategory = cat?.label || '';
      pushTimeline(ticket, `จัดหมวดหมู่ปัญหาเป็น ${cat?.label || '—'}`, req.user, 'info');
    }

    if (priority && priority !== ticket.priority) {
      ticket.priority = priority;
      ticket.slaDueAt = slaDueFrom(priority, ticket.createdAt);
      pushTimeline(ticket, `กำหนดระดับความสำคัญเป็น ${PRIORITY_LABEL[priority] || priority}`, req.user, 'priority');
    }

    let assignedUser = null;
    if (assigneeId) {
      assignedUser = await User.findById(assigneeId);
      if (!assignedUser) return res.status(400).json({ message: 'ไม่พบเจ้าหน้าที่ที่ต้องการมอบหมาย' });

      const changed = String(ticket.assignee?._id || '') !== String(assignedUser._id);
      ticket.assignee = assignedUser._id;
      ticket.group = assignedUser.group || '';
      if (['new'].includes(ticket.status)) {
        ticket.status = 'assigned';
        ticket.statusReason = 'รอเจ้าหน้าที่รับงาน';
      }
      if (changed) pushTimeline(ticket, `มอบหมายให้ ${assignedUser.name}`, req.user, 'assign');
    }

    if (note) ticket.description = `${ticket.description}\n\n[หมายเหตุจาก Helpdesk] ${note}`.trim();

    await ticket.save();
    await ticket.populate(POPULATE);

    const io = req.app.get('io');
    const payload = serializeTicket(ticket);
    io?.emit('ticket:updated', payload);
    io?.to(`ticket:${ticket._id}`).emit('ticket:updated', payload);

    if (assignedUser) {
      await notify(io, {
        userIds: [assignedUser._id],
        tag: 'มอบหมาย',
        title: 'คุณได้รับมอบหมายตั๋วงานใหม่',
        body: `${ticket.code} · ${ticket.title}`,
        ticket: ticket._id,
        ticketCode: ticket.code
      });
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tickets/:id/status — อัปเดตสถานะการทำงาน
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });

    const ticket = await Ticket.findById(req.params.id).populate(POPULATE);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });

    // ผู้ดูแลระบบดูได้อย่างเดียว เปลี่ยนสถานะงานไม่ได้
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'ผู้ดูแลระบบไม่มีสิทธิ์เปลี่ยนสถานะตั๋วงาน' });
    }

    // พนักงานทั่วไปทำได้เฉพาะยกเลิกตั๋วของตัวเอง
    if (req.user.role === 'employee') {
      const own = String(ticket.requester?._id) === String(req.user._id);
      if (!own || status !== 'cancelled') {
        return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เปลี่ยนสถานะตั๋วงานนี้' });
      }
    }

    const STATUS_LABEL = {
      new: 'ตั๋วใหม่', assigned: 'มอบหมายแล้ว', inprogress: 'กำลังดำเนินการ',
      pending: 'รอดำเนินการ', resolved: 'แก้ไขสำเร็จ', cancelled: 'ยกเลิก'
    };

    ticket.status = status;
    ticket.statusReason = reason || STATUS_LABEL[status];
    if (status === 'inprogress' && !ticket.firstResponseAt) ticket.firstResponseAt = new Date();
    if (status === 'resolved') ticket.resolvedAt = new Date();
    if (status === 'cancelled') ticket.closedAt = new Date();
    if (!['resolved', 'cancelled'].includes(status)) ticket.resolvedAt = undefined;

    pushTimeline(ticket, `เปลี่ยนสถานะเป็น ${STATUS_LABEL[status]}`, req.user, 'status');
    await ticket.save();
    await ticket.populate(POPULATE);

    const io = req.app.get('io');
    const payload = serializeTicket(ticket);
    io?.emit('ticket:updated', payload);
    io?.to(`ticket:${ticket._id}`).emit('ticket:updated', payload);

    await notify(io, {
      userIds: watchers(ticket, req.user._id),
      tag: 'สถานะ',
      title: `ตั๋วงาน ${ticket.code} เปลี่ยนสถานะเป็น ${STATUS_LABEL[status]}`,
      body: ticket.title,
      ticket: ticket._id,
      ticketCode: ticket.code
    });

    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tickets/:id/resolve — บันทึก Resolution Note และปิดตั๋ว (+ เผยแพร่เข้า KB)
exports.resolve = async (req, res, next) => {
  try {
    const { note, publishToKb } = req.body;
    const ticket = await Ticket.findById(req.params.id).populate(POPULATE);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: 'กรุณาบันทึกวิธีแก้ปัญหา (Resolution Note) ก่อนปิดตั๋วงาน' });
    }

    ticket.resolutionNote = String(note).trim();
    ticket.status = 'resolved';
    ticket.statusReason = 'แก้ไขเรียบร้อย';
    ticket.resolvedAt = new Date();
    pushTimeline(ticket, 'บันทึกวิธีแก้ปัญหาและปิดตั๋วงาน', req.user, 'resolve');

    let article = null;
    if (publishToKb) {
      const seq = await Counter.next('kb');
      article = await Article.create({
        ref: `KB-${String(seq).padStart(4, '0')}`,
        title: ticket.title,
        summary: ticket.resolutionNote.slice(0, 240),
        body: ticket.resolutionNote,
        category: ticket.category?._id,
        author: req.user._id,
        authorName: req.user.name,
        sourceTicket: ticket._id
      });
      ticket.publishedToKb = true;
      pushTimeline(ticket, `เผยแพร่เข้าฐานความรู้ ${article.ref}`, req.user, 'info');
    }

    await ticket.save();
    await ticket.populate(POPULATE);

    const io = req.app.get('io');
    const payload = serializeTicket(ticket);
    io?.emit('ticket:updated', payload);
    io?.to(`ticket:${ticket._id}`).emit('ticket:updated', payload);

    await notify(io, {
      userIds: watchers(ticket, req.user._id),
      tag: 'ปิดงาน',
      title: `ตั๋วงาน ${ticket.code} แก้ไขสำเร็จแล้ว`,
      body: ticket.resolutionNote.slice(0, 120),
      ticket: ticket._id,
      ticketCode: ticket.code
    });

    res.json({ ticket: payload, article });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tickets/:id/transfer — โอนย้ายตั๋วให้เจ้าหน้าที่/ทีมอื่น
exports.transfer = async (req, res, next) => {
  try {
    const { assigneeId, group, reason } = req.body;
    const ticket = await Ticket.findById(req.params.id).populate(POPULATE);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });

    const target = assigneeId ? await User.findById(assigneeId) : null;
    if (assigneeId && !target) return res.status(400).json({ message: 'ไม่พบเจ้าหน้าที่ปลายทาง' });

    const fromName = ticket.assignee?.name || 'ยังไม่มอบหมาย';
    ticket.assignee = target?._id || null;
    ticket.group = group || target?.group || '';
    ticket.status = target ? 'assigned' : 'new';
    ticket.statusReason = reason || (target ? 'โอนย้ายงาน รอเจ้าหน้าที่รับงาน' : 'ส่งกลับคิวคัดกรอง');
    pushTimeline(
      ticket,
      `โอนย้ายตั๋วงานจาก ${fromName} ไปยัง ${target?.name || ticket.group || 'คิวคัดกรอง'}`,
      req.user,
      'transfer'
    );

    await ticket.save();
    await ticket.populate(POPULATE);

    const io = req.app.get('io');
    const payload = serializeTicket(ticket);
    io?.emit('ticket:updated', payload);
    io?.to(`ticket:${ticket._id}`).emit('ticket:updated', payload);

    if (target) {
      await notify(io, {
        userIds: [target._id],
        tag: 'มอบหมาย',
        title: 'มีตั๋วงานโอนย้ายมาถึงคุณ',
        body: `${ticket.code} · ${ticket.title}`,
        ticket: ticket._id,
        ticketCode: ticket.code
      });
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tickets/:id — แก้ไขรายละเอียดทั่วไป (Helpdesk / Admin)
exports.update = async (req, res, next) => {
  try {
    const allowed = [
      'title', 'description', 'location', 'asset', 'service',
      'incidentType', 'opCategory', 'productCategory', 'channel',
      'requesterName', 'requesterDept', 'requesterPhone', 'contact', 'group'
    ];
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });

    allowed.forEach((k) => {
      if (req.body[k] !== undefined) ticket[k] = req.body[k];
    });
    pushTimeline(ticket, 'แก้ไขรายละเอียดตั๋วงาน', req.user, 'info');

    await ticket.save();
    await ticket.populate(POPULATE);

    const payload = serializeTicket(ticket);
    req.app.get('io')?.emit('ticket:updated', payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// POST /api/tickets/:id/attachments
exports.addAttachments = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });

    (req.files || []).forEach((f) => {
      ticket.attachments.push({
        filename: f.filename,
        originalName: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
        url: `/uploads/${f.filename}`
      });
    });
    await ticket.save();
    await ticket.populate(POPULATE);
    res.json(serializeTicket(ticket));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tickets/:id (Admin)
exports.remove = async (req, res, next) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'ไม่พบตั๋วงานนี้' });
    // เก็บกวาดข้อมูลที่ผูกกับตั๋วนี้ไม่ให้ค้างเป็นลิงก์เสีย
    await Promise.all([
      Message.deleteMany({ ticket: ticket._id }),
      Notification.deleteMany({ ticket: ticket._id }),
      Article.updateMany({ sourceTicket: ticket._id }, { $unset: { sourceTicket: 1 } })
    ]);

    req.app.get('io')?.emit('ticket:deleted', { _id: ticket._id, code: ticket.code });
    res.json({ message: 'ลบตั๋วงานเรียบร้อยแล้ว' });
  } catch (err) {
    next(err);
  }
};
