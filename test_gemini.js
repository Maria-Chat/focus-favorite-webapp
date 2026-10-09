const { generateObject } = require('ai');
const { google } = require('@ai-sdk/google');
const { z } = require('zod');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});

process.env.GOOGLE_GENERATIVE_AI_API_KEY = envVars['GOOGLE_GENERATIVE_AI_API_KEY'];

async function testGemini() {
  const prompt = `
    Analyze the following content (Title + Caption/Transcript):
    "#ล่ามิชลินกินของอร่อย โคราช2026 EP.6 ร้านก๋วยเตี๋ยวเรือโกเกี้ย #tiktokพากิน #MICHELIN - #ล่ามิชลินกินของอร่อย โคราช2026 EP.6 ร้านก๋วยเตี๋ยวเรือโกเกี้ย #tiktokพากิน #MICHELIN #MICHELINguide #โคราช #ก๋วยเตี๋ยวเรือ | Reels • ล่ามิชลิน กินของอร่อย \nPage Title: Facebook \nPage Desc: &#xe40;&#xe1e;&#xe23;&#xe32;"
    
    Extract the following information:
    - Category: A general category (e.g., Food & Cafe, Travel, Tech & Knowledge, General)
    - Tags: 3-5 relevant tags
    - Places: A list of specific places mentioned (with name and type like restaurant/cafe/attraction)
  `;
  
  const { object } = await generateObject({
    model: google("gemini-3.8-flash"),
    prompt,
    schema: z.object({
      category: z.string(),
      tags: z.array(z.string()),
      places: z.array(z.object({
        name: z.string(),
        type: z.string()
      }))
    })
  });
  
  console.log(JSON.stringify(object, null, 2));
}
testGemini();
