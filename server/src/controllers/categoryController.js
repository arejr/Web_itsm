const Category = require('../models/Category');
const Ticket = require('../models/Ticket');

exports.list = async (req, res, next) => {
  try {
    res.json(await Category.find().sort({ order: 1, label: 1 }));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const key = (req.body.key || req.body.label || '').trim().toLowerCase().replace(/\s+/g, '-');
    const count = await Category.countDocuments();
    const cat = await Category.create({ ...req.body, key, order: req.body.order ?? count });
    res.status(201).json(cat);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ message: 'ไม่พบหมวดหมู่' });
    res.json(cat);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const inUse = await Ticket.countDocuments({ category: req.params.id });
    if (inUse > 0) {
      return res.status(400).json({ message: `หมวดหมู่นี้ถูกใช้กับตั๋วงาน ${inUse} รายการ ไม่สามารถลบได้` });
    }
    const cat = await Category.findByIdAndDelete(req.params.id);
    if (!cat) return res.status(404).json({ message: 'ไม่พบหมวดหมู่' });
    res.json({ message: 'ลบหมวดหมู่เรียบร้อยแล้ว' });
  } catch (err) {
    next(err);
  }
};
