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
      const dateStr = today.toISOString().split('T')[0];
      const url = `https://finance.yahoo.com/calendar/earnings?day=${dateStr}`;
      
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const $ = cheerio.load(data);
      const results: CalendarEvent[] = [];

      $('table tbody tr').each((i, el) => {
        const cols = $(el).find('td');
        if (cols.length >= 3) {
          const rawSymbol = $(cols[0]).text().trim();
          const name = $(cols[1]).text().trim();
          
          if (rawSymbol.endsWith('.NS') || rawSymbol.endsWith('.BO')) {
            const cleanSymbol = rawSymbol.replace('.NS', '').replace('.BO', '');
            // Prevent duplicates (some stocks are listed on both NSE and BSE)
            if (!results.find(r => r.symbol === cleanSymbol)) {
              results.push({ symbol: cleanSymbol, name, date: dateStr });
            }
          }
        }
      });

      this.cache = results;
      this.lastFetch = now;
      logger.info(`Updated Earnings Calendar cache for ${dateStr}: Found ${results.length} Indian companies.`);
      
      return results;
    } catch (e: any) {
      logger.error('Failed to scrape Yahoo Finance calendar:', e.message);
      // Return stale cache if available
      return this.cache;
    }
  }
}

export const calendarService = new CalendarService();
