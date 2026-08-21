import logger from '../utils/logger.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'twitter-x-api8.p.rapidapi.com';

class TwitterService {
  private tweetCache = new Map<string, { data: any; timestamp: number }>();
  private idCache = new Map<string, string>(); // caches username -> userId
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; 

  /**
   * Resolves a Twitter username (handle) to their numeric User ID using the API.
   * We cache this permanently in memory to save API calls.
   */
  async getUserId(username: string): Promise<string | null> {
    const cachedId = this.idCache.get(username);
    if (cachedId) return cachedId;

    try {
      const response = await fetch(`https://${RAPIDAPI_HOST}/user/about?username=${username}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      
      // Standard RapidAPI Twitter formats usually return the ID in user.id, user.rest_id, or data.user.rest_id
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
      logger.error(`Failed to resolve username ${username} to ID`, err);
      return null;
    }
  }

  /**
   * Fetches tweets for a specific numeric user ID.
   */
  async getUserTweets(userId: string): Promise<any> {
    if (!RAPIDAPI_KEY) {
      return { error: 'RAPIDAPI_KEY missing in .env' };
    }

    const cached = this.tweetCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const response = await fetch(`https://${RAPIDAPI_HOST}/user/tweets?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      this.tweetCache.set(userId, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      logger.error(`Failed to fetch tweets for ${userId}`, error);
      return { error: 'Failed to fetch tweets' };
    }
  }

  /**
   * Helper that resolves the username first, then fetches tweets.
   */
  async getTweetsByUsername(username: string): Promise<any> {
    if (!RAPIDAPI_KEY) return { error: 'RAPIDAPI_KEY missing in .env' };

    const userId = await this.getUserId(username);
    if (!userId) return { error: `Could not resolve user ID for ${username}` };

    return this.getUserTweets(userId);
  }
}

export const twitterService = new TwitterService();
