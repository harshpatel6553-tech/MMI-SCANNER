import logger from '../utils/logger.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';

export interface AISentimentResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
}

class AIService {
  public get hasValidKey(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  }

  public async analyzeNewsBatch(headlines: string[]): Promise<AISentimentResult[]> {
    if (headlines.length === 0) return [];
    
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return this.analyzeLocally(headlines);
    }

    try {
      const prompt = `Analyze this list of financial news headlines from the Indian Stock Market. For each headline, determine if it is Bullish, Bearish, or Neutral for the market or specific companies, and extract affected Indian NSE stock symbols.
      
      CRITICAL RULES FOR SENTIMENT:
      - Fines, settlements, penalties, and paying out large sums of money MUST be classified as Bearish (even if it "resolves uncertainty").
      - Revenue growth, order wins, and positive earnings MUST be classified as Bullish.
      - Procedural updates without immediate financial impact MUST be classified as Neutral.
      
      You must return a JSON object with a single key "results" which is an array containing EXACTLY ${headlines.length} items, matching the order of the provided headlines. Each item must have "sentiment" (Bullish/Bearish/Neutral) and "affectedStocks" (array of strings).
      
      Headlines:
      ${headlines.map((h, i) => `[${i}] ${h}`).join('\n')}`;

      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mmi-scanner.render.com', // Required by OpenRouter
          'X-Title': 'MMI Scanner'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (!orRes.ok) {
        throw new Error(`OpenRouter HTTP ${orRes.status}: ${await orRes.text()}`);
      }

      const jsonResponse = await orRes.json();
      const parsed = JSON.parse(jsonResponse.choices[0].message.content);
      let results = parsed.results;

      if (!results || !Array.isArray(results)) {
        throw new Error('AI did not return a valid results array');
      }

      // Ensure length matches exactly
      if (results.length > headlines.length) {
        results = results.slice(0, headlines.length);
      } else if (results.length < headlines.length) {
        while (results.length < headlines.length) {
          results.push({ sentiment: 'Neutral', affectedStocks: [] });
        }
      }

      return results;

    } catch (err: any) {
      logger.warn(`OpenRouter AI Analysis failed: ${err.message}. Falling back to local heuristic.`);
      return this.analyzeLocally(headlines);
    }
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
      
      NIFTY_500_STOCKS.forEach((s: any) => {
        const sym = s.symbol.toLowerCase();
        if (lower.includes(`$${sym}`) || lower.includes(` ${sym} `) || lower.startsWith(`${sym}:`) || lower.startsWith(`${sym} `)) {
          affectedStocks.add(s.symbol);
        } else {
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
