import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

async function main() {
  try {
    console.log("Testing gemini-flash-lite-latest...");
    const res2 = await generateObject({
      model: google("gemini-flash-lite-latest"),
      prompt: "Hello",
      schema: z.object({ msg: z.string() })
    });
    console.log("gemini-flash-lite-latest success:", res2.object);
  } catch (e) {
    console.error("gemini-flash-lite-latest error:", e.statusCode || e.status || e.code, e.message);
  }
}
main();
