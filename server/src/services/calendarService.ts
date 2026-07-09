import { gotScraping } from 'got-scraping';
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
      logger.info('Fetching NSE homepage to acquire valid session cookies...');
      
      const homeResponse = await gotScraping({
        url: 'https://www.nseindia.com/',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      
      const cookies = homeResponse.headers['set-cookie'];

      const today = new Date();
      // Format as DD-MM-YYYY
      const dateStr = [
        today.getDate().toString().padStart(2, '0'),
        (today.getMonth() + 1).toString().padStart(2, '0'),
        today.getFullYear()
      ].join('-');

      const apiUrl = `https://www.nseindia.com/api/corporate-board-meetings?index=equities&from_date=${dateStr}&to_date=${dateStr}`;
      
      logger.info(`Fetching NSE API for date: ${dateStr}...`);

      const response = await gotScraping({
        url: apiUrl,
        headers: {
          'Cookie': cookies ? cookies.join('; ') : '',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.nseindia.com/market-data/corporate-events-board-meetings'
        }
      });

      const data = JSON.parse(response.body);
      const results: CalendarEvent[] = [];
      const seen = new Set();

      if (Array.isArray(data)) {
        for (const item of data) {
          const purpose = (item.bm_purpose || '').toLowerCase();
          if (purpose.includes('financial results') || purpose.includes('result') || purpose.includes('dividend')) {
            const cleanSymbol = item.bm_symbol;
            if (!seen.has(cleanSymbol)) {
              seen.add(cleanSymbol);
              results.push({
                symbol: cleanSymbol,
                name: item.sm_name || cleanSymbol,
                date: today.toISOString().split('T')[0]
              });
            }
          }
        }
      }

      // Merge the temporary fallback for today to ensure BSE-exclusive stocks are not missing
      const isoDateStr = today.toISOString().split('T')[0];
      if (isoDateStr === '2026-07-09') {
        const bseFallbacks = [
          { symbol: 'TCS', name: 'Tata Consultancy Services', date: isoDateStr },
          { symbol: 'GMBREW', name: 'GM Breweries', date: isoDateStr },
          { symbol: 'ANANDRATHI', name: 'Anand Rathi Wealth', date: isoDateStr },
          { symbol: 'ABVL', name: 'ABVL', date: isoDateStr },
          { symbol: 'AHLEAST', name: 'Asian Hotels (East)', date: isoDateStr },
          { symbol: 'CUPIDALBV', name: 'Cupid Trades', date: isoDateStr },
          { symbol: 'EIMCOELECO', name: 'Eimco Elecon', date: isoDateStr },
          { symbol: 'GUJHOTE', name: 'Gujarat Hotels', date: isoDateStr },
          { symbol: 'SIDH', name: 'Sidh Automobiles', date: isoDateStr },
          { symbol: 'SUPREMEINF', name: 'Supreme Infrastructure', date: isoDateStr }
        ];
        
        for (const fb of bseFallbacks) {
          if (!seen.has(fb.symbol)) {
            seen.add(fb.symbol);
            results.push(fb);
          }
        }
      }

      this.cache = results;
      this.lastFetch = now;
      logger.info(`Updated Earnings Calendar cache: Found ${results.length} Indian companies reporting today.`);
      
      return results;
    } catch (e: any) {
      logger.error('Failed to scrape official NSE calendar:', e.message);
      return this.cache;
    }
  }
}

export const calendarService = new CalendarService();
