/**
 * @module index
 * @description Main entry point for the Nifty Stock Screener backend server.
 *
 * Bootstraps Express + Socket.IO, mounts REST routes, starts polling loops
 * for Nifty 50 and Nifty 500 data, and handles graceful shutdown.
 *
 * Architecture:
 * - Express serves the REST API at /api/*
 * - Socket.IO streams real-time stock updates to connected clients
 * - yahoo-finance2 fetches live NSE quotes on configurable intervals
 * - Supabase (optional) persists stock snapshots and alerts
 */

import 'dotenv/config';

import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';

import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from './types/index.js';
import { testConnection, supabase, isSupabaseConfigured } from './config/supabase.js';
import { isMarketOpen } from './utils/marketHours.js';
import logger from './utils/logger.js';
import stockRoutes from './routes/stockRoutes.js';
import { newsRoutes } from './routes/newsRoutes.js';
import dealsRoutes from './routes/dealsRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';
import { stockService } from './services/stockService.js';
import { alertService } from './services/alertService.js';
import { newsService } from './services/newsService.js';
import { screenerService } from './services/screenerService.js';
import { calendarService } from './services/calendarService.js';
import { twitterService } from './services/twitterService.js';
import {
  setupSocketHandlers,
  broadcastStockUpdate,
} from './sockets/stockSocket.js';

// ── Configuration ──────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '5000', 10);
const NIFTY50_POLL_INTERVAL = parseInt(
  process.env.NIFTY50_POLL_INTERVAL || '2000',
  10
);
const NIFTY500_POLL_INTERVAL = parseInt(
  process.env.NIFTY500_POLL_INTERVAL || '3000',
  10
);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://mmi-scanner.vercel.app',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

// ── Express Setup ──────────────────────────────────────────────

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  })
);

app.use(express.json());

// Serve static frontend files if they exist (for Electron Desktop App)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // Keep the root route handling below for API checks if needed,
  // but static files will take precedence.
}

// ── HTTP & Socket.IO Server ────────────────────────────────────

const httpServer = http.createServer(app);

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
  httpServer,
  {
    cors: {
      origin: '*', // Allow all origins for the desktop app
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  }
);

// ── Socket Handlers ────────────────────────────────────────────

setupSocketHandlers(io);

// ── REST Routes ────────────────────────────────────────────────

app.use('/api/stocks', stockRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/settings', settingsRoutes);

// SPA Fallback for React Router (Electron Desktop App)
if (fs.existsSync(clientDistPath)) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// ── News Alerts ────────────────────────────────────────────────

newsService.on('news:alert', (news) => {
  io.emit('alert:new', {
    id: `news-${news.id}`,
    symbol: news.source,
    name: news.title,
    alertType: 'NEWS',
    price: 0,
    createdAt: new Date(news.pubDate || Date.now()).toISOString()
  });
});

import * as paperTradingController from './controllers/paperTradingController.js';

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Paper Trading Gamification ─────────────────────────────────
app.get('/api/paper-trading/portfolio/:userId', paperTradingController.getPortfolio);
app.post('/api/paper-trading/trade', paperTradingController.executeTrade);
app.get('/api/paper-trading/leaderboard', paperTradingController.getLeaderboard);

// ── Admin Tools ────────────────────────────────────────────────
app.post('/api/admin/force-refresh', (req: Request, res: Response) => {
  // In a real app, verify admin token here. For this request, we leave it open.
  io.emit('server:force_refresh');
  logger.info('Admin triggered a global force-refresh to all connected clients.');
  res.json({ success: true, message: 'Refresh command broadcasted to all users.' });
});


// Fundamental Data API
app.get('/api/stocks/:symbol/fundamentals', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    
    const fundamentals = await screenerService.getFundamentals(symbol);
    if (!fundamentals) {
      return res.status(404).json({ error: 'Fundamentals not found' });
    }
    res.json(fundamentals);
  } catch (err) {
    logger.error(`Error fetching fundamentals for ${req.params.symbol}:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Earnings Calendar ───────────────────────────────────────────

app.get('/api/calendar/today', async (req: Request, res: Response) => {
  try {
    const calendar = await calendarService.getExpectedToday();
    res.json({ success: true, data: calendar });
  } catch (err) {
    logger.error('Error fetching calendar:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Twitter Live News ──────────────────────────────────────────

app.get('/api/twitter/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    
    const tweets = await twitterService.getUserTweets(userId);
    res.json(tweets);
  } catch (err) {
    logger.error(`Error fetching tweets for ${req.params.userId}:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Root endpoint ──────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    name: 'Nifty Stock Screener API',
    version: '1.0.0',
    endpoints: {
      stocks: '/api/stocks',
      stockBySymbol: '/api/stocks/:symbol',
      alerts: '/api/alerts',
      health: '/api/health',
    },
    websocket: `ws://localhost:${PORT}`,
  });
});

// ── Supabase Upsert Helper ─────────────────────────────────────

/**
 * Upsert stock data to the Supabase `stocks` table.
 * Fire-and-forget — errors are logged but do not interrupt the polling loop.
 *
 * @param stocks - Array of stock data to persist
 */
async function upsertStocksToSupabase(
  stocks: import('./types/index.js').StockData[]
): Promise<void> {
  if (!isSupabaseConfigured || stocks.length === 0) {
    return;
  }

  try {
    const { error } = await supabase.from('stocks').upsert(
      stocks.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        price: s.price,
        previous_close: s.previousClose,
        open_price: s.open,
        day_high: s.dayHigh,
        day_low: s.dayLow,
        change: s.change,
        change_percent: s.changePercent,
        volume: s.volume,
        sector: s.sector,
        average_volume: s.averageVolume,
        relative_volume: s.relativeVolume,
        volume_spike: s.volumeSpike,
        index_name: s.indexName,
        at_day_high: s.atDayHigh,
        at_day_low: s.atDayLow,
        fifty_two_week_high: s.fiftyTwoWeekHigh,
        fifty_two_week_low: s.fiftyTwoWeekLow,
        market_cap: s.marketCap,
        last_updated: s.lastUpdated,
      })),
      { onConflict: 'symbol' }
    );

    if (error) {
      logger.error(`Supabase stock upsert failed: ${error.message}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Supabase stock upsert error: ${message}`);
  }
}

// ── Polling Loops ──────────────────────────────────────────────

/** Track interval IDs for graceful shutdown */
let nifty50Interval: ReturnType<typeof setInterval> | null = null;
let nifty500Interval: ReturnType<typeof setInterval> | null = null;

/** Guard against overlapping poll cycles */
let isNifty50Polling = false;
let isNifty500Polling = false;

/**
 * Execute a single Nifty 50 polling cycle.
 * Fetches quotes, checks for alerts, upserts to DB, and broadcasts.
 */
async function pollNifty50(isInitial = false): Promise<void> {
  if (isNifty50Polling) {
    logger.debug('Nifty 50 poll skipped — previous cycle still running');
    return;
  }
  
  if (!isInitial && !isMarketOpen()) {
    logger.debug('Nifty 50 poll skipped — market is closed');
    const allCached = stockService.getCachedStocks();
    broadcastStockUpdate(io, allCached, []);
    isNifty50Polling = false;
    return;
  }

  isNifty50Polling = true;
  const startTime = Date.now();

  try {
    // 1. Fetch quotes from Yahoo Finance
    const stocks = await stockService.fetchNifty50();

    // 1b. Fetch NIFTY 50 & Bank NIFTY index data for Day High/Low alerts
    const indexData = await stockService.fetchIndices();

    // 2. Check for day-high/low alerts (stocks + indices)
    const stockAlerts = alertService.checkAndGenerateAlerts(stocks);
    const indexAlerts = alertService.checkAndGenerateAlerts(indexData);
    const alerts = [...stockAlerts, ...indexAlerts];

    // 3. Upsert to Supabase (fire-and-forget)
    upsertStocksToSupabase(stocks);

    // 4. Broadcast via Socket.IO
    const allCached = stockService.getCachedStocks();
    broadcastStockUpdate(io, allCached, alerts);

    // 5. Log results
    const duration = Date.now() - startTime;
    logger.info(
      `📊 Nifty 50 poll complete: ${stocks.length} stocks, ${alerts.length} alerts, ${duration}ms`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Nifty 50 poll error: ${message}`);
  } finally {
    isNifty50Polling = false;
  }
}

/**
 * Execute a single Nifty 500 polling cycle.
 * Fetches quotes for non-Nifty-50 stocks, checks alerts, upserts, and broadcasts.
 */
async function pollNifty500(isInitial = false): Promise<void> {
  if (isNifty500Polling) {
    logger.debug('Nifty 500 poll skipped — previous cycle still running');
    return;
  }
  
  if (!isInitial && !isMarketOpen()) {
    logger.debug('Nifty 500 poll skipped — market is closed');
    const allCached = stockService.getCachedStocks();
    broadcastStockUpdate(io, allCached, []);
    isNifty500Polling = false;
    return;
  }

  isNifty500Polling = true;
  const startTime = Date.now();

  try {
    // 1. Fetch quotes from Yahoo Finance (non-Nifty50 stocks only)
    const stocks = await stockService.fetchNifty500();

    // 2. Check for day-high/low alerts
    const alerts = alertService.checkAndGenerateAlerts(stocks);

    // 3. Upsert to Supabase (fire-and-forget)
    upsertStocksToSupabase(stocks);

    // 4. Broadcast via Socket.IO
    const allCached = stockService.getCachedStocks();
    broadcastStockUpdate(io, allCached, alerts);

    // 5. Log results
    const duration = Date.now() - startTime;
    logger.info(
      `📊 Nifty 500 poll complete: ${stocks.length} stocks, ${alerts.length} alerts, ${duration}ms`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Nifty 500 poll error: ${message}`);
  } finally {
    isNifty500Polling = false;
  }
}

// ── Graceful Shutdown ──────────────────────────────────────────

/**
 * Gracefully shut down the server: stop polling, close connections.
 */
function shutdown(): void {
  logger.info('🛑 Shutting down server...');

  // Clear polling intervals
  if (nifty50Interval) {
    clearInterval(nifty50Interval);
    nifty50Interval = null;
  }
  if (nifty500Interval) {
    clearInterval(nifty500Interval);
    nifty500Interval = null;
  }

  // Close Socket.IO
  io.close(() => {
    logger.info('Socket.IO server closed');
  });

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { technicalService } from './services/technicalService.js';

// ── Server Startup ─────────────────────────────────────────────

/**
 * Preload the in-memory cache with the last known stock state from Supabase.
 * This completely eliminates the 10-second "loading skeleton" wait time on the 
 * frontend during cold server restarts by immediately serving the last known prices.
 */
async function loadInitialStocksFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return;
  
  try {
    const { data, error } = await supabase
      .from('stocks')
      .select('*');
      
    if (error) {
      logger.error('Failed to preload stocks from Supabase:', error);
      return;
    }
    
    if (data && data.length > 0) {
      // Map snake_case db columns back to camelCase StockData format
      for (const row of data) {
        const stockData: import('./types/index.js').StockData = {
          symbol: row.symbol,
          name: row.name,
          price: row.price,
          previousClose: row.previous_close,
          open: row.open_price,
          dayHigh: row.day_high,
          dayLow: row.day_low,
          change: row.change,
          changePercent: row.change_percent,
          volume: row.volume,
          sector: row.sector,
          averageVolume: row.average_volume,
          relativeVolume: row.relative_volume,
          volumeSpike: row.volume_spike,
          indexName: row.index_name,
          atDayHigh: row.at_day_high,
          atDayLow: row.at_day_low,
          fiftyTwoWeekHigh: row.fifty_two_week_high,
          fiftyTwoWeekLow: row.fifty_two_week_low,
          marketCap: row.market_cap,
          lastUpdated: row.updated_at || new Date().toISOString(),
          ...(technicalService.getTechnicals(row.symbol) || { macdWeeklyBuy: false, rsiDaily: 50, emaCrossDaily: false })
        };
        stockService.preloadStock(stockData);
      }
      logger.info(`⚡ Preloaded ${data.length} stocks from Supabase instantly!`);
    }
  } catch (err) {
    logger.error('Exception preloading stocks:', err);
  }
}

/**
 * Initialize and start the server.
 */
async function startServer(): Promise<void> {
  try {
    // Test Supabase connection
    const supabaseOk = await testConnection();
    if (!supabaseOk) {
      logger.warn(
        '⚠️  Running without Supabase — stock data will not be persisted'
      );
    }

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info('═══════════════════════════════════════════════');
      logger.info(`🚀 Nifty Stock Screener Server v1.0.0`);
      logger.info(`   REST API:   http://localhost:${PORT}/api`);
      logger.info(`   WebSocket:  ws://localhost:${PORT}`);
      logger.info(`   Health:     http://localhost:${PORT}/api/health`);
      logger.info(`   Supabase:   ${supabaseOk ? '✅ Connected' : '⚠️  Not configured'}`);
      logger.info(`   Nifty 50:   polling every ${NIFTY50_POLL_INTERVAL}ms`);
      logger.info(`   Nifty 500:  polling every ${NIFTY500_POLL_INTERVAL}ms`);
      logger.info('═══════════════════════════════════════════════');
    });

    // ⚡ INSTANT PRELOAD FROM SUPABASE
    // This allows clients connecting right now to instantly see the last known prices
    // instead of waiting 10-15 seconds for the Yahoo Finance scraping to complete.
    logger.info('📦 Loading last known state from database...');
    await loadInitialStocksFromSupabase();
    
    
    // Start Weekly MACD Calculation Loop (Runs every hour)
    logger.info('🔄 Starting Technical MACD background calculation...');
    technicalService.updateAllStocksTechnicals();
    setInterval(() => technicalService.updateAllStocksTechnicals(), 60 * 60 * 1000);

    // Initial fetch — run immediately
    logger.info('🔄 Starting initial Nifty 50 data fetch...');
    await pollNifty50(true);

    // Start Nifty 500 initial fetch after Nifty 50 completes
    logger.info('🔄 Starting initial Nifty 500 data fetch...');
    await pollNifty500(true);

    // Start polling intervals
    nifty50Interval = setInterval(pollNifty50, NIFTY50_POLL_INTERVAL);
    nifty500Interval = setInterval(pollNifty500, NIFTY500_POLL_INTERVAL);

    logger.info('✅ Polling loops started');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to start server: ${message}`);
    process.exit(1);
  }
}

startServer();
