<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { errMsg } from '@/services/api';
import { getSocket } from '@/services/socket';
import { useAuthStore } from '@/stores/auth';
import { useMetaStore } from '@/stores/meta';
import { useTicketStore } from '@/stores/tickets';
import { useUiStore } from '@/stores/ui';
import { PRIORITY, PRIORITY_ORDER, STATUS, STATUS_TRACK, prio, stat } from '@/services/lookups';
import { thDateTime, timeOnly, relTime, fileSize } from '@/services/format';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const meta = useMetaStore();
const store = useTicketStore();
const ui = useUiStore();

const t = computed(() => store.current);
const loading = ref(true);
const messages = ref([]);
const chatText = ref('');
const typingBy = ref('');
const note = ref('');
const publishKb = ref(false);
const busy = ref(false);
const chatBox = ref(null);
const showTransfer = ref(false);
const transferTo = ref('');
const showResolve = ref(false);
const noteBox = ref(null);
let typingTimer = null;

const ticketId = computed(() => route.params.id);

async function scrollChat() {
  await nextTick();
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
}

async function loadAll() {
  loading.value = true;
  try {
    await meta.load();
    const ticket = await store.fetchOne(ticketId.value);
    note.value = ticket.resolutionNote || '';
    const { data } = await api.get(`/tickets/${ticket._id}/messages`);
    messages.value = data;
    joinRoom(ticket._id);
    scrollChat();
    if (auth.isStaff) meta.loadTechnicians();
  } catch (err) {
    ui.error(errMsg(err, 'ไม่พบตั๋วงานนี้'));
    router.replace({ name: auth.isEmployee ? 'my-tickets' : 'queue' });
  } finally {
    loading.value = false;
  }
}

let joinedRoom = null;
function joinRoom(id) {
  const socket = getSocket();
  if (!socket) return;
  if (joinedRoom) socket.emit('ticket:leave', joinedRoom);
  socket.emit('ticket:join', id);
  joinedRoom = id;
}

function onIncoming(msg) {
  if (String(msg.ticket) !== String(t.value?._id)) return;
  if (messages.value.some((m) => m._id === msg._id)) return;
  messages.value.push(msg);
  scrollChat();
}
function onTyping({ name, typing }) {
  typingBy.value = typing ? name : '';
}

onMounted(async () => {
  await loadAll();
  const socket = getSocket();
  socket?.on('message:new', onIncoming);
  socket?.on('typing', onTyping);
});

onBeforeUnmount(() => {
  const socket = getSocket();
  socket?.off('message:new', onIncoming);
  socket?.off('typing', onTyping);
  if (joinedRoom) socket?.emit('ticket:leave', joinedRoom);
});

watch(() => route.params.id, loadAll);

/* ---------- แชท ---------- */
function onChatInput() {
  const socket = getSocket();
  if (!socket || !t.value) return;
  socket.emit('typing', { ticketId: t.value._id, typing: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('typing', { ticketId: t.value._id, typing: false }), 1200);
}

async function sendChat() {
  const text = chatText.value.trim();
  if (!text || !t.value) return;
  chatText.value = '';
  try {
    const { data } = await api.post(`/tickets/${t.value._id}/messages`, { text });
    onIncoming(data);
  } catch (err) {
    ui.error(errMsg(err));
  }
}

/* ---------- การจัดการตั๋ว ---------- */
// เจ้าหน้าที่ฝ่าย IT ทำงานได้เฉพาะตั๋วที่ตนได้รับมอบหมาย
const isMyTicket = computed(() => String(t.value?.assignee?._id || '') === String(auth.user?._id || ''));

// ผู้ดูแลระบบดูตั๋วงานได้อย่างเดียว การจัดการงานเป็นหน้าที่ของ Helpdesk และเจ้าหน้าที่ IT
const canAct = computed(() => auth.isHelpdesk || (auth.isTech && isMyTicket.value));

// เจ้าหน้าที่ IT ที่ไม่ใช่ผู้รับผิดชอบตั๋วใบนี้ — ดูได้อย่างเดียว
const isOtherTech = computed(() => auth.isTech && !isMyTicket.value);

// ตอบแชทได้เฉพาะผู้ที่เกี่ยวข้องกับตั๋วใบนั้น — ช่างที่ถูกโอนงานไปแล้วดูประวัติได้อย่างเดียว
const canChat = computed(() => !isOtherTech.value);

// ตั๋วที่ปิดหรือยกเลิกแล้วไม่ต้องมีปุ่มปิดงานและมอบหมายงานอีก เหลือแค่แสดงวิธีแก้ที่บันทึกไว้
const isClosed = computed(() => ['resolved', 'cancelled'].includes(t.value?.status));

/**
 * สิ่งที่แต่ละบทบาททำได้ในแผงจัดการตั๋วงาน
 *   เจ้าหน้าที่ฝ่าย IT — รับงาน (กำลังดำเนินการ) แล้วบันทึกวิธีแก้เพื่อปิดงาน
 *   IT Helpdesk       — ปิดงานที่แก้เบื้องต้นได้ · มอบหมายงานให้เจ้าหน้าที่ · ยกเลิก
 */
const showStatusButtons = computed(() => auth.isTech);
const showTransferButton = computed(() => auth.isHelpdesk);
// จัดหมวดหมู่ปัญหาเป็นหน้าที่ของ Helpdesk และทำได้เฉพาะตั๋วที่ยังไม่ปิด
const canTriage = computed(() => auth.isHelpdesk && !isClosed.value);
const showCancelButton = computed(() => auth.isHelpdesk);
const isReadOnlyAdmin = computed(() => auth.isAdmin);
// เจ้าหน้าที่ IT กดรับงานอย่างเดียว ส่วนการปิดงานใช้ปุ่มบันทึกและปิดตั๋วงานที่บังคับให้กรอกวิธีแก้
const statusButtons = ['inprogress'];

const trackIndex = computed(() => STATUS_TRACK.findIndex((s) => s.key === t.value?.status));

async function setStatus(status) {
  busy.value = true;
  try {
    const { data } = await api.patch(`/tickets/${t.value._id}/status`, { status });
    store.upsert(data);
    ui.success(`อัปเดตสถานะเป็น ${stat(status).label} แล้ว`);
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

function toggleResolve() {
  showResolve.value = !showResolve.value;
  if (!showResolve.value) return;
  showTransfer.value = false;
  nextTick(() => noteBox.value?.focus());
}

function closeResolve() {
  showResolve.value = false;
  note.value = '';
  publishKb.value = false;
}

function toggleTransfer() {
  showTransfer.value = !showTransfer.value;
  if (showTransfer.value) showResolve.value = false;
}

async function resolveTicket() {
  if (!note.value.trim()) {
    ui.error('กรุณาบันทึกวิธีแก้ปัญหา (Resolution Note) ก่อนปิดตั๋วงาน');
    return;
  }
  busy.value = true;
  try {
    const { data } = await api.patch(`/tickets/${t.value._id}/resolve`, {
      note: note.value.trim(),
      publishToKb: publishKb.value
    });
    store.upsert(data.ticket);
    ui.success(data.article ? `ปิดตั๋วงานและเผยแพร่เป็น ${data.article.ref} แล้ว` : 'ปิดตั๋วงานเรียบร้อยแล้ว');
    closeResolve();
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

async function doTransfer() {
  if (!transferTo.value) {
    ui.error('กรุณาเลือกเจ้าหน้าที่ปลายทาง');
    return;
  }
  busy.value = true;
  try {
    const { data } = await api.patch(`/tickets/${t.value._id}/transfer`, { assigneeId: transferTo.value });
    store.upsert(data);
    showTransfer.value = false;
    transferTo.value = '';
    ui.success('มอบหมายงานเรียบร้อยแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

// Helpdesk จัดหมวดหมู่ปัญหาได้จากหน้ารายละเอียด ไม่ต้องย้อนกลับไปหน้าคิวคัดกรอง
async function setCategory(cat) {
  if (busy.value || String(t.value.category?._id || '') === String(cat._id)) return;
  busy.value = true;
  try {
    const { data } = await api.patch(`/tickets/${t.value._id}/triage`, { categoryId: cat._id });
    store.upsert(data);
    ui.success(`จัดหมวดหมู่เป็น ${cat.label} แล้ว`);
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

// เปลี่ยนระดับความสำคัญแล้วกำหนดเสร็จจะถูกคำนวณใหม่ตามระดับที่เลือกโดยอัตโนมัติ
async function setPriority(p) {
  if (busy.value || t.value.priority === p) return;
  busy.value = true;
  try {
    const { data } = await api.patch(`/tickets/${t.value._id}/triage`, { priority: p });
    store.upsert(data);
    ui.success(`กำหนดระดับความสำคัญเป็น ${PRIORITY[p].label} แล้ว`);
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

// Helpdesk ยกเลิกตั๋วงาน (ใช้ปุ่มแยก เพราะไม่มีแถวปุ่มสถานะให้กด)
async function cancelTicket() {
  const yes = await ui.confirm({
    title: 'ต้องการยกเลิกตั๋วงานนี้ใช่หรือไม่',
    text: `${t.value.code} · ${t.value.title} — ตั๋วที่ยกเลิกแล้วจะปิดลงและแก้ไขต่อไม่ได้`,
    okLabel: 'ยกเลิกตั๋วงาน',
    cancelLabel: 'ไม่ยกเลิก',
    danger: true
  });
  if (!yes) return;
  await setStatus('cancelled');
}

async function cancelOwn() {
  const yes = await ui.confirm({
    title: 'ต้องการยกเลิกตั๋วงานนี้ใช่หรือไม่',
    text: `${t.value.code} · ${t.value.title} — ยกเลิกแล้วจะไม่มีเจ้าหน้าที่รับเรื่องต่อ`,
    okLabel: 'ยกเลิกตั๋วงาน',
    cancelLabel: 'ไม่ยกเลิก',
    danger: true
  });
  if (!yes) return;
  busy.value = true;
  try {
    const { data } = await api.patch(`/tickets/${t.value._id}/status`, { status: 'cancelled', reason: 'ผู้แจ้งยกเลิกเอง' });
    store.upsert(data);
    ui.success('ยกเลิกตั๋วงานแล้ว');
  } catch (err) {
    ui.error(errMsg(err));
  } finally {
    busy.value = false;
  }
}

// สีจุดบนไทม์ไลน์ตามชนิดเหตุการณ์
const TIMELINE_DOT = {
  info: '#9aa4ac', assign: '#14776b', status: '#3d84b8',
  resolve: '#6cb33f', transfer: '#7b5cd6', cancel: '#c0392b'
};
function timelineDot(e) {
  if (e.kind === 'priority') return prio(t.value?.priority).dot;
  return TIMELINE_DOT[e.kind] || '#9aa4ac';
}

function goBack() {
  router.push({ name: auth.isEmployee ? 'my-tickets' : auth.isTech ? 'board' : 'queue' });
}
</script>

<template>
  <div v-if="loading" class="d-flex flex-column gap-3">
    <div class="skeleton" style="height: 220px"></div>
    <div class="skeleton" style="height: 320px"></div>
  </div>

  <div v-else-if="t" class="d-flex flex-column gap-3">
    <button class="btn-ghost align-self-start" type="button" @click="goBack">← กลับไปหน้ารายการ</button>

    <div class="detail-layout">
      <div class="detail-main">
        <!-- บันทึกเหตุการณ์ (Incident record) -->
        <div class="card-surface card-surface--flush record-card">
          <div class="record__accent" :style="{ background: prio(t.priority).dot }"></div>

          <div class="record__head">
            <h1 class="record__title">{{ t.title }}</h1>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="record__type">
                <svg class="record__type-icon" viewBox="0 0 16 20" fill="none" aria-hidden="true">
                  <path
                    d="M2.6 1.4h6.6l4.2 4.2v13a1 1 0 0 1-1 1H2.6a1 1 0 0 1-1-1V2.4a1 1 0 0 1 1-1Z"
                    fill="#fff" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"
                  />
                  <path d="M9.2 1.4v4.2h4.2" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
                  <path d="M4.4 9.4h7M4.4 12.4h7M4.4 15.4h4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                </svg>{{ t.incidentType }}
              </span>
              <span class="mono record__code">{{ t.code }}</span>
              <span class="pill" :style="{ background: prio(t.priority).bg, color: prio(t.priority).fg }">
                {{ prio(t.priority).label }}
              </span>
              <span class="record__updated">อัปเดตล่าสุด {{ thDateTime(t.updatedAt) }}</span>
            </div>

            <div class="record__status">
              <div class="d-flex flex-column gap-1">
                <span class="meta-label">สถานะตั๋วงาน</span>
                <span class="record__status-value" :style="{ color: stat(t.status).fg }">{{ stat(t.status).label }}</span>
              </div>
              <div class="track">
                <div v-for="(s, i) in STATUS_TRACK" :key="s.key" class="track__step">
                  <div class="track__bar" :style="{ background: i <= trackIndex ? '#6cb33f' : '#e3e7ea' }"></div>
                  <span class="track__label" :style="{ color: i <= trackIndex ? '#22292f' : 'var(--muted-3)' }">{{ s.label }}</span>
                </div>
              </div>
            </div>

            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span style="font: 400 12px var(--font-th); color: var(--muted-2)">เหตุผลของสถานะ:</span>
              <span style="font: 500 12.5px var(--font-th); color: var(--ink-strong)">{{ t.statusReason }}</span>
            </div>
          </div>

          <!-- ข้อมูลผู้แจ้ง -->
          <div class="record__section record__grid">
            <div class="d-flex flex-column gap-3">
              <div class="d-flex align-items-center gap-3">
                <div class="position-relative">
                  <div class="avatar avatar--lg">{{ t.requesterInitial }}</div>
                  <span class="presence" :style="{ background: t.slaRisk ? '#c0392b' : '#6cb33f' }"></span>
                </div>
                <div class="d-flex flex-column gap-1">
                  <span class="meta-label">ผู้แจ้งปัญหา</span>
                  <span class="record__requester">{{ t.requesterDisplay }}</span>
                </div>
              </div>
              <div class="d-flex flex-column gap-3">
                <div><span class="meta-label">หน่วยงาน</span><span class="meta-value">{{ t.company || '—' }}</span></div>
                <div><span class="meta-label">รหัสองค์กร</span><span class="meta-value">{{ t.orgCode || '—' }}</span></div>
                <div><span class="meta-label">แผนก</span><span class="meta-value">{{ t.requesterDept || '—' }}</span></div>
              </div>
            </div>

            <div class="d-flex flex-column gap-3">
              <div class="d-flex align-items-center gap-2">
                <span class="contact-icon">☎</span>
                <span class="mono contact-link">{{ t.requesterPhone || '—' }}</span>
              </div>
              <div class="d-flex align-items-center gap-2 min-w-0">
                <span class="contact-icon">✉</span>
                <span class="mono contact-link text-truncate">{{ t.requesterEmail || '—' }}</span>
              </div>
              <div><span class="meta-label">ช่องทางติดต่อสำรอง</span><span class="meta-value">{{ t.contact || '—' }}</span></div>
            </div>

            <div class="d-flex flex-column gap-3">
              <div><span class="meta-label">วันที่แจ้ง</span><span class="meta-value">{{ thDateTime(t.createdAt) }}</span></div>
            </div>
          </div>

          <!-- การจัดหมวดหมู่ -->
          <div class="record__section record__grid">
            <div class="d-flex flex-column gap-3">
              <div><span class="meta-label">บริการที่ได้รับผลกระทบ</span><span class="meta-value">{{ t.service || '—' }}</span></div>
              <div><span class="meta-label">หมวดหมู่ปัญหา</span><span class="meta-value">{{ t.categoryLabel }}</span></div>
            </div>
            <div class="d-flex flex-column gap-3">
              <div><span class="meta-label">อุปกรณ์ที่ได้รับผลกระทบ</span><span class="meta-value mono">{{ t.asset || '—' }}</span></div>
              <div><span class="meta-label">สถานที่เกิดเหตุ</span><span class="meta-value">{{ t.location || '—' }}</span></div>
            </div>
            <div class="d-flex flex-column gap-3">
              <div><span class="meta-label">หมวดหมู่ผลิตภัณฑ์</span><span class="meta-value">{{ t.productCategory || '—' }}</span></div>
            </div>
          </div>

          <!-- รายละเอียด + ไฟล์แนบ -->
          <div class="record__section d-flex flex-column gap-2">
            <span class="meta-label">รายละเอียดปัญหา</span>
            <div class="record__desc">{{ t.description || 'ไม่มีรายละเอียดเพิ่มเติม' }}</div>

            <div v-if="t.attachments?.length" class="d-flex gap-2 flex-wrap pt-1">
              <a
                v-for="a in t.attachments"
                :key="a.filename"
                :href="a.url"
                target="_blank"
                rel="noopener"
                class="attachment"
              >
                <img v-if="a.mimeType?.startsWith('image/')" :src="a.url" :alt="a.originalName" />
                <span v-else class="attachment__file mono">PDF</span>
                <span class="attachment__name mono">{{ a.originalName }} · {{ fileSize(a.size) }}</span>
              </a>
            </div>
          </div>

          <!-- ผู้รับผิดชอบ -->
          <div class="record__foot record__grid">
            <div class="d-flex align-items-center gap-3">
              <div class="avatar avatar--md">{{ t.assigneeInitial }}</div>
              <div class="d-flex flex-column gap-1">
                <span class="meta-label">ผู้รับผิดชอบ</span>
                <span class="meta-value">{{ t.assigneeName }}</span>
              </div>
            </div>
            <div><span class="meta-label">กลุ่มงานที่ดูแล</span><span class="meta-value">{{ t.group || '—' }}</span></div>
            <div>
              <span class="meta-label">กำหนดเสร็จ</span>
              <span class="meta-value mono" :style="{ color: t.slaRisk ? '#a12626' : '#22292f' }">
                {{ t.slaText }} <small class="text-muted-3">({{ thDateTime(t.slaDueAt) }})</small>
              </span>
            </div>
          </div>
        </div>

        <!-- จัดการตั๋วงาน -->
        <div v-if="!isOtherTech" class="card-surface p-3 d-flex flex-column gap-3 action-card">
          <div class="card-title-xs">
            {{ canAct ? 'จัดการตั๋วงาน' : isReadOnlyAdmin ? 'มุมมองผู้ดูแลระบบ' : 'สิ่งที่คุณทำได้' }}
          </div>

          <template v-if="canAct">
            <div v-if="canTriage" class="triage-block">
              <span class="meta-label">หมวดหมู่ปัญหา</span>
              <div class="triage-chips">
                <button
                  v-for="c in meta.categories"
                  :key="c._id"
                  type="button"
                  class="chip"
                  :class="{ 'is-active': String(t.category?._id || '') === String(c._id) }"
                  :disabled="busy"
                  @click="setCategory(c)"
                >
                  {{ c.label }}
                </button>
              </div>

              <span class="meta-label">ระดับความสำคัญ</span>
              <div class="triage-chips">
                <button
                  v-for="p in PRIORITY_ORDER"
                  :key="p"
                  type="button"
                  class="chip"
                  :class="{ 'is-active': t.priority === p }"
                  :style="t.priority === p ? { background: PRIORITY[p].bg, color: PRIORITY[p].fg, borderColor: PRIORITY[p].dot } : {}"
                  :disabled="busy"
                  @click="setPriority(p)"
                >
                  {{ PRIORITY[p].label }}
                </button>
              </div>
            </div>

            <div v-if="showStatusButtons" class="status-grid">
              <button
                v-for="s in statusButtons"
                :key="s"
                type="button"
                class="status-btn"
                :class="{ 'is-active': t.status === s }"
                :style="t.status === s ? { background: STATUS[s].bg, color: STATUS[s].fg, borderColor: STATUS[s].fg } : {}"
                :disabled="busy"
                @click="setStatus(s)"
              >
                {{ STATUS[s].label }}
              </button>
            </div>

            <!-- ปิดหรือยกเลิกงานแล้ว — แสดงวิธีแก้ที่บันทึกไว้อย่างเดียว -->
            <template v-if="isClosed">
              <div class="resolution-box">
                <span class="meta-label">วิธีแก้ปัญหาที่บันทึกไว้</span>
                <span class="resolution-box__text">{{ t.resolutionNote || 'ไม่ได้บันทึกวิธีแก้ไว้' }}</span>
              </div>
              <p class="closed-hint mb-0">
                ตั๋วงานนี้{{ t.status === 'cancelled' ? 'ถูกยกเลิกแล้ว' : 'ปิดเรียบร้อยแล้ว' }}
              </p>
            </template>

            <template v-else>
            <button class="btn-green w-100" type="button" :disabled="busy" @click="toggleResolve">
              บันทึกและปิดตั๋วงาน
            </button>

            <!-- ช่องบันทึกวิธีแก้จะเปิดออกมาหลังกดปิดตั๋วงาน ไม่ได้แสดงค้างไว้ตลอด -->
            <div v-if="showResolve" class="resolve-box">
              <textarea
                ref="noteBox"
                v-model="note"
                class="input input--sm"
                rows="4"
                placeholder="Resolution Note — บันทึกวิธีแก้ไขเพื่อเก็บเป็นฐานความรู้"
              ></textarea>

              <label class="kb-check">
                <input v-model="publishKb" type="checkbox" /> เผยแพร่เข้าฐานความรู้ (KB)
              </label>

              <div class="d-flex gap-2">
                <button class="btn-ghost flex-fill" type="button" :disabled="busy" @click="closeResolve">
                  ยกเลิก
                </button>
                <button class="btn-green flex-fill" type="button" :disabled="busy" @click="resolveTicket">
                  ยืนยันปิดตั๋วงาน
                </button>
              </div>
            </div>

            <button v-if="showTransferButton" class="btn-ghost w-100" type="button" @click="toggleTransfer">
              มอบหมายงาน
            </button>

            <div v-if="showTransfer && showTransferButton" class="transfer-box">
              <select v-model="transferTo" class="input input--sm">
                <option value="">— เลือกเจ้าหน้าที่ที่จะมอบหมาย —</option>
                <option v-for="tech in meta.technicians" :key="tech._id" :value="tech._id">
                  {{ tech.name }} · {{ tech.skill }} ({{ tech.load }} งาน)
                </option>
              </select>
              <button class="btn-brand w-100" type="button" :disabled="busy" @click="doTransfer">ยืนยันการมอบหมาย</button>
            </div>

            <button
              v-if="showCancelButton"
              class="btn-ghost w-100"
              type="button"
              style="color: var(--danger-ink)"
              :disabled="busy"
              @click="cancelTicket"
            >
              ยกเลิกตั๋วงาน
            </button>
            </template>
          </template>

          <template v-else-if="isReadOnlyAdmin">
            <div class="employee-hint">
              ผู้ดูแลระบบดูรายละเอียดและสถานะของตั๋วงานได้ แต่ไม่สามารถมอบหมายงาน
              หรือปิดงานได้ — การจัดการงานเป็นหน้าที่ของ IT Helpdesk และเจ้าหน้าที่ฝ่าย IT
            </div>
            <div class="admin-state">
              <div><span class="meta-label">สถานะปัจจุบัน</span><span class="meta-value" :style="{ color: stat(t.status).fg }">{{ stat(t.status).label }}</span></div>
              <div><span class="meta-label">ผู้รับผิดชอบ</span><span class="meta-value">{{ t.assigneeName }}</span></div>
              <div><span class="meta-label">กำหนดเสร็จ</span><span class="meta-value mono" :style="{ color: t.slaRisk ? '#a12626' : '#22292f' }">{{ t.slaText }}</span></div>
            </div>
            <div v-if="t.resolutionNote" class="resolution-box">
              <span class="meta-label">วิธีแก้ปัญหาที่บันทึกไว้</span>
              <span style="font: 400 12px/1.8 var(--font-th); color: var(--ink-2)">{{ t.resolutionNote }}</span>
            </div>
          </template>

          <template v-else>
            <div class="employee-hint">
              ทีม IT กำลังดำเนินการอยู่ คุณจะได้รับแจ้งเตือนทันทีเมื่อสถานะเปลี่ยน หากมีข้อมูลเพิ่มเติมส่งผ่านแชทได้เลย
            </div>
            <div v-if="t.resolutionNote" class="resolution-box">
              <span class="meta-label">วิธีแก้ปัญหาที่บันทึกไว้</span>
              <span style="font: 400 12px/1.8 var(--font-th); color: var(--ink-2)">{{ t.resolutionNote }}</span>
            </div>
            <button
              v-if="!['resolved', 'cancelled'].includes(t.status)"
              class="btn-ghost w-100"
              type="button"
              style="color: var(--danger-ink)"
              :disabled="busy"
              @click="cancelOwn"
            >
              ยกเลิกตั๋วงานนี้
            </button>
          </template>
        </div>

      </div>

      <!-- แถบด้านข้าง -->
      <div class="detail-rail">
        <!-- แชทเรียลไทม์ -->
        <div class="card-surface card-surface--flush d-flex flex-column chat-card">
          <div class="card-head">
            <div class="card-title-sm">แชทในตั๋วงาน</div>
            <span class="live-dot"><span class="dot" style="background: #6cb33f"></span>เรียลไทม์</span>
            <div class="flex-fill"></div>
            <span v-if="typingBy" class="typing mono">{{ typingBy }} กำลังพิมพ์…</span>
          </div>

          <div ref="chatBox" class="chat">
            <p v-if="!messages.length" class="empty-state mb-0">ยังไม่มีข้อความ — เริ่มพูดคุยกับผู้เกี่ยวข้องได้เลย</p>
            <div
              v-for="m in messages"
              :key="m._id"
              class="chat__row"
              :class="{ 'is-mine': m.sender === auth.user?._id }"
            >
              <span class="chat__who">{{ m.senderName }} · {{ timeOnly(m.createdAt) }}</span>
              <div class="chat__bubble">{{ m.text }}</div>
            </div>
          </div>

          <form v-if="canChat" class="chat__form" @submit.prevent="sendChat">
            <input
              v-model="chatText"
              class="input input--sm flex-fill"
              placeholder="พิมพ์ข้อความถึงผู้เกี่ยวข้อง…"
              @input="onChatInput"
            />
            <button class="btn-slate" type="submit" :disabled="!chatText.trim()">ส่ง</button>
          </form>

          <div v-else class="chat__locked">
            ตั๋วงานนี้มอบหมายให้ <strong>{{ t.assigneeName }}</strong> —
            คุณดูประวัติการสนทนาได้ แต่ตอบแชทไม่ได้
          </div>
        </div>


        <!-- ไทม์ไลน์ -->
        <div class="card-surface p-3 timeline-card">
          <div class="card-title-xs mb-3">ไทม์ไลน์ตั๋วงาน</div>
          <div v-for="(e, i) in [...(t.timeline || [])].reverse()" :key="i" class="timeline">
            <div class="timeline__marker">
              <span class="timeline__dot" :style="{ background: timelineDot(e) }"></span>
              <span v-if="i < t.timeline.length - 1" class="timeline__line"></span>
            </div>
            <div class="d-flex flex-column gap-1 pb-3">
              <span class="timeline__title">{{ e.title }}</span>
              <span class="timeline__by">{{ e.by }} · {{ relTime(e.at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 14px; align-items: start; }
.detail-main { display: flex; flex-direction: column; gap: 14px; }
.detail-rail { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 88px; }

/* แผงจัดการเป็นพื้นที่ทำงานหลักของหน้านี้ — ทำให้เด่นกว่ากล่องข้อมูลทั่วไป */
.action-card {
  border-color: rgba(20, 119, 107, 0.35);
  box-shadow: 0 6px 20px rgba(20, 119, 107, 0.1);
  position: relative;
  overflow: hidden;
}
.action-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--brand);
}

.record__accent { height: 3px; }
.record__head { padding: 20px 24px 18px; display: flex; flex-direction: column; gap: 11px; }
.record__title { font: 600 25px var(--font-th); letter-spacing: -0.4px; line-height: 1.3; margin: 0; }
.record__type { display: flex; align-items: center; gap: 7px; font: 400 12.5px var(--font-th); color: var(--muted); }
.record__type-icon { width: 15px; height: 18px; flex: none; color: var(--muted-2); }
.record__code { font: 500 13px var(--font-mono); color: var(--ink-strong); letter-spacing: 0.3px; }
.record__updated { font: 400 11.5px var(--font-th); color: var(--muted-3); }

.record__status { display: flex; align-items: center; gap: 16px; padding-top: 6px; flex-wrap: wrap; }
.record__status-value { font: 600 17px var(--font-th); }
.track { flex: 1; min-width: 260px; display: flex; align-items: center; padding-top: 14px; }
.track__step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.track__bar { width: 100%; height: 5px; }
.track__label { font: 500 10px var(--font-th); }

.record__section { padding: 18px 24px; border-top: 1px solid var(--line); }
.record__grid { display: grid; grid-template-columns: 1.25fr 1fr 0.85fr; gap: 22px; }
.record__foot { padding: 15px 24px; border-top: 1px solid var(--line); background: var(--surface-2); align-items: center; }
.record__requester { font: 500 19px var(--font-th); letter-spacing: -0.2px; }
.record__desc { font: 400 13.5px/1.9 var(--font-th); color: var(--ink-strong); white-space: pre-line; }

.presence { position: absolute; right: 1px; bottom: 2px; width: 13px; height: 13px; border-radius: 50%; border: 2px solid #fff; }
.contact-icon { width: 16px; text-align: center; color: #2b8a6b; flex: none; }
.contact-link { font-size: 12.5px; color: var(--brand-ink); }

.attachment {
  width: 130px; border-radius: var(--radius); overflow: hidden;
  border: 1px solid rgba(16, 24, 32, 0.1); background: #eef2f5;
  display: flex; flex-direction: column; text-decoration: none;
}
.attachment:hover { border-color: var(--brand); text-decoration: none; }
.attachment img { width: 100%; height: 90px; object-fit: cover; display: block; }
.attachment__file { height: 90px; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--muted); }
.attachment__name { padding: 5px 7px; font-size: 9.5px; color: var(--muted); background: #fff; word-break: break-all; }

.live-dot { display: flex; align-items: center; gap: 5px; font: 400 11px var(--font-th); color: var(--ok-ink); }
.typing { font-size: 10.5px; color: var(--muted-3); }

.chat { padding: 16px; display: flex; flex-direction: column; gap: 13px; background: var(--surface-4); min-height: 240px; max-height: 460px; overflow: auto; }
.chat__row { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.chat__row.is-mine { align-items: flex-end; }
.chat__who { font: 400 10.5px var(--font-th); color: var(--muted-3); }
.chat__bubble {
  max-width: 86%; padding: 11px 14px;
  border-radius: 12px 12px 12px 3px;
  background: #fff; color: var(--ink-strong);
  border: 1px solid rgba(16, 24, 32, 0.1);
  font: 400 13px/1.7 var(--font-th);
  white-space: pre-wrap; word-break: break-word;
}
.chat__row.is-mine .chat__bubble {
  border-radius: 12px 12px 3px 12px;
  background: var(--brand); color: #fff; border-color: var(--brand);
}
.chat__form { padding: 12px; border-top: 1px solid rgba(16, 24, 32, 0.08); display: flex; align-items: center; gap: 8px; }
.chat__locked {
  padding: 13px 14px;
  border-top: 1px solid rgba(16, 24, 32, 0.08);
  background: var(--surface-2);
  font: 400 11.5px/1.7 var(--font-th);
  color: var(--muted);
  text-align: center;
}

.status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.status-btn {
  padding: 9px 6px; border-radius: 7px;
  border: 1px solid var(--line-strong); background: #fff; color: var(--ink-3);
  cursor: pointer; font: 500 11.5px var(--font-th);
}
.status-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.kb-check { display: flex; align-items: center; gap: 8px; font: 400 11.5px var(--font-th); color: var(--ink-3); cursor: pointer; margin: 0; }
.kb-check input { accent-color: var(--brand); width: 14px; height: 14px; }

.transfer-box { display: flex; flex-direction: column; gap: 8px; padding: 11px; border-radius: var(--radius); background: var(--surface-2); border: 1px solid rgba(16, 24, 32, 0.07); }

.employee-hint {
  padding: 12px; border-radius: 9px;
  background: var(--surface-2); border: 1px solid rgba(16, 24, 32, 0.07);
  font: 400 12px/1.7 var(--font-th); color: var(--ink-3);
}
.resolution-box { padding: 12px; border-radius: 9px; background: var(--ok-soft); border: 1px solid #d6e6bd; display: flex; flex-direction: column; gap: 4px; }
.resolve-box { display: flex; flex-direction: column; gap: 10px; }
.triage-block { display: flex; flex-direction: column; gap: 8px; }
.triage-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.triage-chips + .meta-label { margin-top: 5px; }
.resolution-box__text { font: 400 12.5px/1.8 var(--font-th); color: var(--ink-2); white-space: pre-line; }
.closed-hint { font: 400 11.5px var(--font-th); color: var(--muted-2); text-align: center; }
.admin-state { display: flex; flex-direction: column; gap: 11px; padding: 12px; border-radius: 9px; background: var(--surface-2); border: 1px solid rgba(16, 24, 32, 0.07); }

.timeline { display: grid; grid-template-columns: 14px 1fr; gap: 11px; }
.timeline__marker { display: flex; flex-direction: column; align-items: center; }
.timeline__dot { width: 9px; height: 9px; border-radius: 50%; background: var(--brand); margin-top: 4px; flex: none; }
.timeline__line { width: 1px; flex: 1; background: rgba(16, 24, 32, 0.12); }
.timeline__title { font: 500 12.5px var(--font-th); color: var(--ink-strong); }
.timeline__by { font: 400 11px var(--font-th); color: var(--muted-2); }
.min-w-0 { min-width: 0; }

@media (max-width: 1199.98px) {
  .detail-layout { grid-template-columns: 1fr; }
  .detail-rail { position: static; }

  /* จอแคบไม่มีคอลัมน์ข้าง — ยุบสองคอลัมน์ให้เรียงต่อกันเป็นรายการเดียว
     ลำดับที่ได้: ข้อมูลตั๋ว → จัดการตั๋วงาน → แชท → ไทม์ไลน์ */
  .detail-main, .detail-rail { display: contents; }
}
@media (max-width: 767.98px) {
  .record__grid { grid-template-columns: 1fr; gap: 16px; }
  .record__head, .record__section, .record__foot { padding-left: 16px; padding-right: 16px; }
  .record__title { font-size: 20px; }
  .track { min-width: 100%; }
  .track__label { font-size: 9px; }
  .chat__bubble { max-width: 88%; }
}
</style>
