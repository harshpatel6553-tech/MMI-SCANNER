import { GoogleGenAI, Type, Schema } from '@google/genai';

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: 'AIzaSyAhom85UMbu__nF_SL7lUs_Mbri9FJsV6A' });
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        sentiment: {
          type: Type.STRING,
          description: "The market sentiment of the news: Bullish, Bearish, or Neutral",
          enum: ['Bullish', 'Bearish', 'Neutral']
        },
        affectedStocks: {
          type: Type.ARRAY,
          description: "Array of exactly matching Indian NSE stock symbols affected by this news.",
          items: {
            type: Type.STRING
          }
        }
      },
      required: ["sentiment", "affectedStocks"],
    };

    const prompt = `Analyze this financial news headline from the Indian Stock Market and determine if it is Bullish, Bearish, or Neutral for the market or specific companies. Extract any affected Indian NSE stock symbols.\nHeadline: "ITC Enters Functional Beverage Segment with Launch of No-Added-Sugar 'Coconut Cola'"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      }
    });

    console.log("Success:", response.text);
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}

test();
