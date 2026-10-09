const { embed } = require('ai');
const { google } = require('@ai-sdk/google');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});

process.env.GOOGLE_GENERATIVE_AI_API_KEY = envVars['GOOGLE_GENERATIVE_AI_API_KEY'];

async function testEmbed() {
  try {
     const { embedding } = await embed({
       model: google.textEmbeddingModel('gemini-embedding-001'),
       value: 'test string',
     });
     console.log('Embedding length:', embedding.length);
  } catch(e) {
     console.error(e);
  }
}
testEmbed();
