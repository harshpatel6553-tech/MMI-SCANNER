import { exec } from 'child_process';
import path from 'path';
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

  public async fetchDeals(): Promise<void> {
    if (this.isFetching) return;
    this.isFetching = true;

    try {
      logger.info('Fetching latest NSE bulk deals via Python scraper...');
      const scriptPath = path.resolve(process.cwd(), 'src/scripts/nse_scraper.py');
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      const deals = await new Promise<any[]>((resolve, reject) => {
        exec(`${pythonCmd} "${scriptPath}"`, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          
          try {
            const result = JSON.parse(stdout);
            if (result.status === 'success') {
              resolve(result.data);
            } else {
              reject(new Error(result.message));
            }
          } catch (parseError) {
            logger.error(`Failed to parse python output: ${stdout.substring(0, 200)}...`);
            reject(parseError);
          }
        });
      });

      this.cachedDeals = deals;
      this.lastFetchTime = new Date();
      logger.info(`Successfully fetched and cached ${deals.length} NSE bulk deals.`);
      
    } catch (error) {
      logger.error('Error fetching NSE bulk deals:', error);
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
