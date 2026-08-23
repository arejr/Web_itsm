const Rule = require('../models/Rule');

// หา "กฎมอบหมายอัตโนมัติ" ตัวแรกที่ตรงกับตั๋วงาน แล้วคืนผู้รับผิดชอบที่ควรได้รับงาน
async function applyAssignRules(ticket, category) {
  const rules = await Rule.find({ kind: 'ASSIGN', enabled: true })
    .sort({ order: 1 })
    .populate('assignTo');

  for (const rule of rules) {
    const catOk = !rule.matchCategoryKey || rule.matchCategoryKey === category?.key;
    const prioOk = !rule.matchPriority || rule.matchPriority === ticket.priority;
    const locOk =
      !rule.matchLocationLike ||
      String(ticket.location || '').toLowerCase().includes(rule.matchLocationLike.toLowerCase());

    if (catOk && prioOk && locOk && (rule.assignTo || rule.assignGroup)) {
      await Rule.updateOne({ _id: rule._id }, { $inc: { hits: 1 } });
      return {
        assignee: rule.assignTo?._id || null,
        group: rule.assignGroup || rule.assignTo?.group || '',
        ruleText: rule.then
      };
    }
  }
  return null;
}

module.exports = { applyAssignRules };
