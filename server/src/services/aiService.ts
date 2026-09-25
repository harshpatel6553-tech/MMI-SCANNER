import logger from '../utils/logger.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';

export interface AISentimentResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
  reasoning?: string;
  perspective?: 'Company' | 'IndiaMacro' | 'General';
  confidence?: number;
}

class AIService {
  public get hasValidKey(): boolean {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  /**
   * Universal prompt applying:
   * 1. Company Financial Perspective (Micro level)
   * 2. Global-to-India Macro Lens (Macro level)
   */
  private buildUniversalPrompt(headlines: string[]): string {
    return `You are the chief quantitative financial news analyst for Market Minds India (MMI), classifying market-moving news impacting the Indian Stock Market (NSE / BSE).

=== UNIVERSAL DIRECTIVES ===

1. COMPANY FINANCIAL PERSPECTIVE (Micro Level):
- Analyze news primarily from the perspective of the affected company's balance sheet, operational revenue, order pipeline, and cash flows.
- BULLISH: Order wins, earnings beats, capacity expansion, debt reduction, cost efficiencies, favorable litigation/regulatory approvals, or positive forward guidance.
- BEARISH: Fines, penalties, investigations, plant shutdowns, client losses, executive resignations, accounting discrepancies, downgrades, or margin contraction.
- NEUTRAL: Routine procedural announcements with zero financial or directional enterprise value impact.

2. GLOBAL-TO-INDIA MACRO LENS (Macro Level):
- For global news and macroeconomic developments (e.g., US Federal Reserve, global central banks, crude oil, commodity cycles, geopolitics, forex/USDINR), STRICTLY evaluate through the lens of Indian markets (Dalal Street) and Indian equities.
- Examples: 
  * Crude oil price drops -> BULLISH for Indian Oil Marketing Companies (IOC, BPCL), paints (ASIANPAINT, BERGEPAINT), tyres, and overall Indian fiscal deficit.
  * Rising US treasury yields / hawkish Fed -> BEARISH for Indian IT exporters and foreign institutional investment (FII) flows.
  * China economic stimulus/slowdown -> evaluate direct export/import substitution impact on Indian chemicals, steel, and textiles.

3. SENSITIVITY:
- Aggressively flag any tangible positive or negative catalysts. Only use Neutral when there is genuinely zero financial or directional impact.

=== REQUIRED OUTPUT FORMAT ===
You must return a valid JSON object with a single key "results" containing an array of EXACTLY ${headlines.length} items, matching the order of headlines.
Each item must have:
- "sentiment": "Bullish" | "Bearish" | "Neutral"
- "affectedStocks": array of Indian NSE stock symbols or key company names (e.g. ["RELIANCE", "TCS", "INFY", "BPCL", "TATAMOTORS"])
- "reasoning": a crisp 1-sentence explanation strictly from the company's financial perspective or Indian market macro lens
- "perspective": "Company" (if company-specific) or "IndiaMacro" (if global/macro event) or "General"
- "confidence": confidence rating between 0 and 100

Headlines:
${headlines.map((h, i) => `[${i}] ${h}`).join('\n')}`;
  }

  /**
   * Universal batch analysis using the GEMINI_API_KEY from environment.
   */
  public async analyzeNewsBatch(headlines: string[]): Promise<AISentimentResult[]> {
    if (headlines.length === 0) return [];

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      logger.warn('No GEMINI_API_KEY provided in .env, falling back to local heuristic analysis.');
      return this.analyzeLocally(headlines);
    }

    try {
      const promptText = this.buildUniversalPrompt(headlines);
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      let response;
      const primaryModel = process.env.AI_SENTIMENT_MODEL?.trim() || 'gemini-3.5-flash';

      try {
        response = await ai.models.generateContent({
          model: primaryModel,
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });
      } catch (primaryErr: any) {
        if (primaryModel !== 'gemini-3.5-flash') {
          logger.warn(`Primary model ${primaryModel} failed (${primaryErr.message}). Retrying with gemini-3.5-flash.`);
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: promptText,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });
        } else {
          throw primaryErr;
        }
      }

      const textContent = response.text || '';
      const parsed = JSON.parse(textContent);
      let results: AISentimentResult[] = parsed?.results;

      if (!results || !Array.isArray(results)) {
        throw new Error('Gemini did not return a valid results array');
      }

      // Ensure length matches headlines
      if (results.length > headlines.length) {
        results = results.slice(0, headlines.length);
      } else if (results.length < headlines.length) {
        while (results.length < headlines.length) {
          results.push({
            sentiment: 'Neutral',
            affectedStocks: [],
            reasoning: 'Neutral sentiment based on available market context.',
            perspective: 'General',
            confidence: 50,
          });
        }
      }

      return results;
    } catch (err: any) {
      logger.warn(`Gemini AI analysis failed: ${err.message}. Falling back to local heuristic.`);
      return this.analyzeLocally(headlines);
    }
  }

  /**
   * Fast rule-based heuristic fallback if API quota is reached or network is unavailable.
   */
  private analyzeLocally(headlines: string[]): AISentimentResult[] {
    const BULLISH_COMPANY = ['order win', 'wins order', 'profit jumps', 'profit up', 'revenue growth', 'capacity expansion', 'debt free', 'acquires', 'acquisition', 'secures contract', 'usfda approval', 'favorable order', 'beats estimates', 'dividend', 'buyback', 'soars', 'surges'];
    const BEARISH_COMPANY = ['loss widens', 'profit drops', 'net loss', 'penalty', 'fine', 'cbi raid', 'sebi probe', 'accounting fraud', 'resignation of auditor', 'defaults on debt', 'downgrade', 'plant shutdown', 'usfda warning letter', 'plunges', 'slumps'];

    const BULLISH_INDIA_MACRO = ['crude falls', 'crude drops', 'oil plunges', 'fii buying', 'rate cut', 'inflation cools', 'gst collections jump', 'monsoon normal', 'us fed pauses', 'fed cuts rate'];
    const BEARISH_INDIA_MACRO = ['crude surges', 'oil jumps', 'brent climbs', 'fii selling', 'rate hike', 'fed hikes', 'rupee slumps', 'inflation spikes', 'middle east escalation', 'trade tariffs'];

    return headlines.map(h => {
      const lower = h.toLowerCase();
      let bullScore = 0;
      let bearScore = 0;
      let perspective: 'Company' | 'IndiaMacro' | 'General' = 'Company';
      const matchedKeywords: string[] = [];

      BULLISH_COMPANY.forEach(w => {
        if (lower.includes(w)) {
          bullScore += 2;
          matchedKeywords.push(`+${w}`);
        }
      });

      BEARISH_COMPANY.forEach(w => {
        if (lower.includes(w)) {
          bearScore += 2;
          matchedKeywords.push(`-${w}`);
        }
      });

      BULLISH_INDIA_MACRO.forEach(w => {
        if (lower.includes(w)) {
          bullScore += 2;
          perspective = 'IndiaMacro';
          matchedKeywords.push(`[India Macro] +${w}`);
        }
      });

      BEARISH_INDIA_MACRO.forEach(w => {
        if (lower.includes(w)) {
          bearScore += 2;
          perspective = 'IndiaMacro';
          matchedKeywords.push(`[India Macro] -${w}`);
        }
      });

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

      const reasoning = matchedKeywords.length > 0
        ? `Categorized as ${sentiment} based on catalysts: ${matchedKeywords.join(', ')}`
        : 'Classified based on contextual directional impact.';

      return {
        sentiment,
        affectedStocks: Array.from(affectedStocks),
        reasoning,
        perspective,
        confidence: sentiment === 'Neutral' ? 50 : 75,
      };
    });
  }
}

export const aiService = new AIService();
