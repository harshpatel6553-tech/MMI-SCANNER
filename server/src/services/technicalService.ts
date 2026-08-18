/**
 * @module technicalService
 * @description Service to calculate technical indicators (like MACD) for stocks.
 * Uses yahoo-finance2 to fetch historical weekly data and technicalindicators library
 * to calculate MACD signals.
 */

import { MACD } from 'technicalindicators';
import logger from '../utils/logger.js';
import { NIFTY_500_STOCKS } from '../data/nifty500.js';


class TechnicalService {
  /** Cache of MACD Weekly Buy signals keyed by NSE symbol */
  private macdCache: Map<string, boolean> = new Map();

  /**
   * Fetches weekly historical data and calculates MACD (12, 26, 9)
   */
  async calculateWeeklyMACD(symbol: string): Promise<boolean> {
    try {
      const yahooSymbol = `${symbol}.NS`;
      
      const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(yahooSymbol)}&range=1y&interval=1wk`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as any;
      const result = data?.spark?.result?.[0]?.response?.[0];
      const quote = result?.indicators?.quote?.[0];

      if (!quote || !quote.close || quote.close.length < 35) {
        return false; // Not enough data points
      }

      // Filter out null values
      const closePrices = quote.close.filter((p: any): p is number => p !== null);

      if (closePrices.length < 35) return false;

      const macdInput = {
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      };

      const macdResult = MACD.calculate(macdInput);
      if (!macdResult || macdResult.length < 2) return false;

      const latest = macdResult[macdResult.length - 1];
      const previous = macdResult[macdResult.length - 2];
      const previous2 = macdResult[macdResult.length - 3];

      if (latest && previous && previous2 && 
          latest.MACD !== undefined && latest.signal !== undefined && 
          previous.MACD !== undefined && previous.signal !== undefined &&
          previous2.MACD !== undefined && previous2.signal !== undefined) {
        
        // Crossover this week (MACD line crosses above Signal line)
        const crossoverThisWeek = previous.MACD <= previous.signal && latest.MACD > latest.signal;
        
        // Crossover last week (and still holding the buy trend this week)
        const crossoverLastWeek = previous2.MACD <= previous2.signal && previous.MACD > previous.signal && latest.MACD > latest.signal;

        return crossoverThisWeek || crossoverLastWeek;
      }
      
      return false;
    } catch (err) {
      logger.error(`Failed to calculate MACD for ${symbol}: ${err}`);
      return false;
    }
  }

  /**
   * Background task to calculate MACD for all stocks
   */
  async updateAllStocksMACD() {
    logger.info('Starting weekly MACD background calculation for all stocks...');
    
    // We only process in small batches to respect Yahoo Finance rate limits
    const batchSize = 5;
    for (let i = 0; i < NIFTY_500_STOCKS.length; i += batchSize) {
      const batch = NIFTY_500_STOCKS.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (stock) => {
          const isBuy = await this.calculateWeeklyMACD(stock.symbol);
          this.macdCache.set(stock.symbol, isBuy);
        })
      );
      // Wait 1 second between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.info('Finished calculating weekly MACD for all stocks.');
  }

  /**
   * Get the cached MACD signal for a stock
   */
  getSignal(symbol: string): boolean {
    return this.macdCache.get(symbol) ?? false;
  }
}

export const technicalService = new TechnicalService();
