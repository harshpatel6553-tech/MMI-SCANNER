/**
 * @module stockService
 * @description Core stock data service that fetches real-time quotes from
 * Yahoo Finance using the v7 spark API bulk fetching to completely bypass
 * strict IP bans, rate limits, and crumb requirements.
 */

import type { StockQuote, StockData } from '../types/index.js';
import { NIFTY_50_STOCKS } from '../data/nifty50.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';
import { SECTOR_MAP } from '../data/sectorMap.js';
import { technicalService } from './technicalService.js';
import logger from '../utils/logger.js';
import yahooFinanceModule from 'yahoo-finance2';
const yahooFinance = typeof yahooFinanceModule === 'function' ? new (yahooFinanceModule as any)({ suppressNotices: ['yahooSurvey'] }) : (yahooFinanceModule as any).default ? new (yahooFinanceModule as any).default({ suppressNotices: ['yahooSurvey'] }) : yahooFinanceModule;

/** Number of concurrent requests per batch */
const CONCURRENCY = 20;


/**
 * Tolerance for detecting whether a stock is at its day high or low.
 * A price within 0.01% of the extreme is considered "at" the extreme.
 */
const HIGH_LOW_TOLERANCE = 0.0001;

/** User agent to mimic a browser */
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Pauses execution for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class StockService {
  /** In-memory cache of the latest stock data, keyed by NSE symbol */
  private stockCache: Map<string, StockData> = new Map();

  /** Timestamp of the last successful fetch per index */
  private lastFetchTime: Map<string, number> = new Map();

  /** Name lookup map from original stock lists */
  private nameMap: Map<string, string> = new Map();
  private averageVolumeMap: Map<string, number> = new Map();
  private volumeHistory: Map<string, { timestamp: number, volume: number }[]> = new Map();
  private hasFetchedAverageVolume = false;

  constructor() {
    for (const s of NIFTY_50_STOCKS) {
      this.nameMap.set(s.symbol, s.name);
    }
    for (const s of NIFTY_500_STOCKS) {
      this.nameMap.set(s.symbol, s.name);
    }
  }

  async fetchAverageVolumesInBackground() {
    if (this.hasFetchedAverageVolume) return;
    this.hasFetchedAverageVolume = true;
    try {
      const allStocks = [...NIFTY_50_STOCKS, ...NIFTY_500_STOCKS];
      const chunkSize = 50;
      for (let i = 0; i < allStocks.length; i += chunkSize) {
        const chunk = allStocks.slice(i, i + chunkSize);
        const symbols = chunk.map(s => s.symbol + '.NS');
        try {
          const quotes = await yahooFinance.quote(symbols);
          for (const q of quotes) {
            const sym = q.symbol.replace('.NS', '');
            if (q.averageDailyVolume3Month) {
              this.averageVolumeMap.set(sym, q.averageDailyVolume3Month);
            }
          }
        } catch (err) {
          logger.warn('Failed to fetch avg volume chunk: ' + err);
        }
        await sleep(2000);
      }
      logger.info('Finished background fetch of average volumes.');
    } catch (err) {
      logger.error('Background avg volume fetch failed: ' + err);
    }
  }

  public preloadStock(stock: StockData): void {
    this.stockCache.set(stock.symbol, stock);
  }

  async fetchQuotes(
    stocks: StockQuote[],
    indexName: 'NIFTY50' | 'NIFTY500'
  ): Promise<StockData[]> {
    if (!this.hasFetchedAverageVolume) {
      // Intentionally not awaited so it runs in background
      this.fetchAverageVolumesInBackground();
    }

    const results: StockData[] = [];
    const batches: StockQuote[][] = [];

    // Split into concurrent batches of 50
    for (let i = 0; i < stocks.length; i += CONCURRENCY) {
      batches.push(stocks.slice(i, i + CONCURRENCY));
    }



    // Fetch all batches in parallel to eliminate the 46-second delay
    const fetchPromises = batches.map(async (batch, batchIdx) => {
      const symbolsStr = batch.map(s => `${s.symbol}.NS`).join(',');
      
      try {
        const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolsStr)}&range=1d&interval=1h`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
          }
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json() as any;
        const sparkResults = data?.spark?.result || [];

        const batchResults: StockData[] = [];
        for (const sparkObj of sparkResults) {
          const meta = sparkObj.response?.[0]?.meta;
          const quoteIndicators = sparkObj.response?.[0]?.indicators?.quote?.[0];
          
          if (!meta) continue;

          const cleanSymbol = meta.symbol.replace('.NS', '');
          const baseStock = batch.find(s => s.symbol === cleanSymbol);
          if (!baseStock) continue;

          const price: number = meta.regularMarketPrice ?? 0;
          if (price === 0) continue;

          const dayHigh: number = meta.regularMarketDayHigh ?? price;
          const dayLow: number = meta.regularMarketDayLow ?? price;
          const prevClose: number = meta.previousClose ?? meta.chartPreviousClose ?? price;
          
          let openPrice: number = price;
          if (quoteIndicators && quoteIndicators.close && quoteIndicators.close.length > 0) {
            const firstClose = quoteIndicators.close.find((p: number | null) => p !== null);
            if (firstClose) openPrice = firstClose;
          }

          const atDayHigh = dayHigh > 0 && price > 0 && Math.abs(price - dayHigh) / dayHigh <= HIGH_LOW_TOLERANCE;
          const atDayLow = dayLow > 0 && price > 0 && Math.abs(price - dayLow) / dayLow <= HIGH_LOW_TOLERANCE;

          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

          const volume: number = meta.regularMarketVolume ?? 0;
          
          const fullDayAvgVol = this.averageVolumeMap.get(cleanSymbol) || volume || 1;
          
          // --- ROLLING 1-HOUR VOLUME SPIKE LOGIC ---
          const nowMs = Date.now();
          const ONE_HOUR_MS = 60 * 60 * 1000;
          
          let history = this.volumeHistory.get(cleanSymbol);
          if (!history) {
            history = [];
            this.volumeHistory.set(cleanSymbol, history);
          }
          
          // Only save a snapshot every 1 minute to save memory
          if (history.length === 0 || nowMs - history[history.length - 1].timestamp > 60000) {
            history.push({ timestamp: nowMs, volume });
          }
          // Always update the very last entry to the latest volume for real-time accuracy
          else {
            history[history.length - 1].volume = volume;
          }
          
          // Remove entries older than 1 hour
          while (history.length > 0 && nowMs - history[0].timestamp > ONE_HOUR_MS) {
            history.shift();
          }
          
          // Calculate volume traded in the rolling window (up to 1 hour)
          const volumeWindowAgo = history[0].volume;
          const volumeTradedInWindow = volume - volumeWindowAgo;
          
          // Average hourly volume for this stock (6.25 hours in Indian trading day)
          const averageHourlyVolume = fullDayAvgVol / 6.25;
          
          // Calculate relative volume based on the 1-hour expected volume
          const relativeVolume = averageHourlyVolume > 1 ? volumeTradedInWindow / averageHourlyVolume : 0;
          
          // Trigger spike if volume in the last hour is >= 1.5x the normal hourly average
          // AND we actually have some volume traded (prevents division weirdness)
          const volumeSpike = relativeVolume >= 1.5 && volumeTradedInWindow > 0;

          const stockData: StockData = {
            symbol: cleanSymbol,
            name: meta.longName || meta.shortName || this.nameMap.get(cleanSymbol) || baseStock.name,
            price,
            previousClose: prevClose,
            open: openPrice,
            dayHigh,
            dayLow,
            change,
            changePercent,
            volume,
            sector: SECTOR_MAP[cleanSymbol] || 'Others',
            averageVolume: fullDayAvgVol,
            relativeVolume,
            volumeSpike,
            indexName,
            lastUpdated: new Date().toISOString(),
            atDayHigh,
            atDayLow,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
            marketCap: meta.marketCap ?? 0,
            ...(technicalService.getTechnicals(cleanSymbol) || { macdWeeklyBuy: false, rsiDaily: 50, emaCrossDaily: false }),
          };

          batchResults.push(stockData);
          this.stockCache.set(stockData.symbol, stockData);
        }
        return batchResults;
      } catch (err: any) {
        logger.error(`Bulk fetch failed for batch ${batchIdx}: ${err.message}`);
        return [];
      }
    });

    const resultsArrays = await Promise.all(fetchPromises);
    for (const arr of resultsArrays) {
      results.push(...arr);
    }

    this.lastFetchTime.set(indexName, Date.now());

    return results;
  }

  async fetchNifty50(): Promise<StockData[]> {
    return this.fetchQuotes(NIFTY_50_STOCKS, 'NIFTY50');
  }

  async fetchNifty500(): Promise<StockData[]> {
    const nifty50Symbols = new Set(NIFTY_50_STOCKS.map((s) => s.symbol));
    const additionalStocks = NIFTY_500_STOCKS.filter(
      (s) => !nifty50Symbols.has(s.symbol)
    );
    return this.fetchQuotes(additionalStocks, 'NIFTY500');
  }

  async fetchIndices(): Promise<StockData[]> {
    const indices = [
      { yahooSymbol: '^NSEI', displaySymbol: 'NIFTY 50', name: 'NIFTY 50' },
      { yahooSymbol: '^NSEBANK', displaySymbol: 'BANKNIFTY', name: 'Bank NIFTY' },
      { yahooSymbol: '^CNX100', displaySymbol: 'NIFTY 100', name: 'NIFTY 100' },
      { yahooSymbol: '^CNX200', displaySymbol: 'NIFTY 200', name: 'NIFTY 200' },
      { yahooSymbol: '^CRSLDX', displaySymbol: 'NIFTY 500', name: 'NIFTY 500' },
      { yahooSymbol: '^CNXAUTO', displaySymbol: 'NIFTY AUTO', name: 'NIFTY AUTO' },
      { yahooSymbol: '^CNXIT', displaySymbol: 'NIFTY IT', name: 'NIFTY IT' },
      { yahooSymbol: '^CNXMETAL', displaySymbol: 'NIFTY METAL', name: 'NIFTY METAL' },
      { yahooSymbol: '^CNXPHARMA', displaySymbol: 'NIFTY PHARMA', name: 'NIFTY PHARMA' },
      { yahooSymbol: '^CNXENERGY', displaySymbol: 'NIFTY ENERGY', name: 'NIFTY ENERGY' },
      { yahooSymbol: '^CNXFMCG', displaySymbol: 'NIFTY FMCG', name: 'NIFTY FMCG' },
      { yahooSymbol: '^CNXREALTY', displaySymbol: 'NIFTY REALTY', name: 'NIFTY REALTY' },
      { yahooSymbol: '^CNXINFRA', displaySymbol: 'NIFTY INFRA', name: 'NIFTY INFRA' },
      { yahooSymbol: '^CNXPSUBANK', displaySymbol: 'NIFTY PSU BANK', name: 'NIFTY PSU BANK' },
      { yahooSymbol: '^CNXFIN', displaySymbol: 'NIFTY FIN SERVICE', name: 'NIFTY FIN SERVICE' },
      { yahooSymbol: '^CNXMNCE', displaySymbol: 'NIFTY MNC', name: 'NIFTY MNC' },
      { yahooSymbol: '^CNXPSE', displaySymbol: 'NIFTY PSE', name: 'NIFTY PSE' },
      { yahooSymbol: '^NSEMDCP50', displaySymbol: 'NIFTY MIDCAP 50', name: 'NIFTY MIDCAP 50' }
    ];

    const results: StockData[] = [];

    try {
      const symbolsStr = indices.map(i => i.yahooSymbol).join(',');
      const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolsStr)}&range=1d&interval=1h`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as any;
      const sparkResults = data?.spark?.result || [];

      for (const sparkObj of sparkResults) {
        const meta = sparkObj.response?.[0]?.meta;
        if (!meta) continue;

        const idx = indices.find(i => i.yahooSymbol === meta.symbol);
        if (!idx) continue;

        const price: number = meta.regularMarketPrice ?? 0;
        if (price === 0) continue;

        const dayHigh: number = meta.regularMarketDayHigh ?? price;
        const dayLow: number = meta.regularMarketDayLow ?? price;
        const prevClose: number = meta.previousClose ?? meta.chartPreviousClose ?? price;
        
        const atDayHigh = dayHigh > 0 && price > 0 && Math.abs(price - dayHigh) / dayHigh <= HIGH_LOW_TOLERANCE;
        const atDayLow = dayLow > 0 && price > 0 && Math.abs(price - dayLow) / dayLow <= HIGH_LOW_TOLERANCE;

        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        const indexData: StockData = {
          symbol: idx.displaySymbol,
          name: idx.name,
          price,
          previousClose: prevClose,
          open: price,
          dayHigh,
          dayLow,
          change,
          changePercent,
          volume: meta.regularMarketVolume ?? 0,
          sector: 'Index',
          averageVolume: 0,
          relativeVolume: 0,
          volumeSpike: false,
          indexName: 'INDEX',
          lastUpdated: new Date().toISOString(),
          atDayHigh,
          atDayLow,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
          marketCap: 0,
        };

        results.push(indexData);
        this.stockCache.set(idx.displaySymbol, indexData);


      }
    } catch (err: any) {
      logger.error(`Failed to fetch indices: ${err.message}`);
    }

    return results;
  }

  getCachedStocks(): StockData[] {
    return Array.from(this.stockCache.values());
  }

  getCachedStock(symbol: string): StockData | undefined {
    return this.stockCache.get(symbol);
  }

  getLastFetchTime(indexName: string): number | undefined {
    return this.lastFetchTime.get(indexName);
  }

  getCacheSize(): number {
    return this.stockCache.size;
  }
}

export const stockService = new StockService();
export default stockService;
