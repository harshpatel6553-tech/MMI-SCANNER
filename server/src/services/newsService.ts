import { XMLParser } from 'fast-xml-parser';
import * as he from 'he';
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
  private readonly RSS_URL = 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms';
  private readonly POLL_INTERVAL = 60 * 1000; // 60 seconds

  constructor() {
    this.startPolling();
  }

  public getLatestNews(): NewsItem[] {
    return this.newsCache;
  }

  private async fetchRSS(): Promise<void> {
    try {
      const response = await fetch(this.RSS_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch RSS: ${response.statusText}`);
      }
      
      const xmlData = await response.text();
      
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
      });
      
      const result = parser.parse(xmlData);
      const items = result?.rss?.channel?.item;
      
      if (!items || !Array.isArray(items)) {
        logger.warn('Unexpected RSS format from Economic Times');
        return;
      }

      // Parse and clean the top 20 news items
      const newNews: NewsItem[] = items.slice(0, 20).map((item: any, index: number) => {
        // ET sometimes includes CDATA or HTML entities
        const cleanTitle = he.decode(item.title || 'Breaking News').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
        
        return {
          id: item.guid || `${Date.now()}-${index}`,
          title: cleanTitle,
          link: item.link || '#',
          pubDate: item.pubDate || new Date().toUTCString(),
          source: 'Economic Times'
        };
      });

      this.newsCache = newNews;
      logger.debug(`Fetched ${newNews.length} latest news items from ET Markets.`);

    } catch (error) {
      logger.error('Error fetching news RSS:', error instanceof Error ? error.message : String(error));
    }
  }

  private startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;

    // Initial fetch
    this.fetchRSS();

    // Poll every interval
    setInterval(() => {
      this.fetchRSS();
    }, this.POLL_INTERVAL);
  }
}

export const newsService = new NewsService();
