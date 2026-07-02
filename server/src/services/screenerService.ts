import * as cheerio from 'cheerio';
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

  /**
   * Fetches fundamental data from Screener.in for a given NSE symbol.
   * Utilizes a 24-hour cache to prevent rate-limiting.
   */
  async getFundamentals(symbol: string): Promise<Fundamentals | null> {
    const cleanSymbol = symbol.replace('.NS', '').toUpperCase();

    // Check cache
    const cached = this.cache.get(cleanSymbol);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      logger.debug(`Serving fundamentals for ${cleanSymbol} from cache.`);
      return cached.data;
    }

    try {
      const url = `https://www.screener.in/company/${cleanSymbol}/consolidated/`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.status === 404) {
         return await this.getStandaloneFundamentals(cleanSymbol);
      }

      if (!response.ok) {
        logger.warn(`Screener.in returned ${response.status} for ${cleanSymbol}`);
        return null;
      }

      const html = await response.text();
      const fundamentals = this.parseHtml(html);
      
      // Save to cache
      this.cache.set(cleanSymbol, { data: fundamentals, timestamp: Date.now() });
      return fundamentals;
      
    } catch (error) {
      logger.error(`Error fetching Screener data for ${symbol}:`, error);
      return null;
    }
  }

  private async getStandaloneFundamentals(cleanSymbol: string): Promise<Fundamentals | null> {
    try {
        const url = `https://www.screener.in/company/${cleanSymbol}/`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(5000)
        });
  
        if (!response.ok) return null;
        
        const html = await response.text();
        const fundamentals = this.parseHtml(html);
        this.cache.set(cleanSymbol, { data: fundamentals, timestamp: Date.now() });
        return fundamentals;
    } catch (e) {
        return null;
    }
  }

  private parseHtml(html: string): Fundamentals {
    const $ = cheerio.load(html);
    const results: Record<string, string> = {};
    
    $('ul#top-ratios li').each((_, el) => {
      const name = $(el).find('span.name').text().trim();
      const valueSpan = $(el).find('span.value');
      
      // Handle the High / Low which has two numbers
      const numbers = valueSpan.find('span.number');
      if (numbers.length === 2) {
         results[name] = numbers.eq(0).text().trim() + ' / ' + numbers.eq(1).text().trim();
      } else {
         results[name] = valueSpan.find('span.number').text().trim();
      }
    });

    return {
      marketCap: results['Market Cap'] ? '₹' + results['Market Cap'] + ' Cr.' : 'N/A',
      currentPrice: results['Current Price'] ? '₹' + results['Current Price'] : 'N/A',
      highLow: results['High / Low'] ? '₹' + results['High / Low'] : 'N/A',
      peRatio: results['Stock P/E'] || 'N/A',
      roce: results['ROCE'] ? results['ROCE'] + '%' : 'N/A',
      roe: results['ROE'] ? results['ROE'] + '%' : 'N/A',
      bookValue: results['Book Value'] ? '₹' + results['Book Value'] : 'N/A',
      dividendYield: results['Dividend Yield'] ? results['Dividend Yield'] + '%' : 'N/A',
      faceValue: results['Face Value'] ? '₹' + results['Face Value'] : 'N/A'
    };
  }
}

export const screenerService = new ScreenerService();
