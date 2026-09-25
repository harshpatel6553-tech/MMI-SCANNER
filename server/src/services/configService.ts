import fs from 'fs';
import path from 'path';

const userDataPath = process.env.USER_DATA_PATH || process.cwd();
const CONFIG_FILE_PATH = path.join(userDataPath, 'user_config.json');

export interface AISentimentConfig {
  model: string;
  temperature: number;
  sensitivity: 'Aggressive' | 'Balanced' | 'Conservative';
  companyPerspectivePrompt: string;
  indiaMacroLensPrompt: string;
  fallbackHeuristic: boolean;
  apiKey?: string;
}

export interface UserConfig {
  RAPIDAPI_KEY?: string;
  GEMINI_API_KEY?: string;
  aiSentiment?: AISentimentConfig;
  [key: string]: any;
}

const DEFAULT_AI_SENTIMENT_CONFIG: AISentimentConfig = {
  model: process.env.AI_SENTIMENT_MODEL || 'gemini-3.5-flash',
  temperature: 0.1,
  sensitivity: 'Aggressive',
  companyPerspectivePrompt: `Analyze news primarily from the perspective of the affected company's balance sheet, operational revenue, order pipeline, and cash flows:
- BULLISH if: Order wins, earnings beats, capacity expansion, debt reduction, cost efficiencies, favorable litigation/regulatory approvals, or positive forward guidance.
- BEARISH if: Fines, penalties, investigations, plant shutdowns, client losses, executive resignations, accounting discrepancies, downgrades, or margin contraction.
- NEUTRAL only if: Routine procedural announcements with zero financial or directional enterprise value impact.`,
  indiaMacroLensPrompt: `For global news and macroeconomic developments (e.g., US Federal Reserve, global central banks, crude oil, commodity cycles, geopolitics, forex/USDINR):
- STRICTLY evaluate through the lens of Indian markets (Dalal Street) and Indian equities.
- Examples: 
  * Crude oil price drops -> BULLISH for Indian Oil Marketing Companies (IOC, BPCL), paints (ASIANPAINT, BERGEPAINT), tyres, and overall Indian fiscal deficit.
  * Rising US treasury yields / hawkish Fed -> BEARISH for Indian IT exporters and foreign institutional investment (FII) flows.
  * China economic stimulus/slowdown -> evaluate direct export/import substitution impact on Indian chemicals, steel, and textiles.`,
  fallbackHeuristic: true,
};

class ConfigService {
  private config: UserConfig = {};

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
        this.config = JSON.parse(data);
        console.log('[CONFIG] Successfully loaded user_config.json');
      }
    } catch (error) {
      console.error('[CONFIG] Error loading user_config.json:', error);
    }
  }

  public getConfig(): UserConfig {
    return {
      ...this.config,
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || this.config.RAPIDAPI_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || this.config.GEMINI_API_KEY,
      aiSentiment: {
        ...DEFAULT_AI_SENTIMENT_CONFIG,
        ...(this.config.aiSentiment || {}),
      },
    };
  }

  public getSentimentConfig(): AISentimentConfig {
    return {
      ...DEFAULT_AI_SENTIMENT_CONFIG,
      ...(this.config.aiSentiment || {}),
    };
  }

  public updateSentimentConfig(newConfig: Partial<AISentimentConfig>) {
    const updated = {
      ...this.getSentimentConfig(),
      ...newConfig,
    };
    this.updateConfig({ aiSentiment: updated });
    return updated;
  }

  public updateConfig(newConfig: Partial<UserConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log('[CONFIG] Successfully updated user_config.json');
    } catch (error) {
      console.error('[CONFIG] Error saving user_config.json:', error);
    }
  }

  public getKey(key: string): string | undefined {
    return process.env[key] || this.config[key];
  }
}

export const configService = new ConfigService();
