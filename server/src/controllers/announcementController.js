const Announcement = require('../models/Announcement');

// GET /api/announcements — ?active=true คืนเฉพาะประกาศที่เผยแพร่อยู่ (ใช้กับแบนเนอร์)
exports.list = async (req, res, next) => {
  try {
    const filter = req.query.active === 'true' ? { published: true } : {};
    res.json(await Announcement.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const doc = await Announcement.create({ ...req.body, createdBy: req.user._id });
    req.app.get('io')?.emit('announcement:changed');
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const doc = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ message: 'ไม่พบประกาศ' });
    req.app.get('io')?.emit('announcement:changed');
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const doc = await Announcement.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'ไม่พบประกาศ' });
    req.app.get('io')?.emit('announcement:changed');
    res.json({ message: 'ลบประกาศเรียบร้อยแล้ว' });
  } catch (err) {
    next(err);
  }
};
