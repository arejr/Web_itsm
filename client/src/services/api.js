import axios from 'axios';

// ค่าเริ่มต้นใช้ path เดียวกับหน้าเว็บ (กรณี backend เสิร์ฟไฟล์ frontend ด้วย)
// ถ้าแยก host กันคนละที่ ให้ตั้ง VITE_API_BASE_URL เช่น https://api.example.com/api
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api' });

// แนบ JWT ทุกคำขอ
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('itsm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// เซสชันหมดอายุ → เด้งกลับหน้าเข้าสู่ระบบ
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 && !String(err.config?.url || '').includes('/auth/login')) {
      localStorage.removeItem('itsm_token');
      // ให้ App.vue เป็นผู้ล้าง store และพากลับหน้าเข้าสู่ระบบ
      // (ถ้าแก้ hash ตรงนี้ store จะยังค้างว่าล็อกอินอยู่ แล้ว guard จะเด้งกลับเป็นวน)
      window.dispatchEvent(new CustomEvent('itsm:unauthorized'));
    }
    return Promise.reject(err);
  }
);

// ดึงข้อความ error ภาษาไทยจาก response
export function errMsg(err, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') {
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
