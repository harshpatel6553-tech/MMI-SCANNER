require('dotenv').config({path: 'server/.env'});
const key = process.env.GROQ_API_KEY;
fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: 'Say hello in valid JSON format: {"msg": "hello"}' }],
    response_format: { type: 'json_object' }
  })
}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d, null, 2))).catch(console.error);
