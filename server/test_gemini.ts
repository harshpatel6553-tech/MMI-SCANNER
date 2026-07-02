import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

async function testGemini() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'say hi',
        });
        console.log("Is response.text a string?", typeof response.text);
        console.log("Is response.text a function?", typeof response.text === 'function');
    } catch(e) {
        console.error(e);
    }
}
testGemini();
