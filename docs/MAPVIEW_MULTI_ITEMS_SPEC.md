# Map View — Multi-Items per Location Spec (สถานะ: เสร็จสมบูรณ์ & ผ่านการทดสอบแล้ว ✅ 2026-10-15)

> 📌 **เป้าหมาย:** เมื่อพิกัด/สถานที่หนึ่งๆ มีคอนเทนต์ที่ผู้ใช้บันทึกไว้มากกว่า 1 รายการ (เช่น ร้านดังที่มีทั้งคลิปรีวิวจาก TikTok, YouTube, และ Facebook Reels) ผู้ใช้ต้องสามารถมองเห็นตัวเลขรวมบนหมุดแผนที่ และเปิดดูคอนเทนต์ทั้งหมดที่พูดถึงสถานที่นั้นได้อย่างครบถ้วนในที่เดียว  
> **ไฟล์หลักที่เกี่ยวข้อง:** [`src/components/MapView.tsx`](file:///Users/maria/Documents/focus%20favorite%20webapp/src/components/MapView.tsx)

---

## 1. ปัญหาเดิม (The Problem)
- ปัจจุบัน `allLocations` แตกสถานที่ออกมาแบบ 1 สถานที่ : 1 ไอเทม (`LocationEntry = { location, item }`)
- หากมี 3 คลิปที่พูดถึงร้านเดียวกันและมีพิกัดเดียวกัน แผนที่จะวาง `<Marker>` ทับซ้อนกันสนิท 3 ตัว
- เมื่อผู้ใช้คลิกหมุด เบราว์เซอร์จะรับ Event เฉพาะหมุดบนสุด ทำให้ผู้ใช้เห็นเพียงคลิปเดียว และไม่รู้เลยว่ามีคลิปอื่นเกี่ยวกับร้านนี้อีก

---

## 2. ทางเลือก UX/UI ที่เลือก (Selected UX: Type 1 Vertical List)
ผู้ใช้เลือก **แบบที่ 1: Vertical List (Master-Detail)** 
*(มี Interactive Prototype ให้ดูที่ `public/mockup_multi_items.html`)*

### 2.1 บนแผนที่ (Map Marker with Counter Badge)
- หากพิกัดนั้นมี **1 คลิป:** แสดงหมุดมาตรฐาน (สีน้ำเงิน / สีเขียวเมื่อเลือก)
- หากพิกัดนั้นมี **> 1 คลิป:** ใช้ Leaflet `divIcon` แสดงหมุดพร้อม **Badge Counter สีส้ม/ชมพู** (เช่น `2`, `3`, `5`) แปะที่มุมขวาบนของหมุด เพื่อให้สังเกตเห็นได้ทันที

### 2.2 แผงรายละเอียด (Master-Detail Panel)
- **ส่วนหัว (Shared Venue Header):**
  - แสดงป้ายกำกับ: `รวม N คอนเทนต์ในที่นี่`
  - ชื่อสถานที่ + ที่อยู่
  - ปุ่มเปิดนำทางใน Google Maps (แสดงครั้งเดียว ไม่ต้องซ้ำทุกการ์ด)
- **ส่วนรายการคลิป (Vertical Card Feed):**
  - เรียงการ์ดย่อยของแต่ละคลิปลงมาในแนวตั้ง พร้อม scrollbar
  - แต่ละการ์ดระบุชัดเจน:
    - Platform Badge: 🎵 TikTok, 📺 YouTube, 📘 Facebook Reels
    - ชื่อคลิป (Original Title)
    - แคปชั่นย่อ (Original Caption)
    - ปุ่ม *"ดูคลิปต้นฉบับ"* และปุ่ม *"แก้ไขข้อมูล"*

### 2.3 การปรับให้เข้ากับ Mobile
- **Desktop (lg+):** แผงขวาสูง 520px เลื่อนดูคลิปทั้งหมดในร้านนั้นได้สบายๆ
- **Mobile (< lg):** แผงใต้แผนที่แสดงหัวข้อร้าน และเลื่อนดูรายการคลิปทั้งหมดในแนวตั้ง หรือ Horizontal Cards แบบ Snap

---

## 3. สถาปัตยกรรมข้อมูล (Data Architecture Plan)

### 3.1 Type Definition ใหม่
```typescript
export type LocationClusterEntry = {
  key: string;              // unique cluster key: name + rounded lat,lng
  location: LocationItem;   // ตัวแทนพิกัดและชื่อสถานที่
  items: SavedItem[];       // รวมไอเทมทั้งหมดที่พูดถึงสถานที่นี้
};
```

### 3.2 กฎการจัดกลุ่ม (Grouping Strategy)
- เกณฑ์การรวมกลุ่ม:
  1. `place_id` เดียวกัน (ถ้ามี)
  2. หรือ ชื่อสถานที่ใกล้เคียงกัน + พิกัด Lat/Lng ห่างกันไม่เกิน ~0.0005 (ประมาณ 50 เมตร)
- การค้นหา (Search Filtering): หากคำค้นตรงกับหัวข้อ/แคปชั่น/แท็กของ **ไอเทมใดไอเทมหนึ่งในกลุ่ม** หรือตรงกับชื่อสถานที่ กลุ่มนั้นจะถูกนำมาแสดงทันที

---

## 4. ขั้นตอนการดำเนินงาน (Checklist)
- [x] 1. อัปเดต Data Structure ใน `MapView.tsx`: ปรับ `allLocations` จาก `LocationEntry[]` เป็น `LocationClusterEntry[]`
- [x] 2. สร้าง Custom Leaflet Marker Icon สำหรับหมุดที่มี Counter Badge (ใช้ `L.divIcon`)
- [x] 3. ปรับปรุง `renderCardDetail` ให้เป็น Master-Detail (Header สถานที่ 1 ครั้ง + รายการคลิปทั้งหมดพร้อม Platform Badges)
- [x] 4. ปรับปรุง Search Result Mode และ Mobile Carousel ให้รองรับ Cluster Data
- [x] 5. ทดสอบ `npm run build` ผ่าน 0 errors และเตรียมพร้อมสำหรับการ Deploy
