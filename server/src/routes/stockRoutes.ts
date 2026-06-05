/**
 * @module stockRoutes
 * @description Express REST API routes for the stock screener.
 * Provides endpoints for cached stock data, individual stock lookup,
 * alert retrieval, and server health checks.
 */

import { Router, type Request, type Response } from 'express';
import { stockService } from '../services/stockService.js';
import { alertService } from '../services/alertService.js';
import type { StockData } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

/** Valid sort fields for the stock listing endpoint */
type SortField = 'symbol' | 'price' | 'change' | 'changePercent' | 'volume';

/** Valid sort directions */
type SortOrder = 'asc' | 'desc';

/**
 * GET /api/stocks
 *
 * Returns cached stock data with support for filtering, searching, and sorting.
 *
 * Query Parameters:
 * - `index` — Filter by index: NIFTY50 | NIFTY500 | ALL (default: ALL)
 * - `priceMin` — Minimum price filter (₹)
 * - `priceMax` — Maximum price filter (₹)
 * - `volumeMin` — Minimum volume filter
 * - `changePercentMin` — Minimum change percent filter
 * - `changePercentMax` — Maximum change percent filter
 * - `search` — Free-text search against symbol or company name (case-insensitive)
 * - `sort` — Sort field: symbol | price | change | changePercent | volume (default: symbol)
 * - `order` — Sort direction: asc | desc (default: asc)
 */
router.get('/stocks', (req: Request, res: Response): void => {
  try {
    let stocks = stockService.getCachedStocks();

    // ── Index filter ───────────────────────────────────────────
    const indexFilter = (req.query.index as string)?.toUpperCase();
    if (indexFilter && indexFilter !== 'ALL') {
      stocks = stocks.filter((s) => s.indexName === indexFilter);
    }

    // ── Price range filter ─────────────────────────────────────
    const priceMin = parseFloat(req.query.priceMin as string);
    if (!isNaN(priceMin)) {
      stocks = stocks.filter((s) => s.price >= priceMin);
    }

    const priceMax = parseFloat(req.query.priceMax as string);
    if (!isNaN(priceMax)) {
      stocks = stocks.filter((s) => s.price <= priceMax);
    }

    // ── Volume filter ──────────────────────────────────────────
    const volumeMin = parseFloat(req.query.volumeMin as string);
    if (!isNaN(volumeMin)) {
      stocks = stocks.filter((s) => s.volume >= volumeMin);
    }

    // ── Change percent range filter ────────────────────────────
    const changePercentMin = parseFloat(req.query.changePercentMin as string);
    if (!isNaN(changePercentMin)) {
      stocks = stocks.filter((s) => s.changePercent >= changePercentMin);
    }

    const changePercentMax = parseFloat(req.query.changePercentMax as string);
    if (!isNaN(changePercentMax)) {
      stocks = stocks.filter((s) => s.changePercent <= changePercentMax);
    }

    // ── Free-text search ───────────────────────────────────────
    const search = (req.query.search as string)?.trim().toLowerCase();
    if (search) {
      stocks = stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(search) ||
          s.name.toLowerCase().includes(search)
      );
    }

    // ── Sorting ────────────────────────────────────────────────
    const validSortFields: SortField[] = [
      'symbol',
      'price',
      'change',
      'changePercent',
      'volume',
    ];
    const sortField = validSortFields.includes(req.query.sort as SortField)
      ? (req.query.sort as SortField)
      : 'symbol';
    const sortOrder: SortOrder =
      (req.query.order as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    stocks.sort((a: StockData, b: StockData) => {
      let comparison: number;

      if (sortField === 'symbol') {
        comparison = a.symbol.localeCompare(b.symbol);
      } else {
        comparison = (a[sortField] as number) - (b[sortField] as number);
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    res.json({
      success: true,
      count: stocks.length,
      data: stocks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`GET /api/stocks error: ${message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching stocks',
    });
  }
});

/**
 * GET /api/stocks/:symbol
 *
 * Returns cached data for a single stock by its NSE symbol.
 * Returns 404 if the stock is not found in the cache.
 */
router.get('/stocks/:symbol', (req: Request, res: Response): void => {
  try {
    const symbol = req.params.symbol?.toUpperCase();

    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbol parameter is required',
      });
      return;
    }

    const stock = stockService.getCachedStock(symbol);

    if (!stock) {
      res.status(404).json({
        success: false,
        error: `Stock '${symbol}' not found in cache. It may not have been fetched yet.`,
      });
      return;
    }

    res.json({
      success: true,
      data: stock,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`GET /api/stocks/${req.params.symbol} error: ${message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching stock',
    });
  }
});

/**
 * GET /api/alerts
 *
 * Returns recent stock price alerts (day-high/day-low transitions).
 *
 * Query Parameters:
 * - `limit` — Maximum number of alerts to return (default: 100, max: 500)
 */
router.get(
  '/alerts',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limitParam = parseInt(req.query.limit as string, 10);
      const limit = isNaN(limitParam)
        ? 100
        : Math.min(Math.max(limitParam, 1), 500);

      const alerts = await alertService.getRecentAlerts(limit);

      res.json({
        success: true,
        count: alerts.length,
        data: alerts,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`GET /api/alerts error: ${message}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching alerts',
      });
    }
  }
);

/**
 * GET /api/health
 *
 * Server health check endpoint. Returns current status, uptime,
 * stock cache size, and server timestamp.
 */
router.get('/health', (_req: Request, res: Response): void => {
  try {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      stockCount: stockService.getCacheSize(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`GET /api/health error: ${message}`);
    res.status(500).json({
      status: 'error',
      error: message,
    });
  }
});

export default router;
