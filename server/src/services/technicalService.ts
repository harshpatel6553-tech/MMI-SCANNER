import { MACD, RSI, EMA } from 'technicalindicators';
import logger from '../utils/logger.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';

interface TechData {
  macdWeeklyBuy: boolean;
  rsiDaily: number;
  emaCrossDaily: boolean;
}

class TechnicalService {
  private cache: Map<string, TechData> = new Map();

  async calculateTechnicals(symbol: string): Promise<TechData | null> {
    try {
      const yahooSymbol = `${symbol}.NS`;
      
      // We need BOTH weekly and daily data. 
      // Let's do two fetch calls in parallel.
      const weeklyUrl = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(yahooSymbol)}&range=1y&interval=1wk`;
      const dailyUrl = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(yahooSymbol)}&range=6mo&interval=1d`;
      
      const [weeklyRes, dailyRes] = await Promise.all([
        fetch(weeklyUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        fetch(dailyUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      ]);

      if (!weeklyRes.ok || !dailyRes.ok) return null;

      const weeklyData = await weeklyRes.json() as any;
      const dailyData = await dailyRes.json() as any;

      const wQuote = weeklyData?.spark?.result?.[0]?.response?.[0]?.indicators?.quote?.[0];
      const dQuote = dailyData?.spark?.result?.[0]?.response?.[0]?.indicators?.quote?.[0];

      if (!wQuote?.close || !dQuote?.close) return null;

      const wClose = wQuote.close.filter((p: any) => p !== null) as number[];
      const dClose = dQuote.close.filter((p: any) => p !== null) as number[];

      let macdBuy = false;
      let rsi = 50;
      let emaCross = false;

      // --- MACD Weekly (12,26,9) ---
      if (wClose.length >= 35) {
        const macdResult = MACD.calculate({ values: wClose, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
        if (macdResult.length >= 3) {
          const latest = macdResult[macdResult.length - 1];
          const prev = macdResult[macdResult.length - 2];
          const prev2 = macdResult[macdResult.length - 3];
          if (latest.MACD !== undefined && latest.signal !== undefined && 
              prev.MACD !== undefined && prev.signal !== undefined && 
              prev2.MACD !== undefined && prev2.signal !== undefined) {
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
          rsi = rsiResult[rsiResult.length - 1]!;
        }
      }

      // --- EMA Cross Daily (13, 34) ---
      if (dClose.length >= 35) {
        const ema13 = EMA.calculate({ values: dClose, period: 13 });
        const ema34 = EMA.calculate({ values: dClose, period: 34 });
        
        if (ema13.length >= 2 && ema34.length >= 2) {
          const e13_latest = ema13[ema13.length - 1]!;
          const e13_prev = ema13[ema13.length - 2]!;
          
          const e34_latest = ema34[ema34.length - 1]!;
          const e34_prev = ema34[ema34.length - 2]!;
          
          // Bullish cross: previously 13 <= 34, now 13 > 34
          emaCross = (e13_prev <= e34_prev) && (e13_latest > e34_latest);
        }
      }

      return { macdWeeklyBuy: macdBuy, rsiDaily: rsi, emaCrossDaily: emaCross };
    } catch (err) {
      logger.error(`Failed to calculate technicals for ${symbol}: ${err}`);
      return null;
    }
  }

  async updateAllStocksTechnicals() {
    logger.info('Starting daily/weekly technicals background calculation for all stocks...');
    
    const batchSize = 5;
    for (let i = 0; i < NIFTY_500_STOCKS.length; i += batchSize) {
      const batch = NIFTY_500_STOCKS.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (stock) => {
          const tech = await this.calculateTechnicals(stock.symbol);
          if (tech) {
            this.cache.set(stock.symbol, tech);
          }
        })
      );
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    
    logger.info('Finished calculating technicals for all stocks.');
  }

  getTechnicals(symbol: string): TechData | null {
    return this.cache.get(symbol) || null;
  }
}

export const technicalService = new TechnicalService();
