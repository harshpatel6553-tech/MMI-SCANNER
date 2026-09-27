import { Router, Request, Response } from 'express';
import { newsService } from '../services/newsService.js';

const router = Router();

import { twitterService } from '../services/twitterService.js';

router.get('/', async (req: Request, res: Response) => {
  try {
    let news = newsService.getLatestNews();
    if (news.length === 0) {
      await newsService.fetchTweets();
      news = newsService.getLatestNews();
    }
    
    res.json({
      success: true,
      data: news,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve news',
    });
  }
});

export const newsRoutes = router;
