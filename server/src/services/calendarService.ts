import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/logger.js';

export interface CalendarEvent {
  symbol: string;
  name: string;
  date: string;
}

class CalendarService {
  private cache: CalendarEvent[] = [];
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours

  public async getExpectedToday(): Promise<CalendarEvent[]> {
    const now = Date.now();
    if (this.cache.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.cache;
    }

    try {
      const today = new Date();
      // Start of today in seconds
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000;
      const endOfDay = startOfDay + 86400; // + 24 hours

      const payload = {
        "filter": [
          { "left": "earnings_release_date", "operation": "egreater", "right": startOfDay },
          { "left": "earnings_release_date", "operation": "eless", "right": endOfDay }
        ],
        "options": { "lang": "en" },
        "markets": ["india"],
        "symbols": { "query": { "types": ["stock"] }, "tickers": [] },
        "columns": ["name", "description", "earnings_release_date"],
        "sort": { "sortBy": "market_cap_basic", "sortOrder": "desc" },
        "range": [0, 150]
      };

      const res = await axios.post('https://scanner.tradingview.com/india/scan', payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      const results: CalendarEvent[] = [];
      
      if (res.data && res.data.data) {
        // TradingView returns duplicates (NSE vs BSE), so we filter them out
        const seen = new Set();
        for (const item of res.data.data) {
          const rawSymbol = item.d[0]; // e.g. NSE:TCS or BSE:TCS
          const name = item.d[1];
          const cleanSymbol = rawSymbol.split(':')[1] || rawSymbol;
          
          if (!seen.has(cleanSymbol)) {
            seen.add(cleanSymbol);
            results.push({
              symbol: cleanSymbol,
              name: name,
              date: today.toISOString().split('T')[0]
            });
          }
        }
      }

      this.cache = results;
      this.lastFetch = now;
      logger.info(`Updated Earnings Calendar cache: Found ${results.length} Indian companies.`);
      
      return results;
    } catch (e: any) {
      logger.error('Failed to scrape TradingView calendar:', e.message);
      return this.cache;
    }
  }
}

export const calendarService = new CalendarService();
