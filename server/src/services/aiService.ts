import logger from '../utils/logger.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';
import { configService, type AISentimentConfig } from './configService.js';

export interface AISentimentResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks: string[];
  reasoning?: string;
  perspective?: 'Company' | 'IndiaMacro' | 'General';
  confidence?: number;
}

export interface AISentimentTestResponse {
  success: boolean;
  model: string;
  latencyMs: number;
  result: AISentimentResult;
  usedHeuristic: boolean;
  error?: string;
}

class AIService {
  public get hasValidKey(): boolean {
    return !!(configService.getKey('GEMINI_API_KEY') || process.env.GEMINI_API_KEY);
  }

  /**
   * Generates the prompt incorporating the dynamic Company Perspective and India Macro directives.
   */
  private buildPrompt(headlines: string[], config: AISentimentConfig): string {
    return `You are the chief quantitative financial news analyst for Market Minds India (MMI), classifying market-moving news impacting the Indian Stock Market (NSE / BSE).

=== CORE DIRECTIVES ===

1. COMPANY PERSPECTIVE (Micro Level):
${config.companyPerspectivePrompt}

2. GLOBAL-TO-INDIA PERSPECTIVE (Macro Level):
${config.indiaMacroLensPrompt}

3. SENSITIVITY CALIBRATION: ${config.sensitivity.toUpperCase()}
${
  config.sensitivity === 'Aggressive'
    ? '- Aggressively flag any tangible positive or negative catalysts. Only use Neutral when there is genuinely zero financial or directional impact.'
    : config.sensitivity === 'Conservative'
    ? '- Only assign Bullish or Bearish if there is high certainty and meaningful financial magnitude. Default routine news to Neutral.'
    : '- Maintain balanced evaluation, assigning Bullish or Bearish when probability of market impact exceeds 60%.'
}

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
   * Analyzes a batch of news headlines using the configured Gemini model.
   */
  public async analyzeNewsBatch(headlines: string[]): Promise<AISentimentResult[]> {
    if (headlines.length === 0) return [];

    const config = configService.getSentimentConfig();
    const geminiKey = configService.getKey('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      logger.warn('No GEMINI_API_KEY configured, falling back to local heuristic analysis.');
      return this.analyzeLocally(headlines);
    }

    try {
      const promptText = this.buildPrompt(headlines, config);
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey.trim() });

      let response;
      const primaryModel = config.model || 'gemini-3.5-flash';
      try {
        response = await ai.models.generateContent({
          model: primaryModel,
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            temperature: typeof config.temperature === 'number' ? config.temperature : 0.1,
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
              temperature: typeof config.temperature === 'number' ? config.temperature : 0.1,
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
      logger.warn(`Gemini AI analysis failed (${config.model}): ${err.message}. Falling back to local heuristic.`);
      if (config.fallbackHeuristic) {
        return this.analyzeLocally(headlines);
      }
      return headlines.map(() => ({
        sentiment: 'Neutral',
        affectedStocks: [],
        reasoning: 'AI analysis unavailable and heuristic fallback disabled.',
        perspective: 'General',
        confidence: 0,
      }));
    }
  }

  /**
   * Tests a single headline live in the Admin Console sandbox with performance latency tracking.
   */
  public async testHeadline(headline: string, overrideConfig?: Partial<AISentimentConfig>): Promise<AISentimentTestResponse> {
    const config = {
      ...configService.getSentimentConfig(),
      ...(overrideConfig || {}),
    };
    const geminiKey = overrideConfig?.apiKey || configService.getKey('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    const startTime = Date.now();

    if (!geminiKey) {
      const heuristicResult = this.analyzeLocally([headline])[0];
      return {
        success: true,
        model: 'Local Heuristic (No API Key)',
        latencyMs: Date.now() - startTime,
        result: heuristicResult,
        usedHeuristic: true,
        error: 'No GEMINI_API_KEY supplied. Used local heuristic fallback.',
      };
    }

    try {
      const promptText = this.buildPrompt([headline], config);
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey.trim() });

      let response;
      let usedModel = config.model || 'gemini-3.5-flash';
      try {
        response = await ai.models.generateContent({
          model: usedModel,
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            temperature: typeof config.temperature === 'number' ? config.temperature : 0.1,
          },
        });
      } catch (primaryErr: any) {
        if (usedModel !== 'gemini-3.5-flash') {
          usedModel = 'gemini-3.5-flash';
          response = await ai.models.generateContent({
            model: usedModel,
            contents: promptText,
            config: {
              responseMimeType: 'application/json',
              temperature: typeof config.temperature === 'number' ? config.temperature : 0.1,
            },
          });
        } else {
          throw primaryErr;
        }
      }

      const parsed = JSON.parse(response.text || '{}');
      const item = parsed?.results?.[0];

      if (!item) {
        throw new Error('No result returned from Gemini model');
      }

      return {
        success: true,
        model: usedModel,
        latencyMs: Date.now() - startTime,
        result: {
          sentiment: item.sentiment || 'Neutral',
          affectedStocks: item.affectedStocks || [],
          reasoning: item.reasoning || '',
          perspective: item.perspective || 'Company',
          confidence: item.confidence || 80,
        },
        usedHeuristic: false,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const heuristicResult = this.analyzeLocally([headline])[0];
      return {
        success: false,
        model: config.model,
        latencyMs,
        result: heuristicResult,
        usedHeuristic: true,
        error: err.message,
      };
    }
  }

  /**
   * Fast rule-based heuristic when AI API key is unavailable or rate-limited.
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
