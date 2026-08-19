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
  private readonly POLL_INTERVAL = 60 * 1000; // 60 seconds

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
          // Use axios instead of native fetch because native fetch returns empty string for Nitter
          const { default: axios } = await import('axios');
          
          if (this.rapidApiKeys.length === 0) {
             const rawKeys = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY || process.env.TWITTER_API_KEY || process.env.TWITTERAPI_KEY || process.env.X_RAPIDAPI_KEY || '';
             if (rawKeys.includes(',')) {
                 this.rapidApiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k);
             } else if (rawKeys) {
                 this.rapidApiKeys = [rawKeys];
             }
             
             // Also dynamically load any numbered keys like RAPIDAPI_KEY_1, RAPIDAPI_KEY_2, etc.
             for (let i = 1; i <= 20; i++) {
                 const k = process.env[`RAPIDAPI_KEY_${i}`] || process.env[`TWITTERAPI_KEY_${i}`] || process.env[`TWITTER_API_KEY_${i}`];
                 if (k && !this.rapidApiKeys.includes(k)) {
                     this.rapidApiKeys.push(k);
                 }
             }
          }
          
          if (this.rapidApiKeys.length > 0) {
            let fetchSuccess = false;

            while (this.rapidApiKeys.length > 0 && !fetchSuccess) {
              const rapidApiKey = this.rapidApiKeys[this.currentKeyIndex % this.rapidApiKeys.length];
              this.currentKeyIndex++; // rotate to the next key for the next attempt
              
              try {
                 const rapidRes = await axios.get('https://twitter-search-only.p.rapidapi.com/timeline.php', {
                   params: { screenname: screenname },
                   headers: {
                     'X-RapidAPI-Key': rapidApiKey,
                     'X-RapidAPI-Host': 'twitter-search-only.p.rapidapi.com'
                   },
                   timeout: 10000
                 });
                 
                 if (rapidRes.status === 200 && rapidRes.data) {
                   let tweets: any[] = [];
                   if (rapidRes.data.data && Array.isArray(rapidRes.data.data.tweets)) {
                     tweets = rapidRes.data.data.tweets;
                   } else if (Array.isArray(rapidRes.data)) {
                     tweets = rapidRes.data;
                   } else if (rapidRes.data.timeline) {
                     tweets = rapidRes.data.timeline;
                   }
                   
                   if (tweets.length > 0) {
                     logger.info(`Fetched ${tweets.length} real-time tweets for ${screenname} via RapidAPI!`);
                     fetchSuccess = true;
                     return tweets.map((t: any) => ({
                       full_text: t.full_text || t.note_tweet?.text || t.extended_tweet?.full_text || t.text || '',
                       created_at: t.created_at || t.timestamp || new Date().toUTCString(),
                       _sourceAccount: screenname,
                       id_str: t.tweet_id || t.id_str || t.id || ''
                     }));
                   } else {
                     // Empty timeline, but API call succeeded
                     fetchSuccess = true; 
                     return [];
                   }
                 }
              } catch (rapidErr: any) {
                 const status = rapidErr.response?.status;
                 if (status === 429 || status === 403) {
                    logger.warn(`RapidAPI Key ${rapidApiKey.substring(0,6)}... exhausted or invalid (HTTP ${status}). Removing from rotation.`);
                    this.rapidApiKeys = this.rapidApiKeys.filter(k => k !== rapidApiKey);
                    // Loop will continue and try the next key immediately!
                 } else {
                    logger.warn(`RapidAPI fetch failed for ${screenname}: ${rapidErr.message}`);
                    break; // Stop retrying for unknown errors (like 500s or timeouts)
                 }
              }
            }
          }
          
          if (this.rapidApiKeys.length === 0) {
            logger.warn(`All RapidAPI keys exhausted or no keys configured! Cannot fetch news for ${screenname}.`);
          }

          return [];
        } catch (err) {
           logger.error(`Error fetching news for ${screenname}: ${err}`);
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
