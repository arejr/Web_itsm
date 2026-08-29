const { io } = require('socket.io-client');
const BASE = 'http://localhost:4000';
const PW = 'Password123!';

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username: email, password: PW })
  });
  return (await r.json()).token;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const results = [];
  const techTok = await login('thanawat.s@company.co.th');
  const empTok = await login('asniya.n@company.co.th');
  const hdTok = await login('pimchanok.d@company.co.th');

  // ปฏิเสธการเชื่อมต่อที่ไม่มี token
  const anon = io(BASE, { auth: {}, transports: ['websocket'] });
  const anonErr = await new Promise(r => { anon.on('connect_error', () => r(true)); anon.on('connect', () => r(false)); });
  results.push(['ปฏิเสธ socket ที่ไม่มี token', anonErr]);
  anon.disconnect();

  const techS = io(BASE, { auth: { token: techTok }, transports: ['websocket'] });
  const empS  = io(BASE, { auth: { token: empTok  }, transports: ['websocket'] });
  await Promise.all([techS, empS].map(s => new Promise(r => s.on('connect', r))));
  results.push(['เชื่อมต่อ socket ด้วย token สำเร็จ', true]);

  // สร้างตั๋วใหม่ที่มอบหมายให้เจ้าหน้าที่คนนี้โดยตรง
  // (เจ้าหน้าที่ IT ตอบแชทได้เฉพาะตั๋วที่ตนได้รับมอบหมาย)
  const techs = await (await fetch(`${BASE}/api/users/technicians`, { headers: { Authorization: `Bearer ${hdTok}` } })).json();
  const me = techs.find((x) => x.name.startsWith('ธนวัฒน์'));
  const t = await (await fetch(`${BASE}/api/tickets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'ทดสอบแชทเรียลไทม์', description: 'x' })
  })).json();
  await fetch(`${BASE}/api/tickets/${t._id}/triage`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${hdTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assigneeId: me._id })
  });

  techS.emit('ticket:join', t._id);
  empS.emit('ticket:join', t._id);
  await wait(250);

  // แชทเรียลไทม์ผ่าน socket
  const gotByEmp = new Promise(r => empS.once('message:new', r));
  const ack = await new Promise(r => techS.emit('message:send', { ticketId: t._id, text: 'ทดสอบข้อความเรียลไทม์จากเจ้าหน้าที่' }, r));
  results.push(['ส่งข้อความผ่าน socket ได้', ack?.ok === true, ack?.message]);
  const received = await Promise.race([gotByEmp, wait(2500).then(()=>null)]);
  results.push(['อีกฝั่งได้รับข้อความทันที', received?.text === 'ทดสอบข้อความเรียลไทม์จากเจ้าหน้าที่']);

  // สถานะ "กำลังพิมพ์"
  const gotTyping = new Promise(r => empS.once('typing', r));
  techS.emit('typing', { ticketId: t._id, typing: true });
  const typing = await Promise.race([gotTyping, wait(2000).then(()=>null)]);
  results.push(['ได้รับสัญญาณกำลังพิมพ์', typing?.typing === true]);

  // การแจ้งเตือนแบบ push เมื่อมีการมอบหมาย
  // พนักงานเป็นผู้แจ้ง แล้ว Helpdesk คัดกรองมอบหมายให้เจ้าหน้าที่
  const gotNotif = new Promise(r => techS.once('notification:new', r));
  const newT = await (await fetch(`${BASE}/api/tickets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'ทดสอบ socket — มอบหมายทันที', description: 'x' })
  })).json();
  await fetch(`${BASE}/api/tickets/${newT._id}/triage`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${hdTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assigneeId: me._id })
  });
  const notif = await Promise.race([gotNotif, wait(2500).then(()=>null)]);
  results.push(['ได้รับ push แจ้งเตือนการมอบหมาย', notif?.ticketCode === newT.code, notif?.title]);

  // เหตุการณ์ตั๋วอัปเดตแบบ broadcast
  const gotUpdate = new Promise(r => empS.once('ticket:updated', r));
  await fetch(`${BASE}/api/tickets/${newT._id}/status`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${techTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'inprogress' })
  });
  const upd = await Promise.race([gotUpdate, wait(2500).then(()=>null)]);
  results.push(['กระจายเหตุการณ์ ticket:updated', upd?.status === 'inprogress']);

  techS.disconnect(); empS.disconnect();

  const failed = results.filter(r => !r[1]);
  results.forEach(([n, pass, extra]) => console.log(`   ${pass ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`));
  console.log(failed.length ? `\n❌ ไม่ผ่าน ${failed.length}` : `\n✅ ผ่านทั้งหมด ${results.length} รายการ`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
