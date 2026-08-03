import WebSocket from 'ws';
import { Server } from 'socket.io';

const WS_URL = 'wss://ws-prices.indstocks.com/api/v1/ws/prices';
let jainamWs: WebSocket | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let ioInstance: Server | null = null;

// Mock list of Large Cap symbols (in reality, this would be fetched from a DB or NSE list)
const LARGE_CAP_SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'SBI', 'BHARTIARTL', 'ITC', 'HINDUNILVR', 'L&T'];

// Thresholds in Rupees
const LARGE_CAP_THRESHOLD = 1000000; // 10 Lakhs
const SMALL_MID_CAP_THRESHOLD = 500000; // 5 Lakhs

export const initJainamSocket = (io: Server) => {
  ioInstance = io;
  const accessToken = process.env.JAINAM_ACCESS_TOKEN;

  if (!accessToken) {
    console.warn('⚠️ JAINAM_ACCESS_TOKEN is missing in .env. Whale Detector will remain inactive.');
    return;
  }

  connectToJainam(accessToken);
};

const connectToJainam = (token: string) => {
  console.log('Connecting to Jainam WebSocket...');
  jainamWs = new WebSocket(WS_URL, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  jainamWs.on('open', () => {
    console.log('✅ Connected to Jainam Live Market Feed');
    
    // Subscribe to top volatile/active stocks (using a sample array, since max may be 500)
    // Jainam format is usually Exchange:Symbol, e.g. NSE:RELIANCE
    const subscribeMsg = JSON.stringify({
      action: 'subscribe',
      mode: 'ltp',
      instruments: ['NSE:RELIANCE', 'NSE:HDFCBANK', 'NSE:TCS', 'NSE:INFY', 'NSE:SUZLON', 'NSE:YESBANK']
    });
    
    jainamWs?.send(subscribeMsg);

    // Keep connection alive with heartbeat every 60s
    heartbeatInterval = setInterval(() => {
      if (jainamWs?.readyState === WebSocket.OPEN) {
        jainamWs.send(JSON.stringify({ heartbeat: 'h' }));
      }
    }, 60000);
  });

  jainamWs.on('message', (data: WebSocket.RawData) => {
    try {
      const parsed = JSON.parse(data.toString());
      
      // Typical Jainam response format for LTP feed (exact fields depend on their specific API version)
      // Usually contains symbol, last_price, last_quantity, etc.
      if (parsed && parsed.data) {
        // Handle array or single object
        const updates = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
        
        updates.forEach(update => {
          if (!update.symbol || !update.last_price || !update.last_quantity) return;
          
          const symbol = update.symbol.replace('NSE:', '');
          const tradeValue = update.last_price * update.last_quantity;
          
          const isLargeCap = LARGE_CAP_SYMBOLS.includes(symbol);
          const threshold = isLargeCap ? LARGE_CAP_THRESHOLD : SMALL_MID_CAP_THRESHOLD;
          
          if (tradeValue >= threshold) {
            console.log(`🚨 WHALE ALERT DETECTED: ${symbol} | Value: ₹${tradeValue.toLocaleString()}`);
            
            // Emit to all connected clients on the frontend
            ioInstance?.emit('WHALE_ALERT', {
              symbol,
              price: update.last_price,
              quantity: update.last_quantity,
              totalValue: tradeValue,
              timestamp: new Date().toISOString(),
              isLargeCap
            });
          }
        });
      }
    } catch (error) {
      // Ignore parse errors from pure string heartbeats if any
    }
  });

  jainamWs.on('close', () => {
    console.log('❌ Jainam WebSocket disconnected. Reconnecting in 5s...');
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    setTimeout(() => connectToJainam(token), 5000);
  });

  jainamWs.on('error', (err) => {
    console.error('Jainam WebSocket Error:', err.message);
  });
};
