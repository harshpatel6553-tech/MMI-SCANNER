import { Router } from 'express';
import { nseScraperService } from '../services/nseScraperService.js';

const router = Router();

router.get('/bulk', (req, res) => {
  try {
    const data = nseScraperService.getCachedDeals();
    res.json({
      status: 'success',
      data: data.deals,
      lastUpdated: data.lastUpdated
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch bulk deals' });
  }
});

// Force a manual refresh (optional)
router.post('/refresh', async (req, res) => {
  try {
    await nseScraperService.fetchDeals();
    const data = nseScraperService.getCachedDeals();
    res.json({
      status: 'success',
      message: 'Deals refreshed successfully',
      data: data.deals,
      lastUpdated: data.lastUpdated
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
