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
  reasoning?: string;
  perspective?: 'Company' | 'IndiaMacro' | 'General';
  isEarningsResult?: boolean;
}

class NewsService extends EventEmitter {
  private newsCache: NewsItem[] = [];
  private isPolling = false;
  private readonly POLL_INTERVAL = 60 * 1000; // 60 seconds (protects API quota)

  constructor() {
    super();
    this.startPolling();
  }

  public getLatestNews(): NewsItem[] {
    return this.newsCache;
  }

  private isFetching = false;

  private computeQuickSentiment(title: string): 'Bullish' | 'Bearish' | 'Neutral' {
    if (/\b(surge|jumps?|rall(?:y|ies)|gains?|beats?|rises?|profit up|record high|bullish|buy|upgrade|positive|expansion|orders? won|contract won|strong growth)\b/i.test(title)) {
      return 'Bullish';
    }
    if (/\b(plunges?|falls?|drops?|slumps?|miss(?:es)?|loss|profit down|bearish|sell|downgrade|probe|fraud|penalty|crackdown|warning|cut)\b/i.test(title)) {
      return 'Bearish';
    }
    return 'Neutral';
  }

  private extractAffectedStocks(title: string): string[] {
    const tUpper = title.toUpperCase();
    const matched = new Set<string>();
    const COMMON_SYMBOLS = [
      'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
      'ITC', 'KOTAKBANK', 'LT', 'AXISBANK', 'HINDUNILVR', 'BAJFINANCE', 'MARUTI',
      'TATASTEEL', 'WIPRO', 'TITAN', 'TATAMOTORS', 'TMPV', 'TMCV', 'ADANIENT',
      'ADANIPORTS', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA', 'SUNPHARMA',
      'JSWSTEEL', 'TECHM', 'ASIANPAINT', 'ZOMATO', 'PAYTM', 'JIOFIN', 'VEDL',
      'HAL', 'BEL', 'BSE', 'CDSL', 'IRCTC', 'SUZLON'
    ];

    for (const sym of COMMON_SYMBOLS) {
      if (new RegExp(`\\b${sym}\\b`, 'i').test(tUpper)) {
        matched.add(sym);
      }
    }
    return Array.from(matched).slice(0, 5);
  }

  private async fetchRssNews(): Promise<any[]> {
    try {
      const url = 'https://news.google.com/rss/search?q=NIFTY+OR+NSE+OR+BSE+stocks+when:1d&hl=en-IN&gl=IN&ceid=IN:en';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      const xml = await res.text();
      const chunks = xml.split('<item>').slice(1);
      return chunks.slice(0, 30).map(chunk => {
        const titleMatch = chunk.match(/<title>(.*?)<\/title>/);
        const linkMatch = chunk.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = chunk.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = chunk.match(/<source[^>]*>(.*?)<\/source>/);
        const rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : '';
        return {
          full_text: he.decode(rawTitle),
          created_at: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
          _sourceAccount: sourceMatch ? sourceMatch[1] : 'Market Wire',
          id_str: 'rss-' + Buffer.from(rawTitle).toString('base64').substring(0, 16),
          link: linkMatch ? linkMatch[1] : '',
        };
      }).filter(item => item.full_text && item.full_text.length > 10);
    } catch {
      return [];
    }
  }

  private currentFetchPromise: Promise<void> | null = null;

  public async fetchTweets(): Promise<void> {
    if (this.currentFetchPromise) {
      return this.currentFetchPromise;
    }
    this.currentFetchPromise = this._executeFetch().finally(() => {
      this.currentFetchPromise = null;
    });
    return this.currentFetchPromise;
  }

  private async _executeFetch(): Promise<void> {

    try {
      const accountsToFollow = ['RedboxIndia', 'yatinmota'];
      let allFetchedTweets: any[] = [];

      // Use the centralized twitterService that handles user ID resolution and fetching
      const { twitterService } = await import('./twitterService.js');

      const fetchPromises = accountsToFollow.map(async (username) => {
        try {
          const raw = await twitterService.getTweetsByUsername(username);
          if (raw.error) {
            logger.warn(`Twitter fetch error for ${username}: ${raw.error}`);
            return [];
          }

          // Helper to deeply find an array of tweets in RapidAPI JSON structure
          const findTweetArray = (obj: any): any[] => {
            if (!obj || typeof obj !== 'object') return [];
            if (Array.isArray(obj)) return obj.length > 0 ? obj : [];
            
            const known = obj.data?.items
                       || obj.items
                       || obj.data?.user?.result?.timeline?.timeline?.instructions?.[1]?.entries
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
                 id_str: t.id || t.tweet_id || t.id_str || ''
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

      // If Twitter returned 0 tweets, fall back to Google News Market Wire RSS so feed is never blank!
      if (allFetchedTweets.length === 0) {
        logger.info('Pulling live Market Wire RSS as fallback...');
        allFetchedTweets = await this.fetchRssNews();
      }
      
      // Sort all fetched items by date descending (newest first)
      allFetchedTweets.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      // Parse and clean all fetched news items (up to 50)
      const newNews: NewsItem[] = allFetchedTweets.slice(0, 50).map((item: any) => {
        const textContent = item.full_text || 'Breaking News';
        const cleanTitle = he.decode(textContent);
        const earningsRegex = /\b(Q[1-4]|FY\d{2}|Quarterly Results|Net Profit|Revenue|EBITDA|PAT|Earnings)\b/i;
        const blockDealRegex = /\b(Block Deal|Bulk Deal|Stake Sale|Promoter|Pledge|OFS|Acquisition|Buyback)\b/i;
        
        const titleHashStr = cleanTitle.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50).toLowerCase();
        const deterministicId = 'msg-' + Buffer.from(titleHashStr + item._sourceAccount).toString('hex');
        
        return {
          id: deterministicId,
          title: cleanTitle,
          link: item.link || `https://x.com/${item._sourceAccount}/status/${item.id_str || ''}`,
          pubDate: item.created_at || new Date().toISOString(),
          source: item._sourceAccount,
          sentiment: this.computeQuickSentiment(cleanTitle),
          affectedStocks: this.extractAffectedStocks(cleanTitle),
          isEarningsResult: earningsRegex.test(cleanTitle),
          isPromoterAction: blockDealRegex.test(cleanTitle)
        };
      });

      // Deduplicate newNews internally based on ID
      const uniqueNewNews = Array.from(new Map(newNews.map(item => [item.id, item])).values());

      const isFirstFetch = this.newsCache.length === 0;
      let newTweets = uniqueNewNews.filter(n => !this.newsCache.find(old => old.id === n.id));

      // Combine old cache with new tweets, deduplicate again to be absolutely safe, and keep top 100
      let combinedNews = [...newTweets, ...this.newsCache]
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        
      combinedNews = Array.from(new Map(combinedNews.map(item => [item.id, item])).values()).slice(0, 100);
        
      this.newsCache = combinedNews;

      // Push full snapshot instantly!
      this.emit('news:update');

      // Emit news alerts IMMEDIATELY so the UI flashes without waiting for AI
      if (!isFirstFetch && newTweets.length > 0) {
        const now = Date.now();
        const FIVE_MINUTES_MS = 5 * 60 * 1000;
        
        newTweets.forEach(news => {
          const tweetTime = new Date(news.pubDate).getTime();
          if (now - tweetTime < FIVE_MINUTES_MS) {
            this.emit('news:alert', { ...news, alertType: 'NEWS' });
          }
        });
      }

      // Run AI in the background asynchronously
      if (newTweets.length > 0) {
        this.enrichWithAI(newTweets).catch(err => logger.error("Background AI failed:", err));
      }

    } catch (error) {
      logger.error('Error in fetchTweets:', error instanceof Error ? error.message : String(error));
    } finally {
      this.isFetching = false;
    }
  }

  private async enrichWithAI(tweetsToEnrich: NewsItem[]) {
    try {
      const headlines = tweetsToEnrich.map(t => t.title);
      const aiResults = await aiService.analyzeNewsBatch(headlines);
      
      let updatedAny = false;

      tweetsToEnrich.forEach((tweet, index) => {
        const res = aiResults[index];
        if (res) {
          const cachedTweet = this.newsCache.find(n => n.id === tweet.id);
          if (cachedTweet) {
            let s = (res.sentiment || 'Neutral').toString().trim().toLowerCase();
            if (s.includes('bull') || s.includes('pos') || s.includes('up') || s.includes('buy')) s = 'Bullish';
            else if (s.includes('bear') || s.includes('neg') || s.includes('down') || s.includes('sell')) s = 'Bearish';
            else s = 'Neutral';

            cachedTweet.sentiment = s as 'Bullish' | 'Bearish' | 'Neutral';
            cachedTweet.affectedStocks = res.affectedStocks || [];
            cachedTweet.reasoning = res.reasoning;
            cachedTweet.perspective = res.perspective;
            updatedAny = true;
          }
        }
      });

      if (updatedAny) {
        this.emit('news:update');
      }
    } catch (e) {
      logger.error("Failed to process background batch sentiment:", e);
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

    let tickCount = 0;
    // Poll every interval
    setInterval(() => {
      tickCount++;
      if (this.isIndianMarketOpen()) {
        this.fetchTweets();
      } else {
        // Outside market hours, refresh every 5 cycles (5 mins) or if cache is empty
        if (this.newsCache.length === 0 || tickCount % 5 === 0) {
          this.fetchTweets();
        }
      }
    }, this.POLL_INTERVAL);
  }
}

export const newsService = new NewsService();
