# Spec: AI Queue & Health Monitor & Sandbox Removal (2026-10-16)

> 📌 **เป้าหมาย:** 
> 1. ปลดระวางแท็บ **Sandbox (`DevSandbox`)** ออกจาก Webapp เพื่อความปลอดภัยของข้อมูล (ป้องกันการเผลอกดปุ่ม Clear Database) และทำให้ UI บนมือถือ/เดสก์ท็อปสะอาด เหลือเฉพาะแท็บหลักที่ใช้งานจริง
> 2. เพิ่ม **AI Queue & Health Status Indicator** บน Navbar เพื่อให้ผู้ใช้ทราบสถานะการทำงานของ Inngest Worker และ Gemini AI ได้แบบเรียลไทม์ หากเกิดกรณีเครดิตหมด (`402`) หรือมีคิวค้าง (`pending`) จะมีป้ายแจ้งเตือนทันที พร้อมปุ่มสั่งรันต่อ (Retry) ในตัว

---

## 1. การปลดระวาง DevSandbox (Sandbox Removal)

### 1.1 ปัญหาและความเสี่ยง
- แท็บ `Sandbox` ถูกสร้างขึ้นเพื่อจำลองการรัน AI ในช่วงพัฒนาแรกเริ่ม ปัจจุบันไม่มีความจำเป็นแล้ว เพราะมีระบบจริงที่รันผ่าน Extension + Inngest สมบูรณ์แบบ
- ใน Sandbox มีปุ่มสีแดงอันตราย: `handleClearHistory` ซึ่งยิงคำสั่ง `DELETE /api/ingest` เพื่อลบข้อมูลทั้งหมดใน Supabase
- การมีแท็บ Sandbox เพิ่มความแออัดบน Navbar โดยเฉพาะหน้าจอมือถือ

### 1.2 แผนการดำเนินการ
1. ปิดกั้น `DELETE /api/ingest` ในเซิร์ฟเวอร์ ให้ตอบกลับ `403 Forbidden` เสมอ เพื่อเป็น Safety Guardrail ถาวรกันข้อมูลสูญหาย
2. นำแท็บ `'sandbox'` ออกจาก `src/components/Navigation.tsx`
3. ปรับปรุง `src/app/page.tsx`:
   - ปรับประเภทของ `activeTab` เหลือเฉพาะ `'feed' | 'map' | 'extension'`
   - นำการ import และ render `<DevSandbox />` ออก
4. เก็บไฟล์คอมโพเนนต์ `DevSandbox.tsx` ไว้เป็น archive ใน repo หรือถอดออกจากการ build bundle

---

## 2. ระบบตรวจสอบสถานะ AI & คิว (AI Queue & Health Monitor)

### 2.1 Backend Endpoint (`GET /api/queue-status`)
สร้าง API route ใหม่ `src/app/api/queue-status/route.ts` ที่ทำงานแบบเบาและเร็วมาก (ใช้ PostgREST `head: true` count):
- คืนค่า JSON:
  ```json
  {
    "total": 10466,
    "completed": 10466,
    "pending": 0,
    "error": 0,
    "status": "idle" | "processing" | "stalled",
    "updatedAt": "2026-10-16T07:30:00.000Z"
  }
  ```

### 2.2 Frontend Indicator บน Header (`Navigation.tsx`)
วาง Status Widget ขนาดกะทัดรัดไว้ข้างโลโก้/จำนวน Saved:
- **กรณีปกติ (Pending = 0, Error = 0):**
  - แสดงป้ายสีเขียวอ่อน: `🟢 AI พร้อมทำงาน (คิวว่าง)`
- **กรณีกำลังรัน (Pending > 0, Error = 0):**
  - แสดงป้ายสีเหลือง/ส้มแบบ Animated Pulse: `⚡ กำลังวิเคราะห์ (เหลือ N รายการ)`
- **กรณีติดปัญหา/ค้าง (Pending ค้างนาน หรือ Error > 0):**
  - แสดงป้ายสีแดง/ชมพู: `⚠️ คิวค้าง N รายการ (คลิกเพื่อดู)`

### 2.3 Status Modal / Drawer
เมื่อผู้ใช้คลิกที่ป้ายสถานะ จะเปิดหน้าต่างสรุปสถานะการทำงาน:
- สรุปตัวเลข: ทั้งหมด, สำเร็จแล้ว, กำลังรอในคิว, เกิดข้อผิดพลาด
- คำแนะนำเมื่อ AI หยุดทำงาน (เช่น เมื่อเครดิตหมด ให้เติมเครดิตที่ Google AI Studio)
- **ปุ่ม Action "สั่งรันคิวที่ค้างต่อ (Retry Pending)":** ยิงเรียก `GET /api/retry-pending` ทันที ผู้ใช้สามารถกดให้ระบบเริ่มทำงานต่อได้เองจากหน้าเว็บ โดยไม่ต้องเข้า SSH
- **ปุ่ม "รีเฟรช":** กดเพื่อดึงสถานะล่าสุดได้ทันใจ

---

## 3. ขั้นตอนการตรวจสอบและทดสอบ (Validation Checklist)
- [ ] 1. สร้าง `src/app/api/queue-status/route.ts` พร้อม fallback handling
- [ ] 2. ปรับ `src/app/api/ingest/route.ts` เพื่อปิดกั้นการลบ DB (Safety Lock)
- [ ] 3. อัปเดต `Navigation.tsx` (ลบ Sandbox, เพิ่ม Queue Status Pill & Modal)
- [ ] 4. อัปเดต `page.tsx` (เอาแท็บ Sandbox ออก)
- [ ] 5. รัน `npm run build` ตรวจสอบ 0 type errors
- [ ] 6. Deploy ขึ้น VPS และทดสอบบน https://72-62-254-106.sslip.io
