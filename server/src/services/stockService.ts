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

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class StockService {
  private stockCache: Map<string, StockData> = new Map();
  private lastFetchTime: Map<string, number> = new Map();
  private volumeHistory: Map<string, Array<{ timestamp: number; volume: number }>> = new Map();
  private averageVolumeMap: Map<string, number> = new Map();
  private hasFetchedAverageVolume: boolean = false;

  constructor() {}

  async fetchAverageVolumesInBackground() {
    if (this.hasFetchedAverageVolume) return;
    this.hasFetchedAverageVolume = true;
    
    logger.info('Starting background fetch of average volumes...');
    try {
      const allStocks = [...NIFTY_50_STOCKS, ...NIFTY_500_STOCKS];
      const uniqueSymbols = Array.from(new Set(allStocks.map(s => s.symbol)));
      
      for (const symbol of uniqueSymbols) {
        const yahooSymbol = symbol + '.NS';
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=10d&interval=1d`;
          const res = await fetch(url, { 
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(6000)
          });
          
          if (res.ok) {
            const data = await res.json() as any;
            const volumes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.volume;
            if (volumes && Array.isArray(volumes) && volumes.length > 0) {
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
        
        await sleep(2000);
      }
      logger.info('Finished background fetch of average volumes via v8 API.');
    } catch (err) {
      logger.error('Background volume fetch failed: ' + (err instanceof Error ? err.message : String(err)));
    }
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
      const yahooToStockMap = new Map();
      const yahooSymbols = stocks.map(s => {
        const ySym = s.symbol + '.NS';
        yahooToStockMap.set(ySym, s);
        return ySym;
      });

      let allSparkResults: any[] = [];
      try {
        const quotes = await yahooFinance.quote(yahooSymbols, { return: 'array' }) as any[];
        
        for (const q of quotes) {
          const baseStock = yahooToStockMap.get(q.symbol);
          if (!baseStock) continue;

          const price = q.regularMarketPrice ?? 0;
          if (price === 0) continue;

          const dayHigh = q.regularMarketDayHigh ?? price;
          const dayLow = q.regularMarketDayLow ?? price;
          const openPrice = q.regularMarketOpen ?? price;
          const volume = q.regularMarketVolume ?? 0;
          const prevClose = q.regularMarketPreviousClose ?? price;
          
          const change = q.regularMarketChange ?? (price - prevClose);
          const changePercent = q.regularMarketChangePercent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0);

          const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
          const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

          const fullDayAvgVol = q.averageDailyVolume10Day || q.averageDailyVolume3Month || volume || 1;

          const nowMs = Date.now();
          const ONE_HOUR_MS = 60 * 60 * 1000;
          
          let history = this.volumeHistory.get(baseStock.symbol);
          if (!history) {
            history = [];
            this.volumeHistory.set(baseStock.symbol, history);
          }
          history.push({ timestamp: nowMs, volume });
          const oneHourAgoMs = nowMs - ONE_HOUR_MS;
          while (history.length > 0 && history[0].timestamp < oneHourAgoMs) {
            history.shift();
          }
          let volumeSpike = false;
          if (history.length >= 2) {
            const oldestVol = history[0].volume;
            const newestVol = history[history.length - 1].volume;
            const hourVolume = newestVol - oldestVol;
            const hourlyAvgVol = fullDayAvgVol / 6.25; 
            const hourlyRelativeVol = hourlyAvgVol > 0 ? hourVolume / hourlyAvgVol : 0;
            if (hourlyRelativeVol >= 1.5) volumeSpike = true;
          }

          const relativeVolume = fullDayAvgVol > 0 ? volume / fullDayAvgVol : 0;
          if (relativeVolume >= 2.0) {
             volumeSpike = true;
          }

          const stockData: StockData = {
            symbol: baseStock.symbol,
            name: baseStock.name,
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
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
            fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
            marketCap: q.marketCap ?? 0
          };

          results.push(stockData);
          this.stockCache.set(stockData.symbol, stockData);
        }
        
      } catch (err: any) {
        logger.error('yahoo-finance2 failed (possibly crumb issue). Falling back to /spark: ' + err.message);
        
        const CHUNK_SIZE = 20;
        const chunks = [];
        for (let i = 0; i < yahooSymbols.length; i += CHUNK_SIZE) {
          chunks.push(yahooSymbols.slice(i, i + CHUNK_SIZE));
        }

        const fetchPromises = chunks.map(chunk => {
          const symbolsStr = chunk.join(',');
          const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolsStr)}&range=1d&interval=1m&cb=${Date.now()}`;
          return fetch(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000)
          }).then(async res => {
            if (!res.ok) {
              const fallbackPromises = chunk.map(sym => {
                const indivUrl = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(sym)}&range=1d&interval=1m&cb=${Date.now()}`;
                return fetch(indivUrl, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }, signal: AbortSignal.timeout(3000) })
                  .then(r => r.ok ? r.json() : null)
                  .then(data => data?.spark?.result?.[0] || null)
                  .catch(() => null);
              });
              const fallbackResults = await Promise.all(fallbackPromises);
              return fallbackResults.filter(r => r !== null);
            }
            const data = await res.json() as any;
            return data?.spark?.result || [];
          }).catch(err => {
            return [];
          });
        });

        const chunkedResults = await Promise.all(fetchPromises);
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
          
          let openPrice = meta.regularMarketOpen;
          if (!openPrice) {
            const closes = sparkObj.response[0].indicators?.quote?.[0]?.close;
            if (closes && Array.isArray(closes) && closes.length > 0) {
              openPrice = closes.find((c: any) => c !== null) ?? price;
            } else {
              openPrice = price;
            }
          }

          const volume = meta.regularMarketVolume ?? 0;
          const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
          
          const change = typeof meta.regularMarketChange === 'number' ? meta.regularMarketChange : (typeof meta.fulldayChange === 'number' ? meta.fulldayChange : (price - prevClose));
          const changePercent = typeof meta.regularMarketChangePercent === 'number' ? meta.regularMarketChangePercent : (typeof meta.fulldayChangePercent === 'number' ? meta.fulldayChangePercent : (prevClose > 0 ? (change / prevClose) * 100 : 0));

          const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
          const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

          const fullDayAvgVol = this.averageVolumeMap.get(baseStock.symbol) || volume || 1;

          let history = this.volumeHistory.get(baseStock.symbol);
          if (!history) {
            history = [];
            this.volumeHistory.set(baseStock.symbol, history);
          }
          history.push({ timestamp: Date.now(), volume });
          
          let volumeSpike = false;
          
          const stockData: StockData = {
            symbol: baseStock.symbol,
            name: baseStock.name,
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
            relativeVolume: 1,
            volumeSpike,
            indexName,
            lastUpdated: new Date().toISOString(),
            atDayHigh,
            atDayLow,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
            marketCap: meta.marketCap ?? 0
          };

          results.push(stockData);
          this.stockCache.set(stockData.symbol, stockData);
        }
      }
    } catch (err: any) {
      logger.error('Bulk fetch failed: ' + err.message);
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
    const yahooIndices: { yahooSymbol: string; displaySymbol: string; name: string; aliases?: string[] }[] = [
      { yahooSymbol: '^NSEI',      displaySymbol: 'NIFTY 50',          name: 'NIFTY 50' },
      { yahooSymbol: '^NSEBANK',   displaySymbol: 'BANKNIFTY',         name: 'Bank NIFTY', aliases: ['BANK NIFTY', 'NIFTY BANK'] },
      { yahooSymbol: '^BSESN',     displaySymbol: 'SENSEX',            name: 'BSE SENSEX' },
      { yahooSymbol: '^CRSLDX',    displaySymbol: 'NIFTY 500',         name: 'NIFTY 500' },
      { yahooSymbol: '^CNXIT',     displaySymbol: 'NIFTY IT',          name: 'NIFTY IT' },
      { yahooSymbol: '^INDIAVIX',  displaySymbol: 'INDIA VIX',         name: 'India VIX' },
      { yahooSymbol: '^CNX100',    displaySymbol: 'NIFTY 100',         name: 'NIFTY 100' },
      { yahooSymbol: '^CNX200',    displaySymbol: 'NIFTY 200',         name: 'NIFTY 200' },
      { yahooSymbol: '^NSEMDCP50', displaySymbol: 'NIFTY MIDCAP 50',  name: 'NIFTY MIDCAP 50' },
      { yahooSymbol: '^CNXAUTO',   displaySymbol: 'NIFTY AUTO',        name: 'NIFTY AUTO' },
      { yahooSymbol: '^CNXENERGY', displaySymbol: 'NIFTY ENERGY',      name: 'NIFTY ENERGY' },
      { yahooSymbol: '^CNXFMCG',   displaySymbol: 'NIFTY FMCG',        name: 'NIFTY FMCG' },
      { yahooSymbol: '^CNXMETAL',  displaySymbol: 'NIFTY METAL',       name: 'NIFTY METAL' },
      { yahooSymbol: '^CNXPHARMA', displaySymbol: 'NIFTY PHARMA',      name: 'NIFTY PHARMA' },
      { yahooSymbol: '^CNXREALTY', displaySymbol: 'NIFTY REALTY',      name: 'NIFTY REALTY' },
      { yahooSymbol: '^CNXINFRA',  displaySymbol: 'NIFTY INFRA',       name: 'NIFTY INFRA' },
      { yahooSymbol: '^CNXPSUBANK',displaySymbol: 'NIFTY PSU BANK',    name: 'NIFTY PSU BANK' },
      { yahooSymbol: '^CNXFIN',    displaySymbol: 'NIFTY FIN SERVICE', name: 'NIFTY FIN SERVICE', aliases: ['NIFTY FINANCIAL SERVICES'] },
      { yahooSymbol: '^CNXPSE',    displaySymbol: 'NIFTY PSE',         name: 'NIFTY PSE' },
    ];

    const results: StockData[] = [];
    const symbolsStr = yahooIndices.map(i => i.yahooSymbol).join(',');

    try {
      try {
        const quotes = await yahooFinance.quote(yahooIndices.map(i => i.yahooSymbol), { return: 'array' }) as any[];
        
        for (const q of quotes) {
          const idx = yahooIndices.find(i => i.yahooSymbol === q.symbol);
          if (!idx) continue;

          const price = q.regularMarketPrice ?? 0;
          if (price === 0) continue;

          const prevClose = q.regularMarketPreviousClose ?? price;
          const change = q.regularMarketChange ?? (price - prevClose);
          const changePercent = q.regularMarketChangePercent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0);
          
          const dayHigh = q.regularMarketDayHigh ?? price;
          const dayLow = q.regularMarketDayLow ?? price;
          const open = q.regularMarketOpen ?? price;
          
          const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
          const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

          const indexData: StockData = {
            symbol: idx.displaySymbol,
            name: idx.name,
            price,
            previousClose: prevClose,
            open,
            dayHigh,
            dayLow,
            change,
            changePercent,
            volume: q.regularMarketVolume ?? 0,
            sector: 'Index',
            averageVolume: 0,
            relativeVolume: 0,
            volumeSpike: false,
            indexName: 'INDEX',
            lastUpdated: new Date().toISOString(),
            atDayHigh,
            atDayLow,
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
            fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
            marketCap: 0
          };
          
          results.push(indexData);
          this.stockCache.set(indexData.symbol, indexData);
          if (idx.aliases) {
            for (const alias of idx.aliases) {
              const aliasData = { ...indexData, symbol: alias };
              this.stockCache.set(alias, aliasData);
            }
          }
        }
      } catch (err: any) {
        logger.error('yahoo-finance2 failed for indices. Falling back to /spark: ' + err.message);
        
        const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolsStr)}&range=1d&interval=1m&cb=${Date.now()}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const sparkResults = data?.spark?.result || [];

          for (const sparkObj of sparkResults) {
            const meta = sparkObj.response?.[0]?.meta;
            if (!meta) continue;

            const idx = yahooIndices.find(i => i.yahooSymbol === meta.symbol);
            if (!idx) continue;

            const price: number = typeof meta.regularMarketPrice === 'number'
              ? meta.regularMarketPrice
              : (parseFloat(meta.regularMarketPrice) || 0);
            if (price === 0) continue;

            const prevClose: number = typeof meta.chartPreviousClose === 'number'
              ? meta.chartPreviousClose
              : (typeof meta.previousClose === 'number' ? meta.previousClose : price);

            const change: number = typeof meta.fulldayChange === 'number'
              ? meta.fulldayChange
              : (typeof meta.regularMarketChange === 'number' ? meta.regularMarketChange : (price - prevClose));

            const changePercent: number = typeof meta.fulldayChangePercent === 'number'
              ? meta.fulldayChangePercent
              : (typeof meta.regularMarketChangePercent === 'number' ? meta.regularMarketChangePercent : (prevClose > 0 ? (change / prevClose) * 100 : 0));

            const dayHigh: number = meta.regularMarketDayHigh ?? price;
            const dayLow: number = meta.regularMarketDayLow ?? price;
            
            let open: number = meta.regularMarketOpen;
            if (!open) {
              const closes = sparkObj.response[0].indicators?.quote?.[0]?.close;
              if (closes && Array.isArray(closes) && closes.length > 0) {
                open = closes.find((c: any) => c !== null) ?? price;
              } else {
                open = price;
              }
            }

            const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
            const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

            const indexData: StockData = {
              symbol: idx.displaySymbol,
              name: idx.name,
              price,
              previousClose: prevClose,
              open,
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
              marketCap: 0
            };
            
            results.push(indexData);
            this.stockCache.set(indexData.symbol, indexData);
            if (idx.aliases) {
              for (const alias of idx.aliases) {
                const aliasData = { ...indexData, symbol: alias };
                this.stockCache.set(alias, aliasData);
              }
            }
          }
        }
      }
    } catch (err: any) {
      logger.error('Yahoo Finance indices fetch failed: ' + err.message);
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