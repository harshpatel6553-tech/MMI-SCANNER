import { aiService } from './src/services/aiService.js';
import 'dotenv/config';
process.env.GEMINI_API_KEY = "AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A";

async function test() {
  const headlines = Array(20).fill("Test headline for rate limit check.");
  try {
    (aiService as any).init();
    // Temporarily hijack the generateContent call to use the lite model
    const originalGenerate = (aiService as any).ai.models.generateContent;
    (aiService as any).ai.models.generateContent = async function(args: any) {
      args.model = 'gemini-2.5-flash-lite';
      return originalGenerate.call(this, args);
    };
    
    const results = await aiService.analyzeNewsBatch(headlines);
    console.log(`Success! length: ${results.length}, first sentiment: ${results[0]?.sentiment}`);
  } catch(e: any) {
    console.error("Test Error:", e.message);
  }
}
test();
