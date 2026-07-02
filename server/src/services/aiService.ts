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
    if (!this.hasValidKey || !this.ai) {
      return headlines.map(() => ({ sentiment: 'Neutral', affectedStocks: [] }));
    }

    if (headlines.length === 0) return [];

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const responseSchema: Schema = {
          type: Type.ARRAY,
          description: "An array of sentiment analysis results, mapping 1-to-1 to the provided headlines array.",
          items: {
            type: Type.OBJECT,
            properties: {
              sentiment: {
                type: Type.STRING,
                description: "The market sentiment of the headline: Bullish, Bearish, or Neutral",
                enum: ['Bullish', 'Bearish', 'Neutral']
              },
              affectedStocks: {
                type: Type.ARRAY,
                description: "Array of matching Indian NSE stock symbols affected by this news.",
                items: { type: Type.STRING }
              }
            },
            required: ["sentiment", "affectedStocks"],
          }
        };

        const prompt = `Analyze this list of financial news headlines from the Indian Stock Market. For each headline, determine if it is Bullish, Bearish, or Neutral for the market or specific companies, and extract affected Indian NSE stock symbols.
        
        CRITICAL RULES FOR SENTIMENT:
        - Fines, settlements, penalties, and paying out large sums of money MUST be classified as Bearish (even if it "resolves uncertainty").
        - Revenue growth, order wins, and positive earnings MUST be classified as Bullish.
        - Procedural updates without immediate financial impact MUST be classified as Neutral.
        
        You must return a JSON array containing EXACTLY ${headlines.length} items, matching the order of the provided headlines.
        
        Headlines:
        ${headlines.map((h, i) => `[${i}] ${h}`).join('\n')}`;

        const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.1, // Keep it deterministic
          }
        });

        if (!response.text) {
          throw new Error("Empty response from AI");
        }

        const results: AISentimentResult[] = JSON.parse(response.text);

        if (results.length !== headlines.length) {
          throw new Error(`AI returned ${results.length} results, expected ${headlines.length}`);
        }

        return results;

      } catch (err: any) {
        lastError = err;
        logger.warn(`AI Batch Analysis attempt ${attempt} failed: ${err.message}. Retrying...`);
        if (attempt < 3) {
          // Wait 2 seconds before retrying
          await new Promise(res => setTimeout(res, 2000));
        }
      }
    }
    
    logger.error(`AI Batch Analysis failed after 3 attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    // Fallback after all retries fail
    return headlines.map(() => ({ sentiment: 'Neutral', affectedStocks: [] }));
  }
}

export const aiService = new AIService();
