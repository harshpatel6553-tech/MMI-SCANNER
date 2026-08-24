import { Router, Request, Response } from 'express';
import { newsService } from '../services/newsService.js';

const router = Router();

import { twitterService } from '../services/twitterService.js';

router.get('/', async (req: Request, res: Response) => {
  try {
    const hasKeys = true;
    
    if (!hasKeys) {
      return res.status(503).json({
        success: false,
        error: 'RAPIDAPI_KEY is missing in .env! Please add it to fetch live news.',
      });
    }

    const news = newsService.getLatestNews();
    
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
