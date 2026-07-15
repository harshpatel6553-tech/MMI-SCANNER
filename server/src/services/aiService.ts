import { GoogleGenAI, Type, Schema } from '@google/genai';
import logger from '../utils/logger.js';

export interface AISentimentResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
}

class AIService {
  private ai: GoogleGenAI | null = null;
  public hasValidKey = false;

  constructor() {
    this.init();
  }

  private init() {
    const key = process.env.GEMINI_API_KEY;
    if (key && key.length > 10) {
      try {
        this.ai = new GoogleGenAI({ apiKey: key });
        this.hasValidKey = true;
        logger.info('🤖 AI Sentiment Engine Initialized.');
      } catch (e) {
        logger.error('Failed to initialize AI Engine', e);
      }
    } else {
      logger.warn('GEMINI_API_KEY is missing or invalid. AI Sentiment analysis will be disabled.');
    }
  }

  public async analyzeNewsBatch(headlines: string[]): Promise<AISentimentResult[]> {
    if (headlines.length === 0) return [];
    
    // Determine if we are using Groq or Gemini
    const groqKey = process.env.GROQ_API_KEY;
    const isUsingGroq = !!groqKey;

    if (!isUsingGroq && (!this.hasValidKey || !this.ai)) {
      return headlines.map(() => ({ sentiment: 'Neutral', affectedStocks: [] }));
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const prompt = `Analyze this list of financial news headlines from the Indian Stock Market. For each headline, determine if it is Bullish, Bearish, or Neutral for the market or specific companies, and extract affected Indian NSE stock symbols.
        
        CRITICAL RULES FOR SENTIMENT:
        - Fines, settlements, penalties, and paying out large sums of money MUST be classified as Bearish (even if it "resolves uncertainty").
        - Revenue growth, order wins, and positive earnings MUST be classified as Bullish.
        - Procedural updates without immediate financial impact MUST be classified as Neutral.
        
        You must return a JSON object with a single key "results" which is an array containing EXACTLY ${headlines.length} items, matching the order of the provided headlines. Each item must have "sentiment" (Bullish/Bearish/Neutral) and "affectedStocks" (array of strings).
        
        Headlines:
        ${headlines.map((h, i) => `[${i}] ${h}`).join('\n')}`;

        let results: AISentimentResult[] = [];

        if (isUsingGroq) {
          // Use Groq API (Llama 3)
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama3-8b-8192',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              response_format: { type: 'json_object' }
            })
          });

          if (!groqRes.ok) {
            throw new Error(`Groq API Error: ${groqRes.statusText}`);
          }

          const jsonResponse = await groqRes.json();
          const parsed = JSON.parse(jsonResponse.choices[0].message.content);
          results = parsed.results;

        } else {
          // Use Google Gemini API
          const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sentiment: { type: Type.STRING, enum: ['Bullish', 'Bearish', 'Neutral'] },
                    affectedStocks: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["sentiment", "affectedStocks"],
                }
              }
            }
          };

          const response = await this.ai!.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: responseSchema,
              temperature: 0.1,
            }
          });

          if (!response.text) {
            throw new Error("Empty response from Gemini AI");
          }

          const parsed = JSON.parse(response.text);
          results = parsed.results;
        }

        if (!results || results.length !== headlines.length) {
          throw new Error(`AI returned ${results?.length} results, expected ${headlines.length}`);
        }

        return results;

      } catch (err: any) {
        lastError = err;
        logger.warn(`AI Batch Analysis attempt ${attempt} failed: ${err.message}. Retrying...`);
        if (attempt < 3) {
          await new Promise(res => setTimeout(res, 2000));
        }
      }
    }
    
    logger.error(`AI Batch Analysis failed after 3 attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    return headlines.map(() => ({ sentiment: 'Neutral', affectedStocks: [] }));
  }
}

export const aiService = new AIService();
