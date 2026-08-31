import logger from '../utils/logger.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';

export interface AISentimentResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
}

class AIService {
  public get hasValidKey(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  public async analyzeNewsBatch(headlines: string[]): Promise<AISentimentResult[]> {
    if (headlines.length === 0) return [];
    
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      logger.warn('No GEMINI_API_KEY found, falling back to local heuristic');
      return this.analyzeLocally(headlines);
    }

    try {
      const promptText = `Analyze this list of financial news headlines from the Indian Stock Market. You must aggressively classify headlines as Bullish or Bearish if they contain ANY positive or negative indicators. Do NOT default to Neutral unless it is a purely informational, non-impactful update.
      
      CRITICAL SENTIMENT RULES:
      1. BEARISH: Fines, settlements, penalties, paying out money, losing court cases, downgrades, resignations, scams, lower production, loss, drops, fallen, declined, falling, negative outlooks.
      2. BULLISH: Revenue growth, order wins, positive earnings, upgrades, higher production, solid growth, sustained demand, approvals, acquisitions, surging prices, up, higher, or any positive forward-looking statements.
      3. NEUTRAL: ONLY use this for mundane procedural updates with zero financial or directional impact.
      
      You must return a JSON object with a single key "results" which is an array containing EXACTLY ${headlines.length} items, matching the order of the provided headlines. Each item must have "sentiment" (Bullish/Bearish/Neutral) and "affectedStocks" (array of strings, extract ticker symbols or company names).
      
      Headlines:
      ${headlines.map((h, i) => `[${i}] ${h}`).join('\n')}`;

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey.trim() });
      
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });
      
      const textContent = response.text || '';
      
      const parsed = JSON.parse(textContent);
      let results = parsed?.results;

      if (!results || !Array.isArray(results)) {
        throw new Error('Gemini did not return a valid results array');
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
      logger.warn('Gemini AI Analysis failed: ' + err.message + '. Falling back to local heuristic.');
      return this.analyzeLocally(headlines);
    }
  }

  private analyzeLocally(headlines: string[]): AISentimentResult[] {
    const BULLISH = ['wins', 'order', 'profit', 'surges', 'jumps', 'up', 'higher', 'growth', 'positive', 'buy', 'target', 'upgrade', 'approval', 'acquires', 'expansion', 'soars'];
    const BEARISH = ['loss', 'drops', 'falls', 'fallen', 'declined', 'declining', 'down', 'lower', 'negative', 'sell', 'downgrade', 'penalty', 'fine', 'scam', 'fraud', 'cancels', 'scraps', 'plunges', 'slumps'];
    
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
        if (lower.includes('$' + sym) || lower.includes(' ' + sym + ' ') || lower.startsWith(sym + ':') || lower.startsWith(sym + ' ')) {
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
