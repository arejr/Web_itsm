const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const tickets = require('../controllers/ticketController');
const messages = require('../controllers/messageController');
const categories = require('../controllers/categoryController');
const announcements = require('../controllers/announcementController');
const articles = require('../controllers/articleController');
const notifications = require('../controllers/notificationController');
const stats = require('../controllers/statsController');

const router = express.Router();

/* ---------- Auth ---------- */
router.post('/auth/login', auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/password', requireAuth, auth.changePassword);

/* ---------- ผู้ใช้งาน (Admin) ---------- */
router.get('/users/technicians', requireAuth, requireRole('admin', 'helpdesk', 'tech'), users.technicians);
router.get('/users', requireAuth, requireRole('admin', 'helpdesk'), users.list);
router.post('/users', requireAuth, requireRole('admin'), users.create);
router.patch('/users/:id/status', requireAuth, requireRole('admin'), users.toggleActive);
router.patch('/users/:id', requireAuth, requireRole('admin'), users.update);
router.delete('/users/:id', requireAuth, requireRole('admin'), users.remove);

/* ---------- ตั๋วงาน ---------- */
router.get('/tickets', requireAuth, tickets.list);
// แจ้งปัญหาเป็นหน้าที่ของพนักงานบริษัทเท่านั้น
// ทีม IT มีหน้าที่รับเรื่องและแก้ไข ไม่ใช่ผู้แจ้ง
router.post('/tickets', requireAuth, requireRole('employee'), upload.array('attachments', 5), tickets.create);
router.get('/tickets/:id', requireAuth, tickets.get);
// ผู้ดูแลระบบดูตั๋วงานได้อย่างเดียว การจัดการงานเป็นหน้าที่ของ Helpdesk และเจ้าหน้าที่ IT
router.patch('/tickets/:id/triage', requireAuth, requireRole('helpdesk'), tickets.triage);
router.patch('/tickets/:id/status', requireAuth, tickets.updateStatus);
router.patch('/tickets/:id/resolve', requireAuth, requireRole('helpdesk', 'tech'), tickets.resolve);
router.patch('/tickets/:id/transfer', requireAuth, requireRole('helpdesk', 'tech'), tickets.transfer);
router.patch('/tickets/:id', requireAuth, requireRole('helpdesk', 'tech'), tickets.update);
router.post('/tickets/:id/attachments', requireAuth, requireRole('helpdesk', 'tech', 'employee'), upload.array('attachments', 5), tickets.addAttachments);
router.delete('/tickets/:id', requireAuth, requireRole('admin'), tickets.remove);

/* ---------- แชทในตั๋วงาน ---------- */
router.get('/tickets/:id/messages', requireAuth, messages.list);
router.post('/tickets/:id/messages', requireAuth, messages.create);

/* ---------- หมวดหมู่ปัญหา ---------- */
router.get('/categories', requireAuth, categories.list);
router.post('/categories', requireAuth, requireRole('admin'), categories.create);
router.patch('/categories/:id', requireAuth, requireRole('admin'), categories.update);
router.delete('/categories/:id', requireAuth, requireRole('admin'), categories.remove);

/* ---------- ประกาศปิดปรับปรุงระบบ ---------- */
router.get('/announcements', requireAuth, announcements.list);
router.post('/announcements', requireAuth, requireRole('admin'), announcements.create);
router.patch('/announcements/:id', requireAuth, requireRole('admin'), announcements.update);
router.delete('/announcements/:id', requireAuth, requireRole('admin'), announcements.remove);

/* ---------- ฐานความรู้ ---------- */
router.get('/articles', requireAuth, articles.list);
router.get('/articles/:id', requireAuth, articles.get);
router.post('/articles', requireAuth, requireRole('admin', 'helpdesk', 'tech'), articles.create);
router.patch('/articles/:id', requireAuth, requireRole('admin', 'helpdesk', 'tech'), articles.update);
router.delete('/articles/:id', requireAuth, requireRole('admin'), articles.remove);

/* ---------- การแจ้งเตือน ---------- */
router.get('/notifications', requireAuth, notifications.list);
router.patch('/notifications/read-all', requireAuth, notifications.markAllRead);
router.patch('/notifications/:id/read', requireAuth, notifications.markRead);

/* ---------- สถิติ ---------- */
router.get('/stats/dashboard', requireAuth, requireRole('admin', 'helpdesk', 'tech'), stats.dashboard);
router.get('/stats/workload', requireAuth, requireRole('admin', 'helpdesk'), stats.workload);

module.exports = router;
