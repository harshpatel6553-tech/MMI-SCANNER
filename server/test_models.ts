import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A" });
    const response = await ai.models.list();
    for await (const model of response) {
      if (model.name.includes("1.5")) {
         console.log(model.name);
      }
    }
  } catch(e: any) {
    console.error("Test Error:", e.message);
  }
}
test();
