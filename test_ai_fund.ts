import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

async function test_gemini() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const symbol = 'RELIANCE.NS';
    const prompt = `Find the latest fundamental data for the Indian stock ${symbol} (Reliance Industries).
We need:
1. P/E Ratio
2. EPS (Earnings Per Share)
3. Debt-to-Equity Ratio
4. Promoter Holding Percentage

Return ONLY a JSON object with these keys: peRatio, eps, debtToEquity, promoterHolding.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
            }
        });
        print(response.text);
    } catch(e) {
        console.error("Error:", e);
    }
}
test_gemini();
