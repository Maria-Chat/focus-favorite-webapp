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

---

## 2. การดึงข้อมูล (Scraping) แบบ Auto-Scroll จาก YouTube (Chrome Extension)

**⚠️ ข้อห้าม (DO NOT):**
- **ห้าม** เช็คจุดสิ้นสุดหน้าเว็บ (End of Page) ด้วยการเทียบความสูง `currentHeight === previousHeight` เด็ดขาด
  - สาเหตุ: YouTube ใช้เทคนิค **Virtual DOM** ในการเรนเดอร์ Playlist มันจะจำกัดความสูง `scrollHeight` ให้คงที่เสมอ โดยใช้วิธีขยับ Padding ด้านบนแทน การเช็คความสูงจะทำให้ระบบนึกว่าเลื่อนสุดแล้วและหยุดทำงานตั้งแต่ 100 คลิปแรก
- **ห้าม** ลบ `img.src` ระหว่างการดึงข้อมูลเพื่อประหยัดแรม (GC Cleanup)
  - สาเหตุ: การลบรูปภาพจะทำให้โครงสร้าง Grid ของ YouTube ยุบตัวลง (ความสูงกลายเป็น 0) ทำให้ Scrollbar กระเด้งกลับไปบนสุดทันที และทำให้ระบบ Infinite Scroll พัง
- **ห้าม** เลื่อนจอด้วยคำสั่ง `scrollIntoView()` ในหน้าเว็บที่มี Virtual DOM
  - สาเหตุ: เบราว์เซอร์จะคำนวณพิกัดผิดพลาดเมื่อ Element ถูก Recycle ทำให้หน้าเว็บกระตุกและดีดกลับไปบนสุด

**✅ วิธีที่ถูกต้อง (The Right Way):**
- **การเลื่อนจอ:** ห้ามทึกทักเอาเองว่า `window` คือตัวเลื่อนจอ (เพราะบาง Layout ล็อค Sidebar ซ้ายไว้) ให้ใช้การค้นหากล่องที่ Scroll ได้ทั้งหมดผ่าน CSS แทน:
  ```javascript
  document.querySelectorAll('*').forEach(el => {
    if (el.scrollHeight > el.clientHeight && ['auto', 'scroll', 'overlay'].includes(window.getComputedStyle(el).overflowY)) {
      el.scrollBy(0, 3000);
    }
  });
  ```
- **การเช็คจุดสิ้นสุด:** ให้เช็คจาก **"จำนวนข้อมูลใหม่ที่ดึงได้ (New Items Extracted)"** ถ้าเจอ 0 ชิ้นติดต่อกัน 10 ครั้ง แปลว่าถึงก้นบึ้งของหน้าเว็บแล้วจริงๆ
- **ตัวเลือก Selector:** YouTube ทำการอัปเดตสถาปัตยกรรมเป็น WebComponents บ่อยมาก (ล่าสุดใช้ `yt-lockup-view-model` และ `.ytLockupMetadataViewModelTitle`) การดึงข้อมูลควรใช้ Selector ที่ยืดหยุ่น เช่น `a[href*="/watch"]` เป็นหลัก แล้วจึงค่อยเดินหา Parent Node ด้วย `closest('yt-lockup-view-model, ytd-playlist-video-renderer')` เพื่อดึงรูปปก
