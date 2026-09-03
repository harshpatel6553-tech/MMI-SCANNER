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

/**
 * GET /api/agent-memory
 * 
 * Dumps the entire internal state of the Alert Agent to prove it is 
 * actively monitoring all stocks.
 */
router.get(
  '/agent-memory',
  (req: Request, res: Response) => {
    const memory = alertService.getAgentDiagnostics();
    const count = alertService.getTrackedSymbolCount();
    
    // Enrich with live price data to prove it is ticking every 3 seconds
    const enrichedMemory = memory.map(s => {
      const live = stockService.getCachedStock(s.symbol);
      return {
        ...s,
        currentPrice: live ? live.price : 0,
        dayHigh: live ? live.dayHigh : s.highestPriceAgentHasSeenToday,
        dayLow: live ? live.dayLow : s.lowestPriceAgentHasSeenToday,
      };
    });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Agent Memory Diagnostics</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="3"> <!-- Auto refresh every 3s -->
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; background: #0b0b0d; color: #fff; padding: 20px; max-width: 1400px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 14px 12px; text-align: left; border-bottom: 1px solid #222; }
          th { background: #111; color: #888; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
          tr:hover { background: #151515; }
          .high { color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 4px; }
          .low { color: #ef4444; font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px; }
          .search { width: 100%; padding: 16px; background: #111; border: 1px solid #333; color: white; border-radius: 8px; font-size: 16px; margin-bottom: 20px; outline: none; box-sizing: border-box; }
          .search:focus { border-color: #da7f63; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
          h2 { margin: 0; font-weight: 500; display: flex; align-items: center; gap: 12px; }
          .live-dot { height: 12px; width: 12px; background-color: #10b981; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2><span class="live-dot"></span> 🧠 Agent Internal Memory</h2>
          <div style="background: #111; padding: 10px 20px; border-radius: 30px; border: 1px solid #333;">
             Actively Tracking <b style="color: #fff; margin-left: 4px;">${count} Stocks</b>
          </div>
        </div>
        
        <input type="text" id="search" class="search" placeholder="Search for a stock symbol (e.g. BSE)..." onkeyup="filter()">
        
        <table id="memoryTable">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Live Status</th>
              <th>Current Live Price</th>
              <th>Actual Day High</th>
              <th>Actual Day Low</th>
              <th>Agent's Peak Tracking</th>
              <th>Last Alert Triggered</th>
            </tr>
          </thead>
          <tbody>
            ${enrichedMemory.map(s => `
              <tr>
                <td style="font-weight: 600; font-size: 15px;">${s.symbol}</td>
                <td>
                  ${s.isCurrentlyAtHigh ? '<span class="high">🚀 AT DAY HIGH</span>' : ''}
                  ${s.isCurrentlyAtLow ? '<span class="low">🩸 AT DAY LOW</span>' : ''}
                  ${!s.isCurrentlyAtHigh && !s.isCurrentlyAtLow ? '<span style="color: #555;">Watching...</span>' : ''}
                </td>
                <td style="color: #fff; font-weight: bold; font-size: 16px;">₹${s.currentPrice.toFixed(2)}</td>
                <td style="color: #10b981;">₹${s.dayHigh.toFixed(2)}</td>
                <td style="color: #ef4444;">₹${s.dayLow.toFixed(2)}</td>
                <td style="color: #666; font-size: 12px;">Peak High: ₹${s.highestPriceAgentHasSeenToday.toFixed(2)}<br>Peak Low: ₹${s.lowestPriceAgentHasSeenToday.toFixed(2)}</td>
                <td style="color: #777;">${s.lastAlertTime > 0 ? new Date(s.lastAlertTime).toLocaleTimeString('en-IN') : 'None yet today'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          // Save scroll position for the auto-refresh
          document.addEventListener("DOMContentLoaded", function(event) { 
            var scrollpos = localStorage.getItem('scrollpos');
            if (scrollpos) window.scrollTo(0, scrollpos);
            
            // Restore search term
            var searchpos = localStorage.getItem('searchpos');
            if (searchpos) {
              document.getElementById("search").value = searchpos;
              filter();
            }
          });

          window.onbeforeunload = function(e) {
            localStorage.setItem('scrollpos', window.scrollY);
            localStorage.setItem('searchpos', document.getElementById("search").value);
          };

          function filter() {
            var input = document.getElementById("search");
            var filter = input.value.toUpperCase();
            var table = document.getElementById("memoryTable");
            var tr = table.getElementsByTagName("tr");
            for (var i = 1; i < tr.length; i++) {
              var td = tr[i].getElementsByTagName("td")[0];
              if (td) {
                var txtValue = td.textContent || td.innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                  tr[i].style.display = "";
                } else {
                  tr[i].style.display = "none";
                }
              }       
            }
          }
        </script>
      </body>
      </html>
    `;
    res.send(html);
  }
);

export default router;
