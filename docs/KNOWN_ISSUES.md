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

---

## 3. การ Geocoding สถานที่ที่เป็น Placeholder (Placeholder Geocoding Hallucination)

**⚠️ ข้อห้าม (DO NOT):**
- **ห้าม** นำชื่อสถานที่ที่เป็น Placeholder เช่น `"ไม่พบชื่อสถานที่"`, `"Unknown"`, หรือค่าว่าง ไปยิงค้นหากับ Google Places API / Google Maps Geocoding API เด็ดขาด
- สาเหตุ: Google Places API ใช้ระบบ Fuzzy Semantic Search หากส่ง `"ไม่พบชื่อสถานที่ Thailand"` ไปค้นหา Google จะไม่ตอบว่าไม่พบ แต่จะสุ่มหยิบแลนด์มาร์ก/สถานที่ท่องเที่ยวสำคัญมาแทน (เช่น *"ส่วนที่แคบที่สุดในประเทศไทย"*, *"วนอุทยานพนมสวาย"*, *"หลักเขตชายแดนไทย-มาเลเซีย"*) และนำพิกัดจริงของจุดนั้นมาบันทึกทับคลิปอาหาร/คลิปทั่วไป ทำให้หมุดไปโผล่ผิดที่นับร้อยรายการ

**✅ วิธีที่ถูกต้อง (The Right Way):**
- ใน `src/lib/inngest/functions.ts` และสคริปต์ Geocoding ทุกตัว ต้องมี Guardrail ดักก่อนเสมอ:
  ```typescript
  const nameTrimmed = (p.name || '').trim();
  if (!nameTrimmed || nameTrimmed === 'ไม่พบชื่อสถานที่' || p.type === 'Unknown' || nameTrimmed.toLowerCase() === 'unknown') {
    return {
      ...p,
      name: 'ไม่พบชื่อสถานที่',
      type: 'Unknown',
      lat: null,
      lng: null,
      place_id: 'failed_geocoding'
    };
  }
  ```
- หากเป็น Placeholder ให้ข้ามการยิง API ทันที และคืนค่า `lat: null, lng: null` เพื่อให้ UI จัดการแสดงผลเป็น "⚠️ หาพิกัดไม่พบ" แทนการปักหมุดมั่ว

---

## 4. การจัดการพิกัดเริ่มต้นและ Geolocation ใน Map View (Map View Initial Coordinates & Auto-Locate)

**⚠️ ข้อห้าม (DO NOT):**
- **ห้าม** ตั้งค่า `setSelectedPin(allLocations[0])` หรือกำหนด `center` ของ `MapContainer` ผูกติดกับหมุดแรกของฐานข้อมูล
  - สาเหตุ: ผู้ใช้เปิดแท็บ Map View เข้ามาเพื่อดูว่ามีสถานที่ใดอยู่ใกล้ตัวตนเองในปัจจุบัน การบังคับเลือกหมุดแรกจะทำให้แผนที่บินไปสถานที่แรกใน DB ตลอดเวลา (เช่น โคราช หรือ เชียงใหม่) และกล่องการ์ดด้านข้างจะแสดงสถานที่ไกลตัวผิดบริบท
- **ห้าม** ยิง `alert()` แจ้ง error ของ Geolocation ตอน auto-locate ขณะเปิดหน้าเว็บ/แท็บ
  - สาเหตุ: หากเครื่องปิด GPS, เบราว์เซอร์ยังไม่ได้ให้สิทธิ์, หรือเปิดบน HTTP จะมี Popup alert เด้งบล็อกหน้าจอทันทีที่เปิดแท็บ สร้าง UX ที่แย่มาก (ควร alert เฉพาะตอนที่ผู้ใช้เอานิ้วไปกดปุ่มด้วยตัวเองเท่านั้น)
- **ห้าม** วาด `L.circle` หรือ Layer บนแผนที่โดยไม่เก็บ Reference ไว้เคลียร์
  - สาเหตุ: การเรียก `.addTo(map)` ทุกครั้งที่กดปุ่มหาตำแหน่ง จะทำให้เกิด Layer ซ้อนทับกันไปเรื่อยๆ (Memory/Layer Leak)
- **ห้าม** ปล่อยให้ `targetMapLocation` ในหน้าหลัก (`page.tsx`) ค้างค่าเดิมไว้เมื่อผู้ใช้คลิกแท็บ Map View ผ่านแถบเมนูด้านบน (Navbar)

**✅ วิธีที่ถูกต้อง (The Right Way):**
- **Auto-Locate with Silent Fallback:** เมื่อเปิดแท็บ Map ให้รัน `autoLocate(isManual: false)` ทันที หากได้พิกัดให้ `flyTo` ไปที่ตำแหน่งปัจจุบัน แต่หากไม่สำเร็จให้คงพิกัดภาพรวมไว้เงียบๆ โดยไม่เด้ง alert
- **Zero-Jump Render ด้วย `sessionStorage`:** เมื่อหาตำแหน่งสำเร็จ ให้บันทึก `{ lat, lng }` ลง `sessionStorage.setItem('focus_user_last_location', ...)` เพื่อให้การเปิดแท็บ Map ในครั้งถัดไป เริ่มต้นเรนเดอร์แผนที่ตรงจุดเดิมทันที ไม่ต้องกระตุกเด้งไปกรุงเทพฯ ก่อน
- **Dual-Indicator Marker (Google Maps Style):** วาดทั้งวงรัศมีความแม่นยำ (`L.circle`) และจุดกึ่งกลางที่ชัดเจน (`L.circleMarker` จุดสีครามขอบขาว) โดยเก็บใน `userLayersRef` เพื่อสั่ง `removeLayer` ตัวเก่าออกก่อนวาดใหม่เสมอ
- **Navbar Tab Reset:** เมื่อผู้ใช้กดคลิกแท็บ "Map View" ใน `<Navigation>` ให้รีเซ็ต `targetMapLocation` เป็น `null` เสมอ เพื่อให้ระบบเข้าสู่โหมด Current Location ตามที่ผู้ใช้คาดหวัง
