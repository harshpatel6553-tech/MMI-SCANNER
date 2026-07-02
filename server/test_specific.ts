import { aiService } from './src/services/aiService.js';
import 'dotenv/config';

process.env.GEMINI_API_KEY = "AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A";

async function test() {
  (aiService as any).init();
  
  const single = [
    "PACE DIGITEK: 55% OF FUTURE REVENUE TO COME FROM BATTERY ENERGY STORAGE SYSTEMS (BESS)"
  ];
  const batch = Array(19).fill("Random news about weather").concat(single);
  
  try {
    const singleResult = await aiService.analyzeNewsBatch(single);
    console.log("Single Result:", singleResult[0].sentiment);
    
    const batchResult = await aiService.analyzeNewsBatch(batch);
    console.log("Batch Result (last item):", batchResult[19]?.sentiment);
    console.log("Batch Result length:", batchResult.length);
  } catch(e: any) {
    console.error("Test Error:", e.message);
  }
}
test();
