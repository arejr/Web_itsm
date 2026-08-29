const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const User = require('../models/User');
const { serializeTicket } = require('../utils/serialize');

const OPEN_STATUSES = ['new', 'assigned', 'inprogress', 'pending'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// GET /api/stats/dashboard — ข้อมูลทั้งหมดของหน้าแดชบอร์ดภาพรวม
exports.dashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // เจ้าหน้าที่ IT เห็นเฉพาะงานที่ตนรับผิดชอบ ส่วน Admin/Helpdesk เห็นทั้งระบบ
    // (พนักงานทั่วไปไม่มีสิทธิ์เข้าถึงเส้นทางนี้ — กันไว้ที่ชั้น route แล้ว)
    const scope = {};
    if (req.user.role === 'tech') scope.assignee = req.user._id;

    const [openCount, resolvedThisMonth, totalThisMonth, allTickets] = await Promise.all([
      Ticket.countDocuments({ ...scope, status: { $in: OPEN_STATUSES } }),
      Ticket.countDocuments({ ...scope, status: 'resolved', resolvedAt: { $gte: monthStart } }),
      Ticket.countDocuments({ ...scope, createdAt: { $gte: monthStart } }),
      Ticket.find(scope).select('status priority createdAt resolvedAt firstResponseAt slaDueAt category')
    ]);

    // อัตราแก้ปัญหาสำเร็จของเดือนนี้
    const successRate = totalThisMonth ? Math.round((resolvedThisMonth / totalThisMonth) * 100) : 0;

    // เวลาตอบกลับเฉลี่ย (นาที) จากตั๋วที่มีการตอบสนองแล้ว
    const responded = allTickets.filter((t) => t.firstResponseAt);
    const avgResponse = responded.length
      ? Math.round(
          responded.reduce((sum, t) => sum + (t.firstResponseAt - t.createdAt) / 60000, 0) / responded.length
        )
      : 0;

    // เกินกำหนดเสร็จในเดือนนี้
    const breached = allTickets.filter((t) => {
      if (!t.slaDueAt) return false;
      const ref = t.resolvedAt || now;
      return ref > t.slaDueAt && t.createdAt >= monthStart;
    }).length;

    // กราฟ 14 วันล่าสุด: แจ้งเข้า vs ปิดงาน
    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = startOfDay(new Date(now.getTime() - i * 86400000));
      const next = new Date(day.getTime() + 86400000);
      days.push({
        day: String(day.getDate()),
        date: day.toISOString(),
        in: allTickets.filter((t) => t.createdAt >= day && t.createdAt < next).length,
        out: allTickets.filter((t) => t.resolvedAt && t.resolvedAt >= day && t.resolvedAt < next).length
      });
    }

    // สัดส่วนตามหมวดหมู่
    const categories = await Category.find().sort({ order: 1 });
    const grouped = await Ticket.aggregate([
      { $match: scope },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const countByCat = Object.fromEntries(grouped.map((g) => [String(g._id), g.count]));
    const totalAll = allTickets.length || 1;
    const catStats = categories.map((c) => ({
      key: c.key,
      label: c.label,
      color: c.color,
      count: countByCat[String(c._id)] || 0,
      percent: Math.round(((countByCat[String(c._id)] || 0) / totalAll) * 100)
    }));

    // ตั๋วงานที่ใกล้เกินกำหนด
    const riskDocs = await Ticket.find({ ...scope, status: { $in: OPEN_STATUSES } })
      .populate([
        { path: 'category', select: 'key label color' },
        { path: 'assignee', select: 'name' },
        { path: 'requester', select: 'name' }
      ])
      .sort({ slaDueAt: 1 })
      .limit(50);
    const slaRisk = riskDocs.map(serializeTicket).filter((t) => t.slaRisk).slice(0, 8);

    // สถิติเสริมสำหรับผู้ดูแลระบบ
    const byStatus = await Ticket.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const byPriority = await Ticket.aggregate([
      { $match: { ...scope, status: { $in: OPEN_STATUSES } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    const userCount = await User.countDocuments({ active: true });

    res.json({
      kpis: {
        open: openCount,
        successRate,
        avgResponseMinutes: avgResponse,
        breachedThisMonth: breached,
        resolvedThisMonth,
        totalThisMonth,
        activeUsers: userCount
      },
      chart: days,
      catStats,
      slaRisk,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      byPriority: Object.fromEntries(byPriority.map((s) => [s._id, s.count]))
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/stats/workload — ภาระงานของเจ้าหน้าที่แต่ละคน
exports.workload = async (req, res, next) => {
  try {
    const techs = await User.find({ role: { $in: ['tech', 'helpdesk'] }, active: true }).select('name group skill');
    const loads = await Ticket.aggregate([
      { $match: { status: { $in: OPEN_STATUSES }, assignee: { $ne: null } } },
      { $group: { _id: '$assignee', count: { $sum: 1 } } }
    ]);
    const map = Object.fromEntries(loads.map((l) => [String(l._id), l.count]));
    res.json(
      techs.map((t) => ({
        _id: t._id,
        name: t.name,
        group: t.group,
        skill: t.skill,
        load: map[String(t._id)] || 0
      }))
    );
  } catch (err) {
    next(err);
  }
};
