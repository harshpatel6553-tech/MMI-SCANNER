/**
 * @module technicalService
 * @description Service to calculate technical indicators (like MACD) for stocks.
 * Uses yahoo-finance2 to fetch historical weekly data and technicalindicators library
 * to calculate MACD signals.
 */

import _yahooFinance from 'yahoo-finance2';
const yahooFinance = _yahooFinance as any;
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
      // Fetch 1 year of weekly data to ensure we have enough points for EMA 26 + EMA 9
      const result = await yahooFinance.historical(yahooSymbol, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        interval: '1wk',
      });

      if (!result || result.length < 35) {
        return false; // Not enough data points
      }

      const closePrices = result.map((quote: any) => quote.close);

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

      if (latest && previous && latest.MACD !== undefined && latest.signal !== undefined && previous.MACD !== undefined && previous.signal !== undefined) {
        // Buy signal: MACD line is above the Signal line (Bullish Trend)
        // Also ensuring MACD is positive shows stronger momentum, but just > signal is enough for a basic buy state.
        const isBuy = latest.MACD > latest.signal;
        return isBuy;
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
