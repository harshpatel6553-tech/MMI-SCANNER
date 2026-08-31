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
import { newsService } from '../services/newsService.js';
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

    // Handle admin forcing all clients to refresh
    socket.on('admin:force-refresh-all', () => {
      if (adminSockets.has(socket.id)) {
        logger.warn(`dY"O Admin ${socket.id} triggered a global force refresh!`);
        io.emit('server:force_refresh');
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
    
    // Handle manual news requests
    socket.on('news:request_snapshot', () => {
      socket.emit('news:snapshot', newsService.getLatestNews());
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

const lastBroadcastState = new Map<string, string>();
let lastStatusBroadcastTime = 0;

/**
 * Broadcast stock updates and alerts to all connected clients.
 */
export function broadcastStockUpdate(
  io: TypedServer,
  stocks: StockData[],
  alerts: StockAlert[] = []
): void {
  try {
    const changedStocks: StockData[] = [];
    
    // Compute deltas (only stocks that actually changed price/volume/etc.)
    for (const stock of stocks) {
      const stockStr = JSON.stringify(stock);
      if (lastBroadcastState.get(stock.symbol) !== stockStr) {
        changedStocks.push(stock);
        lastBroadcastState.set(stock.symbol, stockStr);
      }
    }

    const shouldBroadcastStatus = Date.now() - lastStatusBroadcastTime > 30000;
    
    if (changedStocks.length === 0 && alerts.length === 0 && !shouldBroadcastStatus) {
      return; // Conserve massive amounts of bandwidth
    }

    if (shouldBroadcastStatus) {
      lastStatusBroadcastTime = Date.now();
    }

    const sockets = io.sockets.sockets;

    for (const [, socket] of sockets) {
      const typedSocket = socket as TypedSocket;
      const subscription = typedSocket.data.subscription || 'ALL';

      if (changedStocks.length > 0) {
        const filteredDeltas = filterStocksBySubscription(changedStocks, subscription);
        if (filteredDeltas.length > 0) {
          typedSocket.emit('stocks:update:partial', filteredDeltas);
        }
      }

      if (shouldBroadcastStatus || changedStocks.length > 0) {
        typedSocket.emit('connection:status', {
          connected: true,
          stockCount: stocks.length,
          lastUpdate: new Date().toISOString(),
        });
      }
    }

    for (const alert of alerts) {
      io.emit('alert:new', alert);
    }

    if (changedStocks.length > 0 || alerts.length > 0) {
      logger.debug(
        `Broadcasted ${changedStocks.length} deltas and ${alerts.length} alerts to ${sockets.size} clients`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Error broadcasting stock update: ${message}`);
  }
}
