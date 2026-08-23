import { io } from 'socket.io-client';

// ค่าเริ่มต้นเชื่อมต่อ origin เดียวกับหน้าเว็บ
// ถ้าแยก host กันคนละที่ ให้ตั้ง VITE_SOCKET_URL เช่น https://api.example.com
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

let socket = null;
let currentToken = null;

/**
 * ทะเบียนตัวรับ event
 * เก็บไว้นอก socket เพื่อให้ผูกใหม่ให้อัตโนมัติทุกครั้งที่ socket ถูกสร้างใหม่
 * (ก่อนหน้านี้ store ผูก listener ไว้กับ socket ตัวแรก พอถูกแทนที่ listener ก็ตายเงียบ ๆ)
 */
const handlers = new Map();

function attachAll(target) {
  handlers.forEach((fns, event) => fns.forEach((fn) => target.on(event, fn)));
}

export function onSocket(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  if (socket) socket.on(event, fn);
}

export function offSocket(event, fn) {
  handlers.get(event)?.delete(fn);
  socket?.off(event, fn);
}

export function connectSocket(token) {
  // token เดิมและ socket ยังอยู่ (ต่อแล้วหรือกำลังต่อ) — ใช้ตัวเดิมต่อ ไม่สร้างใหม่
  if (socket && currentToken === token) return socket;

  socket?.disconnect();
  currentToken = token;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    withCredentials: true
  });

  // ผูก handler ที่ลงทะเบียนไว้แล้วทั้งหมดเข้ากับ socket ตัวใหม่
  attachAll(socket);
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = null;
}
