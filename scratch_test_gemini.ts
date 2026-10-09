import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  try {
    console.log("Testing gemini-1.5-flash...");
    const res1 = await generateObject({
      model: google("gemini-1.5-flash"),
      prompt: "Hello",
      schema: z.object({ msg: z.string() })
    });
    console.log("gemini-1.5-flash success:", res1.object);
  } catch (e: any) {
    console.error("gemini-1.5-flash error:", e.statusCode || e.status || e.code, e.message);
  }

  try {
    console.log("Testing gemini-3.8-flash...");
    const res2 = await generateObject({
      model: google("gemini-3.8-flash"),
      prompt: "Hello",
      schema: z.object({ msg: z.string() })
    });
    console.log("gemini-3.8-flash success:", res2.object);
  } catch (e: any) {
    console.error("gemini-3.8-flash error:", e.statusCode || e.status || e.code, e.message);
  }

  try {
    console.log("Testing gemini-embedding-2...");
    const { embed } = await import("ai");
    const { embedding } = await embed({
      model: google.textEmbeddingModel('gemini-embedding-2'),
      value: "Hello",
    });
    console.log("gemini-embedding-2 success (length):", embedding.length);
  } catch (e: any) {
    console.error("gemini-embedding-2 error:", e.statusCode || e.status || e.code, e.message);
  }
}
main();
