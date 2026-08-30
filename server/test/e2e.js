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

  // Helpdesk เปลี่ยนหมวดหมู่ปัญหาจากหน้ารายละเอียดตั๋วได้ (ส่งมาแค่ categoryId อย่างเดียว)
  const catList = (await req('GET', '/categories', helpdesk)).j;
  const network = catList.find(c => c.key === 'network') || catList[1];
  const recat = await req('PATCH', `/tickets/${tid}/triage`, helpdesk, { categoryId: network._id });
  check('Helpdesk จัดหมวดหมู่ปัญหาได้โดยไม่ต้องส่งค่าอื่น',
    recat.status === 200 && recat.j.category?._id === network._id, recat.j.message||'');
  check('ไทม์ไลน์บันทึกการจัดหมวดหมู่',
    (recat.j.timeline||[]).some(e => (e.title||'').includes('จัดหมวดหมู่ปัญหาเป็น')));
  check('เจ้าหน้าที่ IT จัดหมวดหมู่เองไม่ได้',
    (await req('PATCH', `/tickets/${tid}/triage`, tech, { categoryId: network._id })).status === 403);

  // เปลี่ยนระดับความสำคัญอย่างเดียวได้ และกำหนดเสร็จต้องคำนวณใหม่ตามระดับที่เลือก
  const dueBefore = recat.j.slaDueAt;
  const repri = await req('PATCH', `/tickets/${tid}/triage`, helpdesk, { priority: 'critical' });
  check('Helpdesk กำหนดระดับความสำคัญได้โดยไม่ต้องส่งค่าอื่น',
    repri.status === 200 && repri.j.priority === 'critical', repri.j.message||'');
  check('กำหนดเสร็จถูกคำนวณใหม่ให้สั้นลงตามระดับที่เร่งขึ้น',
    new Date(repri.j.slaDueAt) < new Date(dueBefore), `${dueBefore} → ${repri.j.slaDueAt}`);
  check('ไทม์ไลน์บันทึกการกำหนดระดับความสำคัญ',
    (repri.j.timeline||[]).some(e => e.kind === 'priority'));

  // เจ้าหน้าที่ได้รับการแจ้งเตือน
  const techNotifs = (await req('GET','/notifications', tech)).j;
  check('เจ้าหน้าที่ได้รับแจ้งเตือนการมอบหมาย',
    techNotifs.items.some(n => n.tag === 'มอบหมาย' && n.ticketCode === created.j.code));

  // ขอบเขตการแจ้งเตือนตามบทบาท
  const hdNotifs = (await req('GET','/notifications', helpdesk)).j;
  const admNotifs = (await req('GET','/notifications', admin)).j;
  check('Helpdesk ได้รับแจ้งเตือนตั๋วเข้าใหม่',
    hdNotifs.items.some(n => n.tag === 'ตั๋วใหม่' && n.ticketCode === created.j.code));
  check('Admin ไม่ได้รับแจ้งเตือนตั๋วเข้าใหม่',
    !admNotifs.items.some(n => n.tag === 'ตั๋วใหม่'), `${admNotifs.items.length} รายการ`);
  check('Helpdesk ไม่ได้รับแจ้งเตือนของตั๋วที่ไม่ได้รับผิดชอบ',
    !hdNotifs.items.some(n => n.ticketCode === created.j.code && n.tag !== 'ตั๋วใหม่'));

  // 3. เจ้าหน้าที่ IT อัปเดตสถานะ
  for (const st of ['inprogress','assigned','inprogress']) {
    const r = await req('PATCH', `/tickets/${tid}/status`, tech, { status: st });
    check(`อัปเดตสถานะเป็น ${st}`, r.status === 200 && r.j.status === st, r.j.message||'');
  }

  const retired = await req('PATCH', `/tickets/${tid}/status`, tech, { status: 'pending' });
  check('ตั้งสถานะที่เลิกใช้แล้ว (รอข้อมูล) ไม่ได้', retired.status === 400,
    `${retired.status} ${retired.j.message || ''}`);

  // 4. แชทในตั๋วงาน
  const m1 = await req('POST', `/tickets/${tid}/messages`, tech, { text: 'สวัสดีครับ ขอทราบรุ่นของเมาส์ด้วยครับ' });
  const m2 = await req('POST', `/tickets/${tid}/messages`, emp, { text: 'รุ่น Logitech M170 ค่ะ' });
  check('ส่งข้อความแชทได้ทั้งสองฝั่ง', m1.status === 201 && m2.status === 201);
  const msgs = (await req('GET', `/tickets/${tid}/messages`, tech)).j;
  check('อ่านประวัติแชทได้', msgs.length === 2, `${msgs.length} ข้อความ`);
  const empNotifs = (await req('GET','/notifications', emp)).j;
  check('ผู้แจ้งได้รับแจ้งเตือนข้อความใหม่', empNotifs.items.some(n => n.tag === 'ข้อความ'));

  // ผู้ดูแลระบบดูตั๋วงานได้อย่างเดียว
  check('Admin ดูรายละเอียดตั๋วได้', (await req('GET', `/tickets/${tid}`, admin)).status === 200);
  check('Admin คัดกรอง/มอบหมายไม่ได้',
    (await req('PATCH', `/tickets/${tid}/triage`, admin, { priority: 'low' })).status === 403);
  check('Admin เปลี่ยนสถานะไม่ได้',
    (await req('PATCH', `/tickets/${tid}/status`, admin, { status: 'inprogress' })).status === 403);
  check('Admin โอนย้ายงานไม่ได้',
    (await req('PATCH', `/tickets/${tid}/transfer`, admin, { assigneeId: thanawat._id })).status === 403);
  check('Admin ปิดงานไม่ได้',
    (await req('PATCH', `/tickets/${tid}/resolve`, admin, { note: 'x' })).status === 403);
  check('Admin แก้ไขรายละเอียดตั๋วไม่ได้',
    (await req('PATCH', `/tickets/${tid}`, admin, { title: 'x' })).status === 403);

  // เจ้าหน้าที่ IT ทำงานได้เฉพาะตั๋วที่ตนได้รับมอบหมาย
  const piyapong = await login('piyapong.w@company.co.th');
  check('ช่างคนอื่นเปลี่ยนสถานะตั๋วที่ไม่ใช่ของตนไม่ได้',
    (await req('PATCH', `/tickets/${tid}/status`, piyapong, { status: 'inprogress' })).status === 403);
  check('ช่างคนอื่นปิดงานที่ไม่ใช่ของตนไม่ได้',
    (await req('PATCH', `/tickets/${tid}/resolve`, piyapong, { note: 'x' })).status === 403);
  check('ช่างคนอื่นยังดูรายละเอียดตั๋วได้',
    (await req('GET', `/tickets/${tid}`, piyapong)).status === 200);
  check('ช่างคนอื่นตอบแชทในตั๋วที่ไม่ใช่ของตนไม่ได้',
    (await req('POST', `/tickets/${tid}/messages`, piyapong, { text: 'ขอแทรก' })).status === 403);
  check('ช่างคนอื่นยังดูประวัติแชทได้',
    (await req('GET', `/tickets/${tid}/messages`, piyapong)).status === 200);

  // 5. โอนย้ายตั๋วให้ทีมอื่น (เป็นหน้าที่ของ Helpdesk)
  const siriporn = techs.find(x => x.name.startsWith('ศิริพร'));
  const tr = await req('PATCH', `/tickets/${tid}/transfer`, helpdesk, { assigneeId: siriporn._id });
  check('Helpdesk โอนย้ายตั๋วให้ทีมอื่นได้', tr.status === 200 && tr.j.assignee?._id === siriporn._id, tr.j.message||'');
  check('ช่างเดิมหมดสิทธิ์หลังตั๋วถูกโอนไปให้คนอื่น',
    (await req('PATCH', `/tickets/${tid}/status`, tech, { status: 'inprogress' })).status === 403);
  check('ช่างเดิมตอบแชทไม่ได้หลังถูกโอนงาน',
    (await req('POST', `/tickets/${tid}/messages`, tech, { text: 'ขอตอบต่อ' })).status === 403);
  check('ช่างเดิมยังดูประวัติแชทได้หลังถูกโอนงาน',
    (await req('GET', `/tickets/${tid}/messages`, tech)).status === 200);

  // 6. ปิดตั๋วพร้อมบันทึก Resolution Note + เผยแพร่เข้า KB (โดยผู้รับผิดชอบคนใหม่)
  const newOwner = await login('siriporn.m@company.co.th');
  const noNote = await req('PATCH', `/tickets/${tid}/resolve`, newOwner, { note: '' });
  check('ปิดตั๋วโดยไม่มี Resolution Note ไม่ได้', noNote.status === 400);
  const kbBefore = (await req('GET','/articles', newOwner)).j.length;
  const res = await req('PATCH', `/tickets/${tid}/resolve`, newOwner, {
    note: 'เปลี่ยน USB receiver ตัวใหม่และติดตั้งไดรเวอร์ Logitech Options ใหม่', publishToKb: true
  });
  check('ผู้รับผิดชอบคนใหม่ปิดตั๋วพร้อม Resolution Note ได้', res.status === 200 && res.j.ticket.status === 'resolved', res.j.message||'');
  check('เผยแพร่เข้าฐานความรู้ได้', !!res.j.article?.ref, res.j.article?.ref);
  const kbAfter = (await req('GET','/articles', newOwner)).j.length;
  check('จำนวนบทความ KB เพิ่มขึ้น', kbAfter === kbBefore + 1, `${kbBefore} → ${kbAfter}`);

  // กดปิดซ้ำไม่ได้ — ป้องกันไทม์ไลน์และบทความ KB ซ้ำ
  const again = await req('PATCH', `/tickets/${tid}/resolve`, newOwner, { note: 'กดซ้ำ', publishToKb: true });
  check('ปิดตั๋วที่ปิดไปแล้วซ้ำไม่ได้', again.status === 400, again.j.message || '');
  check('บทความ KB ไม่ถูกสร้างซ้ำ',
    (await req('GET','/articles', newOwner)).j.length === kbAfter);

  // 7. แจ้งปัญหาได้เฉพาะพนักงานบริษัท
  const staffCreate = { title: 'ทีม IT ไม่ควรแจ้งปัญหาเองได้', description: 'x' };
  check('Helpdesk แจ้งปัญหาเองไม่ได้', (await req('POST', '/tickets', helpdesk, staffCreate)).status === 403);
  check('เจ้าหน้าที่ IT แจ้งปัญหาเองไม่ได้', (await req('POST', '/tickets', tech, staffCreate)).status === 403);
  check('Admin แจ้งปัญหาเองไม่ได้', (await req('POST', '/tickets', admin, staffCreate)).status === 403);

  const byEmp = await req('POST', '/tickets', emp, { title: 'พนักงานแจ้งปัญหาได้', description: 'x' });
  check('พนักงานบริษัทแจ้งปัญหาได้', byEmp.status === 201, byEmp.j.message || '');
  check('ตั๋วที่แจ้งใหม่เข้าคิวคัดกรอง',
    !byEmp.j.assignee && byEmp.j.status === 'new', `assignee=${byEmp.j.assigneeName} status=${byEmp.j.status}`);

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
  const nc = await req('POST','/categories', admin, { label:'ทดสอบหมวดหมู่', color:'#123456' });
  check('Admin เพิ่มหมวดหมู่ได้', nc.status === 201, nc.j.message||'');
  const uc = await req('PATCH', `/categories/${nc.j._id}`, admin, { label: 'ทดสอบหมวดหมู่ (แก้แล้ว)' });
  check('Admin แก้ไขหมวดหมู่ได้', uc.status === 200 && uc.j.label === 'ทดสอบหมวดหมู่ (แก้แล้ว)', uc.j.message||'');
  check('Admin ลบหมวดหมู่ได้', (await req('DELETE', `/categories/${nc.j._id}`, admin)).status === 200);

  const na = await req('POST','/announcements', admin, { title:'ทดสอบประกาศ E2E', whenText:'คืนนี้ 22:00', published:true });
  check('Admin สร้างประกาศได้', na.status === 201, na.j.message||'');
  const activeAnn = (await req('GET','/announcements?active=true', emp)).j;
  check('ประกาศที่เผยแพร่แสดงต่อผู้ใช้', activeAnn.some(a => a._id === na.j._id));
  await req('PATCH', `/announcements/${na.j._id}`, admin, { published:false });
  const afterHide = (await req('GET','/announcements?active=true', emp)).j;
  check('ปิดการแสดงประกาศได้', !afterHide.some(a => a._id === na.j._id));
  check('Admin ลบประกาศได้', (await req('DELETE', `/announcements/${na.j._id}`, admin)).status === 200);

  // 10. แดชบอร์ด
  const dash = (await req('GET','/stats/dashboard', admin)).j;
  check('แดชบอร์ดคืนค่า KPI ครบ',
    ['open','successRate','avgResponseMinutes','breachedThisMonth'].every(k => dash.kpis[k] !== undefined));
  check('กราฟ 14 วัน', dash.chart?.length === 14);
  check('สัดส่วนหมวดหมู่', dash.catStats?.length >= 5);
  check('พนักงานเข้าแดชบอร์ดไม่ได้ (สิทธิ์)', (await req('GET','/stats/dashboard', emp)).status === 403);
  check('เจ้าหน้าที่ IT เข้าแดชบอร์ดได้', (await req('GET','/stats/dashboard', tech)).status === 200);

  const wl = (await req('GET','/stats/workload', helpdesk)).j;
  check('ภาระงานเจ้าหน้าที่', Array.isArray(wl) && wl.length >= 3, `${wl.length} คน`);
  check('เจ้าหน้าที่ IT ดูภาระงานทีมไม่ได้ (สิทธิ์)', (await req('GET','/stats/workload', tech)).status === 403);

  // 11. แจ้งเตือน อ่านทั้งหมด
  await req('PATCH','/notifications/read-all', tech);
  check('ทำเครื่องหมายอ่านทั้งหมดได้', (await req('GET','/notifications', tech)).j.unread === 0);

  // 12. พนักงานยกเลิกตั๋วของตัวเอง
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
