# Project Context & Handoff (Focus Favorite Webapp)

> 📌 **คำแนะนำสำหรับ AI Agent ในอนาคต:** 
> ไฟล์นี้คือ Master Document ที่รวมและอัปเดตข้อมูลล่าสุดจาก PRD และ Implementation Plan เดิม (ซึ่งถูก Deprecate ไปแล้ว) ให้อ่านไฟล์นี้และ `docs/HANDOFF_RESOURCE_SAFETY.md` ก่อนเริ่มงานเสมอ

## 1. Project Overview (ภาพรวมโปรเจกต์)
**ชื่อโปรเจกต์:** Saved Content Manager (Second Brain for Social Media)
**เป้าหมาย:** ระบบรวบรวม จัดหมวดหมู่ และค้นหาคอนเทนต์ที่ผู้ใช้กด Saved ไว้บนโซเชียลมีเดียต่างๆ (YouTube, TikTok, Facebook) โดยอัตโนมัติ

**โครงสร้างระบบ (Decoupled Architecture):**
1. **Chrome Extension (Data Collector):** ทำหน้าที่ดึงข้อมูล (DOM Scraping) คอนเทนต์ที่หน้า Saved บน Desktop 
2. **Next.js Web Application:** ทำหน้าที่รับข้อมูลผ่าน API (`/api/ingest`), รัน AI Pipeline เบื้องหลังผ่าน Inngest, และเป็น Mobile-First Web App สำหรับค้นหาและแสดงผล (Feed / Map View)

---

## 2. Technical Stack ล่าสุด (ณ ปี 2026)
- **Frontend / Backend:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL + `pgvector`)
- **Deployment:** Hostinger VPS (Ubuntu) บริหารจัดการด้วย `pm2`
- **Background Jobs:** Inngest (รันผ่าน `inngest dev` ร่วมกับ `pm2` เพื่อข้ามข้อจำกัด Serverless Timeout)
- **AI / Machine Learning:**
  - **Categorization & Extraction:** Gemini API (`gemini-3.8-flash` เรียกผ่าน `@ai-sdk/google`)
  - **Embeddings:** Gemini API (`gemini-embedding-2` เวกเตอร์ 768-dim)
  - **Speech-to-Text:** OpenAI API (`whisper-1`)
- **Tools:** 
  - `yt-dlp` (ติดตั้งตรงบน VPS, ใช้ผ่าน `child_process.spawn`)
  - Google Maps Geocoding / Places API

---

## 3. Data Pipeline & Workflow
1. **Ingestion:** Chrome Extension รันโหมด Incremental Sync → ส่ง batch array ไปที่ Web App `POST /api/ingest` (chunk ละ 500 items).
2. **Queueing:** บันทึกลง Supabase (status: `pending`) → ส่งเข้า Inngest Trigger `app/saved_item.ingested`.
3. **Background Processing (Inngest `process-saved-item`):**
   - **Audio:** โหลดเสียงด้วย `yt-dlp` ลง Temp Dir -> แปลงเป็นข้อความด้วย Whisper (`whisper-1`).
   - **Extraction:** นำ Caption + Transcript โยนให้ `gemini-3.8-flash` สกัด Topics, Tags, Places (คืนค่าเป็น JSON/Zod Schema).
   - **Geocoding:** นำ Places ไปหาพิกัด Lat/Lng ด้วย Google Maps API.
   - **Vectorization & Save:** นำข้อมูลไปแปลงเป็น Embedding ด้วย `gemini-embedding-2` และอัปเดตลง Supabase (status: `completed`).

---

## 4. Resource Safety & Operational Guidelines (สำคัญมาก ⚠️)
โปรเจกต์นี้มีข้อจำกัดเรื่องพื้นที่ Disk และ API Costs ที่เคยเกิดปัญหามาก่อน โปรดปฏิบัติตามกฎเหล่านี้อย่างเคร่งครัด:

1. **AI Circuit Breaker (ป้องกันกินเครดิตฟรี):** 
   - หาก Gemini คืนค่า `402 (prepayment credits are depleted)` Inngest จะตัดวงจร (Pause) 10 นาทีทันที ห้ามนำออกเด็ดขาด
2. **การจัดการ Queue ที่ซ้ำซ้อน (Pagination Bug):**
   - เคยมีบั๊กใน `/api/retry-pending` ที่ดึงข้อมูลซ้ำเข้ามาในคิว แก้ไขแล้วโดยเพิ่ม `.order('id')` คู่กับ `.range()`
   - ใน `src/lib/inngest/functions.ts` มี Guardrail: `if (item.status === 'completed') return;` เพื่อข้ามงานซ้ำทันที
3. **การจัดการ Disk Space:**
   - **ห้ามใช้ `killall -9` กับ yt-dlp** เพราะจะทำให้ไฟล์ชั่วคราว (`_MEI*`) บวมเต็มเครื่อง (เคยทำดิสก์เต็ม 41GB มาแล้ว)
   - มี Script ป้องกัน: `npm run cleanup` (ล้างไฟล์ขยะ) และ `npm run watchdog` (เฝ้าดิสก์เบื้องหลัง)

---

## 5. การแสดงผล (User Interface)
- **Feed View:** Infinite Scroll, รองรับ Native Embed (Iframe ของ YT/FB) หรือเล่นตรงผ่าน `<video>` tag ถ้าดึงไฟล์ .mp4 ได้
- **Map View:** แสดงหมุดสถานที่จาก AI ด้วย `react-leaflet` (Leaflet) พร้อมระบบ Search ค้นหาเพื่อกรองพิกัดบนแผนที่แบบ Local
- **Semantic Search:** ค้นหาเนื้อหาด้วย Context (Cosine Similarity) 

*(หมายเหตุ: ไฟล์ `prd.md` และ `IMPLEMENTATION_PLAN.md` เดิม เป็นข้อมูลเก่าและถูก Deprecated แล้ว ให้อ้างอิงการทำงานจากไฟล์นี้เป็นหลัก)*

---

## 6. AI Directives & Standing Orders (กฎเหล็กสำหรับ AI)
> 🚨 **กฎถาวร (Standing Order) ที่ตกลงกับ User ไว้ (ตั้งแต่ 2026-10-09):**
> "นับตั้งแต่นี้เป็นต้นไป ทุกครั้งที่เราทำฟีเจอร์ใหม่เสร็จ หรือแก้บั๊กสำคัญจบ ให้คุณประเมินด้วยตัวเองเสมอว่ามีโค้ด โครงสร้าง หรือข้อควรระวังอะไรเปลี่ยนไปไหม ถ้ามี ให้คุณอัปเดตไฟล์ในโฟลเดอร์ `docs/` เองทันทีเงียบๆ แล้วค่อยมารายงานฉันตอนท้ายพร้อมกับผลงาน"
> 
> *คำสั่งสำหรับ AI:* ห้ามรอให้ User สั่ง "จดบทเรียน" หากคุณเพิ่งแก้โค้ดที่ซับซ้อน หรือรื้อโครงสร้างใหม่ ให้คุณใช้ Tool แก้ไขไฟล์ `KNOWN_ISSUES.md`, `PROJECT_CONTEXT.md`, หรือ `UI_UX_GUIDELINES.md` อย่างเงียบๆ ด้วยตนเองให้เสร็จก่อน แล้วค่อยแจ้ง User ในสรุปงานว่าคุณได้บันทึกการเปลี่ยนแปลงนั้นให้แล้ว

---

## 7. Development & Debugging Workflow
- **Checking DB Status:** ในการตรวจสอบสถานะการประมวลผล (ว่าคิว Inngest บน VPS ทำงานถึงไหนแล้ว) **ห้าม** พยายาม SSH เข้า VPS เพราะเราไม่มีสิทธิ์เข้าถึง ให้รันสคริปต์ `node --env-file=.env.local check_status_now.mjs` ที่เครื่อง Local แทน สคริปต์นี้จะยิง API ไปเช็คที่ Supabase โดยตรงและสรุปยอด Completed, Pending, Error ให้ทันที
- **Extension Target:** ไฟล์ `background.js` ของ Chrome Extension ถูก Hardcode เป้าหมาย `API_ENDPOINT` ไปที่ VPS IP (`http://72.62.254.106:3000/api/ingest`) เพื่อให้ผู้ใช้ใช้งานจริง หากจะเทสบนเครื่อง Local ต้องแก้ IP กลับมาด้วยเสมอ
