# ---------- ขั้นที่ 1: build frontend ----------
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- ขั้นที่ 2: รัน backend พร้อมเสิร์ฟ frontend ----------
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

# โฟลเดอร์ไฟล์แนบ — ต้อง mount ไดเรกทอรีถาวรไว้ที่ /data ไม่งั้นไฟล์จะหายตอน deploy ใหม่
#   Railway : Settings → Volumes → Mount path = /data
#   Docker  : docker run -v itsm-uploads:/data ...
# ไม่ใช้คำสั่ง VOLUME เพราะ Railway ไม่รองรับ (build จะล้มด้วย "docker VOLUME ... is not supported")
# การ mount จากภายนอกใช้งานได้ตามปกติโดยไม่ต้องประกาศ VOLUME
ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
