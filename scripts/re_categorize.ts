import { generateObject, embed } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import * as fs from 'fs';

// 1. Manually parse .env.local to avoid dotenv dependency
const envFile = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#]+?)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

// Set ENV for AI SDK
process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_API_KEY;

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  console.log("Fetching items from Supabase via REST API...");
  
  // 2. Fetch via REST to avoid @supabase/supabase-js WebSocket crash on Node 20
  // Added filter: updated_at=lt.2026-10-03T12:00:00Z to skip the 174 items already processed today
  const res = await fetch(`${SUPABASE_URL}/rest/v1/saved_items?select=id,original_title,transcript,updated_at&transcript=not.is.null&updated_at=lt.2026-10-03T12:00:00Z`, {
    headers: { 'apikey': SUPABASE_KEY!, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const items = await res.json();

  if (!items || !items.length) {
    console.error("Error fetching or no items found:", items);
    return;
  }

  console.log(`Found ${items.length} items to re-categorize. Starting AI processing...\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`[${i+1}/${items.length}] Processing item: ${item.id}`);

    try {
      const cleanTranscript = item.transcript.includes('Log into Facebook') || item.transcript.includes('เข้าสู่ระบบ Facebook') 
         ? item.transcript.split('Page Title:')[0] 
         : item.transcript;

      const prompt = `
        Analyze the following content (Title + Caption/Transcript):
        "${item.original_title} - ${cleanTranscript}"
        
        Extract the following information:
        - Topics: You MUST select 1 to 3 relevant topics from this exact list:
          1. "Tech & AI": Technology, AI, coding, software, apps, tech subscriptions, internet packages, AI courses.
          2. "Psychology": Mindset, psychology, relationships.
          3. "Marketing & Business": Online marketing, business, TikTok affiliate/shop.
          4. "Medical & Health": Medical knowledge, doctor advice, health science.
          5. "Finance & Tax": Money, investment, taxes.
          6. "General Knowledge": Other educational content not fitting above.
          7. "Movie & Series Review": Reviews or discussions about films, series, anime.
          8. "Entertainment & Comedy": Funny clips, dancing, general entertainment, video games, mobile games.
          9. "Shopping & Products": Product recommendations, hauls, gadgets, home decor, clothing, cosmetics, supermarket groceries, or DIY items (focus on physical goods, excludes software/food).
          10. "Cooking & Recipes": How to cook, recipes, food preparation.
          11. "Food & Cafe": Restaurant reviews, cafe hopping, street food eating.
          12. "Travel & Event": Tourism, traveling, festivals, exhibitions.
        - Tags: 5-7 tags. You MUST include BOTH broad umbrella terms (e.g., 'กาแฟ') AND specific details (e.g., 'กาแฟดริป').
      `;
      
      const { object: aiExtracted } = await generateObject({
        model: google("gemini-3.8-flash"),
        prompt,
        schema: z.object({
          topics: z.array(z.enum([
            "Tech & AI", "Psychology", "Marketing & Business", "Medical & Health", 
            "Finance & Tax", "General Knowledge", "Movie & Series Review", 
            "Entertainment & Comedy", "Shopping & Products", "Cooking & Recipes", 
            "Food & Cafe", "Travel & Event"
          ])),
          tags: z.array(z.string())
        })
      });

      const textToEmbed = `${item.original_title} ${item.transcript} ${(aiExtracted.topics || []).join(" ")} ${(aiExtracted.tags || []).join(" ")}`;
      const { embedding } = await embed({
        model: google.textEmbeddingModel('gemini-embedding-2'),
        value: textToEmbed,
      });
      const slicedEmbedding = embedding.slice(0, 768);

      const mergedTags = [...(aiExtracted.topics || []), ...(aiExtracted.tags || [])];

      // Update Database via REST
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/saved_items?id=eq.${item.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY!,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          normalized_category: aiExtracted.topics?.[0] || null,
          tags: mergedTags,
          embedding: slicedEmbedding
        })
      });

      if (!updateRes.ok) {
        console.error(`❌ DB Update Error for ${item.id}:`, await updateRes.text());
      } else {
        console.log(`✅ Success: ${aiExtracted.topics.join(', ')} | Tags: ${aiExtracted.tags.slice(0,3).join(', ')}...`);
      }

    } catch (err) {
      console.error(`❌ AI Processing Failed for ${item.id}:`, err);
    }
    
    // Slight delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log("\n🎉 Re-categorization complete!");
}

run();
