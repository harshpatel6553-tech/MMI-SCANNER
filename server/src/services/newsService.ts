import he from 'he';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { aiService } from './aiService.js';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment?: 'Bullish' | 'Bearish' | 'Neutral';
  affectedStocks?: string[];
  isEarningsResult?: boolean;
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
      // Define the list of Twitter accounts to follow
      const accountsToFollow = ['RedboxIndia', 'yatinmota'];
      let allFetchedTweets: any[] = [];

      const fetchPromises = accountsToFollow.map(async (screenname) => {
        try {
          // Use Nitter to get the Twitter data as RSS without API limits
          const response = await fetch(`https://nitter.net/${screenname}/rss`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          if (!response.ok) {
             logger.warn(`Nitter API error for ${screenname}: HTTP ${response.status}`);
             return [];
          }

          const xml = await response.text();
          
          // Parse the RSS items manually to avoid dependency issues
          const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
          
          return items.map(itemHtml => {
             const titleMatch = itemHtml.match(/<title>([\s\S]*?)<\/title>/);
             const pubDateMatch = itemHtml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
             const guidMatch = itemHtml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
             
             let full_text = titleMatch ? titleMatch[1] : 'Breaking News';
             // Clean up CDATA tags if present
             full_text = full_text.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
             
             return {
                 full_text,
                 created_at: pubDateMatch ? pubDateMatch[1] : new Date().toUTCString(),
                 _sourceAccount: screenname,
                 id_str: guidMatch ? guidMatch[1].replace(/[^0-9]/g, '') : ''
             };
          });
        } catch (err) {
           logger.error(`Error fetching Nitter for ${screenname}: ${err}`);
           return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      allFetchedTweets = results.flat();

      if (allFetchedTweets.length === 0) {
        logger.warn(`Failed to fetch tweets from Syndication API for any account.`);
        return;
      }
      
      // Sort all fetched tweets by date descending (newest first)
      allFetchedTweets.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      // Parse and clean the top 20 most recent tweets across all accounts
      const newNews: NewsItem[] = allFetchedTweets.slice(0, 20).map((item: any) => {
        const textContent = item.full_text || 'Breaking News';
        const cleanTitle = he.decode(textContent);
        const earningsRegex = /\b(Q[1-4]|FY\d{2}|Quarterly Results|Net Profit|Revenue|EBITDA|PAT)\b/i;
        const blockDealRegex = /\b(Block Deal|Bulk Deal|Stake Sale|Promoter|Pledge|OFS)\b/i;
        
        const titleHashStr = cleanTitle.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50).toLowerCase();
        const deterministicId = 'msg-' + Buffer.from(titleHashStr + item._sourceAccount).toString('hex');
        
        return {
          id: deterministicId,
          title: cleanTitle,
          link: `https://x.com/${item._sourceAccount}/status/${item.id_str || ''}`,
          pubDate: item.created_at || new Date().toUTCString(),
          source: item._sourceAccount,
          isEarningsResult: earningsRegex.test(cleanTitle),
          isPromoterAction: blockDealRegex.test(cleanTitle)
        };
      });

      // Deduplicate newNews internally based on ID
      const uniqueNewNews = Array.from(new Map(newNews.map(item => [item.id, item])).values());

      const isFirstFetch = this.newsCache.length === 0;
      let newTweets = uniqueNewNews.filter(n => !this.newsCache.find(old => old.id === n.id));

      if (newTweets.length > 0 && aiService.hasValidKey) {
        try {
          const headlines = newTweets.map(t => t.title);
          const aiResults = await aiService.analyzeNewsBatch(headlines);
          
          newTweets = newTweets.map((tweet, index) => {
            tweet.sentiment = aiResults[index].sentiment;
            tweet.affectedStocks = aiResults[index].affectedStocks;
            return tweet;
          });
        } catch (e) {
          logger.error("Failed to process batch sentiment:", e);
        }
      }

      // Combine old cache with new tweets, keeping the top 100 latest in memory for deduplication
      const combinedNews = [...newTweets, ...this.newsCache]
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
        .slice(0, 100);
        
      this.newsCache = combinedNews;
      logger.debug(`Fetched ${newTweets.length} new tweets from multiple accounts.`);

      // Emit news alerts for new tweets (skip on first boot to avoid spamming alerts)
      if (!isFirstFetch && newTweets.length > 0) {
        newTweets.forEach(news => {
          this.emit('news:alert', news);
        });
      }

    } catch (error) {
      logger.error('Error in fetchTweets:', error instanceof Error ? error.message : String(error));
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
