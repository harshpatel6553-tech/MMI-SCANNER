/**
 * @module stockService
 * @description Core stock data service that fetches real-time quotes from
 * Yahoo Finance using yahoo-finance2 bulk fetching to completely bypass
 * strict IP bans and rate limits.
 */

import type { StockQuote, StockData } from '../types/index.js';
import { NIFTY_50_STOCKS } from '../data/nifty50.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';
import { SECTOR_MAP } from '../data/sectorMap.js';
import { technicalService } from './technicalService.js';
import logger from '../utils/logger.js';
import yahooFinance from 'yahoo-finance2';

/** Number of concurrent requests per batch */
const CONCURRENCY = 50;

/** Delay (ms) between successive batches to avoid triggering Yahoo DDoS protections */
const BATCH_DELAY_MS = 2000;

/**
 * Tolerance for detecting whether a stock is at its day high or low.
 * A price within 0.01% of the extreme is considered "at" the extreme.
 */
const HIGH_LOW_TOLERANCE = 0.0001;

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

  constructor() {
    for (const s of NIFTY_50_STOCKS) {
      this.nameMap.set(s.symbol, s.name);
    }
    for (const s of NIFTY_500_STOCKS) {
      this.nameMap.set(s.symbol, s.name);
    }
  }

  public preloadStock(stock: StockData): void {
    this.stockCache.set(stock.symbol, stock);
  }

  async fetchQuotes(
    stocks: StockQuote[],
    indexName: 'NIFTY50' | 'NIFTY500'
  ): Promise<StockData[]> {
    const results: StockData[] = [];
    const batches: StockQuote[][] = [];

    // Split into concurrent batches of 50
    for (let i = 0; i < stocks.length; i += CONCURRENCY) {
      batches.push(stocks.slice(i, i + CONCURRENCY));
    }

    logger.debug(
      `Fetching ${stocks.length} ${indexName} stocks in ${batches.length} batch(es) via Bulk Quote API`
    );

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]!;

      if (batchIdx > 0) {
        await sleep(BATCH_DELAY_MS);
      }

      const symbols = batch.map(s => `${s.symbol}.NS`);
      
      try {
        const quotes = await yahooFinance.quote(symbols);
        
        for (const quote of quotes) {
          const cleanSymbol = quote.symbol.replace('.NS', '');
          const baseStock = batch.find(s => s.symbol === cleanSymbol);
          if (!baseStock) continue;

          const price: number = quote.regularMarketPrice ?? 0;
          if (price === 0) continue;

          const dayHigh: number = quote.regularMarketDayHigh ?? price;
          const dayLow: number = quote.regularMarketDayLow ?? price;
          const prevClose: number = quote.regularMarketPreviousClose ?? price;
          const openPrice: number = quote.regularMarketOpen ?? price;

          const atDayHigh = dayHigh > 0 && price > 0 && Math.abs(price - dayHigh) / dayHigh <= HIGH_LOW_TOLERANCE;
          const atDayLow = dayLow > 0 && price > 0 && Math.abs(price - dayLow) / dayLow <= HIGH_LOW_TOLERANCE;

          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

          const volume: number = quote.regularMarketVolume ?? 0;
          
          // Estimate 1-hour average volume based on the 10-day average daily volume
          // (assuming ~6.25 trading hours per day)
          const dailyAvgVol = quote.averageDailyVolume10Day ?? volume;
          const averageVolume = dailyAvgVol > 0 ? Math.round(dailyAvgVol / 6.25) : volume;

          const relativeVolume: number = averageVolume > 0 ? volume / averageVolume : 0;
          const volumeSpike: boolean = relativeVolume >= 2.0;

          const stockData: StockData = {
            symbol: cleanSymbol,
            name: quote.longName || quote.shortName || this.nameMap.get(cleanSymbol) || baseStock.name,
            price,
            previousClose: prevClose,
            open: openPrice,
            dayHigh,
            dayLow,
            change,
            changePercent,
            volume,
            sector: SECTOR_MAP[cleanSymbol] || 'Others',
            averageVolume,
            relativeVolume,
            volumeSpike,
            indexName,
            lastUpdated: new Date().toISOString(),
            atDayHigh,
            atDayLow,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
            marketCap: quote.marketCap ?? 0,
            macdWeeklyBuy: technicalService.getSignal(cleanSymbol),
          };

          results.push(stockData);
          this.stockCache.set(stockData.symbol, stockData);
        }
      } catch (err: any) {
        logger.error(`Bulk fetch failed for batch ${batchIdx}: ${err.message}`);
      }
    }

    this.lastFetchTime.set(indexName, Date.now());
    logger.info(`${indexName}: fetched ${results.length}/${stocks.length} stocks successfully`);
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
      { yahooSymbol: '^NSEI', displaySymbol: 'NIFTY50', name: 'NIFTY 50 Index' },
      { yahooSymbol: '^NSEBANK', displaySymbol: 'BANKNIFTY', name: 'Bank NIFTY Index' },
    ];

    const results: StockData[] = [];

    try {
      const quotes = await yahooFinance.quote(indices.map(i => i.yahooSymbol));
      
      for (const quote of quotes) {
        const idx = indices.find(i => i.yahooSymbol === quote.symbol);
        if (!idx) continue;

        const price: number = quote.regularMarketPrice ?? 0;
        if (price === 0) continue;

        const dayHigh: number = quote.regularMarketDayHigh ?? price;
        const dayLow: number = quote.regularMarketDayLow ?? price;
        const prevClose: number = quote.regularMarketPreviousClose ?? price;
        const openPrice: number = quote.regularMarketOpen ?? price;

        const atDayHigh = dayHigh > 0 && price > 0 && Math.abs(price - dayHigh) / dayHigh <= HIGH_LOW_TOLERANCE;
        const atDayLow = dayLow > 0 && price > 0 && Math.abs(price - dayLow) / dayLow <= HIGH_LOW_TOLERANCE;

        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        const indexData: StockData = {
          symbol: idx.displaySymbol,
          name: idx.name,
          price,
          previousClose: prevClose,
          open: openPrice,
          dayHigh,
          dayLow,
          change,
          changePercent,
          volume: quote.regularMarketVolume ?? 0,
          sector: 'Index',
          averageVolume: 0,
          relativeVolume: 0,
          volumeSpike: false,
          indexName: 'INDEX',
          lastUpdated: new Date().toISOString(),
          atDayHigh,
          atDayLow,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
          marketCap: 0,
        };

        results.push(indexData);
        this.stockCache.set(idx.displaySymbol, indexData);

        logger.info(
          `📈 ${idx.name}: ₹${price.toFixed(2)} | High: ₹${dayHigh.toFixed(2)} | Low: ₹${dayLow.toFixed(2)} | ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
        );
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
