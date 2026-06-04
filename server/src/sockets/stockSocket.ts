/**
 * @module stockSocket
 * @description Socket.IO event handlers for real-time stock data streaming.
 * Manages client connections, subscription preferences, and broadcast logic.
 */

import type { Server, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  StockData,
  StockAlert,
} from '../types/index.js';
import { stockService } from '../services/stockService.js';
import logger from '../utils/logger.js';

/** Extended socket data to store per-client subscription preferences */
interface SocketData {
  subscription: 'NIFTY50' | 'NIFTY500' | 'ALL';
}

/** Typed Socket.IO server */
type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** Typed Socket.IO socket */
type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/**
 * Filter stocks based on a client's subscription preference.
 *
 * @param stocks - Full array of stock data
 * @param subscription - Client subscription type
 * @returns Filtered stock array
 */
function filterStocksBySubscription(
  stocks: StockData[],
  subscription: 'NIFTY50' | 'NIFTY500' | 'ALL'
): StockData[] {
  if (subscription === 'ALL') {
    return stocks;
  }
  return stocks.filter((s) => s.indexName === subscription);
}

/**
 * Set up Socket.IO event handlers for the stock screener.
 *
 * On each client connection:
 * - Defaults subscription to 'ALL'
 * - Sends an initial snapshot of all cached stock data
 * - Emits a `connection:status` event with server state
 * - Listens for `subscribe:index` to update the client's filter preference
 * - Logs connection and disconnection events
 *
 * @param io - The Socket.IO server instance
 *
 * @example
 * ```typescript
 * import { setupSocketHandlers } from './stockSocket.js';
 * setupSocketHandlers(io);
 * ```
 */
export function setupSocketHandlers(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    logger.info(`🔌 Client connected: ${socket.id}`);

    // Set default subscription
    socket.data.subscription = 'ALL';

    // Send initial stock snapshot
    const cachedStocks = stockService.getCachedStocks();
    const filtered = filterStocksBySubscription(
      cachedStocks,
      socket.data.subscription
    );
    socket.emit('stocks:update', filtered);

    // Send connection status
    socket.emit('connection:status', {
      connected: true,
      stockCount: cachedStocks.length,
      lastUpdate: new Date().toISOString(),
    });

    // Handle subscription changes
    socket.on('subscribe:index', (index) => {
      const validIndices = ['NIFTY50', 'NIFTY500', 'ALL'] as const;

      if (!validIndices.includes(index)) {
        logger.warn(
          `Client ${socket.id} sent invalid subscription: ${index}`
        );
        return;
      }

      socket.data.subscription = index;
      logger.info(`Client ${socket.id} subscribed to ${index}`);

      // Send filtered stocks for the new subscription
      const stocks = stockService.getCachedStocks();
      const subscriptionStocks = filterStocksBySubscription(stocks, index);
      socket.emit('stocks:update', subscriptionStocks);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`🔌 Client disconnected: ${socket.id} (${reason})`);
    });
  });
}

/**
 * Broadcast stock updates and alerts to all connected clients.
 *
 * Each client receives only the stocks matching their current subscription
 * preference. Alerts are broadcast to ALL connected clients regardless of
 * subscription.
 *
 * @param io - The Socket.IO server instance
 * @param stocks - Updated stock data to broadcast
 * @param alerts - New alerts to broadcast (optional)
 *
 * @example
 * ```typescript
 * const updatedStocks = await stockService.fetchNifty50();
 * const newAlerts = alertService.checkAndGenerateAlerts(updatedStocks);
 * broadcastStockUpdate(io, updatedStocks, newAlerts);
 * ```
 */
export function broadcastStockUpdate(
  io: TypedServer,
  stocks: StockData[],
  alerts: StockAlert[] = []
): void {
  try {
    const sockets = io.sockets.sockets;

    for (const [, socket] of sockets) {
      const typedSocket = socket as TypedSocket;
      const subscription = typedSocket.data.subscription || 'ALL';

      // Send filtered stock data based on client subscription
      const filtered = filterStocksBySubscription(stocks, subscription);
      typedSocket.emit('stocks:update', filtered);

      // Send connection status
      typedSocket.emit('connection:status', {
        connected: true,
        stockCount: stocks.length,
        lastUpdate: new Date().toISOString(),
      });
    }

    // Broadcast alerts to ALL connected clients
    for (const alert of alerts) {
      io.emit('alert:new', alert);
    }

    if (alerts.length > 0) {
      logger.debug(
        `Broadcast ${stocks.length} stocks and ${alerts.length} alerts to ${sockets.size} clients`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Error broadcasting stock update: ${message}`);
  }
}
