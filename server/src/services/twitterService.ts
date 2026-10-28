import { XMLParser } from 'fast-xml-parser';
import logger from '../utils/logger.js';
import { configService } from '../services/configService.js';

const RAPIDAPI_HOST = 'twitter-x-api8.p.rapidapi.com';

class TwitterService {
  private readonly DEFAULT_RAPIDAPI_KEY = 'edd35e9e16msh30e58d06cb73f85p1109d5jsn72745dbe1e48';
  private xmlParser = new XMLParser();
  private rssCache = new Map<string, { data: any; timestamp: number }>();
  private readonly RSS_CACHE_TTL_MS = 20 * 1000; // 20s cache to prevent hammering

  private get TWITTERAPI_IO_KEY(): string | undefined {
    const envKey = process.env.TWITTERAPI_KEY || process.env.TWITTERAPI_IO_KEY;
    if (envKey && envKey.trim().startsWith('new1_')) return envKey.trim();
    const cfgKey = configService.getKey('TWITTERAPI_KEY') || configService.getKey('TWITTERAPI_IO_KEY');
    if (cfgKey && cfgKey.trim().startsWith('new1_')) return cfgKey.trim();
    return undefined;
  }

  private get RAPIDAPI_KEY(): string | undefined {
    const envKey = process.env.RAPIDAPI_KEY;
    if (envKey && envKey !== 'test' && envKey.trim().length > 10 && !envKey.trim().startsWith('new1_')) {
      return envKey.trim();
    }
    const cfgKey = configService.getKey('RAPIDAPI_KEY');
    if (cfgKey && cfgKey !== 'test' && cfgKey.trim().length > 10 && !cfgKey.trim().startsWith('new1_')) {
      return cfgKey.trim();
    }
    return this.DEFAULT_RAPIDAPI_KEY;
  }

  private tweetCache = new Map<string, { data: any; timestamp: number }>();
  private idCache = new Map<string, string>([
    ['RedboxIndia', '1092883822473924608'],
    ['yatinmota', '1933369219']
  ]); // caches username -> userId
  private readonly CACHE_TTL_MS = 0; // Caching disabled: always fetch fresh data 

  private extractFullTweetText(item: any): string {
    let rawDesc = item.description || '';
    if (typeof rawDesc !== 'string') rawDesc = String(rawDesc || '');

    // Strip HTML and clean entities from RSS description to get untruncated tweet text
    let clean = rawDesc
      .replace(/<img[^>]*>/gi, '')
      .replace(/<br\s*[\/]?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    // If clean description is available, it has the untruncated full tweet text
    if (clean && clean.length > 0) {
      if (title.length > clean.length && !title.endsWith('…') && !title.endsWith('...')) {
        return title;
      }
      return clean;
    }
    return title;
  }

  /**
   * Open-Source RSS fetcher (Fixupx / FixTweet)
   * 100% Free, NO API keys required, NO monthly limits, real-time live tweets.
   */
  async getTweetsFromRss(username: string): Promise<any> {
    const cached = this.rssCache.get(username);
    if (cached && Date.now() - cached.timestamp < this.RSS_CACHE_TTL_MS) {
      return cached.data;
    }

    const endpoints = [
      `https://fixupx.com/${encodeURIComponent(username)}/feed.xml`,
      `https://fxtwitter.com/${encodeURIComponent(username)}/feed.xml`
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
          }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          continue;
        }

        const xml = await response.text();
        if (!xml || !xml.includes('<rss')) {
          continue;
        }

        const parsed = this.xmlParser.parse(xml);
        const rawItems = parsed?.rss?.channel?.item || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];

        if (items.length === 0) {
          continue;
        }

        const tweets = items.map((item: any) => {
          const link = item.link || item.guid || '';
          const idMatch = String(link).match(/status\/(\d+)/);
          const id_str = idMatch ? idMatch[1] : '';
          const text = this.extractFullTweetText(item);
          return {
            id: id_str,
            id_str: id_str,
            text: text,
            full_text: text,
            created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            link: link,
            _sourceAccount: username
          };
        }).filter((t: any) => t.full_text && t.full_text.length > 0);

        if (tweets.length > 0) {
          const result = { tweets };
          this.rssCache.set(username, { data: result, timestamp: Date.now() });
          logger.info(`✨ Open-Source Engine: Fetched ${tweets.length} real-time tweets for @${username}`);
          return result;
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          logger.warn(`RSS attempt failed for ${username} on ${url}: ${err.message || err}`);
        }
      }
    }

    return null;
  }

  /**
   * Fetch from twitterapi.io directly when a new1_ key is provided
   */
  async getTweetsFromTwitterApiIo(username: string): Promise<any> {
    const apiKey = this.TWITTERAPI_IO_KEY;
    if (!apiKey) return null;

    try {
      const url = `https://api.twitterapi.io/twitter/user/last_tweets?userName=${encodeURIComponent(username)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      clearTimeout(timeoutId);

      if (response.status === 402) {
        logger.error(`❌ twitterapi.io: Account has insufficient credits. Please recharge your account at twitterapi.io.`);
        return { error: 'Insufficient credits on twitterapi.io (HTTP 402). Please recharge.' };
      }

      if (!response.ok) {
        const text = await response.text();
        logger.warn(`twitterapi.io returned status ${response.status} for ${username}: ${text}`);
        return { error: `twitterapi.io error ${response.status}: ${text}` };
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.warn(`twitterapi.io timeout for ${username}`);
      } else {
        logger.error(`Failed to fetch from twitterapi.io for ${username}: ${err.message || err}`);
      }
      return null;
    }
  }

  /**
   * Resolves a Twitter username (handle) to their numeric User ID using RapidAPI.
   */
  async getUserId(username: string): Promise<string | null> {
    const cachedId = this.idCache.get(username);
    if (cachedId) return cachedId;

    const apiKey = this.RAPIDAPI_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch(`https://${RAPIDAPI_HOST}/user/about?username=${username}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      
      const id = data?.user?.rest_id 
              || data?.user?.id 
              || data?.data?.user?.rest_id 
              || data?.data?.user?.id 
              || data?.user_id 
              || data?.id 
              || data?.rest_id 
              || data?.data?.id
              || data?.result?.rest_id
              || data?.data?.user?.result?.rest_id
              || data?.data?.user?.result?.id;
      
      if (id) {
        this.idCache.set(username, id);
        return id;
      }
      return null;
    } catch (err) {
      logger.error(`Failed to resolve username ${username} to ID via RapidAPI`, err);
      return null;
    }
  }

  /**
   * Fetches tweets for a specific numeric user ID via RapidAPI.
   */
  async getUserTweets(userId: string): Promise<any> {
    const apiKey = this.RAPIDAPI_KEY;
    if (!apiKey) {
      return { error: 'RAPIDAPI_KEY missing in settings' };
    }

    const cached = this.tweetCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`https://${RAPIDAPI_HOST}/user/tweets?user_id=${userId}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type': 'application/json'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      this.tweetCache.set(userId, { data, timestamp: Date.now() });
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.warn(`RapidAPI Twitter timeout (10s) for ${userId}. Skipping this cycle.`);
      } else {
        logger.error(`Failed to fetch tweets for ${userId} via RapidAPI: ${error.message || error}`);
      }
      return { error: 'Failed to fetch tweets' };
    }
  }

  /**
   * Unified method:
   * 1. Prioritizes 100% Free Open-Source RSS engine (FixTweet/Fixupx) - NO limit, NO API keys
   * 2. Falls back to twitterapi.io if key is configured
   * 3. Falls back to RapidAPI if key is configured
   */
  async getTweetsByUsername(username: string): Promise<any> {
    // 1. Open-Source Engine (Fixupx / FixTweet RSS) - Zero limits, zero cost, real-time
    const rssResult = await this.getTweetsFromRss(username);
    if (rssResult && rssResult.tweets && rssResult.tweets.length > 0) {
      return rssResult;
    }

    // 2. If twitterapi.io key is configured and RSS had an issue, try twitterapi.io
    if (this.TWITTERAPI_IO_KEY) {
      const ioResult = await this.getTweetsFromTwitterApiIo(username);
      if (ioResult && !ioResult.error) {
        return ioResult;
      }
    }

    // 3. Otherwise fall back to RapidAPI
    const userId = await this.getUserId(username);
    if (userId) {
      return this.getUserTweets(userId);
    }

    return { error: `Could not resolve or fetch tweets for ${username}` };
  }
}

export const twitterService = new TwitterService();
export default twitterService;
