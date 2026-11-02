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
  isPromoterAction?: boolean;
}

export function isAllowedSource(source?: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase().replace('@', '').trim();
  return s === 'redboxindia' || s === 'yatinmota';
}

const BLACKLISTED_TITLE_PATTERNS = [
  /outlook\s*(&|and)?\s*prediction/i,
  /stock market this week/i,
  /market this week/i,
  /weekly market/i,
  /technical analysis/i,
  /share market (live|news|today)/i,
  /open(s|ed)? flat/i,
  /end(s|ed)? flat/i,
  /amid selling in/i,
  /among \d+ companies/i,
  /nifty (may|could|will|prediction)/i,
  /prediction/i,
  /market watch/i,
  /top stocks to buy/i,
  /stocks in focus/i,
  /trading guide/i,
  /expert advice/i,
  /brokerage radar/i,
];

export function isNoisyOrBlacklisted(item: { source?: string; title?: string; full_text?: string }): boolean {
  if (!isAllowedSource(item.source)) return true;
  const text = (item.title || item.full_text || '').toLowerCase();
  for (const pattern of BLACKLISTED_TITLE_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

class NewsService extends EventEmitter {
  private newsCache: NewsItem[] = [];
  private isPolling = false;
  private readonly POLL_INTERVAL = 25 * 1000; // 25 seconds for reliable real-time updates without rate limits

  constructor() {
    super();
    this.startPolling();
  }

  public getLatestNews(): NewsItem[] {
    return this.newsCache.filter(item => isAllowedSource(item.source) && !isNoisyOrBlacklisted(item));
  }

  private isFetching = false;

  private computeQuickSentiment(title: string): 'Bullish' | 'Bearish' | 'Neutral' {
    if (/\b(surge|jumps?|rall(?:y|ies)|gains?|beats?|rises?|profit up|record high|bullish|buy|upgrade|positive|expansion|orders? won|contract won|strong growth)\b/i.test(title)) {
      return 'Bullish';
    }
    if (/\b(plunges?|falls?|drops?|slumps?|miss(?:es)?|loss|profit down|bearish|sell|downgrade|probe|fraud|penalty|crackdown|warning|cut|resign|resigns)\b/i.test(title)) {
      return 'Bearish';
    }
    return 'Neutral';
  }

  private extractAffectedStocks(title: string): string[] {
    const matched = new Set<string>();

    // 1. Prefix ticker before colon (e.g. "CRAFTSMAN: Q2...", "BAJAJELEC: Q2...", "20MICRONS: Q2...", "VAKRANGEE: Q2...", "WAAREE: CO...")
    const prefixMatch = title.match(/^([A-Za-z0-9_\-\.]{2,15}):/i);
    if (prefixMatch) {
      const p = prefixMatch[1].toUpperCase();
      const STOP_TOKENS = new Set(['ALERT', 'BREAKING', 'UPDATE', 'NEWS', 'EXCLUSIVE', 'JUST IN', 'REPORT', 'SOURCE', 'WATCH', 'MARKET', 'NIFTY', 'SENSEX', 'REDBOXINDIA', 'YATINMOTA']);
      if (!STOP_TOKENS.has(p) && !/^\d+$/.test(p)) {
        matched.add(p);
      }
    }

    // 2. Explicit cashtags starting with a letter like $TECHM, $KPITTECH, $CRAFTSMAN (ignore currency like $4.20)
    const dollarMatches = title.match(/\$([A-Za-z][A-Za-z0-9_\-]{1,14})\b/g) || [];
    for (const m of dollarMatches) {
      const s = m.replace('$', '').toUpperCase();
      if (s.length >= 2 && s.length <= 15) {
        matched.add(s);
      }
    }

    // 3. Known Company Name / Aliases
    const ALIAS_MAP = [
      { re: /\b(PVR\s*INOX|PVR)\b/i, sym: 'PVRINOX' },
      { re: /\b(BAJAJ\s*ELECTRIC(?:ALS)?|BAJAJELEC)\b/i, sym: 'BAJAJELEC' },
      { re: /\b(UNITED\s*BREWERIES)\b/i, sym: 'UBL' },
      { re: /\b(UNITED\s*SPIRITS|MCDOWELL)\b/i, sym: 'UNITDSPR' },
      { re: /\b(KPIT\s*TECH(?:NOLOGIES)?)\b/i, sym: 'KPITTECH' },
      { re: /\b(CRAFTSMAN\s*(?:AUTOMATION)?)\b/i, sym: 'CRAFTSMAN' },
      { re: /\b(20\s*MICRONS|20MICRONS)\b/i, sym: '20MICRONS' },
      { re: /\b(VAKRANGEE)\b/i, sym: 'VAKRANGEE' },
      { re: /\b(WAAREE\s*(?:ENERGIES)?)\b/i, sym: 'WAAREEENER' },
      { re: /\b(BHARTI\s*AIRTEL|AIRTEL)\b/i, sym: 'BHARTIARTL' },
      { re: /\b(TATA\s*MOTORS)\b/i, sym: 'TATAMOTORS' },
      { re: /\b(TATA\s*STEEL)\b/i, sym: 'TATASTEEL' },
      { re: /\b(TATA\s*POWER)\b/i, sym: 'TATAPOWER' },
      { re: /\b(HDFC\s*BANK)\b/i, sym: 'HDFCBANK' },
      { re: /\b(ICICI\s*BANK)\b/i, sym: 'ICICIBANK' },
      { re: /\b(KOTAK\s*BANK)\b/i, sym: 'KOTAKBANK' },
      { re: /\b(AXIS\s*BANK)\b/i, sym: 'AXISBANK' },
      { re: /\b(STATE\s*BANK\s*OF\s*INDIA|SBI)\b/i, sym: 'SBIN' },
      { re: /\b(ASIAN\s*PAINTS?)\b/i, sym: 'ASIANPAINT' },
      { re: /\b(SUN\s*PHARMA)\b/i, sym: 'SUNPHARMA' },
      { re: /\b(MARUTI\s*SUZUKI)\b/i, sym: 'MARUTI' },
      { re: /\b(RELIANCE\s*(?:IND|INDUSTRIES)?|RIL)\b/i, sym: 'RELIANCE' },
      { re: /\b(LARSEN\s*(&|AND)?\s*TOUBRO|L&T)\b/i, sym: 'LT' },
    ];

    for (const alias of ALIAS_MAP) {
      if (alias.re.test(title)) {
        matched.add(alias.sym);
      }
    }

    // 4. Common symbols check - avoiding common English words
    const COMMON_SYMBOLS = [
      'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
      'ITC', 'KOTAKBANK', 'LT', 'AXISBANK', 'HINDUNILVR', 'BAJFINANCE', 'MARUTI',
      'TATASTEEL', 'WIPRO', 'TITAN', 'TATAMOTORS', 'TMPV', 'TMCV', 'ADANIENT',
      'ADANIPORTS', 'NTPC', 'POWERGRID', 'SUNPHARMA', 'JSWSTEEL', 'TECHM',
      'ASIANPAINT', 'ZOMATO', 'PAYTM', 'JIOFIN', 'VEDL', 'HAL', 'BEL', 'BSE',
      'CDSL', 'IRCTC', 'SUZLON'
    ];

    const tUpper = title.toUpperCase();
    for (const sym of COMMON_SYMBOLS) {
      if (new RegExp(`\\b${sym}\\b`).test(tUpper)) {
        matched.add(sym);
      }
    }

    return Array.from(matched).slice(0, 4);
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

      // Use the centralized twitterService that handles open-source RSS and API endpoints
      const { twitterService } = await import('./twitterService.js');

      const fetchPromises = accountsToFollow.map(async (username) => {
        try {
          const raw = await twitterService.getTweetsByUsername(username);
          if (raw.error) {
            logger.warn(`Twitter fetch error for ${username}: ${raw.error}`);
            return [];
          }

          // Helper to deeply find an array of tweets in RapidAPI/RSS JSON structure
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
               const date = t.createdAt || t.created_at || t.content?.itemContent?.tweet_results?.result?.legacy?.created_at || new Date().toISOString();
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

      // Strictly allow ONLY @RedboxIndia and @yatinmota
      allFetchedTweets = allFetchedTweets.filter(item => isAllowedSource(item._sourceAccount) && !isNoisyOrBlacklisted({
        source: item._sourceAccount,
        title: item.full_text
      }));

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
        const deterministicId = item.id_str ? 'tweet-' + item.id_str : 'msg-' + Buffer.from(titleHashStr + item._sourceAccount).toString('hex');
        
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

      // Deduplicate newNews internally based on ID and filter noise
      const uniqueNewNews = Array.from(new Map(newNews.map(item => [item.id, item])).values())
        .filter(item => isAllowedSource(item.source) && !isNoisyOrBlacklisted(item));

      // Clean existing cache of any previously stored non-whitelisted items
      this.newsCache = this.newsCache.filter(item => isAllowedSource(item.source) && !isNoisyOrBlacklisted(item));

      const isFirstFetch = this.newsCache.length === 0;
      let newTweets = uniqueNewNews.filter(n => !this.newsCache.find(old => old.id === n.id));

      // Combine old cache with new tweets, deduplicate again, and keep top 100
      let combinedNews = [...newTweets, ...this.newsCache]
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        
      combinedNews = Array.from(new Map(combinedNews.map(item => [item.id, item])).values())
        .filter(item => isAllowedSource(item.source) && !isNoisyOrBlacklisted(item))
        .slice(0, 100);
        
      this.newsCache = combinedNews;

      // Push full snapshot instantly!
      this.emit('news:update');

      // Emit news alerts ONLY for verified, actionable institutional market alpha
      if (!isFirstFetch && newTweets.length > 0) {
        const now = Date.now();
        const FIVE_MINUTES_MS = 5 * 60 * 1000;
        
        newTweets.forEach(news => {
          const tweetTime = new Date(news.pubDate).getTime();
          if (now - tweetTime < FIVE_MINUTES_MS) {
            // STRICT FILTER FOR ALERTS:
            // 1. Source MUST be RedboxIndia or yatinmota
            if (!isAllowedSource(news.source)) return;

            // 2. Reject noisy titles or blog summaries
            if (isNoisyOrBlacklisted(news)) return;

            // 3. Must be tangible company news / results / guidance / deals / catalysts
            const isHighSignal = news.isEarningsResult || 
                                 news.isPromoterAction || 
                                 (news.affectedStocks && news.affectedStocks.length > 0) ||
                                 /\b(guidance|order|contract|resigns?|resignation|ceo|md|cfo|chairman|acquisition|acquired|merger|dividend|bonus|split|approved|approval|usfda|fda|penalty|raid|sebi|cbi|default|insolvency|halt|circuit)\b/i.test(news.title);

            if (isHighSignal) {
              this.emit('news:alert', { ...news, alertType: 'NEWS' });
            }
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
            // Only adopt AI affected stocks if it found valid ones, without overwriting existing ticker prefix
            if (res.affectedStocks && res.affectedStocks.length > 0) {
              const combinedStocks = new Set([...(cachedTweet.affectedStocks || []), ...res.affectedStocks]);
              cachedTweet.affectedStocks = Array.from(combinedStocks).slice(0, 4);
            }
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
        // Outside market hours, refresh every 5 cycles (2 mins) or if cache is empty
        if (this.newsCache.length === 0 || tickCount % 5 === 0) {
          this.fetchTweets();
        }
      }
    }, this.POLL_INTERVAL);
  }
}

export const newsService = new NewsService();
