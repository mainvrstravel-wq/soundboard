# 🎛️ Live Soundboard

กดเสียงจากมือถือ → ดังที่หน้าไลฟ์ (OBS / TikTok Live Studio) แบบ real-time ผ่าน Socket.io

## รันในเครื่อง
```bash
npm install
npm start
# Controller: http://localhost:3000/controller?room=my-stream
# Receiver:   http://localhost:3000/receiver?room=my-stream
```

## Deploy บน Render (Free)
1. Push โปรเจกต์ขึ้น GitHub
2. Render → New → Web Service → เลือก repo
3. Build Command: `npm install` · Start Command: `npm start` · Instance Type: Free

## ใช้กับ OBS / TikTok Live Studio
Browser Source → ใส่ลิงก์:
`https://YOUR-APP.onrender.com/receiver?room=ชื่อห้อง&ui=hidden&bg=transparent`
(ลิงก์นี้ก๊อปได้จากหน้า Controller: แตะที่ชื่อห้อง)

## ฟีเจอร์
- ห้องแยกกัน (Room ID), เสียงเล่นหลายอันซ้อนกันได้, Master Volume, STOP ALL
- อัปโหลดเสียงของตัวเองจากมือถือ (≤ 2MB, สูงสุด 12 เสียง/ห้อง) เก็บในหน่วยความจำเซิร์ฟเวอร์
- คีย์ลัด (เดสก์ท็อป): 1–9,0 = เล่นเสียง, Space = หยุดทั้งหมด
- พารามิเตอร์ Receiver: `?room=` · `ui=hidden` (ซ่อน UI) · `bg=transparent`

## เสียงในตัว
ไฟล์ใน `public/sounds/` สร้างจากการสังเคราะห์ (`python3 tools/gen_sounds.py`)
อยากได้คุณภาพจริง: เอา mp3 ของจริงมาวางทับโดยใช้ชื่อไฟล์เดิม หรืออัปโหลดผ่านปุ่ม ＋ ในหน้า Controller

## หมายเหตุ Free tier
- เซิร์ฟเวอร์หลับหลังไม่มีการใช้งาน ~15 นาที (ตื่นใช้เวลา ~30–60 วินาที) → เปิด Receiver ก่อนไลฟ์ หรือให้ UptimeRobot ping `/healthz` ทุก 10 นาที
- เสียงที่อัปโหลดจะหายเมื่อเซิร์ฟเวอร์รีสตาร์ท → เสียงที่ใช้ประจำควรใส่เป็นไฟล์ใน `public/sounds/` + `public/js/sounds.js`
