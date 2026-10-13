import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MACD, RSI, EMA } from 'technicalindicators';
import logger from '../utils/logger.js';
import { NIFTY_50_STOCKS } from '../data/nifty50.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';

export interface TechData {
  macdWeeklyBuy: boolean;
  rsiDaily: number;
  emaCrossDaily: boolean;
}

type UpdateListener = (symbol: string, data: TechData) => void;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE_PATH = path.resolve(__dirname, '../../data/technicals_cache.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class TechnicalService {
  private cache: Map<string, TechData> = new Map();
  private listeners: UpdateListener[] = [];
  private isUpdating = false;

  constructor() {
    this.loadCacheFromDisk();
  }

  private loadCacheFromDisk(): void {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, TechData>;
        for (const [sym, data] of Object.entries(parsed)) {
          this.cache.set(sym, data);
        }
        logger.info(`Loaded ${this.cache.size} technical indicators from cache file.`);
      } else {
        logger.warn(`No technicals cache file found at ${CACHE_FILE_PATH}`);
      }
    } catch (err) {
      logger.error('Failed to load technicals cache from disk: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  private saveCacheToDisk(): void {
    try {
      const dataObj: Record<string, TechData> = {};
      for (const [sym, data] of this.cache.entries()) {
        dataObj[sym] = data;
      }
      const dir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(dataObj, null, 2), 'utf-8');
      logger.debug(`Saved ${this.cache.size} technical indicators to cache file.`);
    } catch (err) {
      logger.error('Failed to save technicals cache to disk: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  onUpdate(listener: UpdateListener): void {
    this.listeners.push(listener);
  }

  private notifyListeners(symbol: string, data: TechData): void {
    for (const listener of this.listeners) {
      try {
        listener(symbol, data);
      } catch (err) {
        logger.error(`Error in technical update listener for ${symbol}: ${err}`);
      }
    }
  }

  async calculateBatchTechnicals(symbols: string[]): Promise<Map<string, TechData>> {
    const results = new Map<string, TechData>();
    if (!symbols.length) return results;

    try {
      const symStr = symbols.map(s => s + '.NS').join(',');
      const weeklyUrl = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symStr)}&range=1y&interval=1wk`;
      const dailyUrl = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symStr)}&range=6mo&interval=1d`;

      const [weeklyRes, dailyRes] = await Promise.all([
        fetch(weeklyUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) }),
        fetch(dailyUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) })
      ]);

      if (!weeklyRes.ok || !dailyRes.ok) return results;

      const weeklyData = await weeklyRes.json() as any;
      const dailyData = await dailyRes.json() as any;

      const weeklyMap = new Map<string, number[]>();
      weeklyData?.spark?.result?.forEach((r: any) => {
        const sym = r.symbol?.replace(/\.NS$/i, '');
        const closes = r.response?.[0]?.indicators?.quote?.[0]?.close?.filter((c: any) => typeof c === 'number') as number[];
        if (sym && closes) weeklyMap.set(sym, closes);
      });

      const dailyMap = new Map<string, number[]>();
      dailyData?.spark?.result?.forEach((r: any) => {
        const sym = r.symbol?.replace(/\.NS$/i, '');
        const closes = r.response?.[0]?.indicators?.quote?.[0]?.close?.filter((c: any) => typeof c === 'number') as number[];
        if (sym && closes) dailyMap.set(sym, closes);
      });

      for (const sym of symbols) {
        const wClose = weeklyMap.get(sym);
        const dClose = dailyMap.get(sym);
        if (!dClose || dClose.length < 15) continue;

        let macdBuy = false;
        let rsi = 50;
        let emaCross = false;

        // --- MACD Weekly (12, 26, 9) ---
        if (wClose && wClose.length >= 35) {
          const macdResult = MACD.calculate({
            values: wClose,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
          });
          if (macdResult.length >= 3) {
            const latest = macdResult[macdResult.length - 1];
            const prev = macdResult[macdResult.length - 2];
            const prev2 = macdResult[macdResult.length - 3];
            if (
              latest.MACD !== undefined && latest.signal !== undefined &&
              prev.MACD !== undefined && prev.signal !== undefined &&
              prev2.MACD !== undefined && prev2.signal !== undefined
            ) {
              const crossThisWeek = prev.MACD <= prev.signal && latest.MACD > latest.signal;
              const crossLastWeek = prev2.MACD <= prev2.signal && prev.MACD > prev.signal && latest.MACD > latest.signal;
              macdBuy = crossThisWeek || crossLastWeek;
            }
          }
        }

        // --- RSI Daily (14) ---
        if (dClose.length >= 15) {
          const rsiResult = RSI.calculate({ values: dClose, period: 14 });
          if (rsiResult.length > 0) {
            rsi = Number(rsiResult[rsiResult.length - 1]!.toFixed(2));
          }
        }

        // --- EMA Cross Daily (13, 34) ---
        if (dClose.length >= 35) {
          const ema13 = EMA.calculate({ values: dClose, period: 13 });
          const ema34 = EMA.calculate({ values: dClose, period: 34 });
          const l13 = ema13.length;
          const l34 = ema34.length;

          if (l13 >= 4 && l34 >= 4) {
            // Check cross in last 3 trading sessions
            const c0 = ema13[l13 - 2] <= ema34[l34 - 2] && ema13[l13 - 1] > ema34[l34 - 1];
            const c1 = ema13[l13 - 3] <= ema34[l34 - 3] && ema13[l13 - 2] > ema34[l34 - 2];
            const c2 = ema13[l13 - 4] <= ema34[l34 - 4] && ema13[l13 - 3] > ema34[l34 - 3];
            emaCross = c0 || c1 || c2;
          }
        }

        const techData: TechData = { macdWeeklyBuy: macdBuy, rsiDaily: rsi, emaCrossDaily: emaCross };
        results.set(sym, techData);
        this.cache.set(sym, techData);
        this.notifyListeners(sym, techData);
      }
    } catch (err) {
      logger.error(`Error calculating technicals batch for ${symbols.slice(0, 3).join(',')}: ${err}`);
    }

    return results;
  }

  async updateAllStocksTechnicals(): Promise<void> {
    if (this.isUpdating) {
      logger.debug('Technicals calculation already in progress, skipping duplicate run.');
      return;
    }

    this.isUpdating = true;
    logger.info('Starting daily/weekly technicals calculation for all stocks (in batches of 20)...');

    try {
      const allSymbols = Array.from(new Set([
        ...NIFTY_50_STOCKS.map(s => s.symbol),
        ...NIFTY_500_STOCKS.map(s => s.symbol)
      ]));

      const CHUNK_SIZE = 20;
      for (let i = 0; i < allSymbols.length; i += CHUNK_SIZE) {
        const chunk = allSymbols.slice(i, i + CHUNK_SIZE);
        await this.calculateBatchTechnicals(chunk);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      this.saveCacheToDisk();
      logger.info(`Finished calculating technicals for all stocks. Total cached: ${this.cache.size}`);
    } catch (err) {
      logger.error('Failed to update technicals: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      this.isUpdating = false;
    }
  }

  getTechnicals(symbol: string): TechData | null {
    return this.cache.get(symbol) || null;
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const technicalService = new TechnicalService();
export default technicalService;
