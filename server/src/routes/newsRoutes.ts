import { Router, Request, Response } from 'express';
import { newsService } from '../services/newsService.js';

const router = Router();

import { twitterService } from '../services/twitterService.js';

router.get('/', async (req: Request, res: Response) => {
  try {
    const hasKeys = !!(process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY || process.env.TWITTER_API_KEY);
    
    if (!hasKeys) {
      return res.status(503).json({
        success: false,
        error: 'RAPIDAPI_KEY is missing in .env! Please add it to fetch live news.',
      });
    }

    // Fetch from the new Twitter service (using user_id 44196397 or any other you prefer)
    // The frontend expects the data to be in NewsItem format
    const rawTweets = await twitterService.getUserTweets('44196397');
    
    if (rawTweets.error) {
      return res.status(500).json({ success: false, error: rawTweets.error });
    }
    
    // Map RapidAPI raw tweet format to our frontend NewsItem format
    const mappedNews = (rawTweets.data?.user?.result?.timeline?.timeline?.instructions?.[1]?.entries || rawTweets.data || rawTweets || []).map((t: any, index: number) => {
      // RapidAPI twitter-x-api8 returns deeply nested structures or flat arrays depending on the exact path
      // We do a best-effort mapping here
      const text = t.text || t.full_text || t.content?.itemContent?.tweet_results?.result?.legacy?.full_text || 'Breaking News Update';
      const date = t.created_at || t.content?.itemContent?.tweet_results?.result?.legacy?.created_at || new Date().toISOString();
      
      return {
        id: t.id_str || t.id || `tweet-${index}`,
        title: text,
        link: `https://twitter.com/x/status/${t.id_str || t.id || ''}`,
        pubDate: date,
        source: 'Twitter',
        sentiment: 'Neutral'
      };
    });

    res.json({
      success: true,
      data: mappedNews.filter((n: any) => n.title !== 'Breaking News Update'),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve news',
    });
  }
});

export const newsRoutes = router;
