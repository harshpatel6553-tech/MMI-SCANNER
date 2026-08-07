import axios from 'axios';
import logger from '../utils/logger.js';

class NSEScraperService {
  private cachedDeals: any[] = [];
  private lastFetchTime: Date | null = null;
  private isFetching: boolean = false;

  constructor() {
    // Initial fetch
    this.fetchDeals();
    
    // Fetch every 30 minutes since bulk deals are updated infrequently (mostly EOD)
    setInterval(() => this.fetchDeals(), 30 * 60 * 1000);
  }

  /**
   * Helper to parse a single CSV line honoring quotes
   */
  private parseCsvLine(text: string): string[] {
    const result: string[] = [];
    let inQuotes = false;
    let currentWord = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(currentWord);
        currentWord = '';
      } else {
        currentWord += char;
      }
    }
    result.push(currentWord);
    return result.map(s => s.trim());
  }

  public async fetchDeals(): Promise<void> {
    if (this.isFetching) return;
    this.isFetching = true;

    try {
      logger.info('Fetching latest NSE bulk deals natively via Node.js...');
      
      const response = await axios.get('https://archives.nseindia.com/content/equities/bulk.csv', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/csv,application/csv,text/plain,*/*'
        },
        timeout: 10000
      });

      const csvData = response.data;
      if (!csvData || typeof csvData !== 'string') {
        throw new Error('Invalid CSV data received from NSE');
      }

      const lines = csvData.split('\n').filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV has no data rows');
      }

      const headers = this.parseCsvLine(lines[0]);
      
      // Find column indices
      const dateIdx = headers.findIndex(h => h.includes('Date'));
      const symbolIdx = headers.findIndex(h => h.includes('Symbol'));
      const clientNameIdx = headers.findIndex(h => h.includes('Client Name'));
      const typeIdx = headers.findIndex(h => h.includes('Buy/Sell'));
      const qtyIdx = headers.findIndex(h => h.includes('Quantity Traded'));
      const priceIdx = headers.findIndex(h => h.includes('Trade Price') || h.includes('Wght. Avg. Price'));

      const deals = [];

      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCsvLine(lines[i]);
        if (row.length < 6) continue;

        try {
          deals.push({
            date: row[dateIdx] || '',
            symbol: row[symbolIdx] || '',
            clientName: row[clientNameIdx] || '',
            type: (row[typeIdx] || '').toUpperCase(),
            quantity: parseInt((row[qtyIdx] || '0').replace(/,/g, ''), 10) || 0,
            price: parseFloat((row[priceIdx] || '0.0').replace(/,/g, '')) || 0
          });
        } catch (e) {
           // Skip bad row
        }
      }

      this.cachedDeals = deals;
      this.lastFetchTime = new Date();
      logger.info(`Successfully fetched and parsed ${deals.length} NSE bulk deals natively.`);
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Error fetching NSE bulk deals: ${msg}`);
    } finally {
      this.isFetching = false;
    }
  }

  public getCachedDeals() {
    return {
      lastUpdated: this.lastFetchTime,
      deals: this.cachedDeals
    };
  }
}

export const nseScraperService = new NSEScraperService();
