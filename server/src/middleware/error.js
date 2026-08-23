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
    return res.status(409).json({ message: 'ข้อมูลซ้ำกับที่มีอยู่แล้ว', keys: err.keyValue });
  }
  res.status(err.status || 500).json({ message: err.message || 'เกิดข้อผิดพลาดภายในระบบ' });
}

module.exports = { notFound, errorHandler };
