import { aiService } from './src/services/aiService.js';
import 'dotenv/config';

process.env.GEMINI_API_KEY = "AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A";

async function test() {
  (aiService as any).init();
  const headlines = [
    "GOVT INVITES FRESH BIDS FROM EXISTING BIDDERS FOR IDBI BANK, AS PER SOURCES. NDTV"
  ];
  try {
    const results = await aiService.analyzeNewsBatch(headlines);
    console.log(JSON.stringify(results, null, 2));
  } catch(e: any) {
    console.error("Test Error:", e.message);
  }
}
test();
