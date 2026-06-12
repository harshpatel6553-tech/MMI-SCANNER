/**
 * @module stockService
 * @description Core stock data service that fetches real-time quotes from
 * Yahoo Finance v8 Chart API (direct HTTP) and maintains an in-memory cache.
 *
 * Uses the chart endpoint which does NOT require crumb/cookie authentication,
 * avoiding the rate-limiting issues of the yahoo-finance2 library.
 */

import type { StockQuote, StockData } from '../types/index.js';
import { NIFTY_50_STOCKS } from '../data/nifty50.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';
import { SECTOR_MAP } from '../data/sectorMap.js';
import logger from '../utils/logger.js';

/** Number of concurrent requests per batch */
const CONCURRENCY = 25;

/** Delay (ms) between successive batches */
const BATCH_DELAY_MS = 250;

/**
 * Tolerance for detecting whether a stock is at its day high or low.
 * A price within 0.01% of the extreme is considered "at" the extreme.
 */
const HIGH_LOW_TOLERANCE = 0.0001;

/** Yahoo Finance v8 chart endpoint — NO crumb/cookie required */
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

/** User agent to mimic a browser */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Pauses execution for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a single stock quote from Yahoo Finance v8 Chart API.
 * Returns both meta and indicators.quote data from the chart response.
 */
async function fetchChartQuote(
  yahooSymbol: string
): Promise<{ meta: Record<string, any>; quote: Record<string, any>; volumes: number[] } | null> {
  // Use 1h interval to detect sudden intraday volume spikes on an hourly basis
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}?interval=1h&range=1d`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const result = data?.chart?.result?.[0];

  if (!result?.meta) {
    return null;
  }

  const quote = result?.indicators?.quote?.[0] ?? {};
  const volumes: number[] = (quote.volume ?? []).filter((v: any) => v != null && v > 0);

  return { meta: result.meta, quote, volumes };
}

/**
 * Core service for fetching and caching stock market data.
 *
 * Uses Yahoo Finance v8 Chart API to retrieve real-time quotes for
 * NSE-listed stocks. Fetches in controlled concurrent batches to
 * balance speed and rate-limit compliance.
 *
 * @example
 * ```typescript
 * import { stockService } from './stockService.js';
 *
 * const nifty50 = await stockService.fetchNifty50();
 * console.log(`Fetched ${nifty50.length} stocks`);
 * ```
 */
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

  /**
   * Fetch real-time quotes for a list of stocks from Yahoo Finance v8 Chart API.
   *
   * Processes stocks in groups of {@link CONCURRENCY} concurrent requests,
   * with a {@link BATCH_DELAY_MS} pause between groups.
   *
   * @param stocks - Array of stock identifiers to fetch
   * @param indexName - Index label to attach to each result
   * @returns Array of successfully fetched stock data
   */
  async fetchQuotes(
    stocks: StockQuote[],
    indexName: 'NIFTY50' | 'NIFTY500'
  ): Promise<StockData[]> {
    const results: StockData[] = [];
    const batches: StockQuote[][] = [];

    // Split into concurrent batches
    for (let i = 0; i < stocks.length; i += CONCURRENCY) {
      batches.push(stocks.slice(i, i + CONCURRENCY));
    }

    logger.debug(
      `Fetching ${stocks.length} ${indexName} stocks in ${batches.length} batch(es) via Yahoo v8 Chart API`
    );

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]!;

      // Add delay between batches (skip first)
      if (batchIdx > 0) {
        await sleep(BATCH_DELAY_MS);
      }

      // Fetch batch concurrently (small batch = 5 concurrent)
      const promises = batch.map(async (stock) => {
        const yahooSymbol = `${stock.symbol}.NS`;
        try {
          const chartData = await fetchChartQuote(yahooSymbol);

          if (!chartData || chartData.meta.regularMarketPrice == null) {
            logger.warn(`No data returned for ${yahooSymbol}`);
            return null;
          }

          const { meta, quote, volumes } = chartData;

          const price: number = meta.regularMarketPrice ?? 0;
          const dayHigh: number = meta.regularMarketDayHigh ?? price;
          const dayLow: number = meta.regularMarketDayLow ?? price;
          const prevClose: number = meta.previousClose ?? meta.chartPreviousClose ?? price;

          // Extract open price from indicators.quote (first 1-hour candle of the day)
          const openArray: number[] = (quote.open ?? []).filter((v: any) => v != null);
          const openPrice: number = openArray.length > 0 ? openArray[0] : price;

          // Detect if price is at day high/low within tolerance
          const atDayHigh =
            dayHigh > 0 &&
            price > 0 &&
            Math.abs(price - dayHigh) / dayHigh <= HIGH_LOW_TOLERANCE;

          const atDayLow =
            dayLow > 0 &&
            price > 0 &&
            Math.abs(price - dayLow) / dayLow <= HIGH_LOW_TOLERANCE;

          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

          // Intraday Volume analytics (1-hour Sudden Spikes)
          let volume = 0; // Current 1h volume
          let averageVolume = 0; // Average 1h volume today

          if (volumes.length > 0) {
            volume = volumes[volumes.length - 1] ?? 0;
            
            // Calculate average 1h volume, excluding the very first opening hour which is always huge
            const validVolumes = volumes.length > 1 ? volumes.slice(1, -1) : volumes;
            if (validVolumes.length > 0) {
              averageVolume = validVolumes.reduce((sum, v) => sum + v, 0) / validVolumes.length;
            } else {
              averageVolume = volume;
            }
          }

          const relativeVolume: number =
            averageVolume > 0 ? volume / averageVolume : 0;
          // Trigger spike if sudden 1h volume is 3x higher than average 1h volume
          const volumeSpike: boolean = relativeVolume >= 3.0;

          // Market cap: price × shares outstanding (estimate from volume data if not in meta)
          const marketCap: number = meta.marketCap ?? 0;

          const stockData: StockData = {
            symbol: stock.symbol,
            name:
              meta.longName || meta.shortName || this.nameMap.get(stock.symbol) || stock.name,
            price,
            previousClose: prevClose,
            open: openPrice,
            dayHigh,
            dayLow,
            change,
            changePercent,
            volume,
            sector: SECTOR_MAP[stock.symbol] || 'Others',
            averageVolume,
            relativeVolume,
            volumeSpike,
            indexName,
            lastUpdated: new Date().toISOString(),
            atDayHigh,
            atDayLow,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
            marketCap,
          };

          return stockData;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('404')) {
            logger.debug(`Skipping ${yahooSymbol} (404 Not Found)`);
          } else {
            logger.error(`Failed to fetch ${yahooSymbol}: ${message}`);
          }
          return null;
        }
      });

      const settled = await Promise.allSettled(promises);

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled' && outcome.value !== null) {
          const data = outcome.value;
          results.push(data);
          this.stockCache.set(data.symbol, data);
        }
      }

      // Log progress every 5 batches
      if ((batchIdx + 1) % 5 === 0 || batchIdx === batches.length - 1) {
        logger.debug(
          `Progress: ${Math.min((batchIdx + 1) * CONCURRENCY, stocks.length)}/${stocks.length} symbols processed`
        );
      }
    }

    this.lastFetchTime.set(indexName, Date.now());

    logger.info(
      `${indexName}: fetched ${results.length}/${stocks.length} stocks successfully`
    );

    return results;
  }

  /**
   * Fetch all Nifty 50 stocks.
   */
  async fetchNifty50(): Promise<StockData[]> {
    return this.fetchQuotes(NIFTY_50_STOCKS, 'NIFTY50');
  }

  /**
   * Fetch all Nifty 500 stocks (excluding those already in Nifty 50).
   */
  async fetchNifty500(): Promise<StockData[]> {
    const nifty50Symbols = new Set(NIFTY_50_STOCKS.map((s) => s.symbol));
    const additionalStocks = NIFTY_500_STOCKS.filter(
      (s) => !nifty50Symbols.has(s.symbol)
    );
    return this.fetchQuotes(additionalStocks, 'NIFTY500');
  }

  /** Get all cached stock data. */
  getCachedStocks(): StockData[] {
    return Array.from(this.stockCache.values());
  }

  /** Get cached data for a single stock. */
  getCachedStock(symbol: string): StockData | undefined {
    return this.stockCache.get(symbol);
  }

  /** Get the timestamp of the last successful fetch for an index. */
  getLastFetchTime(indexName: string): number | undefined {
    return this.lastFetchTime.get(indexName);
  }

  /** Get the total number of stocks in the cache. */
  getCacheSize(): number {
    return this.stockCache.size;
  }
}

/**
 * Singleton instance of the StockService.
 */
export const stockService = new StockService();

export default stockService;
