import { Router, Request, Response } from 'express';
import axios from 'axios';
import { optionChainService } from '../services/optionChainService.js';
import logger from '../utils/logger.js';

const router = Router();
const candleCache = new Map<string, { timestamp: number; data: any }>();

/**
 * GET /api/fno/option-chain
 * Returns full option chain with strike-by-strike OI, Greeks, Max Pain, and Range
 */
router.get('/option-chain', async (req: Request, res: Response) => {
  try {
    const symbol = ((req.query.underlying || req.query.symbol) as string || 'NIFTY').toUpperCase();
    const expiry = req.query.expiry as string | undefined;

    const data = await optionChainService.fetchOptionChain(symbol, expiry);
    if (!data) {
      return res.status(503).json({ success: false, error: 'Option chain data temporarily unavailable' });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    logger.error(`fnoRoutes: Error getting option chain: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/fno/overview (alias for option-chain)
 */
router.get('/overview', (req: Request, res: Response) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(307, `/api/fno/option-chain${query}`);
});

/**
 * GET /api/fno/expiries
 * Returns list of available expiry dates for symbol
 */
router.get('/expiries', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.underlying as string || 'NIFTY').toUpperCase();
    const expiries = await optionChainService.getExpiries(symbol);
    res.json({ success: true, expiries });
  } catch (err: any) {
    logger.error(`fnoRoutes: Error getting expiries: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/fno/oi-alerts
 * Returns live smart money / big money OI moves feed
 */
router.get('/oi-alerts', (req: Request, res: Response) => {
  try {
    const alerts = optionChainService.getAlerts();
    res.json({ success: true, alerts });
  } catch (err: any) {
    logger.error(`fnoRoutes: Error getting oi alerts: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/fno/option-candles
 * Returns real historical intraday candlestick bars for specific option contract
 */
router.get('/option-candles', async (req: Request, res: Response) => {
  try {
    const underlying = ((req.query.underlying || req.query.symbol) as string || 'NIFTY').toUpperCase();
    const strike = req.query.strike as string || '23050';
    const type = ((req.query.type as string) || 'CE').toUpperCase();
    const expiry = (req.query.expiry as string) || '03-Nov-2026';
    const tf = (req.query.tf as string) || '5m';

    const MONTH_CODES: Record<string, string> = {
      JAN: '1', FEB: '2', MAR: '3', APR: '4', MAY: '5', JUN: '6',
      JUL: '7', AUG: '8', SEP: '9', OCT: 'O', NOV: 'N', DEC: 'D'
    };

    const dayMatch = expiry.match(/\b\d{1,2}\b/);
    const day = dayMatch ? dayMatch[0].padStart(2, '0') : '03';
    const monthMatch = expiry.match(/JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/i);
    const mon = monthMatch ? monthMatch[0].toUpperCase() : 'NOV';
    const yearMatch = expiry.match(/\b(20\d\d)\b/);
    let year = '26';
    if (yearMatch) {
      year = yearMatch[1].slice(-2);
    } else {
      const shortYearMatch = expiry.match(/\b\d{2}\b/g);
      if (shortYearMatch && shortYearMatch.length > 1) {
        year = shortYearMatch[shortYearMatch.length - 1];
      }
    }
    const monCode = MONTH_CODES[mon] || 'N';
    const contractSymbol = `${underlying}${year}${monCode}${day}${strike}${type}`;

    const cacheKey = `${contractSymbol}_${tf}`;
    const cached = candleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 15000) {
      return res.json({ success: true, symbol: contractSymbol, candles: cached.data });
    }

    const url = `https://volumelens.com/api/orderflow/historical-candles/${contractSymbol}?tf=${tf}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 6000
    });

    if (response.data) {
      const rawList = Array.isArray(response.data) ? response.data : (response.data.candles || response.data.data || []);
      if (Array.isArray(rawList) && rawList.length > 0) {
        const candles = rawList.map((c: any) => ({
          time: Math.floor(new Date(c.date).getTime() / 1000),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0)
        })).filter(c => !isNaN(c.time) && !isNaN(c.close));

        candleCache.set(cacheKey, { timestamp: Date.now(), data: candles });
        return res.json({ success: true, symbol: contractSymbol, candles });
      }
    }

    res.json({ success: false, error: 'No candles found for contract' });
  } catch (err: any) {
    logger.warn(`fnoRoutes: option-candles fetch error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
