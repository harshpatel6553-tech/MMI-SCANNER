import he from 'he';
import logger from '../utils/logger.js';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

class NewsService {
  private newsCache: NewsItem[] = [];
  private isPolling = false;
  private readonly POLL_INTERVAL = 60 * 1000; // 60 seconds

  constructor() {
    this.startPolling();
  }

  public getLatestNews(): NewsItem[] {
    return this.newsCache;
  }

  private async fetchTweets(): Promise<void> {
    try {
      const apiKey = process.env.TWITTERAPI_KEY;
      if (!apiKey) {
        logger.warn('TWITTERAPI_KEY is missing. Skipping Twitter fetch.');
        return;
      }

      const response = await fetch('https://api.twitterapi.io/twitter/user/last_tweets?userName=RedboxIndia', {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Twitter API: ${response.statusText}`);
      }
      
      const json = await response.json();
      
      if (json.status !== 'success' || !json.data || !json.data.tweets) {
        logger.warn('Unexpected JSON format from twitterapi.io');
        return;
      }

      const tweets = json.data.tweets;

      // Parse and clean the top 20 tweets
      const newNews: NewsItem[] = tweets.slice(0, 20).map((item: any, index: number) => {
        const cleanTitle = he.decode(item.text || 'Breaking News');
        
        return {
          id: item.id || `${Date.now()}-${index}`,
          title: cleanTitle,
          link: item.url || `https://twitter.com/RedboxIndia/status/${item.id}`,
          pubDate: item.createdAt || new Date().toUTCString(),
          source: 'RedboxIndia'
        };
      });

      this.newsCache = newNews;
      logger.debug(`Fetched ${newNews.length} latest tweets from RedboxIndia.`);

    } catch (error) {
      logger.error('Error fetching Twitter API:', error instanceof Error ? error.message : String(error));
    }
  }

  private startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;

    // Initial fetch
    this.fetchTweets();

    // Poll every interval
    setInterval(() => {
      this.fetchTweets();
    }, this.POLL_INTERVAL);
  }
}

export const newsService = new NewsService();
