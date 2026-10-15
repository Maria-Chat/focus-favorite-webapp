# Map View — Search Results & UX Architecture (สถานะ: เสร็จสมบูรณ์ & Deploy แล้ว ✅)

> 📌 **สถานะการทำงาน:** เสร็จสมบูรณ์ (Commit `fc6fe0f` และ `b97ce33`) และ deploy บน Production (`https://72-62-254-106.sslip.io`) เรียบร้อยแล้ว  
> **ไฟล์หลัก:** [`src/components/MapView.tsx`](file:///Users/maria/Documents/focus%20favorite%20webapp/src/components/MapView.tsx)

---

## 1. ปัญหาเดิมก่อนการปรับปรุง (Historical Context)
- เมื่อผู้ใช้ค้นหาสถานที่ (เช่น "korat" หรือชื่อร้าน/อำเภอ) ตัวเลขสถิติแสดงว่าค้นพบ "93 จุด" แต่แผนที่กลับซูมไปที่จุดแรกเพียงจุดเดียวที่ระดับ zoom 14
- แผงด้านข้างแสดงการ์ดใบเดียว ทำให้ผู้ใช้มองไม่เห็นภาพรวมว่าหมุดที่เหลืออีก 92 จุดกระจายตัวอยู่ที่ใดบ้าง
- เมื่อกดเลือกหมุดหรือสลับการค้นหา การ sync ระหว่างการ์ดกับแผนที่ไม่สอดคล้องกัน และไม่มี Progressive Rendering สำหรับผลลัพธ์จำนวนมาก

---

## 2. สถาปัตยกรรมและฟีเจอร์ที่พัฒนาเสร็จสิ้น (Architecture & Implementation)

### 2.1 แผนที่และการควบคุม Viewport (`MapController`)
- **Auto fitBounds:** เมื่อผลการค้นหาเปลี่ยน แผนที่จะคำนวณ LatLngBounds ครอบคลุมทุกจุดที่ตรงกับคำค้น พร้อมใส่ `padding: [50, 50]` และกำหนด `maxZoom: 15` เพื่อให้เห็นภาพรวมของทุกสถานที่ ไม่ซูมลึกเกินไปกรณีมีเพียงจุดเดียว
- **แยก State การขยับแผนที่เพื่อกัน Race Condition:**
  - `fitBoundsRequest: { bounds: L.LatLngBounds; id: number }` ควบคุมการกางแผนที่ดูภาพรวม
  - `flyToTarget: { lat: number; lng: number; id: number }` ควบคุมการบินไปหาหมุดเฉพาะเจาะจง
  - ใช้ `id` (Timestamp) พร้อม `useRef` ใน `MapController` เพื่อป้องกัน Effect ทำงานซ้ำหรือแย่งกันขยับกล้อง
- **ปุ่ม "ดูทั้งหมด N จุด" (`Maximize2`):** ติดอยู่ที่มุมขวาบนของแผนที่ ให้ผู้ใช้กดเพื่อสั่ง `fitBounds` ครอบคลุมผลการค้นหาทั้งหมดใหม่ได้ทุกเมื่อ
- **Active Pin Styling:** หมุดที่เลือกจะใช้ `activeIcon` (สีเขียว ขนาดใหญ่ 25x41px) เด่นชัดเหนือหมุดทั่วไป (`defaultIcon` สีน้ำเงิน) และหมุดที่หาพิกัดไม่พบ (`dummyIcon` สีเทา)

### 2.2 การค้นหาและการ Debounce (Search Handling)
- **Debounce 300ms:** ป้องกันการ re-filter และ map animation กระตุกขณะพิมพ์ต่อเนื่อง
- **Immediate Submit on Enter:** กดปุ่ม Enter บนคีย์บอร์ด จะตัด timer แล้ว trigger ผลลัพธ์ทันที พร้อมสั่ง `.blur()` เพื่อปิดคีย์บอร์ดบนมือถืออัตโนมัติ
- **Smart Counter Badge & Clear Button:** 
  - แสดงป้ายจำนวนผลลัพธ์ เช่น "93 จุด" (สีเขียว) หรือ "ไม่พบ" (สีแดง) 
  - ปุ่ม ✕ กดแล้วคืนค่าหมุดทั้งหมดกลับมา โดยคงสถานะหมุดที่เลือกล่าสุดไว้ (ไม่เด้งหลุดไปหมุดแรก)
- **Empty State UX:** แสดงข้อความเตือน "ไม่พบสถานที่ที่ตรงกับ '...'" พร้อมปุ่ม "ล้างการค้นหา"

### 2.3 การแสดงผลการ์ด (Adaptive Split View)
- **Desktop (Screen lg ขึ้นไป):**
  - แผงด้านขวาความสูงคงที่เท่ากับแผนที่ (520px) พร้อมแถบ Scroll แบบกำหนดเอง (`custom-scrollbar`)
  - หัวแผงแสดง "N ผลลัพธ์สำหรับ 'xxx'"
  - การ์ดธรรมดาแสดงผลแบบกะทัดรัด (Compact Card): แสดง Tag ประเภท, พิกัดย่อ, ชื่อสถานที่ และชื่อคอนเทนต์
  - การ์ดที่ถูกเลือก (Selected Card): ขอบไฮไลต์ด้วยสี Emerald (`ring-2 ring-emerald-500`) และขยายเป็นการ์ดเต็มรูปแบบ (มีที่อยู่เต็ม, Snippet คอนเทนต์, ปุ่มเปิด Google Maps, ปุ่มดูคลิปต้นฉบับ, และปุ่มแก้ไขพิกัด)
- **Mobile (Screen เล็กกว่า lg):**
  - แถบการ์ดแสดงอยู่ใต้แผนที่ในแนวนอนแบบ Snap Carousel (`overflow-x-auto snap-x snap-mandatory`)
  - แต่ละการ์ดกว้าง `85vw` (Max 384px) เผื่อให้เห็นขอบการ์ดใบถัดไปเล็กน้อย ให้ผู้ใช้รู้ว่าปัดเลื่อนได้

### 2.4 การเชื่อมโยงสองทาง (Two-Way Synchronization)
- **Deterministic Location Key:** ระบุเอกลักษณ์ของแต่ละหมุดด้วย:
  ```typescript
  const getLocationKey = (item: SavedItem, loc: LocationItem) =>
    `${item.id}:${loc.name}:${loc.lat},${loc.lng}`;
  ```
- **คลิกหมุดบนแผนที่ -> การ์ดเลื่อนมาตรงกลาง:**
  - สั่ง `setFlyToTarget` บินไปที่พิกัด
  - สั่ง `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` (Desktop) หรือ `inline: 'center'` (Mobile)
- **คลิกการ์ด -> แผนที่บินไปหาหมุด:**
  - ตั้งค่า `selectedPin` และเรียก `flyToTarget`
- **Mobile Carousel Swipe Sync (IntersectionObserver):**
  - มี Observer ดักการ์ดที่เลื่อนมาอยู่กึ่งกลางจอ (Threshold `0.6`) แล้วเปลี่ยน `selectedPin` และขยับแผนที่ตามอัตโนมัติ
  - **Loop Prevention Lock:** มีตัวแปร `isProgrammaticScrollRef` (Lock ไว้ 700ms) ขณะที่ผู้ใช้กดคลิกหมุด เพื่อไม่ให้ Observer ไป Trigger ซ้ำซ้อนจนเกิด Infinite Animation Loop

### 2.5 ประสิทธิภาพ (Progressive Infinite Rendering)
- คำค้นยอดนิยมอาจเจอหลายร้อยจุด ระบบจึงใช้เทคนิค Progressive Loading:
  - เริ่มต้นแสดงผล 40 การ์ดแรก
  - ใช้ `loadMoreSentinelRef` ร่วมกับ `IntersectionObserver` ทยอยโหลดเพิ่มทีละ 30 จุดเมื่อผู้ใช้เลื่อนลงมาล่างสุด
  - ฟังก์ชัน `ensurePinVisible()` ตรวจสอบว่าหากผู้ใช้คลิกหมุดที่อยู่นอกเหนือ 40 ตัวแรก ระบบจะขยาย `visibleCount` ให้ครอบคลุมการ์ดนั้นทันที เพื่อให้ scrollIntoView ทำงานได้สมบูรณ์

### 2.6 พิกัดปัจจุบันและการเปิดแท็บ (Current Location & Auto-Locate on Open)
- **Auto-Locate เมื่อเปิดแท็บแผนที่:**
  - เมื่อผู้ใช้กดแท็บ "Map View" ในแถบ Navigation หรือเปิดหน้านี้โดยตรงโดยไม่มี `targetLocation`:
    - ระบบจะเรียกหาพิกัด GPS อัตโนมัติ (`autoLocate: true`) ทันทีเหมือนกับการกดปุ่ม Current Location
    - ป้องกันปัญหาเดิมที่เปิดมาแล้วแผนที่พุ่งไปที่พิกัดแรกในฐานข้อมูลตลอดเวลา (`allLocations[0]`)
    - หากดึงตำแหน่งอัตโนมัติไม่สำเร็จ จะไม่แสดง Popup alert รบกวนผู้ใช้ แต่จะคงแผนที่ไว้ที่พิกัดตั้งต้น (แต่ถ้าผู้ใช้กดปุ่มเอง จะแสดง Alert แนะนำวิธีเปิดสิทธิ์/HTTPS ตามปกติ)
  - **Zero-Jump Render ด้วย `sessionStorage`:**
    - บันทึกพิกัดล่าสุดที่เคยหาสำเร็จลงใน `sessionStorage` (`focus_user_last_location`)
    - เมื่อเปิดแท็บ Map อีกครั้ง แผนที่จะเริ่มต้นเรนเดอร์ที่พิกัดล่าสุดทันทีโดยไม่กระตุกไปกรุงเทพฯ ก่อน แล้วค่อยอัปเดตพิกัดสด
  - **Dual-Indicator Marker (Google Maps Style):**
    - วงกลมรัศมีความแม่นยำ (`L.circle` สีกึ่งโปร่งแสง `#6366f1` / `#818cf8`)
    - จุดระบุตำแหน่งกึ่งกลางแบบชัดเจน (`L.circleMarker` จุดสีครามขอบขาว `#4f46e5` radius 7)
    - มี `userLayersRef` จัดการล้าง Marker ตัวเดิมก่อนวาดใหม่ ป้องกัน Layer สะสมค้างบนแผนที่
  - **Empty State ที่เป็นมิตร:**
    - เมื่อยังไม่ได้เลือกหมุดใด ระบบจะแสดงการ์ด "ตำแหน่งของคุณบนแผนที่" แนะนำให้แตะหมุดรอบตัวเพื่อเปิดดูคอนเทนต์ แทนการปล่อยว่างหรือเลือกหมุดไกลตัวโดยไม่ตั้งใจ
  - **Top Navigation Reset:**
    - เมื่อผู้ใช้กดแท็บ "Map View" จากแถบเมนูด้านบน ระบบจะเคลียร์ `targetMapLocation` เป็น `null` เสมอ เพื่อให้กลับมาสู่โหมด Current Location โดยไม่ค้างพิกัดหมุดเดิมที่เคยกดมาจาก Feed

---

## 3. รายการทดสอบและการตรวจสอบความถูกต้อง (Verification Matrix)

| รายการทดสอบ | รายละเอียดพฤติกรรม | ผลการทดสอบ |
|---|---|---|
| **Debounce Search** | พิมพ์ค้นหาแล้วรอ 300ms แผนที่จึง fitBounds | ผ่าน ✅ |
| **Enter Submit** | กด Enter แผนที่ตอบสนองทันทีและซ่อนคีย์บอร์ด | ผ่าน ✅ |
| **All Locations Fit** | ค้นพบ 90+ จุด แผนที่กางออกครอบคลุมทุกหมุด มี padding สวยงาม | ผ่าน ✅ |
| **Button "ดูทั้งหมด N จุด"** | กดแล้ว Viewport กางออกครอบคลุมจุดทั้งหมดซ้ำได้ | ผ่าน ✅ |
| **Desktop Two-Way Sync** | คลิกหมุด -> การ์ดขวาเลื่อนมาไฮไลต์ / คลิกการ์ด -> แผนที่บินไปหาหมุด | ผ่าน ✅ |
| **Mobile Carousel Sync** | ปัดการ์ดแนวนอนจนเกิน 60% แผนที่บินตามการ์ดใบนั้น | ผ่าน ✅ |
| **Infinite Loop Guard** | คลิกหมุดบนมือถือแล้วการ์ดเลื่อน โดยไม่มีการดีดกลับไปมา | ผ่าน ✅ |
| **Feed Integration** | เปิดมาจากหน้า Feed ด้วย `targetLocation` หมุดและแผนที่โฟกัสถูกต้อง | ผ่าน ✅ |
| **Build & Deploy** | ผ่าน `next build` แบบ 0 TypeScript/Lint errors และ deploy บน VPS แล้ว | ผ่าน ✅ |
