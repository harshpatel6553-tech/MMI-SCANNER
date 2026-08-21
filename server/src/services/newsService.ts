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
  private rapidApiKeys: string[] = [];
  private readonly POLL_INTERVAL = 5 * 1000; // 5 seconds

  constructor() {
    super();
    this.startPolling();
  }

  public getLatestNews(): NewsItem[] {
    return this.newsCache;
  }

  private async fetchTweets(): Promise<void> {
    try {
      const accountsToFollow = ['RedboxIndia', 'yatinmota'];
      let allFetchedTweets: any[] = [];

      // Use the newly centralized twitterService that handles user ID resolution and fetching
      const { twitterService } = await import('./twitterService.js');

      const fetchPromises = accountsToFollow.map(async (username) => {
        try {
          const raw = await twitterService.getTweetsByUsername(username);
          if (raw.error) return [];

          // Helper to deeply find an array of tweets in the unknown RapidAPI JSON structure
          const findTweetArray = (obj: any): any[] => {
            if (!obj || typeof obj !== 'object') return [];
            if (Array.isArray(obj)) return obj.length > 0 ? obj : [];
            
            const known = obj.data?.user?.result?.timeline?.timeline?.instructions?.[1]?.entries
                       || obj.data?.user?.result?.timeline_v2?.timeline?.instructions?.find((i: any) => i.type === 'TimelineAddEntries')?.entries
                       || obj.timeline
                       || obj.tweets
                       || obj.data?.tweets;
            if (Array.isArray(known) && known.length > 0) return known;

            for (const val of Object.values(obj)) {
              if (Array.isArray(val) && val.length > 0) return val;
              if (val && typeof val === 'object') {
                const found = findTweetArray(val);
                if (found.length > 0) return found;
              }
            }
            return [];
          };

          let tweets = findTweetArray(raw);
          
          if (tweets.length > 0) {
            logger.info(`Fetched ${tweets.length} real-time tweets for ${username} via twitterService!`);
            return tweets.map((t: any) => {
               const text = t.text || t.full_text || t.content?.itemContent?.tweet_results?.result?.legacy?.full_text || '';
               const date = t.created_at || t.content?.itemContent?.tweet_results?.result?.legacy?.created_at || new Date().toISOString();
               return {
                 full_text: text,
                 created_at: date,
                 _sourceAccount: username,
                 id_str: t.tweet_id || t.id_str || t.id || ''
               };
            }).filter((t: any) => t.full_text && t.full_text !== 'Breaking News Update');
          }
          return [];
        } catch (err) {
           logger.error(`Error fetching news for ${username}: ${err}`);
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

    // Initial fetch always runs so the news panel isn't blank
    this.fetchTweets();

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
