const Ticket = require('../models/Ticket');
const Rule = require('../models/Rule');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { notify } = require('../utils/notify');
const { PRIORITY_SLA_MINUTES } = require('../config/constants');

const OPEN = ['new', 'assigned', 'inprogress', 'pending'];

// ตรวจตั๋วที่ใกล้เกิน SLA แล้วยกระดับ/แจ้งเตือนตามกฎ Escalation
async function sweep(io) {
  const rules = await Rule.find({ kind: 'ESCALATE', enabled: true }).sort({ order: 1 });
  if (!rules.length) return;

  const tickets = await Ticket.find({ status: { $in: OPEN }, slaDueAt: { $ne: null } })
    .populate('assignee', 'name')
    .populate('requester', 'name');

  const now = Date.now();
  const managers = await User.find({ role: { $in: ['admin', 'helpdesk'] }, active: true }).select('_id');
  const managerIds = managers.map((m) => m._id);

  for (const ticket of tickets) {
    const totalMinutes = PRIORITY_SLA_MINUTES[ticket.priority] ?? PRIORITY_SLA_MINUTES.medium;
    const remaining = (ticket.slaDueAt.getTime() - now) / 60000;
    const percentLeft = (remaining / totalMinutes) * 100;
    const idleMinutes = (now - new Date(ticket.updatedAt).getTime()) / 60000;

    for (const rule of rules) {
      const byPercent = rule.slaRemainingPercent != null && percentLeft <= rule.slaRemainingPercent;
      const byIdle = rule.idleMinutes != null && idleMinutes >= rule.idleMinutes;
      if (!byPercent && !byIdle) continue;

      // กันแจ้งซ้ำภายใน 60 นาที
      const recent = await Notification.findOne({
        ticket: ticket._id,
        tag: 'Escalation',
        createdAt: { $gte: new Date(now - 60 * 60000) }
      });
      if (recent) continue;

      await Rule.updateOne({ _id: rule._id }, { $inc: { hits: 1 } });
      const targets = [...managerIds];
      if (ticket.assignee?._id) targets.push(ticket.assignee._id);

      await notify(io, {
        userIds: targets,
        tag: 'Escalation',
        title: `ตั๋วงาน ${ticket.code} ${remaining < 0 ? 'เกินกำหนด SLA แล้ว' : 'ใกล้เกินกำหนด SLA'}`,
        body: `${rule.then} · ${ticket.title}`,
        ticket: ticket._id,
        ticketCode: ticket.code
      });
      break;
    }
  }
}

// รันทุก 5 นาที
function startSlaMonitor(io) {
  const run = () => sweep(io).catch((e) => console.error('[sla]', e.message));
  setTimeout(run, 15000);
  setInterval(run, 5 * 60 * 1000);
}

module.exports = { startSlaMonitor, sweep };
