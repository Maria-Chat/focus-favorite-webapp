# Known Issues & Architectural Gotchas

ไฟล์นี้รวบรวมข้อผิดพลาดที่เคยเกิดขึ้น แนวทางการแก้ไข และ **ข้อห้าม** ในการเขียนโค้ด เพื่อป้องกันไม่ให้ AI ตัวใหม่หรือนักพัฒนาเผลอกลับไปใช้วิธีที่เคยพังมาแล้ว

---

## 1. การดึงวิดีโอจาก TikTok (TikTok Embed & Video Extraction)

**⚠️ ข้อห้าม (DO NOT):**
- **ห้าม** ใช้ Iframe ของ TikTok แบบ Official (`https://www.tiktok.com/embed/v2/...`) เด็ดขาด 
- สาเหตุ: ระบบของ TikTok จะตรวจจับการโหลดจากเว็บเราและส่ง Error `overload-protect triggered` กลับมา ทำให้ผู้ใช้ดูคลิปไม่ได้

**✅ วิธีที่ถูกต้อง (The Right Way):**
- ให้ใช้ Custom Component `<TikTokEmbed>` เท่านั้น ซึ่งจะไปเรียก `/api/video-url` ในการทำงาน
- ภายใน `/api/video-url`:
  1. **ต้อง** ทำการ Resolve Redirect ลิงก์ย่อ (`vt.tiktok.com`) ให้เป็นลิงก์เต็มก่อนเสมอ ไม่อย่างนั้น API จะอ่านลิงก์ไม่ออก
  2. **ต้อง** ตัด Query Parameters (เช่น `?is_from_webapp=1`) ออกก่อน (Clean URL) และต้องทำ `encodeURIComponent`
  3. **ต้อง** มีการทำ Auto Retry ทิ้งระยะเวลา 1.2 วินาที หาก API (tikwm) ตอบกลับมาว่า `code: -1` (Free Api Limit: 1 request/second) เพื่อไม่ให้ระบบโยนภาระไปให้ `yt-dlp` ซึ่งมักจะติด CAPTCHA และค้างจน Timeout (IP Rate Limited)
