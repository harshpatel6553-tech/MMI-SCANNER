import logger from '../utils/logger.js';

// Reads the key from your .env file
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'twitter-x-api8.p.rapidapi.com';

class TwitterService {
  // 15-minute cache to prevent you from using up all your RapidAPI quota instantly!
  private cache: { data: any; timestamp: number } | null = null;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; 

  async getUserTweets(userId: string): Promise<any> {
    if (!RAPIDAPI_KEY) {
      logger.warn('RAPIDAPI_KEY is not set in .env! Returning empty Twitter data.');
      return { error: 'RAPIDAPI_KEY missing in .env' };
    }

    // Return cached data if available
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL_MS) {
      logger.debug(`Serving Twitter data for ${userId} from cache.`);
      return this.cache.data;
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

      if (!response.ok) {
        throw new Error(`Twitter API returned ${response.status}`);
      }

      const data = await response.json();
      
      // Save successful response to cache
      this.cache = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      logger.error('Failed to fetch from Twitter RapidAPI', error);
      return { error: 'Failed to fetch tweets' };
    }
  }
}

export const twitterService = new TwitterService();
