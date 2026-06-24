import logger from '../utils/logger.js';
import axios from 'axios';

class NseSessionManager {
  private cookies: string = '';
  private baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive'
  };

  /**
   * Visits the NSE homepage to grab fresh session cookies.
   */
  async refreshCookies(): Promise<boolean> {
    try {
      logger.debug('Fetching fresh cookies from NSE homepage...');
      const response = await axios.get('https://www.nseindia.com', {
        headers: this.baseHeaders,
        timeout: 10000
      });

      if (response.headers['set-cookie']) {
        const cookieArray = response.headers['set-cookie'];
        // Parse and combine the cookies
        this.cookies = cookieArray.map(c => c.split(';')[0]).join('; ');
        logger.info('✅ Successfully refreshed NSE session cookies.');
        return true;
      }
      
      logger.warn('No cookies returned from NSE homepage.');
      return false;
    } catch (err: any) {
      logger.error(`Failed to refresh NSE cookies: ${err.message}`);
      return false;
    }
  }

  /**
   * Perform an API request to NSE using the managed cookies.
   */
  async fetch(url: string, retries = 1): Promise<any> {
    if (!this.cookies) {
      await this.refreshCookies();
    }

    try {
      const response = await axios.get(url, {
        headers: {
          ...this.baseHeaders,
          'Cookie': this.cookies
        },
        timeout: 10000
      });
      return response.data;
    } catch (err: any) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        // Cookie might have expired. Try to refresh and retry once.
        if (retries > 0) {
          logger.warn(`NSE ${err.response.status} Error. Refreshing cookies and retrying...`);
          await this.refreshCookies();
          return this.fetch(url, retries - 1);
        }
      }
      logger.error(`NSE Fetch Error for ${url}: ${err.message}`);
      throw err;
    }
  }
}

export const nseSessionManager = new NseSessionManager();
export default nseSessionManager;
