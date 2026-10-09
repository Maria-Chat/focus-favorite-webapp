import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { embed } from "ai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const text = "A".repeat(8000); // 8000 characters

async function main() {
  console.log("Checking token usage for 8000 chars...");
  
  // Actually we can't easily get token count without generating, but we can do a dummy generate
  // and log the usage.
  try {
    const res = await generateObject({
      model: google("gemini-3.8-flash"),
      prompt: "Extract info from: " + text,
      schema: z.object({ msg: z.string() })
    });
    console.log("gemini-3.8-flash usage:", res.usage);
  } catch(e) {
    console.error("error:", e.message);
  }
}
main();
