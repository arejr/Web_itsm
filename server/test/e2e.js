const BASE = 'http://localhost:4000/api';
const PW = 'Password123!';
const ok = [], bad = [];
function check(name, cond, extra='') { (cond?ok:bad).push(name + (extra?` — ${extra}`:'')); }

async function login(email) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username: email, password: PW })
  });
  const j = await r.json();
  if (!j.token) throw new Error(`login ${email} failed: ${j.message}`);
  return j.token;
}
const H = (t, extra={}) => ({ Authorization: `Bearer ${t}`, 'Content-Type':'application/json', ...extra });
async function req(m, path, t, body) {
  const r = await fetch(BASE + path, { method: m, headers: H(t), body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(()=>({}));
  return { status: r.status, j };
}

(async () => {
  const admin = await login('waraporn.c@company.co.th');
  const helpdesk = await login('pimchanok.d@company.co.th');
  const tech = await login('thanawat.s@company.co.th');
  const emp = await login('asniya.n@company.co.th');
  check('เข้าสู่ระบบทั้ง 4 บทบาท', true);

  // บัญชีถูกระงับต้องเข้าไม่ได้
  const sus = await fetch(`${BASE}/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},
    body: JSON.stringify({username:'somchai.j@company.co.th', password: PW})});
  check('บัญชีที่ถูกระงับเข้าระบบไม่ได้', sus.status === 403, `status=${sus.status}`);

  // 1. พนักงานแจ้งปัญหาใหม่
  const created = await req('POST','/tickets', emp, {
    title:'ทดสอบ E2E — เมาส์ไร้สายเชื่อมต่อไม่ได้',
    description:'อาการ: ไฟ USB receiver ไม่ติด',
    location:'อาคาร 4 ชั้น 1', asset:'MSE-TEST-01'
  });
  check('พนักงานสร้างตั๋วได้', created.status === 201, `status=${created.status} ${created.j.message||''}`);
  const tid = created.j._id;
  check('ระบบออกเลขตั๋วอัตโนมัติ', /^INC-\d{4}-\d{6}$/.test(created.j.code||''), created.j.code);
  check('ระบบตั้ง SLA อัตโนมัติ', !!created.j.slaDueAt);

  // พนักงานเห็นเฉพาะตั๋วของตัวเอง
  const empList = await req('GET','/tickets', emp);
  check('พนักงานเห็นเฉพาะตั๋วของตนเอง',
    empList.j.every(t => t.requester?._id === undefined || t.requesterEmail === 'asniya.n@company.co.th'),
    `${empList.j.length} ใบ`);
  const forbidden = await req('GET','/users', emp);
  check('พนักงานเข้าหน้าจัดการผู้ใช้ไม่ได้', forbidden.status === 403, `status=${forbidden.status}`);

  // 2. Helpdesk คัดกรอง: จัดหมวดหมู่ + ความสำคัญ + มอบหมาย
  const cats = (await req('GET','/categories', helpdesk)).j;
  const techs = (await req('GET','/users/technicians', helpdesk)).j;
  const thanawat = techs.find(x => x.name.startsWith('ธนวัฒน์'));
  const triaged = await req('PATCH', `/tickets/${tid}/triage`, helpdesk, {
    categoryId: cats.find(c=>c.key==='hardware')._id, priority: 'high', assigneeId: thanawat._id
  });
  check('Helpdesk คัดกรองและมอบหมายได้', triaged.status === 200 && triaged.j.status === 'assigned', triaged.j.message||triaged.j.status);
  check('มอบหมายให้เจ้าหน้าที่ถูกคน', triaged.j.assignee?._id === thanawat._id);
  check('ปรับ SLA ตามความสำคัญใหม่', triaged.j.priority === 'high');
  check('ไทม์ไลน์บันทึกการมอบหมาย', (triaged.j.timeline||[]).some(e => e.kind === 'assign'));

  // เจ้าหน้าที่ได้รับการแจ้งเตือน
  const techNotifs = (await req('GET','/notifications', tech)).j;
  check('เจ้าหน้าที่ได้รับแจ้งเตือนการมอบหมาย',
    techNotifs.items.some(n => n.tag === 'มอบหมาย' && n.ticketCode === created.j.code));

  // 3. เจ้าหน้าที่ IT อัปเดตสถานะ
  for (const st of ['inprogress','pending','inprogress']) {
    const r = await req('PATCH', `/tickets/${tid}/status`, tech, { status: st });
    check(`อัปเดตสถานะเป็น ${st}`, r.status === 200 && r.j.status === st, r.j.message||'');
  }

  // 4. แชทในตั๋วงาน
  const m1 = await req('POST', `/tickets/${tid}/messages`, tech, { text: 'สวัสดีครับ ขอทราบรุ่นของเมาส์ด้วยครับ' });
  const m2 = await req('POST', `/tickets/${tid}/messages`, emp, { text: 'รุ่น Logitech M170 ค่ะ' });
  check('ส่งข้อความแชทได้ทั้งสองฝั่ง', m1.status === 201 && m2.status === 201);
  const msgs = (await req('GET', `/tickets/${tid}/messages`, tech)).j;
  check('อ่านประวัติแชทได้', msgs.length === 2, `${msgs.length} ข้อความ`);
  const empNotifs = (await req('GET','/notifications', emp)).j;
  check('ผู้แจ้งได้รับแจ้งเตือนข้อความใหม่', empNotifs.items.some(n => n.tag === 'ข้อความ'));

  // 5. โอนย้ายตั๋วให้ทีมอื่น
  const siriporn = techs.find(x => x.name.startsWith('ศิริพร'));
  const tr = await req('PATCH', `/tickets/${tid}/transfer`, tech, { assigneeId: siriporn._id });
  check('โอนย้ายตั๋วให้ทีมอื่นได้', tr.status === 200 && tr.j.assignee?._id === siriporn._id, tr.j.message||'');

  // 6. ปิดตั๋วพร้อมบันทึก Resolution Note + เผยแพร่เข้า KB
  const noNote = await req('PATCH', `/tickets/${tid}/resolve`, tech, { note: '' });
  check('ปิดตั๋วโดยไม่มี Resolution Note ไม่ได้', noNote.status === 400);
  const kbBefore = (await req('GET','/articles', tech)).j.length;
  const res = await req('PATCH', `/tickets/${tid}/resolve`, tech, {
    note: 'เปลี่ยน USB receiver ตัวใหม่และติดตั้งไดรเวอร์ Logitech Options ใหม่', publishToKb: true
  });
  check('ปิดตั๋วพร้อม Resolution Note ได้', res.status === 200 && res.j.ticket.status === 'resolved', res.j.message||'');
  check('เผยแพร่เข้าฐานความรู้ได้', !!res.j.article?.ref, res.j.article?.ref);
  const kbAfter = (await req('GET','/articles', tech)).j.length;
  check('จำนวนบทความ KB เพิ่มขึ้น', kbAfter === kbBefore + 1, `${kbBefore} → ${kbAfter}`);

  // 7. Helpdesk ออกตั๋วแทนผู้แจ้ง (walk-in / โทรศัพท์)
  const onBehalf = await req('POST','/tickets', helpdesk, {
    title:'ทดสอบ E2E — แจ้งทางโทรศัพท์', description:'ผู้ใช้โทรแจ้ง',
    requesterName:'สมหญิง ทดสอบ', requesterDept:'ฝ่ายจัดซื้อ', channel:'โทรศัพท์',
    categoryId: cats.find(c=>c.key==='software')._id, priority:'medium'
  });
  check('Helpdesk ออกตั๋วแทนผู้แจ้งได้', onBehalf.status === 201, onBehalf.j.message||'');
  check('บันทึกช่องทางที่รับแจ้ง', onBehalf.j.channel === 'โทรศัพท์', onBehalf.j.channel);
  check('กฎมอบหมายอัตโนมัติทำงาน (Software → Application Support)',
    onBehalf.j.assignee?.name === 'ปิยะพงษ์ วรกุล', onBehalf.j.assigneeName);

  // 8. Admin: จัดการผู้ใช้ (สร้าง / ระงับ / เปิด / ลบ)
  const nu = await req('POST','/users', admin, {
    name:'ทดสอบ อีทูอี', email:`e2e${Date.now()}@company.co.th`, role:'employee', department:'ฝ่ายทดสอบ'
  });
  check('Admin เพิ่มผู้ใช้ได้', nu.status === 201, nu.j.message||'');
  const off = await req('PATCH', `/users/${nu.j._id}/status`, admin, { active:false });
  check('Admin ระงับบัญชีได้', off.status === 200 && off.j.active === false);
  const on = await req('PATCH', `/users/${nu.j._id}/status`, admin, { active:true });
  check('Admin เปิดใช้งานบัญชีได้', on.status === 200 && on.j.active === true);
  const selfOff = await req('PATCH', `/users/${nu.j._id}/status`, helpdesk, { active:false });
  check('Helpdesk ระงับบัญชีไม่ได้ (สิทธิ์)', selfOff.status === 403, `status=${selfOff.status}`);
  const del = await req('DELETE', `/users/${nu.j._id}`, admin);
  check('Admin ลบผู้ใช้ได้', del.status === 200);

  // 9. Admin: หมวดหมู่ + ประกาศ
  const nc = await req('POST','/categories', admin, { label:'ทดสอบหมวดหมู่', slaHours: 6, color:'#123456' });
  check('Admin เพิ่มหมวดหมู่ได้', nc.status === 201, nc.j.message||'');
  const uc = await req('PATCH', `/categories/${nc.j._id}`, admin, { slaHours: 12 });
  check('Admin แก้ไขหมวดหมู่ได้', uc.status === 200 && uc.j.slaHours === 12);
  check('Admin ลบหมวดหมู่ได้', (await req('DELETE', `/categories/${nc.j._id}`, admin)).status === 200);

  const na = await req('POST','/announcements', admin, { title:'ทดสอบประกาศ E2E', whenText:'คืนนี้ 22:00', published:true });
  check('Admin สร้างประกาศได้', na.status === 201, na.j.message||'');
  const activeAnn = (await req('GET','/announcements?active=true', emp)).j;
  check('ประกาศที่เผยแพร่แสดงต่อผู้ใช้', activeAnn.some(a => a._id === na.j._id));
  await req('PATCH', `/announcements/${na.j._id}`, admin, { published:false });
  const afterHide = (await req('GET','/announcements?active=true', emp)).j;
  check('ปิดการแสดงประกาศได้', !afterHide.some(a => a._id === na.j._id));
  check('Admin ลบประกาศได้', (await req('DELETE', `/announcements/${na.j._id}`, admin)).status === 200);

  // 10. กฎอัตโนมัติ
  const rules = (await req('GET','/rules', admin)).j;
  check('อ่านรายการกฎอัตโนมัติได้', rules.length >= 6, `${rules.length} กฎ`);
  const tg = await req('PATCH', `/rules/${rules[0]._id}`, admin, { enabled: !rules[0].enabled });
  check('เปิด/ปิดกฎได้', tg.status === 200 && tg.j.enabled === !rules[0].enabled);
  await req('PATCH', `/rules/${rules[0]._id}`, admin, { enabled: rules[0].enabled });

  // 11. แดชบอร์ด
  const dash = (await req('GET','/stats/dashboard', admin)).j;
  check('แดชบอร์ดคืนค่า KPI ครบ',
    ['open','successRate','avgResponseMinutes','breachedThisMonth'].every(k => dash.kpis[k] !== undefined));
  check('กราฟ 14 วัน', dash.chart?.length === 14);
  check('สัดส่วนหมวดหมู่', dash.catStats?.length >= 5);
  const wl = (await req('GET','/stats/workload', helpdesk)).j;
  check('ภาระงานเจ้าหน้าที่', Array.isArray(wl) && wl.length >= 3, `${wl.length} คน`);
  check('เจ้าหน้าที่ IT ดูภาระงานทีมไม่ได้ (สิทธิ์)', (await req('GET','/stats/workload', tech)).status === 403);

  // 12. แจ้งเตือน อ่านทั้งหมด
  await req('PATCH','/notifications/read-all', tech);
  check('ทำเครื่องหมายอ่านทั้งหมดได้', (await req('GET','/notifications', tech)).j.unread === 0);

  // 13. พนักงานยกเลิกตั๋วของตัวเอง
  const c2 = await req('POST','/tickets', emp, { title:'ทดสอบ E2E — จะยกเลิก', description:'x' });
  const cancel = await req('PATCH', `/tickets/${c2.j._id}/status`, emp, { status:'cancelled' });
  check('พนักงานยกเลิกตั๋วของตนเองได้', cancel.status === 200 && cancel.j.status === 'cancelled');
  const badStatus = await req('PATCH', `/tickets/${c2.j._id}/status`, emp, { status:'resolved' });
  check('พนักงานปิดตั๋วเองไม่ได้', badStatus.status === 403, `status=${badStatus.status}`);

  console.log(`\n✅ ผ่าน ${ok.length} รายการ`);
  ok.forEach(o => console.log('   ✓ ' + o));
  if (bad.length) {
    console.log(`\n❌ ไม่ผ่าน ${bad.length} รายการ`);
    bad.forEach(b => console.log('   ✗ ' + b));
    process.exit(1);
  }
})().catch(e => { console.error('ERROR', e); process.exit(1); });
