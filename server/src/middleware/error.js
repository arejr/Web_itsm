function notFound(req, res) {
  res.status(404).json({ message: `ไม่พบเส้นทาง ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err.message);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง', details: err.errors });
  }
  if (err.code === 11000) {
    // บอกให้ชัดว่าซ้ำที่ช่องไหน ไม่งั้นผู้ใช้ต้องเดาเองว่าต้องแก้อะไร
    const LABEL = { employeeId: 'รหัสพนักงาน', email: 'อีเมล', code: 'เลขตั๋วงาน', key: 'คีย์', ref: 'รหัสอ้างอิง' };
    const field = Object.keys(err.keyValue || {})[0];
    const message = field
      ? `${LABEL[field] || field} "${err.keyValue[field]}" ถูกใช้ไปแล้ว กรุณาใช้ค่าอื่น`
      : 'ข้อมูลซ้ำกับที่มีอยู่แล้ว';
    return res.status(409).json({ message, keys: err.keyValue });
  }
  res.status(err.status || 500).json({ message: err.message || 'เกิดข้อผิดพลาดภายในระบบ' });
}

module.exports = { notFound, errorHandler };
