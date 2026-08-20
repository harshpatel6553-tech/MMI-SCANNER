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

    // Fetch from the market news accounts using their usernames!
    const accounts = ['RedboxIndia', 'yatinmota'];
    
    const results = await Promise.all(
      accounts.map(async (username) => {
        const raw = await twitterService.getTweetsByUsername(username);
        if (raw.error) return [];
        
        // Extract array of tweet objects
        let items = raw.data?.user?.result?.timeline?.timeline?.instructions?.[1]?.entries || raw.data || raw || [];
        
        // Ensure items is actually an array to prevent "items.map is not a function" crashes
        if (!Array.isArray(items)) {
           // Fallback for different API response structures
           if (items && typeof items === 'object') {
              items = Object.values(items).find(v => Array.isArray(v)) || [];
           } else {
              items = [];
           }
        }
        
        return items.map((t: any, index: number) => {
          const text = t.text || t.full_text || t.content?.itemContent?.tweet_results?.result?.legacy?.full_text || 'Breaking News Update';
          const date = t.created_at || t.content?.itemContent?.tweet_results?.result?.legacy?.created_at || new Date().toISOString();
          return {
            id: t.id_str || t.id || `${username}-${index}`,
            title: text,
            link: `https://twitter.com/${username}/status/${t.id_str || t.id || ''}`,
            pubDate: date,
            source: `@${username}`,
            sentiment: 'Neutral'
          };
        }).filter((n: any) => n.title !== 'Breaking News Update');
      })
    );
    
    // Merge all tweets and sort by date descending (newest first)
    const mergedNews = results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    res.json({
      success: true,
      data: mergedNews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve news',
    });
  }
});

export const newsRoutes = router;
