import { SavedItem } from '../types';

export const INITIAL_MOCK_ITEMS: SavedItem[] = [
  {
    id: '1',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    platform: 'youtube',
    content_type: 'video',
    original_title: 'แจกพิกัด 5 คาเฟ่ลับย่านอารีย์ บรรยากาศดี เหมาะนั่งทำงานปี 2026',
    original_caption: 'วันนี้พาทุกคนมาทัวร์อารีย์ ซอย 4 รวม 5 คาเฟ่ลับที่มีเงียบสงบ กาแฟดริปดีมาก ปลั๊กไฟเยอะ เหมาะสำหรับสายโกออฟฟิศ #คาเฟ่อารีย์ #รีวิวกาแฟ #BangkokCafe',
    normalized_category: 'Food & Cafe',
    tags: ['คาเฟ่', 'อารีย์', 'นั่งทำงาน', 'กาแฟดริป', 'กรุงเทพ'],
    extracted_locations: [
      {
        name: 'Nana Coffee Roasters Ari',
        type: 'Cafe',
        lat: 13.7820,
        lng: 100.5435,
        formatted_address: '24 Soi Ari 4 Nua, Samsen Nai, Phaya Thai, Bangkok'
      },
      {
        name: 'Yellow Lane Ari',
        type: 'Cafe & Brunch',
        lat: 13.7808,
        lng: 100.5422,
        formatted_address: 'Ari Soi 2, Phaya Thai, Bangkok'
      }
    ],
    thumbnail_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
    transcript: 'สวัสดีครับเพื่อนๆ วันนี้เราพามาดู 5 คาเฟ่ลับย่านอารีย์ ร้านแรกคือ Nana Coffee Roasters กาแฟหอมมาก มีสวนร่มรื่น...',
    status: 'completed',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: '2',
    url: 'https://www.tiktok.com/@example/video/1234567890',
    platform: 'tiktok',
    content_type: 'video',
    original_title: 'ราเมงลับเปิดถึงตี 3 ชามละ 120 บาท เส้นสดน้ำซุปเข้มข้น!',
    original_caption: 'พิกัดร้านลับบรรทัดทอง ชามใหญ่มากกก น้ำซุปกระดูกหมูเข้มข้นสุดๆ ใครสายกินดึกห้ามพลาด #รีวิวของกิน #บรรทัดทอง #ราเมง',
    normalized_category: 'Food & Cafe',
    tags: ['ราเมง', 'บรรทัดทอง', 'ร้านเด็ดตอนดึก', 'ของกินกรุงเทพ'],
    extracted_locations: [
      {
        name: 'ร้านราเมงเต่าทอง บรรทัดทอง',
        type: 'Ramen Restaurant',
        lat: 13.7431,
        lng: 100.5234,
        formatted_address: 'Ban That Thong Rd, Pathum Wan, Bangkok'
      }
    ],
    thumbnail_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    transcript: 'โอ้โหทุกคน ราเมงซุปกระดูกหมูร้านนี้เข้มข้นสะใจมาก หมูชาชูชิ้นใหญ่เบิ้ม...',
    status: 'completed',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: '3',
    url: 'https://www.facebook.com/watch/?v=9876543210',
    platform: 'facebook',
    content_type: 'post',
    original_title: 'คู่มือเที่ยวเชียงใหม่ 3 วัน 2 คืน เก็บคาเฟ่ + ดอยอินทนนท์',
    original_caption: 'สรุปแพลนเที่ยวเชียงใหม่ช่วงหน้าหนาว พักนิมมาน ขึ้นดอยดูพระอาทิตย์ขึ้น และแวะถ่ายรูปสวนดอกไม้แม่ริม เซฟเก็บไว้ตามได้เลย!',
    normalized_category: 'Travel',
    tags: ['เชียงใหม่', 'เที่ยวไทย', 'ดอยอินทนนท์', 'นิมมาน'],
    extracted_locations: [
      {
        name: 'ดอยอินทนนท์ (Doi Inthanon)',
        type: 'Mountain / National Park',
        lat: 18.5889,
        lng: 98.4868,
        formatted_address: 'Chom Thong District, Chiang Mai'
      },
      {
        name: 'One Nimman Chiang Mai',
        type: 'Shopping & Landmark',
        lat: 18.8003,
        lng: 98.9681,
        formatted_address: 'Nimmanhaemin Rd, Suthep, Mueang Chiang Mai'
      }
    ],
    thumbnail_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    status: 'completed',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: '4',
    url: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
    platform: 'youtube',
    content_type: 'video',
    original_title: 'สอนสรุปหนังสือด้วย AI (Prompt Engineering 2026)',
    original_caption: 'เทคนิคการสร้าง Second Brain และการเขียน Prompt เพื่อย่อยบทความยาวๆ ให้ได้จุดสำคัญภายใน 1 นาที #Productivity #AI #Tech',
    normalized_category: 'Tech & Knowledge',
    tags: ['AI', 'Prompt Engineering', 'Productivity', 'Second Brain'],
    extracted_locations: [],
    thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    transcript: 'ในคลิปนี้จะพาดูวิธีการใช้ LLM ช่วยวิเคราะห์สรุปความรู้เพื่อบันทึกเข้าฐานข้อมูลส่วนตัว...',
    status: 'completed',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];
