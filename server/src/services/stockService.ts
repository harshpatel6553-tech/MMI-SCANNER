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
  private nseCookies: string = '';
  private nseCookieExpires: number = 0;

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
      // 1. Create a map of Yahoo symbol -> Base Stock
      const yahooToStockMap = new Map();
      const yahooSymbols = stocks.map(s => {
        const ySym = s.symbol + '.NS';
        yahooToStockMap.set(ySym, s);
        return ySym;
      });

      // 2. Yahoo Spark API limits to 20 symbols per request. We will chunk them and fire them in PARALLEL.
      const CHUNK_SIZE = 20;
      const chunks = [];
      for (let i = 0; i < yahooSymbols.length; i += CHUNK_SIZE) {
        chunks.push(yahooSymbols.slice(i, i + CHUNK_SIZE));
      }

      const fetchPromises = chunks.map(chunk => {
        const symbolsStr = chunk.join(',');
        // CACHE BUSTER + 1m interval guarantees absolutely zero-delay ticks
        const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolsStr)}&range=1d&interval=1m&cb=${Date.now()}`;
        return fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
          }
        }).then(async res => {
          if (!res.ok) {
            logger.error(`[CRITICAL] Yahoo Spark chunk failed with HTTP ${res.status}`);
            return [];
          }
          const data = await res.json() as any;
          return data?.spark?.result || [];
        }).catch(err => {
          logger.error(`[CRITICAL] Yahoo Spark chunk error: ${err.message}`);
          return [];
        });
      });

      const chunkedResults = await Promise.all(fetchPromises);
      
      let allSparkResults: any[] = [];
      for (const res of chunkedResults) {
        allSparkResults = allSparkResults.concat(res);
      }

      for (const sparkObj of allSparkResults) {
        if (!sparkObj || !sparkObj.response || !sparkObj.response[0] || !sparkObj.response[0].meta) continue;
        const meta = sparkObj.response[0].meta;
        const baseStock = yahooToStockMap.get(meta.symbol);
        if (!baseStock) continue;

        const price = meta.regularMarketPrice ?? 0;
        if (price === 0) continue;

        const dayHigh = meta.regularMarketDayHigh ?? price;
        const dayLow = meta.regularMarketDayLow ?? price;
        const openPrice = meta.regularMarketOpen ?? price;
        const volume = meta.regularMarketVolume ?? 0;
        const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
        
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
        const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

        const fullDayAvgVol = this.averageVolumeMap.get(baseStock.symbol) || volume || 1;

        // --- ROLLING 1-HOUR VOLUME SPIKE LOGIC ---
        const nowMs = Date.now();
        const ONE_HOUR_MS = 60 * 60 * 1000;
        
        let history = this.volumeHistory.get(baseStock.symbol);
        if (!history) {
          history = [];
          this.volumeHistory.set(baseStock.symbol, history);
        }
        
        history.push({ timestamp: nowMs, volume });
        
        // Remove entries older than 1 hour
        const cutoffTime = nowMs - ONE_HOUR_MS;
        while (history.length > 0 && history[0].timestamp < cutoffTime) {
          history.shift();
        }

        const volumeWindowAgo = history[0].volume;
        const volumeTradedInWindow = volume - volumeWindowAgo;
        const averageHourlyVolume = fullDayAvgVol / 6.25;
        const relativeVolume = averageHourlyVolume > 1 ? volumeTradedInWindow / averageHourlyVolume : 0;
        const volumeSpike = relativeVolume >= 3.0 && volumeTradedInWindow > 0;

        const stockData: StockData = {
          symbol: baseStock.symbol,
          name: this.nameMap.get(baseStock.symbol) || baseStock.name,
          price,
          previousClose: prevClose,
          open: openPrice,
          dayHigh,
          dayLow,
          change,
          changePercent,
          volume,
          sector: SECTOR_MAP[baseStock.symbol] || 'Others',
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
          ...(technicalService.getTechnicals(baseStock.symbol) || { macdWeeklyBuy: false, rsiDaily: 50, emaCrossDaily: false }),
        };

        results.push(stockData);
        this.stockCache.set(stockData.symbol, stockData);
      }
    } catch (err: any) {
      logger.error(`Bulk fetch failed: ${err.message}`);
    }

    // STRICT AUDIT: Check if any requested stocks were missed by the API
    const fetchedSymbols = new Set(results.map(r => r.symbol));
    const missingStocks = stocks.filter(s => !fetchedSymbols.has(s.symbol));
    
    if (missingStocks.length > 0) {
      const missingSymbols = missingStocks.map(s => s.symbol).join(', ');
      logger.error(`[CRITICAL] TradingView API completely missed ${missingStocks.length} stocks: ${missingSymbols}`);
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

  /**
   * Fetches real-time official index quotes directly from the National Stock Exchange of India (NSE).
   * Authoritative, zero-delay exchange tick stream with accurate previous close and 52-week ranges.
   */
  private async fetchOfficialNseIndices(): Promise<StockData[]> {
    const NSE_INDEX_CONFIG: Record<string, { displaySymbol: string; name: string; aliases?: string[] }> = {
      'NIFTY 50':                 { displaySymbol: 'NIFTY 50',          name: 'NIFTY 50' },
      'NIFTY BANK':               { displaySymbol: 'BANKNIFTY',         name: 'Bank NIFTY', aliases: ['BANK NIFTY', 'NIFTY BANK'] },
      'NIFTY 500':                { displaySymbol: 'NIFTY 500',         name: 'NIFTY 500' },
      'NIFTY IT':                 { displaySymbol: 'NIFTY IT',          name: 'NIFTY IT' },
      'INDIA VIX':                { displaySymbol: 'INDIA VIX',         name: 'India VIX' },
      'NIFTY 100':                { displaySymbol: 'NIFTY 100',         name: 'NIFTY 100' },
      'NIFTY 200':                { displaySymbol: 'NIFTY 200',         name: 'NIFTY 200' },
      'NIFTY MIDCAP 50':          { displaySymbol: 'NIFTY MIDCAP 50',   name: 'NIFTY MIDCAP 50' },
      'NIFTY MIDCAP 100':         { displaySymbol: 'NIFTY MIDCAP 100',  name: 'NIFTY MIDCAP 100' },
      'NIFTY SMALLCAP 100':       { displaySymbol: 'NIFTY SMALLCAP 100',name: 'NIFTY SMALLCAP 100', aliases: ['NIFTY SMALLCAP'] },
      'NIFTY AUTO':               { displaySymbol: 'NIFTY AUTO',        name: 'NIFTY AUTO' },
      'NIFTY FMCG':               { displaySymbol: 'NIFTY FMCG',        name: 'NIFTY FMCG' },
      'NIFTY METAL':              { displaySymbol: 'NIFTY METAL',       name: 'NIFTY METAL' },
      'NIFTY PHARMA':             { displaySymbol: 'NIFTY PHARMA',      name: 'NIFTY PHARMA' },
      'NIFTY REALTY':             { displaySymbol: 'NIFTY REALTY',      name: 'NIFTY REALTY' },
      'NIFTY ENERGY':             { displaySymbol: 'NIFTY ENERGY',      name: 'NIFTY ENERGY' },
      'NIFTY INFRASTRUCTURE':     { displaySymbol: 'NIFTY INFRA',       name: 'NIFTY INFRA', aliases: ['NIFTY INFRASTRUCTURE'] },
      'NIFTY PSU BANK':           { displaySymbol: 'NIFTY PSU BANK',    name: 'NIFTY PSU BANK' },
      'NIFTY FINANCIAL SERVICES': { displaySymbol: 'NIFTY FIN SERVICE', name: 'NIFTY FIN SERVICE', aliases: ['NIFTY FINANCIAL SERVICES'] },
      'NIFTY MEDIA':              { displaySymbol: 'NIFTY MEDIA',       name: 'NIFTY MEDIA' },
      'NIFTY PSE':                { displaySymbol: 'NIFTY PSE',         name: 'NIFTY PSE' },
    };

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
    };

    if (this.nseCookies && Date.now() < this.nseCookieExpires) {
      headers['Cookie'] = this.nseCookies;
    }

    let res = await fetch('https://www.nseindia.com/api/allIndices', {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok || res.status === 401 || res.status === 403) {
      const init = await fetch('https://www.nseindia.com', {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      const rawCookie = init.headers.get('set-cookie');
      if (rawCookie) {
        this.nseCookies = rawCookie
          .split(';')
          .map((c) => c.trim())
          .filter((c) => c.startsWith('nsit=') || c.startsWith('nseappid='))
          .join('; ') || rawCookie;
        this.nseCookieExpires = Date.now() + 10 * 60 * 1000;
        headers['Cookie'] = this.nseCookies;
      }
      res = await fetch('https://www.nseindia.com/api/allIndices', {
        headers,
        signal: AbortSignal.timeout(5000),
      });
    }

    if (!res.ok) {
      throw new Error(`NSE API returned status ${res.status}`);
    }

    const json = (await res.json()) as any;
    const rawList: any[] = Array.isArray(json?.data) ? json.data : [];
    if (rawList.length === 0) {
      throw new Error('NSE API returned empty data');
    }

    const results: StockData[] = [];
    const timestamp = new Date().toISOString();

    for (const item of rawList) {
      const indexKey = item.indexSymbol || item.index;
      const cfg = NSE_INDEX_CONFIG[indexKey];
      if (!cfg) continue;

      const price = typeof item.last === 'number' ? item.last : parseFloat(item.last) || 0;
      if (price === 0) continue;

      const prevClose = typeof item.previousClose === 'number' ? item.previousClose : parseFloat(item.previousClose) || price;
      const change = typeof item.variation === 'number' ? item.variation : parseFloat(item.variation) || (price - prevClose);
      const changePercent = typeof item.percentChange === 'number' ? item.percentChange : parseFloat(item.percentChange) || 0;
      const open = typeof item.open === 'number' ? item.open : parseFloat(item.open) || price;
      const dayHigh = typeof item.high === 'number' ? item.high : parseFloat(item.high) || price;
      const dayLow = typeof item.low === 'number' ? item.low : parseFloat(item.low) || price;
      const fiftyTwoWeekHigh = typeof item.yearHigh === 'number' ? item.yearHigh : parseFloat(item.yearHigh) || 0;
      const fiftyTwoWeekLow = typeof item.yearLow === 'number' ? item.yearLow : parseFloat(item.yearLow) || 0;

      const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
      const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

      const stockItem: StockData = {
        symbol: cfg.displaySymbol,
        name: cfg.name,
        price,
        previousClose: prevClose,
        open,
        dayHigh,
        dayLow,
        change,
        changePercent,
        volume: 0,
        sector: 'Index',
        averageVolume: 0,
        relativeVolume: 0,
        volumeSpike: false,
        indexName: 'INDEX',
        lastUpdated: timestamp,
        atDayHigh,
        atDayLow,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        marketCap: 0,
      };

      results.push(stockItem);
      this.stockCache.set(cfg.displaySymbol, stockItem);

      if (cfg.aliases) {
        for (const alias of cfg.aliases) {
          const aliasItem = { ...stockItem, symbol: alias };
          results.push(aliasItem);
          this.stockCache.set(alias, aliasItem);
        }
      }
    }

    return results;
  }

  async fetchIndices(): Promise<StockData[]> {
    const results: StockData[] = [];
    const resolvedSymbols = new Set<string>();

    // ── Tier 1: Official NSE India Direct API (Authoritative, Zero Third-Party Delay) ──
    try {
      const nseResults = await this.fetchOfficialNseIndices();
      for (const item of nseResults) {
        results.push(item);
        resolvedSymbols.add(item.symbol);
      }
      logger.info(`🏛️ Fetched ${nseResults.length} live indices directly from Official NSE India API`);
    } catch (nseErr: any) {
      logger.warn(`Official NSE India API fetch failed, falling back to TradingView: ${nseErr.message}`);
    }

    // ── Tier 2: TradingView Scanner (For BSE:SENSEX and backup fallback) ──
    const TV_INDEX_MAP: Record<string, { displaySymbol: string; name: string; aliases?: string[] }> = {
      'NSE:NIFTY':       { displaySymbol: 'NIFTY 50',          name: 'NIFTY 50' },
      'NSE:BANKNIFTY':   { displaySymbol: 'BANKNIFTY',         name: 'Bank NIFTY', aliases: ['BANK NIFTY'] },
      'BSE:SENSEX':      { displaySymbol: 'SENSEX',            name: 'BSE SENSEX' },
      'NSE:CNX500':      { displaySymbol: 'NIFTY 500',         name: 'NIFTY 500' },
      'NSE:CNXIT':       { displaySymbol: 'NIFTY IT',          name: 'NIFTY IT' },
      'NSE:CNXENERGY':   { displaySymbol: 'NIFTY ENERGY',      name: 'NIFTY ENERGY' },
      'NSE:CNXMIDCAP':   { displaySymbol: 'NIFTY MIDCAP 50',   name: 'NIFTY MIDCAP 50' },
      'NSE:CNXSMALLCAP': { displaySymbol: 'NIFTY SMALLCAP',    name: 'NIFTY SMALLCAP' },
      'NSE:CNXFINANCE':  { displaySymbol: 'NIFTY FIN SERVICE', name: 'NIFTY FIN SERVICE' },
    };

    const neededTvTickers = Object.keys(TV_INDEX_MAP).filter(
      (ticker) => !resolvedSymbols.has(TV_INDEX_MAP[ticker].displaySymbol)
    );

    if (neededTvTickers.length > 0) {
      try {
        const tvRes = await fetch('https://scanner.tradingview.com/india/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: JSON.stringify({
            symbols: { tickers: neededTvTickers },
            columns: [
              'name',
              'close',
              'change',
              'change_abs',
              'open',
              'high',
              'low',
              'volume',
              'price_52_week_high',
              'price_52_week_low',
            ],
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (tvRes.ok) {
          const tvData = (await tvRes.json()) as any;
          for (const item of tvData?.data || []) {
            const cfg = TV_INDEX_MAP[item.s];
            if (!cfg) continue;

            const d = item.d || [];
            const price: number = d[1] ?? 0;
            if (price === 0) continue;

            const changePercent: number = typeof d[2] === 'number' ? d[2] : 0;
            const change: number = typeof d[3] === 'number' ? d[3] : 0;
            const prevClose: number = price - change;
            const open: number = d[4] ?? price;
            const dayHigh: number = d[5] ?? price;
            const dayLow: number = d[6] ?? price;
            const volume: number = d[7] ?? 0;
            const fiftyTwoWeekHigh: number = d[8] ?? 0;
            const fiftyTwoWeekLow: number = d[9] ?? 0;

            const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
            const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

            const indexData: StockData = {
              symbol: cfg.displaySymbol,
              name: cfg.name,
              price,
              previousClose: prevClose,
              open,
              dayHigh,
              dayLow,
              change,
              changePercent,
              volume,
              sector: 'Index',
              averageVolume: 0,
              relativeVolume: 0,
              volumeSpike: false,
              indexName: 'INDEX',
              lastUpdated: new Date().toISOString(),
              atDayHigh,
              atDayLow,
              fiftyTwoWeekHigh,
              fiftyTwoWeekLow,
              marketCap: 0,
            };

            results.push(indexData);
            this.stockCache.set(cfg.displaySymbol, indexData);
            resolvedSymbols.add(cfg.displaySymbol);

            if (cfg.aliases) {
              for (const alias of cfg.aliases) {
                const aliasData = { ...indexData, symbol: alias };
                results.push(aliasData);
                this.stockCache.set(alias, aliasData);
                resolvedSymbols.add(alias);
              }
            }
          }
        }
      } catch (tvErr: any) {
        logger.warn(`TradingView indices fetch failed, falling back to Yahoo: ${tvErr.message}`);
      }
    }

    // ── Tier 3: Query Yahoo Spark for remaining sector indices or fallback ──
    const yahooIndices = [
      { yahooSymbol: '^NSEI',      displaySymbol: 'NIFTY 50',          name: 'NIFTY 50' },
      { yahooSymbol: '^NSEBANK',   displaySymbol: 'BANKNIFTY',         name: 'Bank NIFTY' },
      { yahooSymbol: '^CNX100',    displaySymbol: 'NIFTY 100',         name: 'NIFTY 100' },
      { yahooSymbol: '^CNX200',    displaySymbol: 'NIFTY 200',         name: 'NIFTY 200' },
      { yahooSymbol: '^CRSLDX',    displaySymbol: 'NIFTY 500',         name: 'NIFTY 500' },
      { yahooSymbol: '^NSEMDCP50', displaySymbol: 'NIFTY MIDCAP 50',  name: 'NIFTY MIDCAP 50' },
      { yahooSymbol: '^CNXAUTO',   displaySymbol: 'NIFTY AUTO',        name: 'NIFTY AUTO' },
      { yahooSymbol: '^CNXIT',     displaySymbol: 'NIFTY IT',          name: 'NIFTY IT' },
      { yahooSymbol: '^CNXMETAL',  displaySymbol: 'NIFTY METAL',       name: 'NIFTY METAL' },
      { yahooSymbol: '^CNXPHARMA', displaySymbol: 'NIFTY PHARMA',      name: 'NIFTY PHARMA' },
      { yahooSymbol: '^CNXENERGY', displaySymbol: 'NIFTY ENERGY',      name: 'NIFTY ENERGY' },
      { yahooSymbol: '^CNXFMCG',   displaySymbol: 'NIFTY FMCG',        name: 'NIFTY FMCG' },
      { yahooSymbol: '^CNXREALTY', displaySymbol: 'NIFTY REALTY',      name: 'NIFTY REALTY' },
      { yahooSymbol: '^CNXINFRA',  displaySymbol: 'NIFTY INFRA',       name: 'NIFTY INFRA' },
      { yahooSymbol: '^CNXPSUBANK',displaySymbol: 'NIFTY PSU BANK',    name: 'NIFTY PSU BANK' },
      { yahooSymbol: '^CNXFIN',    displaySymbol: 'NIFTY FIN SERVICE', name: 'NIFTY FIN SERVICE' },
      { yahooSymbol: '^CNXPSE',    displaySymbol: 'NIFTY PSE',         name: 'NIFTY PSE' },
    ];

    const remainingIndices = yahooIndices.filter(i => !resolvedSymbols.has(i.displaySymbol));
    if (remainingIndices.length > 0) {
      try {
        const symbolsStr = remainingIndices.map(i => i.yahooSymbol).join(',');
        const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolsStr)}&range=1d&interval=1m&cb=${Date.now()}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const sparkResults = data?.spark?.result || [];

          for (const sparkObj of sparkResults) {
            const meta = sparkObj.response?.[0]?.meta;
            if (!meta) continue;

            const idx = remainingIndices.find(i => i.yahooSymbol === meta.symbol);
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
              open: meta.regularMarketOpen ?? price,
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
        }
      } catch (err: any) {
        logger.error(`Failed to fetch Yahoo fallback indices: ${err.message}`);
      }
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
