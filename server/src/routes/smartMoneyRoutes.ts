import { Router, Request, Response } from 'express';
import { smartMoneyService } from '../services/smartMoneyService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/smart-money/flow
 * Returns comprehensive Smart Money institutional fund flow snapshot
 */
router.get('/flow', (req: Request, res: Response) => {
  try {
    const data = smartMoneyService.getSmartMoneyFlow();
    res.json({
      status: 'success',
      data
    });
  } catch (error: any) {
    logger.error('smartMoneyRoutes: Failed to compute flow: ' + error.message);
    res.status(500).json({ status: 'error', message: 'Failed to compute smart money flow' });
  }
});

/**
 * GET /api/smart-money/accumulators
 * Returns stocks where institutional buyers are aggressively putting money
 */
router.get('/accumulators', (req: Request, res: Response) => {
  try {
    const data = smartMoneyService.getSmartMoneyFlow();
    res.json({
      status: 'success',
      count: data.topAccumulators.length,
      totalInflowCr: data.totalInstitutionalInflowCr,
      data: data.topAccumulators
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/smart-money/distributors
 * Returns stocks from where institutional buyers are actively removing funds
 */
router.get('/distributors', (req: Request, res: Response) => {
  try {
    const data = smartMoneyService.getSmartMoneyFlow();
    res.json({
      status: 'success',
      count: data.topDistributors.length,
      totalOutflowCr: data.totalInstitutionalOutflowCr,
      data: data.topDistributors
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/smart-money/sectors
 * Returns sector-by-sector institutional capital rotation
 */
router.get('/sectors', (req: Request, res: Response) => {
  try {
    const data = smartMoneyService.getSmartMoneyFlow();
    res.json({
      status: 'success',
      data: data.sectorRotation
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/smart-money/deals
 * Filterable NSE bulk & block deals with institutional classification
 */
router.get('/deals', (req: Request, res: Response) => {
  try {
    const data = smartMoneyService.getSmartMoneyFlow();
    let deals = data.recentBlockDeals;

    const type = req.query.type as string;
    const category = req.query.category as string;
    const search = req.query.search as string;
    const minVal = parseFloat(req.query.minVal as string);

    if (type) {
      deals = deals.filter(d => d.type.toUpperCase() === type.toUpperCase());
    }

    if (category) {
      deals = deals.filter(d => d.clientCategory.toUpperCase().includes(category.toUpperCase()));
    }

    if (search) {
      const q = search.toLowerCase();
      deals = deals.filter(d => d.symbol.toLowerCase().includes(q) || d.clientName.toLowerCase().includes(q));
    }

    if (!isNaN(minVal) && minVal > 0) {
      deals = deals.filter(d => d.valueCr >= minVal);
    }

    res.json({
      status: 'success',
      count: deals.length,
      data: deals
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
