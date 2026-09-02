/**
 * @module types
 * @description Core type definitions for the Nifty Stock Screener backend.
 * All interfaces are shared across services, routes, and socket handlers.
 */

/** Minimal stock identifier used in static stock lists */
export interface StockQuote {
  /** NSE trading symbol (e.g. "RELIANCE") */
  symbol: string;
  /** Full company name (e.g. "Reliance Industries") */
  name: string;
}

/** Complete real-time stock data enriched from Yahoo Finance */
export interface StockData {
  /** NSE trading symbol */
  symbol: string;
  /** Full company name */
  name: string;
  /** Current market price (₹) */
  price: number;
  /** Previous trading day close price (₹) */
  previousClose: number;
  /** Market open price for today (₹) */
  open: number;
  /** Intraday high (₹) */
  dayHigh: number;
  /** Intraday low (₹) */
  dayLow: number;
  /** Absolute price change from previous close (₹) */
  change: number;
  /** Percentage change from previous close */
  changePercent: number;
  /** Total traded volume */
  volume: number;
  /** Stock sector category */
  sector: string;
  /** Average daily volume (3-month or 10-day from Yahoo Finance) */
  averageVolume: number;
  /** Relative volume: current volume / average volume */
  relativeVolume: number;
  /** Whether volume is spiking (relativeVolume >= 2.0) */
  volumeSpike: boolean;
  /** Index membership */
  indexName: 'NIFTY50' | 'NIFTY500' | 'INDEX';
  /** Last update timestamp in ISO 8601 format */
  lastUpdated: string;
  /** Whether current price is at or near the day's high */
  atDayHigh: boolean;
  /** Whether current price is at or near the day's low */
  atDayLow: boolean;
  /** 52-week high price */
  fiftyTwoWeekHigh: number;
  /** 52-week low price */
  fiftyTwoWeekLow: number;
  /** Market capitalization */
  marketCap: number;
  /** Weekly MACD Buy signal */
  macdWeeklyBuy?: boolean;
  /** Daily RSI (14) Value */
  rsiDaily?: number;
  /** Daily EMA (13, 34) Bullish Crossover */
  emaCrossDaily?: boolean;
}

/** Alert generated when a stock hits its intraday high or low */
export interface StockAlert {
  /** Unique alert identifier (UUID v4) */
  id: string;
  /** NSE trading symbol */
  symbol: string;
  /** Full company name */
  name: string;
  /** Type of price alert */
  alertType: 'DAY_HIGH' | 'DAY_LOW' | 'VOLUME_SPIKE' | 'NEWS';
  /** Price at which the alert was triggered (₹) */
  price: number;
  /** Percentage change of the stock at the time the alert was triggered */
  changePercent?: number;
  /** Alert creation timestamp in ISO 8601 format */
  createdAt: string;
}

/** Client-side filter/query options for stock screening */
export interface FilterOptions {
  /** Filter by index membership */
  index: 'ALL' | 'NIFTY50' | 'NIFTY500';
  /** Minimum price filter (₹) */
  priceMin?: number;
  /** Maximum price filter (₹) */
  priceMax?: number;
  /** Minimum volume filter */
  volumeMin?: number;
  /** Minimum change percent filter */
  changePercentMin?: number;
  /** Maximum change percent filter */
  changePercentMax?: number;
  /** Free-text search against symbol or company name */
  search?: string;
}

/** Socket.IO events emitted from server to client */
export interface ServerToClientEvents {
  /** Batch stock data update (Legacy) */
  'stocks:update': (data: StockData[]) => void;
  /** Full baseline state update for Delta Architecture */
  'stocks:update:full': (data: StockData[]) => void;
  /** Partial update containing only changed full stocks */
  'stocks:update:partial': (data: StockData[]) => void;
  /** Partial delta update containing only changed stocks */
  'stocks:update:delta': (data: Partial<StockData>[]) => void;
  /** New price alert notification */
  'alert:new': (alert: StockAlert) => void;
  /** Silent notification to refetch news after background AI processing */
  'news:update': () => void;
  /** Direct transmission of the complete news array */
  'news:snapshot': (data: any[]) => void;
  /** Server connection status heartbeat */
  'connection:status': (status: {
    connected: boolean;
    stockCount: number;
    lastUpdate: string;
  }) => void;
  /** Live online users list (admin only) */
  'admin:online-users': (users: { email: string; connectedAt: string }[]) => void;
  /** Force all clients to immediately refresh their browser */
  'server:force_refresh': () => void;
}

/** Socket.IO events emitted from client to server */
export interface ClientToServerEvents {
  /** Subscribe to updates for a specific index or all */
  'subscribe:index': (index: 'NIFTY50' | 'NIFTY500' | 'ALL') => void;
  /** Explicitly request the latest news snapshot */
  'news:request_snapshot': () => void;
  /** Identify the connected user by email */
  'auth:identify': (data: { email: string; isAdmin?: boolean }) => void;
  /** Admin requests the current online user list */
  'admin:request-online-users': () => void;
  /** Admin triggers a global refresh of all clients */
  'admin:force-refresh-all': () => void;
}
