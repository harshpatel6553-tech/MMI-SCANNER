import { GoogleGenAI, Type, Schema } from '@google/genai';
import logger from '../utils/logger.js';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface NewsSentiment {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
}

class AIService {
  private hasValidKey: boolean;

  constructor() {
    this.hasValidKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10;
    if (!this.hasValidKey) {
      logger.warn('GEMINI_API_KEY is missing or invalid. AI Sentiment analysis will be disabled.');
    } else {
      logger.info('🤖 AI Sentiment Engine Initialized.');
    }
  }

  /**
   * Analyzes a news headline to determine sentiment and extract affected NSE stock symbols.
   * Returns a fallback if the API fails or is not configured.
   */
  async analyzeNews(headline: string): Promise<NewsSentiment> {
    const fallback: NewsSentiment = { sentiment: 'Neutral', affectedStocks: [] };

    if (!this.hasValidKey) return fallback;

    try {
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
            description: "Array of exactly matching Indian NSE stock symbols affected by this news (e.g. ['RELIANCE', 'TCS']). Max 3 symbols. If none, return empty array.",
            items: {
              type: Type.STRING
            }
          }
        },
        required: ["sentiment", "affectedStocks"],
      };

      const prompt = `Analyze this financial news headline from the Indian Stock Market and determine if it is Bullish, Bearish, or Neutral for the market or specific companies. Extract any affected Indian NSE stock symbols.\nHeadline: "${headline}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1, // Keep it deterministic
        }
      });

      if (response.text) {
        const result = JSON.parse(response.text) as NewsSentiment;
        // Ensure affectedStocks is an array of strings
        if (!Array.isArray(result.affectedStocks)) {
          result.affectedStocks = [];
        }
        // Basic cleanup of symbols (uppercase, max length)
        result.affectedStocks = result.affectedStocks
          .filter(s => typeof s === 'string' && s.length > 0 && s.length <= 15)
          .map(s => s.toUpperCase().trim())
          .slice(0, 3); // Max 3 stocks to prevent UI clutter

        return result;
      }
      return fallback;
    } catch (err) {
      logger.error(`AI Analysis failed for headline "${headline}": ${err instanceof Error ? err.message : String(err)}`);
      return fallback;
    }
  }
}

export const aiService = new AIService();
