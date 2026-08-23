const Notification = require('../models/Notification');

exports.list = async (req, res, next) => {
  try {
    const items = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('ticket', 'code title');
    const unread = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ items, unread });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
    res.json({ message: 'ok' });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'ok' });
  } catch (err) {
    next(err);
  }
};
