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
      
      You must return a JSON array containing EXACTLY ${headlines.length} items, matching the order of the provided headlines.
      
      Headlines:
      ${headlines.map((h, i) => `[${i}] ${h}`).join('\n')}`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
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

    } catch (err) {
      logger.error(`AI Batch Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
      // Fallback
      return headlines.map(() => ({ sentiment: 'Neutral', affectedStocks: [] }));
    }
  }
}

export const aiService = new AIService();
