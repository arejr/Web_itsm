const User = require('../models/User');
const Ticket = require('../models/Ticket');

// GET /api/users — รายชื่อสมาชิกทั้งหมด (Admin)
exports.list = async (req, res, next) => {
  try {
    const { role, q, active } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { department: new RegExp(q, 'i') },
        { employeeId: new RegExp(q, 'i') }
      ];
    }
    const users = await User.find(filter).sort({ role: 1, name: 1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/technicians — เจ้าหน้าที่ IT พร้อมจำนวนงานที่ถืออยู่ (ใช้ตอนมอบหมาย)
exports.technicians = async (req, res, next) => {
  try {
    const techs = await User.find({ role: { $in: ['tech', 'helpdesk'] }, active: true }).sort({ name: 1 });
    const loads = await Ticket.aggregate([
      { $match: { status: { $in: ['assigned', 'inprogress'] }, assignee: { $ne: null } } },
      { $group: { _id: '$assignee', count: { $sum: 1 } } }
    ]);
    const map = Object.fromEntries(loads.map((l) => [String(l._id), l.count]));
    res.json(
      techs.map((t) => ({
        _id: t._id,
        name: t.name,
        email: t.email,
        role: t.role,
        skill: t.skill || t.group || '—',
        group: t.group,
        initial: t.initial,
        load: map[String(t._id)] || 0
      }))
    );
  } catch (err) {
    next(err);
  }
};

// POST /api/users — เพิ่มสมาชิกใหม่ (Admin)
exports.create = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (!payload.password) payload.password = 'Password123!';
    const user = await User.create(payload);
    const safe = user.toObject();
    delete safe.password;
    res.status(201).json(safe);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id — แก้ไขข้อมูลสมาชิก (Admin)
exports.update = async (req, res, next) => {
  try {
    const allowed = [
      'name', 'email', 'employeeId', 'role', 'department', 'group',
      'skill', 'phone', 'contact', 'company', 'orgCode', 'active'
    ];
    const patch = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    });

    const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });

    // เปลี่ยนรหัสผ่านโดยผู้ดูแลระบบ
    if (req.body.password) {
      const withPass = await User.findById(user._id).select('+password');
      withPass.password = req.body.password;
      await withPass.save();
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id/status — ระงับ / เปิดใช้งานบัญชี (Admin)
exports.toggleActive = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'ไม่สามารถระงับบัญชีของตนเองได้' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });

    user.active = req.body.active !== undefined ? !!req.body.active : !user.active;
    await user.save({ validateBeforeSave: false });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id (Admin)
exports.remove = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'ไม่สามารถลบบัญชีของตนเองได้' });
    }
    const open = await Ticket.countDocuments({
      assignee: req.params.id,
      status: { $in: ['assigned', 'inprogress'] }
    });
    if (open > 0) {
      return res.status(400).json({ message: `ผู้ใช้นี้ยังถือตั๋วงานค้างอยู่ ${open} รายการ กรุณามอบหมายงานให้ผู้อื่นก่อน` });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    res.json({ message: 'ลบผู้ใช้งานเรียบร้อยแล้ว' });
  } catch (err) {
    next(err);
  }
};
