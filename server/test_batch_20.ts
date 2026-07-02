import { aiService } from './src/services/aiService.js';

async function test() {
  process.env.GEMINI_API_KEY = "AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A";
  (aiService as any).init();
  
  const headlines = Array(20).fill("Headline number one test.");
  
  try {
    const results = await aiService.analyzeNewsBatch(headlines);
    console.log(`Sent 20, Received: ${results.length}`);
  } catch(e: any) {
    console.error("Test Error:", e.message);
  }
}

test();
