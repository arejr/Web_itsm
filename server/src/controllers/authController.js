const User = require('../models/User');
const { signToken } = require('../middleware/auth');

// POST /api/auth/login — เข้าสู่ระบบด้วยรหัสพนักงานหรืออีเมล
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'กรุณากรอกรหัสพนักงานและรหัสผ่านให้ครบถ้วน' });
    }

    const key = String(username).trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: key }, { employeeId: new RegExp(`^${key}$`, 'i') }]
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง' });
    }
    if (!user.active) {
      return res.status(403).json({ message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const safe = user.toObject();
    delete safe.password;
    res.json({ token: signToken(user), user: safe });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ user: req.user });
};

// PATCH /api/auth/password — เปลี่ยนรหัสผ่านของตัวเอง
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword || ''))) {
      return res.status(400).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
  } catch (err) {
    next(err);
  }
};
