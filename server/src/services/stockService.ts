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
      
      // We will use v8/finance/chart to get historical volume, bypassing the broken yahoo-finance2 crumb
      for (let i = 0; i < allStocks.length; i++) {
        const symbol = allStocks[i].symbol;
        const yahooSymbol = symbol + '.NS';
        
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=10d&interval=1d`;
          const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
          
          if (res.ok) {
            const data = await res.json() as any;
            const volumes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.volume;
            if (volumes && Array.isArray(volumes) && volumes.length > 0) {
              // Filter out nulls and zeros
              const validVolumes = volumes.filter((v: any) => typeof v === 'number' && v > 0);
              if (validVolumes.length > 0) {
                const avgVol = validVolumes.reduce((a: number, b: number) => a + b, 0) / validVolumes.length;
                this.averageVolumeMap.set(symbol, avgVol);
              }
            }
          }
        } catch (err) {
          // Silent catch to not spam logs
        }
        
        // Very small delay to prevent IP ban
        await sleep(100);
      }
      logger.info('Finished background fetch of average volumes via v8 API.');
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
      this.fetchAverageVolumesInBackground();
    }

    const results: StockData[] = [];
    
    try {
      // Convert to TradingView symbols (e.g. BAJAJ-AUTO -> BAJAJ_AUTO)
      const tvToNseMap = new Map();
      const tvSymbols = stocks.map(s => {
        let tvSym = s.symbol.replace('-', '_');
        // Handle special cases if needed, otherwise default to NSE:SYMBOL
        const fullTvSym = 'NSE:' + tvSym;
        tvToNseMap.set(fullTvSym, s.symbol);
        return fullTvSym;
      });

      const url = 'https://scanner.tradingview.com/india/scan';
      const payload = {
        symbols: { tickers: tvSymbols },
        columns: ['name', 'close', 'high', 'low', 'open', 'volume', 'change', 'change_abs', 'Value.Traded', 'market_cap_basic', 'price_52_week_high', 'price_52_week_low']
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as any;
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid TradingView response');
      }

      for (const q of data.data) {
        const originalSymbol = tvToNseMap.get(q.s);
        const baseStock = stocks.find(s => s.symbol === originalSymbol);
        if (!baseStock) continue;

        const price = q.d[1] ?? 0;
        if (price === 0) continue;

        const dayHigh = q.d[2] ?? price;
        const dayLow = q.d[3] ?? price;
        const openPrice = q.d[4] ?? price;
        const volume = q.d[5] ?? 0;
        const changePercent = q.d[6] ?? 0;
        const change = q.d[7] ?? 0;
        const prevClose = price - change;

        const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
        const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

        const fullDayAvgVol = this.averageVolumeMap.get(originalSymbol) || volume || 1;

        // --- ROLLING 1-HOUR VOLUME SPIKE LOGIC ---
        const nowMs = Date.now();
        const ONE_HOUR_MS = 60 * 60 * 1000;
        
        let history = this.volumeHistory.get(originalSymbol);
        if (!history) {
          history = [];
          this.volumeHistory.set(originalSymbol, history);
        }
        
        if (history.length === 0 || nowMs - history[history.length - 1].timestamp > 60000) {
          history.push({ timestamp: nowMs, volume });
        } else {
          history[history.length - 1].volume = volume;
        }
        
        while (history.length > 0 && nowMs - history[0].timestamp > ONE_HOUR_MS) {
          history.shift();
        }
        
        const volumeWindowAgo = history[0].volume;
        const volumeTradedInWindow = volume - volumeWindowAgo;
        const averageHourlyVolume = fullDayAvgVol / 6.25;
        const relativeVolume = averageHourlyVolume > 1 ? volumeTradedInWindow / averageHourlyVolume : 0;
        const volumeSpike = relativeVolume >= 3.0 && volumeTradedInWindow > 0;

        const stockData: StockData = {
          symbol: originalSymbol,
          name: this.nameMap.get(originalSymbol) || baseStock.name,
          price,
          previousClose: prevClose,
          open: openPrice,
          dayHigh,
          dayLow,
          change,
          changePercent,
          volume,
          sector: SECTOR_MAP[originalSymbol] || 'Others',
          averageVolume: fullDayAvgVol,
          relativeVolume,
          volumeSpike,
          indexName,
          lastUpdated: new Date().toISOString(),
          atDayHigh,
          atDayLow,
          fiftyTwoWeekHigh: q.d[10] ?? 0,
          fiftyTwoWeekLow: q.d[11] ?? 0,
          marketCap: q.d[9] ?? 0,
          ...(technicalService.getTechnicals(originalSymbol) || { macdWeeklyBuy: false, rsiDaily: 50, emaCrossDaily: false }),
        };

        results.push(stockData);
        this.stockCache.set(stockData.symbol, stockData);
      }
    } catch (err: any) {
      logger.error(`Bulk fetch failed: ${err.message}`);
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
        
        const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
        const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

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
