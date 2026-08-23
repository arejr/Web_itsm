const Article = require('../models/Article');
const Counter = require('../models/Counter');

exports.list = async (req, res, next) => {
  try {
    const { q, category } = req.query;
    const filter = { published: true };
    if (category) filter.category = category;
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { summary: new RegExp(q, 'i') },
        { body: new RegExp(q, 'i') },
        { ref: new RegExp(q, 'i') }
      ];
    }
    const items = await Article.find(filter)
      .populate('category', 'key label color')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const item = await Article.findByIdAndUpdate(
      req.params.id,
      { $inc: { uses: 1 } },
      { new: true }
    ).populate('category', 'key label color');
    if (!item) return res.status(404).json({ message: 'ไม่พบบทความ' });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const seq = await Counter.next('kb');
    const item = await Article.create({
      ...req.body,
      ref: `KB-${String(seq).padStart(4, '0')}`,
      author: req.user._id,
      authorName: req.user.name
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const item = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'ไม่พบบทความ' });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const item = await Article.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'ไม่พบบทความ' });
    res.json({ message: 'ลบบทความเรียบร้อยแล้ว' });
  } catch (err) {
    next(err);
  }
};
