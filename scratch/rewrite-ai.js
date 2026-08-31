
const fs = require('fs');

const code = \import logger from '../utils/logger.js';
import { configService } from './configService.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';

export interface AISentimentResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
}

class AIService {
  public async analyzeNewsBatch(headlines: string[]): Promise<AISentimentResult[]> {
    if (headlines.length === 0) return [];
    
    // Fall back to robust local heuristic analyzer to avoid API rate limits and model deprecation errors.
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
        if (lower.includes(\\\$\\\\\\) || lower.includes(\\\ \\\ \\\) || lower.startsWith(\\\\\\:\\\) || lower.startsWith(\\\\\\ \\\)) {
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
\;

fs.writeFileSync('server/src/services/aiService.ts', code);

