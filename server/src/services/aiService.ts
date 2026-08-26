import { GoogleGenAI, Type, Schema } from '@google/genai';
import logger from '../utils/logger.js';
import { configService } from './configService.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';

export interface AISentimentResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
}

class AIService {
  public get hasValidKey(): boolean {
    const key = configService.getKey('GEMINI_API_KEY');
    return !!(key && key.length > 10);
  }

  private get ai(): GoogleGenAI | null {
    const key = configService.getKey('GEMINI_API_KEY');
    if (key && key.length > 10) {
      return new GoogleGenAI({ apiKey: key });
    }
    return null;
  }

  public async analyzeNewsBatch(headlines: string[]): Promise<AISentimentResult[]> {
    if (headlines.length === 0) return [];
    
    // Determine which AI provider to use
    const omnirouteUrl = process.env.OMNIROUTE_URL || 'http://localhost:20128';
    const useOmniroute = process.env.USE_OMNIROUTE === 'true';
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    
    const isUsingOpenRouter = !!openRouterKey;
    const isUsingGroq = !!groqKey;

    if (!useOmniroute && !isUsingOpenRouter && !isUsingGroq && (!this.hasValidKey || !this.ai)) {
      return this.analyzeLocally(headlines);
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
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

        if (useOmniroute) {
          const omniRes = await fetch(`${omnirouteUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant', // or any model configured in your omniroute
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              response_format: { type: 'json_object' }
            })
          });

          if (!omniRes.ok) {
            const errBody = await omniRes.text();
            logger.warn(`Omniroute Error: ${omniRes.status} - ${errBody}. Falling back...`);
          } else {
            const jsonResponse = await omniRes.json();
            const parsed = JSON.parse(jsonResponse.choices[0].message.content);
            results = parsed.results;
          }
        }

        if (results.length === 0 && isUsingOpenRouter) {
          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://mmi-scanner.render.com', // Required by OpenRouter
              'X-Title': 'MMI Scanner'
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-3.1-8b-instruct', // Cheap, fast, reliable JSON model on OpenRouter
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              response_format: { type: 'json_object' }
            })
          });

          if (!orRes.ok) {
            const errBody = await orRes.text();
            logger.warn(`OpenRouter API Error: ${orRes.status} - ${errBody}. Falling back...`);
          } else {
            const jsonResponse = await orRes.json();
            const parsed = JSON.parse(jsonResponse.choices[0].message.content);
            results = parsed.results;
          }
        }

        if (results.length === 0 && isUsingGroq) {
          // Use Groq API (llama-3.1-8b-instant)
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              response_format: { type: 'json_object' }
            })
          });

          if (!groqRes.ok) {
            const errBody = await groqRes.text();
            logger.warn(`Groq API Error: ${groqRes.status} - ${errBody}. Falling back to Gemini if available...`);
            if (!this.hasValidKey) throw new Error(`Groq failed and no Gemini fallback available.`);
          } else {
            const jsonResponse = await groqRes.json();
            const parsed = JSON.parse(jsonResponse.choices[0].message.content);
            results = parsed.results;
          }
        }

        if (results.length === 0 && this.hasValidKey) {
          const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sentiment: { type: Type.STRING },
                    affectedStocks: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
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

        if (!results || !Array.isArray(results)) {
          throw new Error('AI did not return a valid results array');
        }

        if (results.length > headlines.length) {
          results = results.slice(0, headlines.length);
        } else if (results.length < headlines.length) {
          while (results.length < headlines.length) {
            results.push({ sentiment: 'Neutral', affectedStocks: [] });
          }
        }

        return results;

      } catch (err: any) {
        lastError = err;
        logger.warn(`AI Batch Analysis attempt ${attempt} failed: ${err.message}. Retrying...`);
        if (attempt < 2) {
          await new Promise(res => setTimeout(res, 2000));
        }
      }
    }
    
    logger.error(`AI Batch Analysis failed after retries. Falling back to robust local heuristic analyzer...`);
    return this.analyzeLocally(headlines);
  }

  private analyzeLocally(headlines: string[]): AISentimentResult[] {
    const BULLISH = ['wins', 'order', 'profit', 'surges', 'jumps', 'up', 'higher', 'growth', 'positive', 'buy', 'target', 'upgrade', 'approval', 'acquires', 'expansion', 'soars'];
    const BEARISH = ['loss', 'drops', 'falls', 'down', 'lower', 'negative', 'sell', 'downgrade', 'penalty', 'fine', 'scam', 'fraud', 'cancels', 'scraps', 'plunges', 'slumps'];
    
    return headlines.map(h => {
      const lower = h.toLowerCase();
      let bullScore = 0;
      let bearScore = 0;
      
      BULLISH.forEach(w => { if (lower.includes(w)) bullScore++; });
      BEARISH.forEach(w => { if (lower.includes(w)) bearScore++; });
      
      let sentiment: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
      if (bullScore > bearScore) sentiment = 'Bullish';
      else if (bearScore > bullScore) sentiment = 'Bearish';
      
      const affectedStocks = new Set<string>();
      
      // Extract stocks by scanning for known symbols or names
      NIFTY_500_STOCKS.forEach((s: any) => {
        // Fast symbol check
        const sym = s.symbol.toLowerCase();
        if (lower.includes(`$${sym}`) || lower.includes(` ${sym} `) || lower.startsWith(`${sym}:`) || lower.startsWith(`${sym} `)) {
          affectedStocks.add(s.symbol);
        } else {
          // Check by name (first word usually enough for distinct companies)
          const nameParts = s.name.toLowerCase().split(' ');
          if (nameParts[0] && nameParts[0].length > 3 && lower.includes(nameParts[0])) {
            affectedStocks.add(s.symbol);
          }
        }
      });
      
      return { sentiment, affectedStocks: Array.from(affectedStocks) };
    });
  }
}

export const aiService = new AIService();

