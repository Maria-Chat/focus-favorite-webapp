# Handoff: Resource Safety (Memory / Storage) — Focus Favorite Webapp

> เอกสารส่งต่องานสำหรับ chat/agent ถัดไป · อัปเดตล่าสุด: 2026-10-06 11:50 (+07)
> **อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง** และอัปเดตส่วน "สถานะ" เมื่อทำเสร็จแต่ละเฟส

## 1. บริบท
- Stack: Next.js 14 (App Router) · Inngest (local `inngest-cli dev`) · Supabase (pgvector) · Gemini (`@ai-sdk/google`) · OpenAI Whisper · yt-dlp · Chrome extension (`chrome-extension/`)
- งานหลัก: sync รายการ Saved จาก Facebook (~10,000+ items) → `/api/ingest` → Supabase (`status='pending'`) → Inngest `process-saved-item` → AI วิเคราะห์ → `status='completed'`
- ผู้ใช้สื่อสารภาษา **ไทย**
- เครื่อง: MacOS ดิสก์ 113GB (พื้นที่ว่างน้อย ต้องระวังเสมอ)

## 2. ประวัติเหตุการณ์ disk เต็ม (3 ครั้ง)
| # | ต้นเหตุ | ขนาด | การแก้ |
|---|---|---|---|
| 1 | Chrome cache จาก auto-scroll Facebook (รูป/วิดีโอ) | ~3GB | ล้าง cache (ยังไม่มีการป้องกันถาวร → Phase 3) |
| 2 | `~/.npm/_logs` บวมจาก Inngest retry วนลูปตอน Gemini ตอบ 402 (เครดิตหมด) | ~5GB | ลบ log + `.npmrc logs-max=3` + fail-fast 402 |
| 3 | **`$TMPDIR/_MEI*`** — `bin/yt-dlp_macos` (PyInstaller onefile) แตกไฟล์ ~72MB ทุกครั้งที่รัน และโค้ดเดิมใช้ `killall -9` ทำให้ไม่ได้ลบ → 667 โฟลเดอร์ | **~41GB** | ลบแล้ว + เปลี่ยนไปใช้ yt-dlp จาก pip + per-job temp dir |

> [!WARNING]
> ห้ามกลับไปใช้ `bin/yt-dlp_macos` เป็นตัวหลัก และห้ามใช้ `killall -9` กับ yt-dlp

## 3. สถานะ (ณ 2026-10-06 11:50)
- Supabase: Total 7,182 · Completed 7,127 · **Pending 55** · Error 0
- ❗ **Gemini เครดิตหมดรอบล่าสุด (402)** → Circuit breaker ทำงานได้สมบูรณ์ ตัดวงจรหยุด Inngest ทันทีโดยไม่มี Infinite Retry (ค่าใช้จ่าย 150 บาทที่หายไป เกิดจากการรันสำเร็จ 1,000 ชิ้น ซึ่งใช้ `gemini-3.8-flash` ตกอยู่ประมาณ 0.15 บาท/item ซึ่งเป็นราคาปกติ ไม่ใช่บั๊ก)
- ❗ **บั๊ก API นำคิวเข้า Inngest ซ้ำ** → พบว่า `GET /api/retry-pending` ดึงข้อมูลเก่าที่ completed แล้วเข้าไปในคิวถึง 1,500 รายการ เนื่องจากขาด `.order('id')` คู่กับ `.range()` (PostgreSQL Pagination)
  - **แก้ไขแล้ว:** เติม `.order('id')` ใน `/api/retry-pending/route.ts` เรียบร้อย
  - **แก้ไขแล้ว:** ป้องกันด้วยการเติม `if (item.status === 'completed') { return skip; }` ใน `process-saved-item` (Inngest) ทำให้ระบบเตะคิวที่ซ้ำซ้อน 1,500 อันทิ้งได้ในเสี้ยววินาทีโดยไม่เสียเครดิต AI สตางค์เดียว
- Next.js dev + Inngest dev คาดว่ายังรันอยู่เบื้องหลัง (กำลังค่อยๆ เตะคิวซ้ำทิ้ง + รัน 55 ตัวที่เหลือ)
- Disk watchdog **รันอยู่เบื้องหลัง** (`nohup`, log ที่ `.logs/watchdog.log`) · พื้นที่ว่าง ~43GB · ไม่มี `_MEI*`/`fav_*` ค้าง
- เช็คสถานะ DB: `node check_status.js` · เช็ค Inngest runs: GraphQL `localhost:8288/v0/gql`

### Checklist ก่อนรันข้อมูลที่เหลือ
1. เติมเครดิต Gemini (AI Studio) → ยืนยันด้วย `node scratch_test_gemini.mjs` (ต้องการ API KEY ที่ยังไม่ติด limit)
2. (ถ้า Inngest คิวบวมมาก) แนะนำ restart `inngest dev` เพื่อเคลียร์คิวและแรม (เพราะ Inngest ใช้ in-memory sqlite)
3. `curl localhost:3000/api/retry-pending` → นำเฉพาะ `pending` items กลับเข้า Inngest
4. Reload extension v1.1.0 ใน `chrome://extensions` → เปิด Facebook Saved → ใช้โหมด **"Sync All From Scratch"** (โหมด Sync New จะหยุดทันทีเพราะรายการบนสุดถูก sync ไปแล้ว; server ข้ามรายการที่มีอยู่แล้วเอง)
5. เฝ้าดูด้วย `node check_status.js` + Chrome Task Manager (RAM ของ tab ควรคงที่)

## 4. แผนและความคืบหน้า
แผนเต็ม: `~/.gemini/antigravity-ide/brain/599c3f5f-b1b3-4ca8-b103-370c917ac16f/resource_safety_plan.md`

### ✅ Phase 0 — Guardrail ระดับเครื่อง (เสร็จ)
- `.npmrc` → `logs-max=3`, `loglevel=warn`
- `scripts/cleanup.sh` (`npm run cleanup`) → ลบ `_MEI*` เก่ากว่า 3 นาที, `fav_*`/`audio_*` เก่ากว่า 10 นาที, `~/.npm/_logs`, `.logs` เก่ากว่า 1 วัน, `~/.cache/yt-dlp`
- `scripts/disk-watchdog.sh` (`npm run watchdog`) → ทุก 60 วิ: ว่าง < 3GB รัน cleanup, < 1.5GB `pkill` Inngest + macOS notification (ปรับด้วย env `WARN_GB`, `STOP_GB`, `INTERVAL`)
- `.logs/` อยู่ใน `.gitignore`
- ⏳ ยังไม่ทำ: `scripts/dev-safe.sh` (preflight เช็ค ≥5GB + รัน next/inngest/watchdog พร้อมกัน + log rotation)

### ✅ Phase 1 — Inngest pipeline `src/lib/inngest/functions.ts` (เสร็จ + verified)
- `YTDLP_BIN` เลือกตามลำดับ: `$YTDLP_PATH` → `~/.pyenv/versions/3.9.17/bin/yt-dlp` (2025.10.14) → brew → `bin/yt-dlp_macos` (fallback สุดท้าย)
- `downloadAudio()` ใช้ `spawn` + timeout 20s (SIGTERM แล้วค่อย SIGKILL), ตั้ง `TMPDIR=jobDir` ให้ child, `--max-filesize 25M`, `--audio-quality 9`, `--no-cache-dir`
- per-job dir `$TMPDIR/fav_<id>_xxxx` ลบใน `finally` เสมอ
- `handleAiError()` → 402/billing = `NonRetriableError` + circuit breaker พัก AI 10 นาที (`aiPausedUntil`, in-memory); 429 = `RetryAfterError("2m")`
- `processSavedItem` เพิ่มการดัก `if (status === 'completed') { return skip }` เป็น Guardrail สุดท้ายกัน Inngest รันตัวที่เสร็จแล้วซ้ำแบบฟรีๆ (ป้องกัน API Retry queue duplication bug)
- `generateObject`/`embed` ตั้ง `maxRetries: 0` (ให้ Inngest คุม retry เท่านั้น)
- `throttle: 30/นาที`, `retries: 2`, `concurrency: 1`
- `fetch-item` select เฉพาะคอลัมน์ที่ใช้; รวม embed + update DB เป็น step `embed-and-save` (vector ไม่ถูกเก็บใน step state)
- ตัด transcript ≤ 8,000 ตัวอักษร; log error 1 บรรทัดผ่าน `logError()`
- Verified: ไม่มี `_MEI*` ใหม่เกิดขึ้น, process ที่รันคือ python3.9 yt-dlp

### ✅ Phase 2 — Ingest API `src/app/api/ingest/route.ts` (เสร็จ + verified 2026-10-05 11:28)
ผู้ใช้อนุมัติ: **เก็บ `synced_history.json` เดิมไว้เป็น backup แต่เลิกเขียนเพิ่ม** (ไฟล์ยังอยู่ 9.5MB, ไม่ถูกแตะแล้ว)
- [x] POST: เลิก read/write `synced_history.json` (เดิมโหลด+เขียนใหม่ 9.5MB ทุก request, `findIndex` O(n²))
- [x] POST: แบ่ง chunk 500 (`DB_CHUNK`) สำหรับ `.in('url', …)` + insert, ส่ง event ทีละ 100
- [x] POST: response เหลือแค่ `{message, count, inserted, skipped}` (ตัวเลข) — popup.js ไม่ได้อ่าน field เหล่านี้
- [x] GET: อ่านจาก Supabase 100 รายการล่าสุด + `count: 'exact'` → response 79KB (เดิม 9.5MB)
- [x] DELETE: ลบเฉพาะ Supabase (เหมือนเดิม) ไม่แตะไฟล์ backup; ข้อความยืนยันใน DevSandbox แก้ให้ชัดว่าลบทั้ง DB
- [x] `DevSandbox.tsx` แสดง "ล่าสุด 100 จาก N"
- `scratch_analyze.js` ยังอ่านไฟล์ backup ได้ตามเดิม

### ✅ Phase 3 — Chrome extension `chrome-extension/` (v1.1.0, ตรวจและแก้บั๊ก 2026-10-06 00:00)
ผลตรวจรอบแรก (11:35) เจอบั๊กสำคัญ แก้แล้วดังนี้:
- [x] **DOM cleanup ไม่เคยทำงาน** — ไม่มีโค้ดตั้ง `data-fav-extracted` → ตอนนี้ mark การ์ดตอน extract (เฉพาะเมื่อเจอขอบการ์ดจริง `foundBoundary`)
- [x] **ข้อมูลหายเงียบๆ** — batch ที่ส่งไม่สำเร็จถูกทิ้ง (คอมเมนต์ "will retry" แต่ไม่มี retry) + popup ข้ามการส่งที่เหลือถ้ามีส่งสำเร็จบางส่วน → ตอนนี้เก็บใน `pending` จน server ยืนยัน, retry ทุก flush, ส่ง `failedItems` กลับให้ popup ส่งซ้ำ
- [x] **mark synced ก่อนส่งจริง** (popup.js) → ตอนนี้ mark หลัง server ตอบ OK ทีละ chunk
- [x] **ลบ node (`video/iframe/svg`) ออกจาก DOM ของ React** เสี่ยงทำหน้า FB พัง → ตอนนี้แบบ non-destructive: ถอด `src/srcset`, `video.pause()+load()` เฉพาะการ์ดที่เลื่อนพ้นจอแล้ว
- [x] **fetch localhost จาก content script** (origin = facebook.com → โดน CORS/Local Network Access prompt) → ย้ายไป `background.js` (service worker, retry 3 ครั้ง, mark synced หลังยืนยัน) + `host_permissions: http://localhost:3000/*`
- [x] **ยังสแกนทั้งหน้าทุกรอบ (O(n²))** → `extractSavedContent(incremental=true)` ข้าม link ที่ `data-fav-seen === href` (กัน FB recycle node)
- [x] Memory guard: JS heap > 1.5GB → cleanup + พัก 5 วิ; เก็บเฉพาะ URL (ไม่เก็บ item เต็ม) ใน memory; response กลับ popup เหลือแค่ตัวเลข + failedItems
- ตรวจแล้ว: `node --check` ผ่านทุกไฟล์, manifest เป็น JSON ถูกต้อง, `/api/ingest` OPTIONS/POST ตอบปกติ
- ⚠️ ยังไม่ได้ทดสอบบนหน้า Facebook จริง (agent ทำแทนไม่ได้) — ดู console ของ tab (`⚡ Batch upload failed`) และ service worker ใน `chrome://extensions`

### ⏳ Phase 4 — กฎสำหรับ AI agent
- ก่อนเริ่มงานยาว: `df -h /` ถ้า < 5GB ต้องแจ้งผู้ใช้ก่อน
- output ของคำสั่งต้องจำกัดด้วย `| tail`/`head` เสมอ ห้ามเขียน log ไม่จำกัด
- monitor ด้วย `node check_status.js` (เบา) แทนการเปิด browser/screenshot ถี่ๆ
- เจอ error เดิมซ้ำ (เช่น 402) → หยุด worker ทันที
- ถ้าพื้นที่หายเร็วผิดปกติ: เช็ค `du -sh $TMPDIR ~/.npm/_logs ~/Library/Caches` ก่อนอย่างอื่น

## 5. คำสั่งที่ใช้บ่อย
```bash
node check_status.js                    # สถานะคิวใน Supabase
npm run cleanup                         # คืนพื้นที่
npm run watchdog                        # เฝ้าดิสก์ (รันใน terminal แยก)
curl localhost:3000/api/retry-pending   # re-queue pending ทั้งหมดเข้า Inngest (แก้บัก .order() กันข้อมูลซ้ำแล้ว)
df -h / ; du -sh $TMPDIR ~/.npm/_logs   # เช็คพื้นที่
```
