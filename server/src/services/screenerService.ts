import yahooFinance from 'yahoo-finance2';
import logger from '../utils/logger.js';

export interface Fundamentals {
  marketCap: string;
  currentPrice: string;
  highLow: string;
  peRatio: string;
  roce: string;
  roe: string;
  bookValue: string;
  dividendYield: string;
  faceValue: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class ScreenerService {
  private cache: Map<string, { data: Fundamentals; timestamp: number }> = new Map();

  async getFundamentals(symbol: string): Promise<Fundamentals | null> {
    // Ensure it has .NS suffix for Yahoo Finance
    const cleanSymbol = symbol.toUpperCase().endsWith('.NS') 
      ? symbol.toUpperCase() 
      : `${symbol.toUpperCase()}.NS`;
    const cacheKey = cleanSymbol;

    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }

    try {
      // yahoo-finance2 v4 requires instantiation
      const yf = new (yahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
      
      const result = await yf.quoteSummary(cleanSymbol, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'price']
      }) as any;

      const sd = result.summaryDetail;
      const ks = result.defaultKeyStatistics;
      const fd = result.financialData;

      if (!sd && !ks && !fd) return null;

      const formatNum = (num?: number) => num ? num.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-';
      const formatCr = (num?: number) => num ? `₹${(num / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr.` : '-';
      
      const fundamentals: Fundamentals = {
        marketCap: formatCr(sd?.marketCap || result.price?.marketCap),
        currentPrice: `₹${formatNum(fd?.currentPrice || sd?.previousClose)}`,
        highLow: `₹${formatNum(sd?.fiftyTwoWeekHigh)} / ₹${formatNum(sd?.fiftyTwoWeekLow)}`,
        peRatio: formatNum(sd?.trailingPE),
        roce: ks?.returnOnEquity ? `${(ks.returnOnEquity * 100).toFixed(2)}%` : '-',
        roe: fd?.returnOnEquity ? `${(fd.returnOnEquity * 100).toFixed(2)}%` : '-',
        bookValue: `₹${formatNum(ks?.bookValue)}`,
        dividendYield: sd?.dividendYield ? `${(sd.dividendYield * 100).toFixed(2)}%` : '-',
        faceValue: '-', // Yahoo doesn't provide face value reliably
      };

      this.cache.set(cacheKey, { data: fundamentals, timestamp: Date.now() });
      return fundamentals;
    } catch (error) {
      logger.error(`Error fetching Yahoo fundamentals for ${symbol}:`, error);
      return null;
    }
  }
}

export const screenerService = new ScreenerService();
