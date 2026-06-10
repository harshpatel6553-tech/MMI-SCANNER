import { Router, Request, Response } from 'express';
import { newsService } from '../services/newsService.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
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
