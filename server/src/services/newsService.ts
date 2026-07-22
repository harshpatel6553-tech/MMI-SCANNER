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
      const keyString = process.env.RAPIDAPI_KEY || process.env.TWITTERAPI_KEY || '';
      const keys = keyString.split(',').map(k => k.trim()).filter(Boolean);

      if (keys.length === 0) {
        logger.warn('RAPIDAPI_KEY is missing. Skipping Twitter fetch.');
        return;
      }

      // Define the list of Twitter accounts to follow
      const accountsToFollow = ['RedboxIndia', 'yatinmota'];
      let allFetchedTweets: any[] = [];
      let lastError: any = null;

      // Try keys until one succeeds for the entire batch
      for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[this.currentKeyIndex % keys.length];
        try {
          const fetchPromises = accountsToFollow.map(async (screenname) => {
            const response = await fetch(`https://twitter-search-only.p.rapidapi.com/timeline.php?screenname=${screenname}&tweet_mode=extended&count=20`, {
              headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': 'twitter-search-only.p.rapidapi.com'
              }
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            const json = await response.json();
            if (json.timeline && Array.isArray(json.timeline)) {
              // Add a source field so we know which account it came from
              return json.timeline.map((tweet: any) => ({ ...tweet, _sourceAccount: screenname }));
            }
            return [];
          });

          const results = await Promise.all(fetchPromises);
          allFetchedTweets = results.flat();
          
          if (allFetchedTweets.length > 0) {
            break; // Success! We fetched data. Exit the retry loop.
          }
        } catch (error) {
          lastError = error;
          logger.warn(`API Key (Index ${this.currentKeyIndex % keys.length}) failed. Rotating to next key...`);
          this.currentKeyIndex++; // Move to next key for the next iteration
        }
      }

      if (allFetchedTweets.length === 0) {
        logger.warn(`Failed to fetch tweets from any account. Last error: ${lastError?.message || 'Unknown'}`);
        return;
      }
      
      // Sort all fetched tweets by date descending (newest first)
      allFetchedTweets.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      // Parse and clean the top 20 most recent tweets across all accounts
      const newNews: NewsItem[] = allFetchedTweets.slice(0, 20).map((item: any, index: number) => {
        const textContent = item.full_text || item.retweeted_status?.full_text || item.retweeted_status?.text || item.text || 'Breaking News';
        const cleanTitle = he.decode(textContent);
        
        const earningsRegex = /\b(Q[1-4]|FY\d{2}|Quarterly Results|Net Profit|Revenue|EBITDA|PAT)\b/i;
        
        const titleHashStr = cleanTitle.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50).toLowerCase();
        const deterministicId = 'msg-' + Buffer.from(titleHashStr + item._sourceAccount).toString('hex');
        
        return {
          id: deterministicId,
          title: cleanTitle,
          link: `https://x.com/${item._sourceAccount}`,
          pubDate: item.created_at || new Date().toUTCString(),
          source: item._sourceAccount,
          isEarningsResult: earningsRegex.test(cleanTitle)
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

      // Combine old cache with new tweets, keeping the top 20 latest
      const combinedNews = [...newTweets, ...this.newsCache].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).slice(0, 20);
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
