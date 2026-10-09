const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${envVars['GOOGLE_GENERATIVE_AI_API_KEY']}`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
listModels();
