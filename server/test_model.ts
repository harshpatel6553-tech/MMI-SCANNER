import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A" });
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'Hello',
    });
    console.log("Success gemini-1.5-flash:", response.text);
  } catch (e: any) {
    console.error("Error gemini-1.5-flash:", e.message);
  }
}
test();
