/**
 * ตรวจสอบ origin ที่อนุญาตให้เรียก API และเปิด WebSocket
 * ใช้ร่วมกันทั้ง Express และ Socket.IO เพื่อให้กฎเดียวกันเสมอ
 */

function platformOrigins() {
  const list = [];

  // Render ให้มาเป็น URL เต็ม
  if (process.env.RENDER_EXTERNAL_URL) list.push(process.env.RENDER_EXTERNAL_URL);

  // Railway ให้มาเป็นชื่อโดเมนล้วน ต้องเติม https:// เอง
  if (process.env.RAILWAY_PUBLIC_DOMAIN) list.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);

  // Fly.io
  if (process.env.FLY_APP_NAME) list.push(`https://${process.env.FLY_APP_NAME}.fly.dev`);

  return list;
}

function allowedOrigins() {
  return [...(process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','), ...platformOrigins()]
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * คำขอที่มาจากหน้าเว็บซึ่งเสิร์ฟโดยเซิร์ฟเวอร์ตัวเดียวกันถือเป็น same-origin
 * จำเป็นสำหรับ deploy แบบเซิร์ฟเวอร์เดียว เพราะโดเมนจริงอาจเป็นโดเมนที่ผูกเอง
 * ซึ่งไม่มีทางรู้ล่วงหน้าและไม่ได้อยู่ใน CLIENT_ORIGIN
 */
function isSameOrigin(origin, host) {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * กฎกลาง — ใช้ทั้ง HTTP และ WebSocket
 */
function isOriginAllowed(origin, host) {
  if (!origin) return true; // คำขอจากเซิร์ฟเวอร์เดียวกัน หรือเครื่องมืออย่าง curl
  if (isSameOrigin(origin, host)) return true;

  const allowed = allowedOrigins();
  return allowed.includes('*') || allowed.includes(origin.replace(/\/$/, ''));
}

module.exports = { allowedOrigins, platformOrigins, isSameOrigin, isOriginAllowed };
