# ระบบแจ้งปัญหาทางเทคโนโลยีสารสนเทศและบริหารจัดการตั๋วงาน

IT Service Desk — Incident & Ticket Management System
ดีไซน์อ้างอิงจากไฟล์ `ระบบแจ้งปัญหา IT.dc.html` (Claude Design)

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Vue 3 (Composition API) · Vite · Bootstrap 5 · Pinia · Vue Router · Socket.IO client |
| Backend | Node.js · Express 4 · Socket.IO · JWT · Multer |
| Database | MongoDB (Mongoose 8) |

---

## เริ่มต้นใช้งาน

### วิธีที่ 1 — โหมดสาธิต (ไม่ต้องติดตั้ง MongoDB)

รัน MongoDB แบบ in-memory พร้อมใส่ข้อมูลตัวอย่างให้อัตโนมัติ ข้อมูลจะหายเมื่อปิดโปรเซส

```bash
npm run install:all && npm run dev:demo
```

จากนั้นเปิดอีกเทอร์มินัล:

```bash
npm run dev:client
```

### วิธีที่ 2 — ใช้ MongoDB จริง (แนะนำ)

เริ่ม MongoDB ด้วย Docker:

```bash
npm run db:up
```

หรือใช้ MongoDB ที่ติดตั้งเองแล้วแก้ `MONGODB_URI` ใน `server/.env`

ใส่ข้อมูลตั้งต้น (ผู้ใช้งาน · หมวดหมู่ · ประกาศ — **คิวงานและฐานความรู้เริ่มต้นว่าง**):

```bash
npm run seed
```

เปิด backend และ frontend (คนละเทอร์มินัล):

```bash
npm run dev:server
```

```bash
npm run dev:client
```

เปิดเบราว์เซอร์ที่ **http://localhost:5173**

---

## บัญชีสำหรับทดสอบ

รหัสผ่านเดียวกันทุกบัญชี: `Password123!`
(กดปุ่มลัดบนหน้าเข้าสู่ระบบเพื่อกรอกให้อัตโนมัติได้)

| บทบาท | อีเมล |
|---|---|
| ผู้ดูแลระบบ (Admin) | `waraporn.c@company.co.th` |
| เจ้าหน้าที่รับแจ้งและคัดกรอง (IT Helpdesk) | `pimchanok.d@company.co.th` |
| เจ้าหน้าที่ฝ่าย IT (IT Support) | `thanawat.s@company.co.th` |
| พนักงานบริษัท (Employee) | `asniya.n@company.co.th` |

---

## ฟังก์ชันการทำงานตามบทบาท

### 1. ผู้ดูแลระบบ (Admin)

**1.1 บริหารจัดการผู้ใช้งาน** — หน้า *จัดการผู้ใช้งาน*
- เพิ่ม / แก้ไข / ลบสมาชิกทั้ง 4 บทบาท (พนักงาน · Helpdesk · เจ้าหน้าที่ IT · ผู้ดูแลระบบ)
- ระงับหรือเปิดใช้งานบัญชี — บัญชีที่ถูกระงับจะเข้าสู่ระบบไม่ได้ทันที (HTTP 403)
- ป้องกันการลบผู้ใช้ที่ยังถือตั๋วงานค้างอยู่ และการระงับบัญชีของตนเอง

> ผู้ดูแลระบบ **ดูตั๋วงานได้อย่างเดียว** — เห็นรายละเอียด สถานะ ผู้รับผิดชอบ และกำหนดเสร็จ
> แต่มอบหมาย โอนย้าย เปลี่ยนสถานะ หรือปิดงานไม่ได้
> การจัดการงานเป็นหน้าที่ของ IT Helpdesk และเจ้าหน้าที่ฝ่าย IT

**1.2 บริหารจัดการระบบและตั๋วงาน**
- *แดชบอร์ดภาพรวม* — ตั๋วงานเปิดอยู่, อัตราแก้ปัญหาสำเร็จ, เวลาตอบกลับเฉลี่ย, จำนวนที่เกินกำหนด, กราฟปริมาณตั๋ว 14 วัน (แจ้งเข้า vs ปิดงาน), สัดส่วนตามหมวดหมู่, รายการตั๋วที่ใกล้เกินกำหนด
- *ตั้งค่าระบบ* — จัดการหมวดหมู่ปัญหา (ชื่อ สี กำหนดเสร็จ กลุ่มงาน) และตารางระดับความรุนแรงกับเวลาตอบสนอง
- จัดการประกาศเตือนการปิดปรับปรุงระบบชั่วคราว — เมื่อเผยแพร่จะแสดงเป็นแบนเนอร์บนหัวเว็บของผู้ใช้ทุกคน

### 2. เจ้าหน้าที่ฝ่าย IT (IT Support / Technician)

**2.1 การรับงานและดำเนินงานแก้ไข** — หน้า *งานที่ได้รับมอบหมาย* (Kanban)
- ดูตั๋วงานที่ได้รับมอบหมายจาก Helpdesk แยกตามสถานะ 4 คอลัมน์
- ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนสถานะ หรือกดปุ่มสถานะในหน้ารายละเอียด
- สถานะ: กำลังดำเนินการ · รอดำเนินการ · แก้ไขสำเร็จ · ยกเลิก

**2.2 การสื่อสารและการประสานงาน**
- แชทเรียลไทม์ในตั๋วงานผ่าน Socket.IO พร้อมสถานะ "กำลังพิมพ์…" และแจ้งเตือน push
- โอนย้ายตั๋วให้เจ้าหน้าที่/ทีมอื่นเมื่อต้องใช้ความเชี่ยวชาญเฉพาะทาง

**2.3 บันทึกวิธีแก้ปัญหา (Resolution Note)**
- ต้องบันทึก Resolution Note ก่อนปิดตั๋วงานเสมอ
- ติ๊ก "เผยแพร่เข้าฐานความรู้ (KB)" เพื่อสร้างบทความ KB อัตโนมัติพร้อมเลข `KB-xxxx`

### 3. เจ้าหน้าที่รับแจ้งและคัดกรองปัญหา (IT Helpdesk)

**3.1 การรับเรื่องและออกแบบตั๋วงาน** — หน้า *คิวคัดกรอง*
- ตรวจสอบตั๋วเข้าใหม่ (แถวสีครีม) พร้อมแผงคัดกรองด้านข้าง
- จัดหมวดหมู่ปัญหา (Hardware / Software / Network / บัญชี-สิทธิ์ / อื่น ๆ)
- กำหนดระดับความสำคัญ Low / Medium / High / Critical — ระบบคำนวณกำหนดเสร็จใหม่ทันที
- โหมด "ออกตั๋วเอง" สำหรับรับแจ้งทางโทรศัพท์ / Walk-in / อีเมล / LINE แล้วออกตั๋วแทนผู้แจ้ง

**3.2 การจัดสรรและมอบหมายงาน**
- มอบหมายตั๋วให้เจ้าหน้าที่ พร้อมแสดงภาระงานปัจจุบันของแต่ละคนประกอบการตัดสินใจ
- เปลี่ยนผู้รับผิดชอบภายหลังได้ผ่านการโอนย้ายตั๋ว

**3.3 การแก้ปัญหาเบื้องต้นและการประสานงาน**
- ปุ่ม "ปิดเอง" สำหรับแก้ปัญหาพื้นฐานและปิดตั๋วได้ทันทีพร้อมบันทึกวิธีแก้
- แชทเรียลไทม์กับผู้แจ้งเพื่อสอบถามข้อมูลเพิ่มเติม

> **การแจ้งปัญหาด้วยตนเองทำได้เฉพาะพนักงานบริษัท** — ปุ่ม "+ แจ้งปัญหาใหม่" แสดงเฉพาะบทบาทนี้
> ส่วน **IT Helpdesk ออกตั๋วแทนผู้แจ้ง**ได้จากเมนู "ออกตั๋วเอง" ในแถบนำทาง
> สำหรับกรณีที่ผู้ใช้แจ้งเข้ามาทางโทรศัพท์ Walk-in อีเมล หรือ LINE
> เจ้าหน้าที่ฝ่าย IT และผู้ดูแลระบบเปิดตั๋วไม่ได้ (จำกัดสิทธิ์ที่ฝั่งเซิร์ฟเวอร์ด้วย)

### 4. พนักงานบริษัท (Employee)

- *แจ้งปัญหาใหม่* — กรอกอาการ, หมวดหมู่, สถานที่, อุปกรณ์ และแนบรูปภาพหลักฐาน (ลากวาง, สูงสุด 5 ไฟล์ · 10 MB)
- *ตั๋วงานของฉัน* — ติดตามสถานะและประวัติย้อนหลัง แยกแท็บกำลังดำเนินการ / ปิดแล้ว
- ดูรายละเอียดตั๋ว, แชทกับเจ้าหน้าที่, ยกเลิกตั๋วของตนเอง
- ค้นหาวิธีแก้ปัญหาด้วยตนเองจากฐานความรู้

---

## ระบบอัตโนมัติ

- **ออกเลขตั๋วอัตโนมัติ** รูปแบบ `INC-<ปี>-<running 6 หลัก>` ด้วยตัวนับแบบ atomic
- **ตั๋วใหม่เข้าคิวคัดกรองเสมอ** — Helpdesk เป็นผู้จัดหมวดหมู่ กำหนดความสำคัญ และมอบหมายเจ้าหน้าที่เอง
- **การแจ้งเตือนแยกตามบทบาท**

  | บทบาท | ได้รับแจ้งเตือนเรื่อง |
  |---|---|
  | IT Helpdesk | ตั๋วแจ้งปัญหาเข้าใหม่ที่รอคัดกรองเท่านั้น |
  | เจ้าหน้าที่ฝ่าย IT | ทุกความเคลื่อนไหวของตั๋วที่ตนรับผิดชอบ (ได้รับมอบหมาย · ข้อความแชท · เปลี่ยนสถานะ) |
  | พนักงานบริษัท | ความเคลื่อนไหวของตั๋วที่ตนแจ้งไว้ |
  | ผู้ดูแลระบบ | เฉพาะตั๋วที่ตนเกี่ยวข้องโดยตรง — ดูภาพรวมทั้งระบบได้จากแดชบอร์ดแทน |

  ประกาศปิดปรับปรุงระบบแสดงเป็นแบนเนอร์บนหัวเว็บ ไม่ส่งซ้ำเข้าศูนย์แจ้งเตือน
- **กำหนดเสร็จ** — คำนวณจากระดับความรุนแรง: Critical 1 ชม. · High 4 ชม. · Medium 1 วัน · Low 3 วัน
  (ในโค้ดยังใช้ชื่อตัวแปรว่า sla ตามศัพท์สากล แต่ข้อความที่ผู้ใช้เห็นเป็นภาษาไทยทั้งหมด)

---

## โครงสร้างโปรเจกต์

```
projectitsm/
├── docker-compose.yml          MongoDB สำหรับพัฒนา
├── server/                     Backend (Node.js + Express + MongoDB)
│   ├── src/
│   │   ├── index.js            จุดเริ่มต้น (ใช้ MongoDB จริง)
│   │   ├── devServer.js        โหมดสาธิต (MongoDB in-memory + seed อัตโนมัติ)
│   │   ├── app.js              ตั้งค่า Express
│   │   ├── seed.js             ข้อมูลตัวอย่าง
│   │   ├── config/             เชื่อมต่อฐานข้อมูล + ค่าคงที่
│   │   ├── models/             User · Ticket · Message · Category · Article
│   │   │                       Announcement · Notification · Rule · Counter
│   │   ├── controllers/        ตรรกะของแต่ละ resource
│   │   ├── routes/             นิยาม REST API
│   │   ├── middleware/         auth (JWT + RBAC) · upload · error
│   │   ├── sockets/            Socket.IO (แชท + แจ้งเตือน)
│   │   └── utils/              กำหนดเสร็จ · เลขตั๋ว · แจ้งเตือน
│   ├── test/                   ชุดทดสอบ e2e และ socket
│   └── uploads/                ไฟล์แนบ
└── client/                     Frontend (Vue 3 + Bootstrap 5)
    └── src/
        ├── assets/theme.css    Design tokens จากไฟล์ดีไซน์
        ├── components/         AppShell · AppSidebar · NotificationBell · ฯลฯ
        ├── views/              Login · Dashboard · Queue · Board · Users · IssueTicket
        │                       Settings · KnowledgeBase · NewTicket
        │                       MyTickets · TicketDetail · Profile
        ├── stores/             Pinia: auth · tickets · meta · notifications · ui
        ├── services/           api (axios) · socket · lookups · format
        └── router/             เส้นทาง + การ์ดตามบทบาท
```

---

## REST API

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| POST | `/api/auth/login` | ทุกคน | เข้าสู่ระบบ |
| GET | `/api/auth/me` | ล็อกอิน | ข้อมูลผู้ใช้ปัจจุบัน |
| PATCH | `/api/auth/password` | ล็อกอิน | เปลี่ยนรหัสผ่าน |
| GET | `/api/users` | admin, helpdesk | รายชื่อสมาชิก |
| GET | `/api/users/technicians` | staff | เจ้าหน้าที่ + ภาระงาน |
| POST · PATCH · DELETE | `/api/users/:id` | admin | จัดการสมาชิก |
| PATCH | `/api/users/:id/status` | admin | ระงับ / เปิดใช้งานบัญชี |
| GET | `/api/tickets` | ล็อกอิน | รายการตั๋ว (ขอบเขตตามบทบาท) |
| POST | `/api/tickets` | employee, helpdesk | แจ้งปัญหาใหม่ / ออกตั๋วแทนผู้แจ้ง (multipart รองรับไฟล์แนบ) |
| GET | `/api/tickets/:id` | ล็อกอิน | รายละเอียด (รับทั้ง `_id` และเลขตั๋ว) |
| PATCH | `/api/tickets/:id/triage` | admin, helpdesk | คัดกรอง + มอบหมาย |
| PATCH | `/api/tickets/:id/status` | ล็อกอิน | อัปเดตสถานะ |
| PATCH | `/api/tickets/:id/resolve` | staff | ปิดตั๋ว + Resolution Note + KB |
| PATCH | `/api/tickets/:id/transfer` | staff | โอนย้ายตั๋ว |
| GET · POST | `/api/tickets/:id/messages` | ล็อกอิน | แชทในตั๋วงาน |
| GET · POST · PATCH · DELETE | `/api/categories` | อ่าน: ล็อกอิน / เขียน: admin | หมวดหมู่ปัญหา |
| GET · POST · PATCH · DELETE | `/api/announcements` | อ่าน: ล็อกอิน / เขียน: admin | ประกาศ |
| GET · POST · PATCH · DELETE | `/api/articles` | อ่าน: ล็อกอิน / เขียน: staff | ฐานความรู้ |
| GET · PATCH | `/api/notifications` | ล็อกอิน | การแจ้งเตือน |
| GET | `/api/stats/dashboard` | ล็อกอิน | ข้อมูลแดชบอร์ด (ขอบเขตตามบทบาท) |
| GET | `/api/stats/workload` | admin, helpdesk | ภาระงานของทีม |

### Socket.IO

ยืนยันตัวตนด้วย JWT ผ่าน `auth.token` — เชื่อมต่อโดยไม่มี token จะถูกปฏิเสธ

| ทิศทาง | Event | คำอธิบาย |
|---|---|---|
| ส่ง | `ticket:join` / `ticket:leave` | เข้า/ออกห้องแชทของตั๋ว |
| ส่ง | `message:send` | ส่งข้อความ (มี ack) |
| ส่ง | `typing` | แจ้งสถานะกำลังพิมพ์ |
| รับ | `message:new` | ข้อความใหม่ในห้อง |
| รับ | `notification:new` | แจ้งเตือนส่วนตัว |
| รับ | `ticket:created` / `ticket:updated` | ตั๋วถูกสร้าง/อัปเดต |

---

## นำขึ้น host / เผยแพร่บนอินเทอร์เน็ต

ระบบรองรับการ deploy 2 รูปแบบ

### รูปแบบ A — เซิร์ฟเวอร์เดียว (แนะนำ, ง่ายที่สุด)

Backend เสิร์ฟทั้ง API, WebSocket และไฟล์เว็บ ใช้โดเมนเดียว ไม่ต้องตั้งค่า CORS เอง

```bash
npm run start:prod
```

**ทดสอบโหมด production บนเครื่องก่อน** (ใช้ MongoDB in-memory ไม่ต้องติดตั้งฐานข้อมูล):

```bash
PORT=4100 node server/src/prodDemo.js
```

#### ขึ้น Railway (มีไฟล์ `railway.json` เตรียมไว้ให้แล้ว)

ข้อดีของ Railway สำหรับโปรเจกต์นี้คือ **มี MongoDB ให้ในตัว** จึงไม่ต้องสมัคร MongoDB Atlas แยก

**1. ดันโค้ดขึ้น GitHub**

```bash
git init && git add -A && git commit -m "ระบบแจ้งปัญหา IT"
```

**2. สร้าง project บน Railway**

- [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → เลือก repo นี้
- Railway จะอ่าน `railway.json` แล้ว build ด้วย `Dockerfile` ให้เอง

> **ถ้า build ล้มเหลวภายในไม่กี่วินาที** พร้อมข้อความ `Failed to build an image`
> แปลว่า Railway ไม่ได้ใช้ `Dockerfile` แต่ไป auto-detect เอง
> แก้โดยไปที่ service → **Settings → Build → Builder** แล้วเลือก **Dockerfile** จากนั้นกด Redeploy
> (โปรเจกต์นี้ build ผ่านได้ทั้งสองทางอยู่แล้ว แต่ทาง Dockerfile เร็วกว่าและตรงกับที่ทดสอบไว้)

**3. เพิ่ม MongoDB**

- ในหน้า **Project Canvas** กดปุ่ม **+ New** (หรือกด `⌘K` / `Ctrl+K`) แล้วพิมพ์ค้นหา **MongoDB**
- เลือก MongoDB จากรายการ (เป็น template ที่ Railway เตรียมไว้ ใช้ official mongo image)
- ไปที่ service ของเว็บ → แท็บ **Variables** → **Add Variable Reference** → เลือก `MONGO_URL` จาก MongoDB service

> MongoDB ของ Railway เปิดใช้รหัสผ่าน และผู้ใช้ root อยู่ในฐานข้อมูล `admin`
> ระบบจึงเติมทั้งชื่อฐานข้อมูล `/itsm` และ `authSource=admin` ให้อัตโนมัติ
> ถ้าไม่เติม `authSource` จะขึ้น `Authentication failed`

**4. ตั้งตัวแปรที่เหลือ** (แท็บ Variables ของ service เว็บ)

| ตัวแปร | ค่า |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | ค่าสุ่มของคุณเอง — สร้างด้วย `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `SEED_ON_START` | `true` (เปลี่ยนเป็น `false` หลังใช้งานจริงแล้ว) |

**5. เพิ่ม volume เก็บไฟล์แนบ** — ข้ามขั้นนี้ไฟล์แนบจะหายทุกครั้งที่ deploy ใหม่

- service เว็บ → **Settings → Volumes → Add Volume**
- **Mount path:** `/data`
- `Dockerfile` ตั้ง `UPLOAD_DIR=/data/uploads` ไว้แล้ว จึงเก็บลง volume นี้อัตโนมัติ

> Railway **ไม่รองรับคำสั่ง `VOLUME` ใน Dockerfile** (build จะล้มด้วย `docker VOLUME ... is not supported`)
> จึงต้องประกาศ volume จาก dashboard เท่านั้น — Dockerfile ของโปรเจกต์นี้ไม่มีคำสั่งนั้นแล้ว

**6. เปิดโดเมน**

- **Settings → Networking → Generate Domain**
- Railway จะตั้ง `RAILWAY_PUBLIC_DOMAIN` ให้เอง ระบบใช้เป็น CORS origin อัตโนมัติ **จึงไม่ต้องตั้ง `CLIENT_ORIGIN`**

**7. เข้าใช้งาน** — เปิดโดเมนที่ได้แล้วล็อกอินด้วยบัญชีตัวอย่างข้างต้น

**8. หลังเปิดใช้งานได้แล้ว — สำคัญ**

- เปลี่ยนรหัสผ่านบัญชีตัวอย่างทั้งหมด หรือลบทิ้งแล้วสร้างผู้ใช้จริง
- ตั้ง `SEED_ON_START` เป็น `false`

#### ตรวจสถานะระบบหลัง deploy

เปิด `https://<โดเมนของคุณ>/api/health`

```json
{ "ok": true, "service": "itsm-api", "db": "connected", "dbError": null, "sockets": 2 }
```

| ฟิลด์ | ความหมาย |
|---|---|
| `db` | `connected` = ปกติ · `connecting` / `disconnected` = ต่อฐานข้อมูลไม่ได้ |
| `dbError` | สาเหตุที่ต่อไม่ได้ เช่น `getaddrinfo ENOTFOUND ...` แปลว่า `MONGO_URL` ผิดหรือยังไม่ได้ผูก MongoDB service |
| `sockets` | จำนวนผู้ใช้ที่เปิดหน้าเว็บค้างไว้ — ถ้าเป็น 0 ตลอดทั้งที่มีคนใช้ แปลว่า WebSocket ต่อไม่ติด |

> ระบบจะเปิดเซิร์ฟเวอร์ก่อนแล้วค่อยต่อฐานข้อมูลแบบพยายามซ้ำ
> ถ้าฐานข้อมูลยังไม่พร้อม `/api/health` จะยังตอบ 200 พร้อมบอกสาเหตุ ส่วน API อื่นตอบ 503
> เมื่อฐานข้อมูลพร้อมเมื่อไหร่ ระบบจะต่อเองโดยไม่ต้องรีสตาร์ต

#### ถ้า deploy ล้มที่ขั้น Healthcheck

แปลว่า build ผ่านแล้วแต่แอปตอบ healthcheck ไม่ได้ ให้ดู **Deploy Logs** ของ service

| ข้อความใน log | สาเหตุ |
|---|---|
| `[fatal] ต้องตั้งค่า JWT_SECRET ...` | ยังไม่ได้ตั้ง `JWT_SECRET` |
| `[fatal] ไม่พบทั้ง MONGODB_URI และ MONGO_URL` | ยังไม่ได้ผูก MongoDB service เข้ากับ service เว็บ |
| `[db] ต่อฐานข้อมูลไม่สำเร็จ ...` | ผูกแล้วแต่ค่าไม่ถูก — ดูสาเหตุที่ต่อท้ายข้อความ |

#### ค่าที่ host ตั้งให้อัตโนมัติ

| ตัวแปร | Railway | Render |
|---|---|---|
| พอร์ต | `PORT` | `PORT` |
| โดเมนสาธารณะ (ใช้เป็น CORS origin) | `RAILWAY_PUBLIC_DOMAIN` | `RENDER_EXTERNAL_URL` |
| ฐานข้อมูล | `MONGO_URL` (จาก MongoDB service) | ต้องใช้ MongoDB Atlas แล้วตั้ง `MONGODB_URI` เอง |

> นอกจากนี้ระบบยังยอมรับคำขอที่มาจากโดเมนเดียวกับที่เสิร์ฟหน้าเว็บเสมอ (same-origin)
> จึงใช้โดเมนที่ผูกเองได้โดยไม่ต้องแก้ `CLIENT_ORIGIN`

#### ขึ้น Render (มีไฟล์ `render.yaml` เตรียมไว้ให้แล้ว)

**1. เตรียมฐานข้อมูลที่ [MongoDB Atlas](https://www.mongodb.com/atlas)**

- สร้าง cluster แบบ **M0 (ฟรี)** เลือก region ใกล้ ๆ เช่น Singapore
- Database Access → สร้าง user พร้อมรหัสผ่าน
- Network Access → เพิ่ม `0.0.0.0/0` (Render ไม่มี IP ตายตัว)
- คัดลอก connection string มาเก็บไว้ แล้วเติมชื่อฐานข้อมูล `/itsm` ต่อท้าย host:

```
mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/itsm?retryWrites=true&w=majority
```

**2. ดันโค้ดขึ้น GitHub**

```bash
git init && git add -A && git commit -m "ระบบแจ้งปัญหา IT"
```

```bash
git remote add origin https://github.com/<username>/<repo>.git && git push -u origin main
```

**3. สร้าง service บน Render**

- [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → เลือก repo นี้
- Render จะอ่าน `render.yaml` แล้วตั้งค่าให้เองทั้งหมด
- ระบบจะถามค่าเดียวคือ **`MONGODB_URI`** — วาง connection string จากขั้นที่ 1
- กด **Apply** แล้วรอ build ประมาณ 3–5 นาที

**4. เข้าใช้งาน**

เปิด URL ที่ Render ให้มา (`https://itsm-xxxx.onrender.com`) แล้วเข้าสู่ระบบด้วยบัญชีตัวอย่างข้างต้น
ข้อมูลตั้งต้นถูกใส่ให้อัตโนมัติในการรันครั้งแรก (`SEED_ON_START=true`) และจะไม่ใส่ซ้ำเมื่อ deploy รอบถัดไป

**5. หลังเปิดใช้งานได้แล้ว — สำคัญ**

- เข้าหน้า *จัดการผู้ใช้งาน* เปลี่ยนรหัสผ่านบัญชีตัวอย่างทั้งหมด หรือลบทิ้งแล้วสร้างผู้ใช้จริง
- ตั้ง `SEED_ON_START` เป็น `false` ใน Environment ของ Render

#### เปรียบเทียบข้อจำกัด

| เรื่อง | Railway | Render (ฟรี) |
|---|---|---|
| หลับเมื่อไม่มีคนใช้ | ไม่หลับ | หลับหลัง 15 นาที คำขอแรกช้า 30–50 วินาที |
| MongoDB | มีให้ในตัว | ต้องใช้ Atlas แยก |
| Volume เก็บไฟล์แนบ | มี — ตั้ง mount path `/data` | ไม่มีในแพ็กเกจฟรี ไฟล์แนบหายทุกครั้งที่ deploy |
| ค่าใช้จ่าย | เครดิตรายเดือนแบบใช้แล้วหมด | ฟรีถาวรแต่มีข้อจำกัด |
| WebSocket | ใช้ได้ | ใช้ได้ |

> รายละเอียดแพ็กเกจของทั้งสองเจ้าเปลี่ยนบ่อย ควรเช็คหน้า pricing ปัจจุบันก่อนสมัคร

### รูปแบบ B — แยก host คนละที่

Frontend ขึ้น static host (Netlify / Vercel / GitHub Pages) และ backend ขึ้นที่อื่น

1. ตั้งค่าตอน build frontend — สร้าง `client/.env`:

```
VITE_API_BASE_URL=https://itsm-api.example.com/api
VITE_SOCKET_URL=https://itsm-api.example.com
```

2. ตั้งค่า backend ให้อนุญาตโดเมนของ frontend — ใน `server/.env`:

```
CLIENT_ORIGIN=https://itsm.example.com
```

> โปรเจกต์ใช้ `createWebHashHistory` (URL เป็นแบบ `/#/dashboard`) จึงขึ้น static host ได้เลย **ไม่ต้องตั้ง rewrite rule**

### สิ่งที่ต้องเตรียม

| หัวข้อ | รายละเอียด |
|---|---|
| **ฐานข้อมูล** | ต้องมี MongoDB ที่เข้าถึงได้จากอินเทอร์เน็ต — [MongoDB Atlas](https://www.mongodb.com/atlas) มีแพ็กเกจฟรี (M0) เพียงพอสำหรับระบบขนาดนี้ นำ connection string มาใส่ `MONGODB_URI` |
| **JWT_SECRET** | **ต้องเปลี่ยน** เป็นค่าสุ่มของตัวเอง — ระบบจะไม่ยอมสตาร์ตถ้ายังเป็นค่า default ตอน `NODE_ENV=production`<br>สร้างด้วย `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| **CLIENT_ORIGIN** | ใส่โดเมนของเว็บ ใส่หลายค่าได้โดยคั่นด้วยจุลภาค |
| **ไฟล์แนบ** | เก็บบนดิสก์ที่ `server/uploads` — host แบบ PaaS ส่วนใหญ่ลบไฟล์ทิ้งทุกครั้งที่ deploy ใหม่ ต้อง mount volume ถาวร หรือย้ายไปเก็บบน S3 / Cloudinary |
| **ข้อมูลตั้งต้น** | รัน `npm run seed` ครั้งเดียวหลัง deploy เพื่อสร้างผู้ใช้ หมวดหมู่ กฎ และฐานความรู้ (คิวงานจะว่าง) |
| **HTTPS** | จำเป็นสำหรับใช้งานจริง — host ส่วนใหญ่ออกใบรับรองให้อัตโนมัติ ถ้าใช้ VPS เองใช้ Nginx + Let's Encrypt |
| **WebSocket** | แชทเรียลไทม์ใช้ WebSocket — ต้องเลือก host ที่รองรับ (Render, Railway, Fly.io รองรับ / **Vercel Serverless ไม่รองรับ** ใช้ได้เฉพาะฝั่ง frontend) |

### เช็กก่อนเปิดใช้จริง

- [ ] เปลี่ยน `JWT_SECRET` เป็นค่าสุ่ม
- [ ] ตั้ง `NODE_ENV=production`
- [ ] ชี้ `MONGODB_URI` ไปที่ฐานข้อมูลจริง และเปิด IP allowlist ให้เซิร์ฟเวอร์
- [ ] ตั้ง `CLIENT_ORIGIN` เป็นโดเมนจริง
- [ ] เปลี่ยนรหัสผ่านของบัญชีตัวอย่างทั้งหมด (หรือลบทิ้งแล้วสร้างผู้ใช้จริง)
- [ ] เตรียม volume ถาวรสำหรับ `server/uploads`
- [ ] เปิด HTTPS

---

## ล้างข้อมูลการใช้งาน

เมื่อต้องการเคลียร์ข้อมูลที่เกิดจากการทดลองใช้งาน:

```bash
npm run clear:tickets
```

```bash
npm run clear:kb
```

```bash
npm run clear:all
```

| คำสั่ง | ลบอะไร |
|---|---|
| `clear:tickets` | ตั๋วงาน · แชทในตั๋ว · การแจ้งเตือนที่ผูกกับตั๋ว · ตัวนับเลขตั๋ว |
| `clear:kb` | บทความฐานความรู้ · ตัวนับเลขบทความ |
| `clear:all` | ทั้งสองอย่าง |

เลขจะเริ่มนับใหม่จาก `INC-<ปี>-000001` และ `KB-0001`
- **เก็บไว้:** ผู้ใช้งาน · หมวดหมู่ · ประกาศ

> คำสั่งนี้ทำงานกับ MongoDB ที่ระบุใน `MONGODB_URI` — **ถ้าใช้โหมดสาธิต** (`npm run dev:demo`) ฐานข้อมูลอยู่ในหน่วยความจำ ให้ปิดแล้วเปิดใหม่แทน
>
> **บน Railway** รันได้จากแท็บ **Console** ของ service เว็บ

> การลบตั๋วรายใบผ่าน `DELETE /api/tickets/:id` (สิทธิ์ Admin) จะเก็บกวาดแชทและการแจ้งเตือนของตั๋วนั้นให้อัตโนมัติ พร้อมกระจาย event `ticket:deleted` ให้ทุกหน้าจอที่เปิดอยู่อัปเดตทันที

---

## ชุดทดสอบ

เปิด backend ทิ้งไว้ก่อน แล้วรัน:

```bash
npm test
```

- `server/test/e2e.js` — 48 รายการ ครอบคลุมทุกฟังก์ชันตามบทบาทและการควบคุมสิทธิ์
- `server/test/socket.js` — 7 รายการ ครอบคลุมแชทเรียลไทม์ การแจ้งเตือน และการยืนยันตัวตนของ socket

---

## Responsive

ทดสอบแล้วว่าไม่มี horizontal overflow ในทุกหน้าที่ความกว้าง 375px (มือถือ), 768px (แท็บเล็ต) และ 1440px (เดสก์ท็อป)

- **≥ 1200px** — โครงเต็มตามดีไซน์: เมนูข้าง 240px + เนื้อหา + แผงด้านข้าง
- **768–1199px** — แผงด้านข้างเลื่อนลงมาต่อท้าย, Kanban เหลือ 2 คอลัมน์, KPI เหลือ 2 คอลัมน์
- **< 992px** — เมนูข้างกลายเป็น drawer เปิดด้วยปุ่มแฮมเบอร์เกอร์ พร้อมฉากหลังปิด
- **< 768px** — ตารางคิวเปลี่ยนเป็นการ์ดหลายบรรทัด, Kanban เหลือ 1 คอลัมน์, ช่องค้นหายุบเป็นปุ่มไอคอน

---

## หมายเหตุด้านความปลอดภัย

- รหัสผ่านเข้ารหัสด้วย bcrypt และไม่ถูกส่งกลับใน response ใด ๆ
- JWT อายุ 7 วัน (ตั้งค่าได้ที่ `JWT_EXPIRES_IN`) — **ต้องเปลี่ยน `JWT_SECRET` ก่อนใช้งานจริง**
- การควบคุมสิทธิ์บังคับที่ฝั่ง backend ทุกเส้นทาง (พนักงานเห็นเฉพาะตั๋วของตนเอง, ปิดตั๋วเองไม่ได้)
- ไฟล์แนบจำกัดชนิด (JPG/PNG/GIF/WEBP/PDF) และขนาดไม่เกิน 10 MB ต่อไฟล์
