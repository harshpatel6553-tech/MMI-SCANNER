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
        
        // Helper to deeply find an array of tweets in the unknown RapidAPI JSON structure
        const findTweetArray = (obj: any): any[] => {
          if (!obj || typeof obj !== 'object') return [];
          if (Array.isArray(obj)) return obj.length > 0 ? obj : [];
          
          // First check known Twitter paths
          const known = obj.data?.user?.result?.timeline?.timeline?.instructions?.[1]?.entries
                     || obj.data?.user?.result?.timeline_v2?.timeline?.instructions?.find((i: any) => i.type === 'TimelineAddEntries')?.entries
                     || obj.timeline
                     || obj.tweets
                     || obj.data?.tweets;
          if (Array.isArray(known) && known.length > 0) return known;

          // Recursively search for any array that looks like it contains tweets
          for (const val of Object.values(obj)) {
            if (Array.isArray(val) && val.length > 0) return val;
            if (val && typeof val === 'object') {
              const found = findTweetArray(val);
              if (found.length > 0) return found;
            }
          }
          return [];
        };

        const items = findTweetArray(raw);
        
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
