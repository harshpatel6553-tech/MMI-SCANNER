import * as cheerio from 'cheerio';
import logger from '../utils/logger.js';

export interface Fundamentals {
  peRatio: string;
  roce: string;
  roe: string;
  bookValue: string;
  dividendYield: string;
  faceValue: string;
}

class ScreenerService {
  /**
   * Fetches fundamental data from Screener.in for a given NSE symbol.
   */
  async getFundamentals(symbol: string): Promise<Fundamentals | null> {
    try {
      // Clean up symbol for Screener (e.g. remove .NS if present)
      const cleanSymbol = symbol.replace('.NS', '').toUpperCase();
      const url = `https://www.screener.in/company/${cleanSymbol}/consolidated/`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
        // A timeout prevents hanging the API if screener is slow
        signal: AbortSignal.timeout(5000)
      });

      // Some companies don't have consolidated data, fallback to standalone
      if (response.status === 404) {
         return await this.getStandaloneFundamentals(cleanSymbol);
      }

      if (!response.ok) {
        logger.warn(`Screener.in returned ${response.status} for ${cleanSymbol}`);
        return null;
      }

      const html = await response.text();
      return this.parseHtml(html);
      
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
        return this.parseHtml(html);
    } catch (e) {
        return null;
    }
  }

  private parseHtml(html: string): Fundamentals {
    const $ = cheerio.load(html);
    const results: Record<string, string> = {};
    
    $('ul#top-ratios li').each((_, el) => {
      const name = $(el).find('span.name').text().trim();
      const value = $(el).find('span.number').text().trim();
      if (name && value) {
        results[name] = value;
      }
    });

    return {
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
