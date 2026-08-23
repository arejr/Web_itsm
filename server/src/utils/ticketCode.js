const Counter = require('../models/Counter');

// ออกเลขตั๋วรูปแบบ INC-<ปี ค.ศ.>-<running 6 หลัก>
async function nextTicketCode(date = new Date()) {
  const year = date.getFullYear();
  const seq = await Counter.next(`ticket-${year}`);
  return `INC-${year}-${String(seq).padStart(6, '0')}`;
}

module.exports = { nextTicketCode };
