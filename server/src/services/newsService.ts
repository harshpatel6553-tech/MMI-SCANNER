import he from 'he';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

class NewsService extends EventEmitter {
  private newsCache: NewsItem[] = [];
  private isPolling = false;
  private currentKeyIndex = 0;
  private readonly POLL_INTERVAL = 90 * 1000; // 90 seconds

  constructor() {
    super();
    this.startPolling();
  }

  public getLatestNews(): NewsItem[] {
    return this.newsCache;
  }

  private async fetchTweets(): Promise<void> {
    try {
      const keyString = process.env.RAPIDAPI_KEY || process.env.TWITTERAPI_KEY || '';
      const keys = keyString.split(',').map(k => k.trim()).filter(Boolean);

      if (keys.length === 0) {
        logger.warn('RAPIDAPI_KEY is missing. Skipping Twitter fetch.');
        return;
      }

      let response: Response | null = null;
      let lastError: any = null;

      // Try keys until one succeeds, up to the number of available keys
      for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[this.currentKeyIndex % keys.length];
        try {
          response = await fetch('https://twitter-search-only.p.rapidapi.com/timeline.php?screenname=RedboxIndia', {
            headers: {
              'x-rapidapi-key': apiKey,
              'x-rapidapi-host': 'twitter-search-only.p.rapidapi.com'
            }
          });

          if (response.ok) {
            break; // Success! Exit the retry loop.
          } else {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          lastError = error;
          logger.warn(`API Key (Index ${this.currentKeyIndex % keys.length}) failed. Rotating to next key...`);
          this.currentKeyIndex++; // Move to next key for the next iteration
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All ${keys.length} API keys failed. Last error: ${lastError?.message || 'Unknown'}`);
      }
      
      const json = await response.json();
      
      if (!json.timeline || !Array.isArray(json.timeline)) {
        logger.warn('Unexpected JSON format from RapidAPI');
        return;
      }

      const tweets = json.timeline;

      // Parse and clean the top 20 tweets
      const newNews: NewsItem[] = tweets.slice(0, 20).map((item: any, index: number) => {
        const textContent = item.full_text || item.retweeted_status?.full_text || item.retweeted_status?.text || item.text || 'Breaking News';
        const cleanTitle = he.decode(textContent);
        
        return {
          id: item.tweet_id || `${Date.now()}-${index}`,
          title: cleanTitle,
          link: `https://x.com/RedboxIndia/status/${item.tweet_id}`,
          pubDate: item.created_at || new Date().toUTCString(),
          source: 'RedboxIndia'
        };
      });

      const isFirstFetch = this.newsCache.length === 0;
      const newTweets = newNews.filter(n => !this.newsCache.find(old => old.id === n.id));

      this.newsCache = newNews;
      logger.debug(`Fetched ${newNews.length} latest tweets from RedboxIndia via RapidAPI.`);

      // Emit news alerts for new tweets (skip on first boot to avoid spamming alerts)
      if (!isFirstFetch && newTweets.length > 0) {
        newTweets.forEach(news => {
          this.emit('news:alert', news);
        });
      }

    } catch (error) {
      logger.error('Error fetching RapidAPI:', error instanceof Error ? error.message : String(error));
    }
  }

  private isIndianMarketOpen(): boolean {
    const now = new Date();
    // Convert to IST
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    const day = istTime.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    
    // Check if it's a weekend
    if (day === 0 || day === 6) return false;
    
    // Check if it's between 9:00 AM and 3:30 PM IST
    const timeInMinutes = hours * 60 + minutes;
    const marketOpenMinutes = 9 * 60; // 9:00 AM (Pre-market)
    const marketCloseMinutes = 15 * 60 + 30; // 3:30 PM (Market Close)
    
    return timeInMinutes >= marketOpenMinutes && timeInMinutes <= marketCloseMinutes;
  }

  private startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;

    // Initial fetch
    if (this.isIndianMarketOpen()) {
      this.fetchTweets();
    } else {
      logger.debug('Indian Market is closed. Skipping initial Twitter API fetch.');
    }

    // Poll every interval
    setInterval(() => {
      // Only waste API credits during active Indian Market Hours!
      if (this.isIndianMarketOpen()) {
        this.fetchTweets();
      } else {
        logger.debug('Indian Market is closed. Skipping Twitter API fetch to save credits.');
      }
    }, this.POLL_INTERVAL);
  }
}

export const newsService = new NewsService();
