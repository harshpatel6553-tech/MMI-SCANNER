import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function test() {
  const ai = new GoogleGenAI({ apiKey: "AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A" });
  try {
    const models = await ai.models.list();
    for await (const model of models) {
      console.log(model.name);
    }
  } catch(e: any) {
    console.error(e.message);
  }
}
test();
