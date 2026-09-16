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


// ══════════════════════════════════════════════════════════════
//  CHART ENDPOINTS — Used by TradePro Trading View app
// ══════════════════════════════════════════════════════════════

const USER_AGENT_CHART = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Map TradePro timeframe codes → Yahoo Finance interval + range */
const TF_TO_YAHOO: Record<string, { interval: string; range: string }> = {
  '1m':  { interval: '1m',  range: '1d'  },
  '5m':  { interval: '5m',  range: '5d'  },
  '15m': { interval: '15m', range: '1mo' },
  '1h':  { interval: '60m', range: '3mo' },
  '1D':  { interval: '1d',  range: '1y'  },
  '1W':  { interval: '1wk', range: '5y'  },
  '1M':  { interval: '1mo', range: 'max' },
};

const RANGE_TO_YAHOO: Record<string, string> = {
  '1D': '1d', '5D': '5d', '1M': '1mo', '3M': '3mo',
  '6M': '6mo', 'YTD': 'ytd', '1Y': '1y', 'ALL': 'max',
};

/**
 * GET /api/stocks/chart/:symbol
 *
 * Returns OHLCV candlestick data for the given symbol.
 *
 * Query params:
 *   - tf    : timeframe key — 1m | 5m | 15m | 1h | 1D | 1W | 1M  (default: 1D)
 *   - range : range override — 1D | 5D | 1M | 3M | 6M | YTD | 1Y | ALL
 *
 * Response:
 *   { symbol, interval, range, candles: [{time, open, high, low, close, volume}] }
 */
router.get('/chart/:symbol', async (req: Request, res: Response): Promise<void> => {
  const rawSymbol = (req.params.symbol as string).toUpperCase();
  // Accept both "RELIANCE" and "RELIANCE.NS"
  const yfSymbol = rawSymbol.endsWith('.NS') ? rawSymbol : `${rawSymbol}.NS`;

  const tf = (req.query.tf as string) || '1D';
  const rangeKey = req.query.range as string | undefined;

  const tfConfig = TF_TO_YAHOO[tf] || TF_TO_YAHOO['1D'];
  const range    = rangeKey ? (RANGE_TO_YAHOO[rangeKey] || tfConfig.range) : tfConfig.range;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=${tfConfig.interval}&range=${range}&includePrePost=false`;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT_CHART, 'Accept': 'application/json' },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Yahoo Finance returned HTTP ${upstream.status}` });
      return;
    }

    const data = await upstream.json() as any;
    const result = data?.chart?.result?.[0];
    if (!result) {
      res.status(404).json({ error: 'No data returned for symbol' });
      return;
    }

    const timestamps: number[] = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const candles = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null || isNaN(o)) continue;
      candles.push({
        time:   timestamps[i],
        open:   parseFloat(o.toFixed(2)),
        high:   parseFloat(h.toFixed(2)),
        low:    parseFloat(l.toFixed(2)),
        close:  parseFloat(c.toFixed(2)),
        volume: v || 0,
      });
    }

    res.json({
      symbol:   yfSymbol,
      interval: tfConfig.interval,
      range,
      candles,
    });
  } catch (err: any) {
    logger.error(`[chart] Failed for ${yfSymbol}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stocks/quote/:symbol
 *
 * Returns a single real-time quote using the Yahoo Spark v7 API
 * (same approach as the main screener).
 *
 * Response:
 *   { symbol, price, open, dayHigh, dayLow, previousClose,
 *     change, changePercent, volume, fiftyTwoWeekHigh, fiftyTwoWeekLow }
 */
router.get('/quote/:symbol', async (req: Request, res: Response): Promise<void> => {
  const rawSymbol = (req.params.symbol as string).toUpperCase();
  const yfSymbol  = rawSymbol.endsWith('.NS') ? rawSymbol : `${rawSymbol}.NS`;

  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(yfSymbol)}&range=1d&interval=1m&cb=${Date.now()}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT_CHART, 'Accept': 'application/json' },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Yahoo Spark returned HTTP ${upstream.status}` });
      return;
    }

    const data    = await upstream.json() as any;
    const results = data?.spark?.result || [];
    const sparkObj = results.find((r: any) => r?.response?.[0]?.meta?.symbol === yfSymbol);
    const meta     = sparkObj?.response?.[0]?.meta;

    if (!meta) {
      res.status(404).json({ error: 'Symbol not found' });
      return;
    }

    const price      = meta.regularMarketPrice ?? 0;
    const prevClose  = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change     = parseFloat((price - prevClose).toFixed(2));
    const changePct  = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

    res.json({
      symbol:           yfSymbol,
      price:            parseFloat(price.toFixed(2)),
      open:             parseFloat((meta.regularMarketOpen   ?? price).toFixed(2)),
      dayHigh:          parseFloat((meta.regularMarketDayHigh ?? price).toFixed(2)),
      dayLow:           parseFloat((meta.regularMarketDayLow  ?? price).toFixed(2)),
      previousClose:    parseFloat(prevClose.toFixed(2)),
      change,
      changePercent:    changePct,
      volume:           meta.regularMarketVolume ?? 0,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow:  meta.fiftyTwoWeekLow  ?? 0,
    });
  } catch (err: any) {
    logger.error(`[quote] Failed for ${yfSymbol}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;

