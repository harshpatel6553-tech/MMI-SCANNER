import logger from '../utils/logger.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';
import { configService } from './configService.js';

export interface AISentimentResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
  reasoning?: string;
  perspective?: 'Company' | 'IndiaMacro' | 'General';
  confidence?: number;
}

const COMMON_DICTIONARY_SYMBOLS = new Set([
  'ALL', 'AND', 'ARE', 'CAN', 'FOR', 'GET', 'GO', 'HAS', 'HAD', 'KEY', 'NEW',
  'NOW', 'NOT', 'ONE', 'OUT', 'RAW', 'RUN', 'SEE', 'SET', 'TOP', 'TRY', 'TWO',
  'USE', 'WAY', 'WIN', 'OIL', 'IT', 'AT', 'ON', 'BE', 'SO', 'DO', 'IF', 'OR',
  'IS', 'AM', 'BY', 'UP', 'TO', 'NO', 'AN', 'AS', 'HE', 'WE', 'MY', 'US', 'IN'
]);

const LOCAL_ALIAS_MAP = [
  { re: /\b(PVR\s*INOX|PVR)\b/i, sym: 'PVRINOX' },
  { re: /\b(BAJAJ\s*ELECTRIC(?:ALS)?|BAJAJELEC)\b/i, sym: 'BAJAJELEC' },
  { re: /\b(UNITED\s*BREWERIES)\b/i, sym: 'UBL' },
  { re: /\b(UNITED\s*SPIRITS|MCDOWELL)\b/i, sym: 'UNITDSPR' },
  { re: /\b(KPIT\s*TECH(?:NOLOGIES)?)\b/i, sym: 'KPITTECH' },
  { re: /\b(CRAFTSMAN\s*(?:AUTOMATION)?)\b/i, sym: 'CRAFTSMAN' },
  { re: /\b(20\s*MICRONS|20MICRONS)\b/i, sym: '20MICRONS' },
  { re: /\b(VAKRANGEE)\b/i, sym: 'VAKRANGEE' },
  { re: /\b(WAAREE\s*(?:ENERGIES)?)\b/i, sym: 'WAAREEENER' },
  { re: /\b(BHARTI\s*AIRTEL|AIRTEL)\b/i, sym: 'BHARTIARTL' },
  { re: /\b(TATA\s*MOTORS)\b/i, sym: 'TATAMOTORS' },
  { re: /\b(TATA\s*STEEL)\b/i, sym: 'TATASTEEL' },
  { re: /\b(TATA\s*POWER)\b/i, sym: 'TATAPOWER' },
  { re: /\b(HDFC\s*BANK)\b/i, sym: 'HDFCBANK' },
  { re: /\b(ICICI\s*BANK)\b/i, sym: 'ICICIBANK' },
  { re: /\b(KOTAK\s*BANK)\b/i, sym: 'KOTAKBANK' },
  { re: /\b(AXIS\s*BANK)\b/i, sym: 'AXISBANK' },
  { re: /\b(STATE\s*BANK\s*OF\s*INDIA|SBI)\b/i, sym: 'SBIN' },
  { re: /\b(ASIAN\s*PAINTS?)\b/i, sym: 'ASIANPAINT' },
  { re: /\b(SUN\s*PHARMA)\b/i, sym: 'SUNPHARMA' },
  { re: /\b(MARUTI\s*SUZUKI)\b/i, sym: 'MARUTI' },
  { re: /\b(RELIANCE\s*(?:IND|INDUSTRIES)?|RIL)\b/i, sym: 'RELIANCE' },
  { re: /\b(LARSEN\s*(&|AND)?\s*TOUBRO|L&T)\b/i, sym: 'LT' },
];

class AIService {
  public get hasValidKey(): boolean {
    return Boolean(process.env.GEMINI_API_KEY?.trim() || configService.getKey('GEMINI_API_KEY')?.trim());
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

    const geminiKey = process.env.GEMINI_API_KEY?.trim() || configService.getKey('GEMINI_API_KEY')?.trim();
    if (!geminiKey) {
      logger.warn('No GEMINI_API_KEY provided in .env or settings, falling back to local heuristic analysis.');
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

      // 1. Prefix ticker before colon (e.g. "CRAFTSMAN: Q2...", "BAJAJELEC: Q2...", "20MICRONS: Q2...")
      const prefixMatch = h.match(/^([A-Za-z0-9_\-\.]{2,15}):/i);
      if (prefixMatch) {
        const p = prefixMatch[1].toUpperCase();
        const STOP_TOKENS = new Set(['ALERT', 'BREAKING', 'UPDATE', 'NEWS', 'EXCLUSIVE', 'JUST IN', 'REPORT', 'SOURCE', 'WATCH', 'MARKET', 'NIFTY', 'SENSEX']);
        if (!STOP_TOKENS.has(p)) {
          affectedStocks.add(p);
        }
      }

      // 2. Explicit cashtags like $TECHM, $KPITTECH, $CRAFTSMAN
      const dollarMatches = h.match(/\$([A-Za-z][A-Za-z0-9_\-]{1,14})\b/g) || [];
      for (const m of dollarMatches) {
        const s = m.replace('$', '').toUpperCase();
        if (s.length >= 2 && s.length <= 15) {
          affectedStocks.add(s);
        }
      }

      // 3. Known Aliases
      for (const alias of LOCAL_ALIAS_MAP) {
        if (alias.re.test(h)) {
          affectedStocks.add(alias.sym);
        }
      }

      // 4. Exact symbol matches for unambiguous symbols (>3 chars and not common English words)
      for (const s of NIFTY_500_STOCKS) {
        const sym = s.symbol.toUpperCase();
        if (sym.length >= 3 && !COMMON_DICTIONARY_SYMBOLS.has(sym)) {
          if (new RegExp(`\\b${sym}\\b`).test(h)) {
            affectedStocks.add(sym);
          }
        }
      }

      const reasoning = matchedKeywords.length > 0
        ? `Categorized as ${sentiment} based on catalysts: ${matchedKeywords.join(', ')}`
        : 'Classified based on contextual directional impact.';

      return {
        sentiment,
        affectedStocks: Array.from(affectedStocks).slice(0, 4),
        reasoning,
        perspective,
        confidence: sentiment === 'Neutral' ? 50 : 75,
      };
    });
  }
}

export const aiService = new AIService();
