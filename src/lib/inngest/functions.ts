import { inngest } from "./client";
import { supabaseAdmin } from "@/lib/supabase";
import { generateObject, embed } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { NonRetriableError, RetryAfterError } from "inngest";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// ---------------------------------------------------------------------------
// Resource-safety helpers
// ---------------------------------------------------------------------------

// Prefer a yt-dlp that does NOT self-extract (pip/brew). The PyInstaller
// "yt-dlp_macos" binary unpacks ~72MB into $TMPDIR/_MEI* on every run and
// leaks it when killed -> this caused a 41GB temp-folder blowup.
const YTDLP_BIN = [
  process.env.YTDLP_PATH,
  path.join(os.homedir(), ".pyenv/versions/3.9.17/bin/yt-dlp"),
  "/usr/local/bin/yt-dlp",
  "/opt/homebrew/bin/yt-dlp",
  path.join(process.cwd(), "bin", "yt-dlp_macos"),
].find((p): p is string => !!p && fs.existsSync(p))!;

const YTDLP_TIMEOUT_MS = 20_000;
const MAX_TEXT_CHARS = 8_000;
const TMP_PREFIX = "fav_";

// Circuit breaker: once the AI provider says "out of credit", stop calling it
// for a while instead of letting every queued job retry and spam logs.
let aiPausedUntil = 0; // reset by antigravity
const AI_PAUSE_MS = 10 * 60_000;

/** One-line, length-capped error log (no giant stack traces). */
function logError(id: string, label: string, err: any) {
  const status = err?.statusCode ?? err?.status ?? err?.code ?? "";
  const msg = String(err?.message ?? err).replace(/\s+/g, " ").slice(0, 300);
  console.error(`[${id}] ${label} ${status}: ${msg}`);
}

/** Map provider errors to Inngest retry semantics. */
function handleAiError(id: string, label: string, err: any): never {
  logError(id, label, err);
  const status = Number(err?.statusCode ?? err?.status ?? 0);
  const msg = String(err?.message ?? "").toLowerCase();
  const isBilling =
    status === 402 || msg.includes("billing") || msg.includes("credit") || msg.includes("prepayment");
  if (isBilling) {
    aiPausedUntil = Date.now() + AI_PAUSE_MS;
    throw new NonRetriableError(`AI quota/billing exhausted (${status})`);
  }
  if (status === 429) {
    throw new RetryAfterError(`AI rate limited`, "2m");
  }
  if (msg.includes("prohibited_content") || msg.includes("safety") || msg.includes("blockreason") || err?.name === "AI_APICallError") {
    // Some API errors like PROHIBITED_CONTENT should not be retried, they will never succeed
    throw new NonRetriableError(`AI rejected content or call failed: ${msg}`);
  }
  throw err;
}

function assertAiAvailable() {
  // temporarily disabled to clear pause state
  // if (Date.now() < aiPausedUntil) {
  //   throw new NonRetriableError("AI paused (circuit breaker after billing error)");
  // }
}

/** Run yt-dlp in an isolated temp dir that is ALWAYS removed afterwards. */
async function downloadAudio(url: string, jobDir: string): Promise<string | null> {
  const args = [
    "--extract-audio", "--audio-format", "mp3", "--audio-quality", "9",
    "--max-filesize", "25M", "--no-playlist", "--no-progress", "--quiet",
    "--no-check-certificates", "--no-warnings", "--socket-timeout", "15",
    "--no-cache-dir",
    "--add-header", "user-agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "-o", path.join(jobDir, "audio.%(ext)s"),
    url,
  ];

  await new Promise<void>((resolve, reject) => {
    // TMPDIR=jobDir -> even a self-extracting binary unpacks inside jobDir
    const child = spawn(YTDLP_BIN, args, {
      env: { ...process.env, TMPDIR: jobDir, TMP: jobDir, TEMP: jobDir },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (d) => { if (stderr.length < 2000) stderr += d; });
    const timer = setTimeout(() => {
      child.kill("SIGTERM"); // graceful first so it can clean up
      setTimeout(() => child.kill("SIGKILL"), 3000).unref();
      reject(new Error(`yt-dlp timed out after ${YTDLP_TIMEOUT_MS / 1000}s`));
    }, YTDLP_TIMEOUT_MS);
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`yt-dlp exit ${code}: ${stderr.slice(0, 200)}`));
    });
  });

  const mp3 = fs.readdirSync(jobDir).find((f) => f.endsWith(".mp3"));
  return mp3 ? path.join(jobDir, mp3) : null;
}

export const processSavedItem = inngest.createFunction(
  { 
    id: "process-saved-item", 
    retries: 2,
    concurrency: 1,
    throttle: { limit: 30, period: "1m" },
    triggers: [{ event: "app/saved_item.ingested" }] 
  },
  async ({ event, step }) => {
    const { id, url } = event.data;
    
    // 1. Fetch item from DB (only the columns we need — never the old embedding)
    const item = await step.run("fetch-item", async () => {
      const { data, error } = await supabaseAdmin
        .from("saved_items")
        .select("id,url,platform,original_title,original_caption,normalized_category,status")
        .eq("id", id)
        .single();
        
      if (error || !data) {
        throw new Error(`Failed to fetch item ${id}`);
      }
      return data;
    });

    if (item.status === "completed") {
      return { success: true, message: "Already completed, skipping to save credits" };
    }

    // 2. Process based on platform (Audio extraction via yt-dlp & Whisper)
    let transcript = item.original_caption || "";

    if (item.platform === "youtube" || item.platform === "tiktok" || item.platform === "facebook") {
      const audioText = await step.run("extract-audio-and-transcribe", async () => {
         // Isolated per-job temp dir, removed in finally (success OR failure)
         const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), `${TMP_PREFIX}${id}_`));
         try {
           const audioPath = await downloadAudio(item.url, jobDir);
           if (!audioPath) return item.original_caption || "";

           const { OpenAI } = await import('openai');
           const openai = new OpenAI();
           const transcription = await openai.audio.transcriptions.create({
             file: fs.createReadStream(audioPath),
             model: "whisper-1",
           });
           return transcription.text.slice(0, MAX_TEXT_CHARS);
         } catch (err: any) {
           logError(id, "audio-skip", err);
           // Fallback to just the caption if audio extraction fails
           return item.original_caption || "";
         } finally {
           fs.rmSync(jobDir, { recursive: true, force: true });
         }
      });
      
      transcript = `${item.original_title} ${item.original_caption} ${audioText}`;
    }
    transcript = transcript.slice(0, MAX_TEXT_CHARS);

    // 3. Extract Categories, Tags, Locations via Gemini
    const aiExtracted = await step.run("llm-extraction", async () => {
      assertAiAvailable();
      // Clean up transcript to avoid Facebook login walls polluting the context
      const cleanTranscript = transcript.includes('Log into Facebook') || transcript.includes('เข้าสู่ระบบ Facebook') 
         ? transcript.split('Page Title:')[0] // Drop the polluted fetch data
         : transcript;

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
        - Places: A strict list of specific places mentioned. 
        
        CRITICAL RULES FOR PLACES:
        1. ONLY extract the main venues, shops, restaurants, or destinations that are being visited, reviewed, or are the primary subject of the content.
        2. DO NOT extract public transit stations (e.g., MRT, BTS) or nearby landmarks that are only mentioned as reference points for directions.
        3. DO NOT extract author names, account names, or 'created by' credits as places (e.g., if a video is by "เครปคุณปาล" but reviewing Kanom Jeen, ignore "เครปคุณปาล").
        4. DO NOT extract a location just because it is a tagged location in the metadata, IF the actual content has nothing to do with it (e.g., talking about a movie but tagged at a coffee shop).
        5. If the content does not clearly focus on a physical place to visit, return an empty array for places.
        6. IF the chosen Topics include 'Food & Cafe' or 'Travel & Event', you MUST output at least one place in the 'places' array. If no specific name is mentioned, you MUST output a place with the name "ไม่พบชื่อสถานที่" (Type: "Unknown").
      `;
      
      const { object } = await generateObject({
        maxRetries: 0, // Inngest owns retries; avoid hidden retry storms
        model: google("gemini-3.8-flash"),
        prompt,
        schema: z.object({
          topics: z.array(z.enum([
            "Tech & AI",
            "Psychology",
            "Marketing & Business",
            "Medical & Health",
            "Finance & Tax",
            "General Knowledge",
            "Movie & Series Review",
            "Entertainment & Comedy",
            "Shopping & Products",
            "Cooking & Recipes",
            "Food & Cafe",
            "Travel & Event"
          ])),
          tags: z.array(z.string()),
          places: z.array(z.object({
            name: z.string(),
            type: z.string()
          }))
        })
      }).catch((err) => {
        logError(id, "llm", err);
        const msg = String(err?.message ?? "").toLowerCase();
        if (msg.includes("billing") || msg.includes("credit") || msg.includes("prepayment") || err?.statusCode === 402) {
           aiPausedUntil = Date.now() + AI_PAUSE_MS;
           throw new NonRetriableError("AI quota/billing exhausted");
        }
        if (err?.statusCode === 429) {
           throw new RetryAfterError("AI rate limited", "2m");
        }
        // For other errors (PROHIBITED_CONTENT, invalid json, etc), just return dummy
        console.warn(`[${id}] Fallback to empty AI extraction due to error`);
        return { object: { topics: [], tags: ["error_fallback"], places: [] } };
      });
      
      return object;
    });

    // 4. Geocode Locations (Google Maps API)
    const geocodedPlaces = await step.run("geocode-locations", async () => {
       const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
       
       return await Promise.all((aiExtracted.places || []).map(async (p: any) => {
         if (!apiKey) {
           return { ...p, lat: null, lng: null, place_id: "no_api_key" };
         }
         
         try {
           const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'X-Goog-Api-Key': apiKey,
               'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id'
             },
             body: JSON.stringify({
               textQuery: p.name + ' Thailand',
               languageCode: 'th'
             })
           });
           const data = await res.json();
           
           if (data.places && data.places.length > 0) {
             const result = data.places[0];
             return {
               ...p,
               name: result.displayName?.text || p.name,
               lat: result.location?.latitude,
               lng: result.location?.longitude,
               formatted_address: result.formattedAddress,
               place_id: result.id
             };
           }
         } catch(e) {
           logError(id, "places", e);
         }
         
         // No more dummy coordinates. If it fails, it fails gracefully.
         return {
           ...p,
           lat: null,
           lng: null,
           place_id: "failed_geocoding"
         };
       }));
    });

    // 5+6. Embed and save in ONE step so the 768-float vector is never
    // persisted in Inngest step state (saves memory in the Inngest server).
    await step.run("embed-and-save", async () => {
      assertAiAvailable();
      const textToEmbed = `${item.original_title} ${transcript} ${(aiExtracted.topics || []).join(" ")} ${(aiExtracted.tags || []).join(" ")}`.slice(0, MAX_TEXT_CHARS);
      const { embedding: fullEmbedding } = await embed({
        model: google.textEmbeddingModel('gemini-embedding-2'),
        value: textToEmbed,
        maxRetries: 0,
      }).catch((err) => handleAiError(id, "embed", err));
      // The API returns 3072 dims but DB is VECTOR(768). Slicing is valid for Gemini embeddings.
      const embedding = fullEmbedding.slice(0, 768);

      const { error } = await supabaseAdmin
        .from("saved_items")
        .update({
          transcript: transcript,
          normalized_category: aiExtracted.topics?.[0] || item.normalized_category, // Keep first topic as main category for fallback
          tags: [...(aiExtracted.topics || []), ...(aiExtracted.tags || [])], // Merge topics directly into tags

          extracted_locations: geocodedPlaces,
          embedding: embedding,
          status: "completed",
        })
        .eq("id", id);
        
      if (error) {
        logError(id, "db-update", error);
        throw new Error(`Failed to update DB: ${error.message}`);
      }
    });

    return { success: true, id };
  }
);
