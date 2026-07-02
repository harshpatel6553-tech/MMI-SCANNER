import { aiService } from './src/services/aiService.js';

async function test() {
  process.env.GEMINI_API_KEY = "AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A";
  // Re-initialize manually to pick up the injected key
  (aiService as any).init();
  
  console.log("hasValidKey:", aiService.hasValidKey);
  const headlines = [
    "FROM BLOOMBERG Government Speeds Up PSU Stake Sales; Invites Fresh Bids from Existing IDBI Bank Suitors",
    "GMR AIRPORT: Q1 PASSENGER TRAFFIC REMAINED WEAK",
    "ITC Enters Functional Beverage Segment with Launch of No-Added-Sugar 'Coconut Cola'"
  ];
  
  try {
    const results = await aiService.analyzeNewsBatch(headlines);
    console.log(JSON.stringify(results, null, 2));
  } catch(e: any) {
    console.error("Test Error:", e);
  }
}

test();
