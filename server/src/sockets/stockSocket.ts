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
function filterStocksBySubscription<T extends Partial<StockData>>(
  stocks: T[],
  subscription: 'NIFTY50' | 'NIFTY500' | 'ALL'
): T[] {
  if (subscription === 'ALL') {
    return stocks;
  }
  return stocks.filter((s) => {
    // For delta updates, indexName might be undefined. Look it up in lastBroadcastState.
    const indexName = s.indexName ?? lastBroadcastState.get(s.symbol!)?.indexName;
    return indexName === subscription;
  });
}

/** Track online users: socketId -> { email, connectedAt } */
const onlineUsers: Map<string, { email: string; connectedAt: string }> = new Map();

/** Set of admin socket IDs that should receive live user updates */
const adminSockets: Set<string> = new Set();

/** Helper: get the deduplicated online user list */
function getOnlineUserList(): { email: string; connectedAt: string }[] {
  const seen = new Set<string>();
  const result: { email: string; connectedAt: string }[] = [];
  for (const user of onlineUsers.values()) {
    if (!seen.has(user.email)) {
      seen.add(user.email);
      result.push(user);
    }
  }
  return result;
}

/** Broadcast online user list to all admin sockets */
function broadcastOnlineUsersToAdmins(io: TypedServer): void {
  const userList = getOnlineUserList();
  for (const adminId of adminSockets) {
    const adminSocket = io.sockets.sockets.get(adminId);
    if (adminSocket) {
      (adminSocket as TypedSocket).emit('admin:online-users', userList);
    }
  }
}

/**
 * Set up Socket.IO event handlers for the stock screener.
 *
 * On each client connection:
 * - Defaults subscription to 'ALL'
 * - Sends an initial snapshot of all cached stock data
 * - Emits a `connection:status` event with server state
 * - Listens for `subscribe:index` to update the client's filter preference
 * - Listens for `auth:identify` to track the user's email
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

    // Handle user identification
    socket.on('auth:identify', (data) => {
      if (data?.email) {
        onlineUsers.set(socket.id, {
          email: data.email,
          connectedAt: new Date().toISOString(),
        });
        logger.info(`👤 User identified: ${data.email} (${socket.id})`);

        // If user is admin, add to admin sockets
        if (data.isAdmin) {
          adminSockets.add(socket.id);
        }

        // Notify all admins about the updated user list
        broadcastOnlineUsersToAdmins(io);
      }
    });

    // Handle admin requesting online users
    socket.on('admin:request-online-users', () => {
      if (adminSockets.has(socket.id)) {
        const userList = getOnlineUserList();
        socket.emit('admin:online-users', userList);
      }
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
      socket.emit('stocks:update:full', subscriptionStocks);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      const userData = onlineUsers.get(socket.id);
      onlineUsers.delete(socket.id);
      adminSockets.delete(socket.id);
      logger.info(`🔌 Client disconnected: ${socket.id}${userData ? ` (${userData.email})` : ''} (${reason})`);

      // Notify all admins about the updated user list
      broadcastOnlineUsersToAdmins(io);
    });
  });
}

/** Cache of the last state sent to clients to compute deltas */
const lastBroadcastState: Map<string, StockData> = new Map();

/**
 * Broadcast stock updates and alerts to all connected clients.
 * Uses a Delta Architecture to only send stocks that have actually changed.
 */
export function broadcastStockUpdate(
  io: TypedServer,
  stocks: StockData[],
  alerts: StockAlert[] = []
): void {
  try {
    const deltaStocks: Partial<StockData>[] = [];

    // 1. Calculate the Delta (Only what changed)
    for (const stock of stocks) {
      const last = lastBroadcastState.get(stock.symbol);
      
      if (!last) {
        // First time seeing this stock: send the full object
        deltaStocks.push(stock);
        lastBroadcastState.set(stock.symbol, { ...stock });
      } else {
        // Compare fields and build a true delta object
        let hasChanges = false;
        const diff: Partial<StockData> = { symbol: stock.symbol };

        if (last.price !== stock.price) { diff.price = stock.price; hasChanges = true; }
        if (last.volume !== stock.volume) { diff.volume = stock.volume; hasChanges = true; }
        if (last.dayHigh !== stock.dayHigh) { diff.dayHigh = stock.dayHigh; hasChanges = true; }
        if (last.dayLow !== stock.dayLow) { diff.dayLow = stock.dayLow; hasChanges = true; }
        if (last.change !== stock.change) { diff.change = stock.change; hasChanges = true; }
        if (last.changePercent !== stock.changePercent) { diff.changePercent = stock.changePercent; hasChanges = true; }
        if (last.volumeSpike !== stock.volumeSpike) { diff.volumeSpike = stock.volumeSpike; hasChanges = true; }
        if (last.lastUpdated !== stock.lastUpdated) { diff.lastUpdated = stock.lastUpdated; hasChanges = true; }
        // Note: We don't check name, sector, fiftyTwoWeekHigh, etc. because they rarely/never change intraday

        if (hasChanges) {
          deltaStocks.push(diff);
          lastBroadcastState.set(stock.symbol, { ...stock });
        }
      }
    }

    const sockets = io.sockets.sockets;

    // 2. Broadcast the Delta to clients (if there are changes)
    if (deltaStocks.length > 0) {
      for (const [, socket] of sockets) {
        const typedSocket = socket as TypedSocket;
        const subscription = typedSocket.data.subscription || 'ALL';

        const filteredDelta = filterStocksBySubscription(deltaStocks, subscription);
        
        if (filteredDelta.length > 0) {
          typedSocket.emit('stocks:update:delta', filteredDelta);
        }
      }
    }

    // 3. Always broadcast connection status & alerts
    for (const [, socket] of sockets) {
      const typedSocket = socket as TypedSocket;
      typedSocket.emit('connection:status', {
        connected: true,
        stockCount: stocks.length,
        lastUpdate: new Date().toISOString(),
      });
    }

    for (const alert of alerts) {
      io.emit('alert:new', alert);
    }

    if (deltaStocks.length > 0 || alerts.length > 0) {
      logger.debug(
        `Delta Broadcast: ${deltaStocks.length} changed stocks and ${alerts.length} alerts to ${sockets.size} clients`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Error broadcasting stock update: ${message}`);
  }
}
