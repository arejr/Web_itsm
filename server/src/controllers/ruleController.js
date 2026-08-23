const Rule = require('../models/Rule');

exports.list = async (req, res, next) => {
  try {
    res.json(await Rule.find().sort({ order: 1 }).populate('assignTo', 'name group'));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const count = await Rule.countDocuments();
    const rule = await Rule.create({ ...req.body, order: req.body.order ?? count });
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rule) return res.status(404).json({ message: 'ไม่พบกฎ' });
    res.json(rule);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const rule = await Rule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: 'ไม่พบกฎ' });
    res.json({ message: 'ลบกฎเรียบร้อยแล้ว' });
  } catch (err) {
    next(err);
  }
};
